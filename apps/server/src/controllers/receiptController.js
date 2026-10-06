const Receipt = require("../models/Receipt");
const Transaction = require("../models/Transaction");
const Comment = require("../models/Comment");
const { logAction } = require("../services/audit");
const { notify, notifyRole } = require("../services/notifications");
const { publish, publishToRole } = require("../services/events");
const { isString, isNonEmptyString } = require("../utils/validate");

// Receipt review — the Review and Approval Workflow (spec section 5).
//
//   1. The owner of an entry attaches a receipt or proof of payment: an
//      uploaded image/PDF, or a link to a file in Google Drive, OneDrive or
//      Dropbox. The receipt is set to "For Review" automatically, and every
//      Reviewer is notified (workflow automation + notification).
//   2. A Reviewer verifies it, rejects it, or asks for a revision (a clearer
//      photo, the right document). The owner is notified, the decision is a
//      note on the entry, and it is written to the audit log.
//   3. After "Needs Revision" or "Rejected" the owner attaches a new version
//      (v2, v3 …); the earlier version is kept. A "Verified" receipt is final.
//
// The entry itself counts in the balance from the moment it is recorded;
// what is reviewed is the evidence behind it.

const MAX_BYTES = 2 * 1024 * 1024;
// Allowed file types, each with the bytes its files start with. The declared
// type is not trusted on its own: a program renamed to receipt.png fails here.
const SIGNATURES = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (b) => b.slice(0, 4).toString("latin1") === "RIFF" && b.slice(8, 12).toString("latin1") === "WEBP",
  "application/pdf": (b) => b.slice(0, 5).toString("latin1") === "%PDF-",
};
const PROVIDERS = [
  [/(^|\.)drive\.google\.com$|(^|\.)docs\.google\.com$/, "Google Drive"],
  [/(^|\.)onedrive\.live\.com$|(^|\.)1drv\.ms$|(^|\.)sharepoint\.com$/, "OneDrive"],
  [/(^|\.)dropbox\.com$|(^|\.)db\.tt$/, "Dropbox"],
];
// Entries a receipt can be attached to: the current version, not an earlier
// or deleted one.
const CURRENT = ["Approved", "Needs Revision"];
// A new version may replace one still waiting, or one sent back.
const REPLACEABLE = ["For Review", "Needs Revision", "Rejected"];
const DECISIONS = {
  verify: { status: "Verified", audit: "Receipt Verified", type: "receipt-verified", verb: "verified" },
  reject: { status: "Rejected", audit: "Receipt Rejected", type: "receipt-rejected", verb: "rejected" },
  revision: { status: "Needs Revision", audit: "Receipt Revision Requested", type: "receipt-revision", verb: "sent back for revision" },
};

const peso = (n) => "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const describe = (tx) => `${tx.type.toLowerCase()} of ${peso(tx.amount)} (${tx.category}, ${tx.date})`;

// What a person sees of a receipt: everything but the file itself.
function publicReceipt(r) {
  const { data, __v, ...rest } = r.toObject ? r.toObject() : r;
  return rest;
}

function cleanFileName(name) {
  const base = isString(name) ? name.split(/[\\/]/).pop() : "";
  const safe = base.replace(/[^\w.\- ()]/g, "_").trim().slice(0, 120);
  return safe || "receipt";
}

// Returns { fields } or { error }.
function readSubmission(body) {
  const { kind } = body;
  if (kind === "link") {
    if (!isNonEmptyString(body.url) || body.url.length > 500) {
      return { error: "Paste the link to the receipt (up to 500 characters)." };
    }
    let parsed;
    try { parsed = new URL(body.url.trim()); } catch (e) { return { error: "That link is not a valid web address." }; }
    if (parsed.protocol !== "https:") return { error: "Only https:// links can be attached." };
    const host = parsed.hostname.toLowerCase();
    const provider = (PROVIDERS.find(([re]) => re.test(host)) || [null, "Web link"])[1];
    return { fields: { kind: "link", url: parsed.toString(), provider } };
  }
  if (kind === "file") {
    const { mimeType, data } = body;
    if (!isString(mimeType) || !SIGNATURES[mimeType]) {
      return { error: "Receipts can be a photo (JPG, PNG, WEBP) or a PDF." };
    }
    if (!isNonEmptyString(data)) return { error: "Choose a file to upload." };
    const bytes = Buffer.from(data, "base64");
    if (bytes.length < 8) return { error: "That file is empty or unreadable." };
    if (bytes.length > MAX_BYTES) return { error: "That file is larger than 2 MB. Take a smaller photo or attach a link instead." };
    if (!SIGNATURES[mimeType](bytes)) {
      return { error: "That file is not really a " + (mimeType === "application/pdf" ? "PDF" : "photo") + ". Upload the receipt itself." };
    }
    return { fields: { kind: "file", fileName: cleanFileName(body.fileName), mimeType, size: bytes.length, data: bytes } };
  }
  return { error: "Attach either a file or a link." };
}

// GET /api/receipts — the caller's own receipts, every version.
async function list(req, res) {
  const receipts = await Receipt.find({ owner: req.user.id }).sort({ submittedAt: -1 }).lean();
  res.json(receipts.map(publicReceipt));
}

// POST /api/receipts — attach a receipt to one of your entries, or a new
// version of one that was sent back.
async function create(req, res) {
  const body = req.body || {};
  if (!isNonEmptyString(body.transactionId)) {
    return res.status(400).json({ error: "Choose the entry this receipt is for." });
  }
  const { fields, error } = readSubmission(body);
  if (error) return res.status(400).json({ error });

  const entry = await Transaction.findById(body.transactionId);
  if (!entry) return res.status(404).json({ error: "Entry not found." });
  if (String(entry.submittedBy) !== req.user.id) {
    return res.status(403).json({ error: "You can only attach receipts to your own entries." });
  }
  if (!CURRENT.includes(entry.status)) {
    return res.status(400).json({ error: "Receipts can only be attached to a current entry, not an earlier version or a deleted one." });
  }

  // Replacing the latest version, if there is one. Claimed atomically, so two
  // uploads at once cannot both become "the" v2.
  const previous = await Receipt.findOne({ entryId: entry._id, latest: true });
  if (previous && !REPLACEABLE.includes(previous.status)) {
    return res.status(409).json({ error: "This entry's receipt is already verified. A verified receipt is final." });
  }
  if (previous) {
    const claimed = await Receipt.findOneAndUpdate(
      { _id: previous._id, latest: true, status: { $in: REPLACEABLE } },
      // One still waiting is withdrawn by the replacement; a decided one
      // keeps its decision in the history.
      { $set: { latest: false, ...(previous.status === "For Review" ? { status: "Replaced" } : {}) } },
      { new: false }
    );
    if (!claimed) return res.status(409).json({ error: "This receipt changed a moment ago. Reload and try again." });
  }

  let receipt;
  try {
    receipt = await Receipt.create({
      ...fields,
      owner: req.user.id,
      ownerName: req.user.name,
      entryId: entry._id,
      version: previous ? previous.version + 1 : 1,
      parentId: previous ? previous._id : null,
      status: "For Review",
    });
  } catch (err) {
    // Put the previous version back, so the entry never loses its receipt.
    if (previous) await Receipt.updateOne({ _id: previous._id }, { $set: { latest: true, status: previous.status } });
    throw err;
  }

  const what = fields.kind === "file" ? `${fields.fileName} (${Math.ceil(fields.size / 1024)} KB)` : `${fields.provider} link`;
  await logAction(req.user.name, previous ? "Receipt Resubmitted" : "Receipt Submitted",
    `v${receipt.version} for ${describe(entry)}: ${what}. Status set to For Review.`, { ref: receipt._id });
  await notifyRole("Reviewer", "receipt",
    `${req.user.name} submitted ${previous ? `receipt v${receipt.version}` : "a receipt"} for an ${describe(entry)}.`, req.user.id);
  publish(req.user.id, "receipts");
  publishToRole("Reviewer", "receipts");
  res.status(201).json(publicReceipt(receipt));
}

// GET /api/receipts/:id/file — the uploaded file, for its owner and for
// Reviewers. Nobody else, Admin included: a receipt can show an address, an
// account number or what someone bought (NFR-002, section 8.3).
async function file(req, res) {
  const receipt = await Receipt.findById(req.params.id).select("+data");
  if (!receipt) return res.status(404).json({ error: "Receipt not found." });
  const isOwner = String(receipt.owner) === req.user.id;
  if (!isOwner && req.user.role !== "Reviewer") {
    return res.status(403).json({ error: "Only the owner and Reviewers can open a receipt." });
  }
  if (receipt.kind !== "file" || !receipt.data) {
    return res.status(400).json({ error: "This receipt is a link, not an uploaded file." });
  }
  res.set({
    "Content-Type": receipt.mimeType,
    "Content-Length": String(receipt.data.length),
    "Content-Disposition": `inline; filename="${receipt.fileName.replace(/"/g, "")}"`,
    "Cache-Control": "private, no-store",
  });
  res.end(receipt.data);
}

// POST /api/receipts/:id/review — { action: verify | reject | revision, note }
async function review(req, res) {
  const { action, note } = req.body || {};
  const decision = DECISIONS[action];
  if (!decision) return res.status(400).json({ error: "Action must be verify, reject or revision." });
  if (note !== undefined && note !== null && !isString(note)) return res.status(400).json({ error: "The note must be text." });
  const text = (note || "").trim();
  if (text.length > 300) return res.status(400).json({ error: "Keep the note to 300 characters." });
  if (action !== "verify" && !text) {
    return res.status(400).json({ error: action === "revision" ? "Say what needs to be fixed." : "Give a reason for rejecting it." });
  }

  const receipt = await Receipt.findById(req.params.id);
  if (!receipt) return res.status(404).json({ error: "Receipt not found." });
  // Separation of duties (section 8.2): nobody verifies their own evidence.
  if (String(receipt.owner) === req.user.id) {
    return res.status(403).json({ error: "You cannot review your own receipt." });
  }

  // Decided once: the update only matches a receipt still waiting, so two
  // Reviewers acting at the same moment cannot both decide it.
  const decided = await Receipt.findOneAndUpdate(
    { _id: receipt._id, latest: true, status: "For Review" },
    { $set: { status: decision.status, reviewedBy: req.user.id, reviewerName: req.user.name, reviewedAt: new Date(), reviewNote: text } },
    { new: true }
  );
  if (!decided) {
    return res.status(409).json({ error: "This receipt was already decided, replaced or withdrawn." });
  }

  const entry = await Transaction.findById(decided.entryId).lean();
  const about = entry ? describe(entry) : "an entry";
  // The decision is kept as a note on the entry (Comment / Feedback module).
  await Comment.create({
    transactionId: decided.entryId,
    author: req.user.name,
    authorId: req.user.id,
    title: `Receipt v${decided.version} ${decision.status.toLowerCase()}`,
    text: text || "Receipt checked and verified.",
  });
  await notify(decision.type,
    `Your receipt v${decided.version} for the ${about} was ${decision.verb}${text ? `: "${text}"` : "."}`, decided.owner);
  await logAction(req.user.name, decision.audit, `v${decided.version} from ${decided.ownerName} for the ${about}${text ? ` — "${text}"` : ""}.`, { ref: decided._id });

  publish(decided.owner, "receipts");
  publish(decided.owner, "comments");
  publishToRole("Reviewer", "receipts");
  res.json(publicReceipt(decided));
}

// Receipts for the review screen: every one waiting, and the ones this
// Reviewer decided recently — each with the entry it is evidence for.
async function reviewQueue(reviewer) {
  const [waiting, decided] = await Promise.all([
    Receipt.find({ latest: true, status: "For Review", owner: { $ne: reviewer.id } }).sort({ submittedAt: 1 }).limit(200).lean(),
    Receipt.find({ reviewedBy: reviewer.id }).sort({ reviewedAt: -1 }).limit(100).lean(),
  ]);
  const all = [...waiting, ...decided];
  const entries = await Transaction.find({ _id: { $in: all.map((r) => r.entryId) } })
    .select("type category amount date note version status autoApproved").lean();
  const byId = new Map(entries.map((t) => [String(t._id), t]));
  return all.map((r) => ({ ...publicReceipt(r), entry: byId.get(String(r.entryId)) || null }));
}

async function queue(req, res) {
  res.json(await reviewQueue(req.user));
}

module.exports = { list, create, file, review, queue, reviewQueue, publicReceipt };
