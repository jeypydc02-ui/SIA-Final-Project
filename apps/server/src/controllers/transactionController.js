const Transaction = require("../models/Transaction");
const Comment = require("../models/Comment");
const { logAction, notify, notifyRoles } = require("../services/audit");
const { todayISO } = require("../utils/dates");
const { isNonEmptyString, isString } = require("../utils/validate");

const REVIEWER_ROLES = ["Reviewer", "Admin"];

// "an expense" / "an income" — both entry types start with a vowel, but pick
// the article from the word so the messages stay correct if a type is added.
function article(word) {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

// How many already-decided entries the review screen shows alongside the
// queue. Everything still pending is always included.
const REVIEW_HISTORY_LIMIT = 300;

// Everyone's own entries by default (NFR-002) — this is what the dashboard,
// budgets and reports add up, so it must be the caller's money only. Returning
// every user's entries to staff accounts made an Admin with no entries of their
// own see a balance of over a million pesos.
//
// ?scope=review is the approval queue, for Reviewers and Admins: every pending
// entry plus the most recent decided ones. Bounded, because this list is
// reloaded after every action and the full history grows without limit.
async function list(req, res) {
  if (req.query.scope === "review") {
    if (!REVIEWER_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to perform this action." });
    }
    const [pending, decided] = await Promise.all([
      Transaction.find({ status: "Pending Review" }).sort({ createdAt: -1 }).lean(),
      Transaction.find({ status: { $ne: "Pending Review" } }).sort({ createdAt: -1 }).limit(REVIEW_HISTORY_LIMIT).lean(),
    ]);
    return res.json([...pending, ...decided].sort((a, b) => b.createdAt - a.createdAt));
  }
  const txs = await Transaction.find({ submittedBy: req.user.id }).sort({ createdAt: -1 }).lean();
  res.json(txs);
}

async function create(req, res) {
  const { type, category, amount, date, note } = req.body || {};
  if (!type || !["Income", "Expense"].includes(type)) {
    return res.status(400).json({ error: "Type must be Income or Expense." });
  }
  if (!isNonEmptyString(category) || amount === undefined || amount === null || isNaN(Number(amount))) {
    return res.status(400).json({ error: "Category and a numeric amount are required." });
  }
  if (Number(amount) <= 0) {
    return res.status(400).json({ error: "Amount must be greater than zero." });
  }
  const tx = await Transaction.create({
    type,
    category,
    amount: Number(amount),
    date: date || todayISO(),
    note: note || "",
    status: "Pending Review",
    submittedBy: req.user.id,
  });
  await logAction(req.user.name, `${type} Submitted`, `${category}: ${amount} — submitted for review.`);
  await notifyRoles(
    "submission",
    `${req.user.name} submitted ${article(type)} ${type.toLowerCase()} of ${amount} for review.`,
    REVIEWER_ROLES
  );
  res.status(201).json(tx);
}

// Review and Approval workflow (FR-005): a Reviewer or Admin approves,
// rejects, or requests revision on a pending submission.
async function review(req, res) {
  const { action, comment } = req.body || {};
  const map = { approve: "Approved", reject: "Rejected", revise: "Needs Revision" };
  if (!isString(action) || !map[action]) {
    return res.status(400).json({ error: "Action must be one of: approve, reject, revise." });
  }
  if (comment !== undefined && comment !== null && !isString(comment)) {
    return res.status(400).json({ error: "Comment must be text." });
  }
  // Claim the entry atomically: matching on "Pending Review" inside the update
  // means that if two reviewers act at the same moment, exactly one decision is
  // recorded. Reading the status and then saving lets both of them through, and
  // the slower one silently overwrites the first reviewer's verdict.
  //
  // submittedBy must not be the reviewer: separation of duties (spec section
  // 8.2). Without it a Reviewer could log a large income and approve it
  // themselves, which defeats the point of having a review step.
  const tx = await Transaction.findOneAndUpdate(
    { _id: req.params.id, status: "Pending Review", submittedBy: { $ne: req.user.id } },
    { $set: { status: map[action], reviewedBy: req.user.id, reviewComment: comment || "" } },
    // findOneAndUpdate skips schema validators unless asked, and reviewComment
    // has a length limit to honour.
    { new: true, runValidators: true }
  );
  if (!tx) {
    const existing = await Transaction.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Transaction not found." });
    if (String(existing.submittedBy) === req.user.id) {
      return res.status(403).json({ error: "You cannot review your own entry — another Reviewer or Admin must decide it." });
    }
    return res.status(400).json({ error: `This entry is already "${existing.status}" and cannot be reviewed again.` });
  }

  if (comment) {
    await Comment.create({
      transactionId: tx._id,
      author: req.user.name,
      authorId: req.user.id,
      text: comment,
    });
  }

  await logAction(req.user.name, `Transaction ${map[action]}`, `${tx.category} (${tx.amount}) — ${comment || "no comment"}.`);
  // The outcome goes to the submitter, not to everyone.
  await notify(
    action === "approve" ? "approved" : action === "reject" ? "rejected" : "revision",
    `Your ${tx.type.toLowerCase()} of ${tx.amount} was ${map[action].toLowerCase()}${comment ? `: "${comment}"` : "."}`,
    tx.submittedBy
  );

  res.json(tx);
}

// A submitter resubmits a "Needs Revision" entry as a new version (FR-004).
async function resubmit(req, res) {
  const existing = await Transaction.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Transaction not found." });
  if (String(existing.submittedBy) !== req.user.id) {
    return res.status(403).json({ error: "You can only resubmit your own entries." });
  }

  if (existing.status !== "Needs Revision") {
    return res.status(400).json({ error: "Only entries marked \"Needs Revision\" can be resubmitted." });
  }

  const { type, category, amount, date, note } = req.body || {};
  if (amount !== undefined && (isNaN(Number(amount)) || Number(amount) <= 0)) {
    return res.status(400).json({ error: "Amount must be a number greater than zero." });
  }

  // Build and fully validate the new version BEFORE touching the original.
  // Previously the original was marked Superseded first; if the new version
  // was then refused (an emptied amount field sends 0), the entry was stranded
  // as Superseded with no successor and could never be resubmitted.
  const revised = new Transaction({
    type: type || existing.type,
    category: category || existing.category,
    amount: amount !== undefined ? Number(amount) : existing.amount,
    date: date || existing.date,
    note: note !== undefined ? note : existing.note,
    status: "Pending Review",
    version: (existing.version || 1) + 1,
    parentId: existing._id,
    submittedBy: req.user.id,
  });
  await revised.validate();

  // Same reasoning as review(): claim the entry before writing the new version,
  // so a double submission cannot produce two v2 records off one v1.
  const original = await Transaction.findOneAndUpdate(
    { _id: req.params.id, submittedBy: req.user.id, status: "Needs Revision" },
    { $set: { status: "Superseded" } },
    { new: false }
  );
  if (!original) {
    return res.status(400).json({ error: "Only entries marked \"Needs Revision\" can be resubmitted." });
  }

  try {
    await revised.save();
  } catch (err) {
    // Validation already passed, so this is the database itself failing.
    // Hand the entry back so the submitter can simply try again.
    await Transaction.updateOne({ _id: original._id }, { $set: { status: "Needs Revision" } });
    throw err;
  }

  await logAction(req.user.name, "Transaction Resubmitted", `v${revised.version} of ${original._id} submitted for review.`);
  await notifyRoles(
    "submission",
    `${req.user.name} resubmitted a revised ${revised.type.toLowerCase()} for review.`,
    REVIEWER_ROLES
  );

  res.status(201).json(revised);
}

// Full version chain for one entry, oldest first — backs the Version History
// screen (spec section 14 screen 6) with real stored versions rather than a
// trail synthesised at render time.
async function versions(req, res) {
  const tx = await Transaction.findById(req.params.id);
  if (!tx) return res.status(404).json({ error: "Transaction not found." });
  if (req.user.role === "User" && String(tx.submittedBy) !== req.user.id) {
    return res.status(403).json({ error: "You can only view your own entries." });
  }

  // Walk back to the root of the chain, then collect forward.
  let root = tx;
  while (root.parentId) {
    const parent = await Transaction.findById(root.parentId);
    if (!parent) break;
    root = parent;
  }
  const chain = [root];
  let current = root;
  for (;;) {
    const child = await Transaction.findOne({ parentId: current._id });
    if (!child) break;
    chain.push(child);
    current = child;
  }
  res.json(chain);
}

// Editing is only allowed while nobody has acted on the entry yet; once it is
// approved or rejected it belongs to the audit record.
async function update(req, res) {
  const tx = await Transaction.findById(req.params.id);
  if (!tx) return res.status(404).json({ error: "Transaction not found." });
  if (String(tx.submittedBy) !== req.user.id) {
    return res.status(403).json({ error: "You can only edit your own entries." });
  }
  if (tx.status !== "Pending Review") {
    return res.status(400).json({ error: `This entry is "${tx.status}" and can no longer be edited.` });
  }

  const { type, category, amount, date, note } = req.body || {};
  if (category !== undefined && !isNonEmptyString(category)) {
    return res.status(400).json({ error: "Category cannot be empty." });
  }
  if (type !== undefined && !["Income", "Expense"].includes(type)) {
    return res.status(400).json({ error: "Type must be Income or Expense." });
  }
  if (amount !== undefined && (isNaN(Number(amount)) || Number(amount) <= 0)) {
    return res.status(400).json({ error: "Amount must be a number greater than zero." });
  }
  const changes = {};
  if (type !== undefined) changes.type = type;
  if (category !== undefined) changes.category = category;
  if (amount !== undefined) changes.amount = Number(amount);
  if (date !== undefined) changes.date = date;
  if (note !== undefined) changes.note = note;

  // Written only if the entry is still pending at the moment of writing, so an
  // edit that races a reviewer's decision cannot change an approved figure.
  const updated = await Transaction.findOneAndUpdate(
    { _id: tx._id, status: "Pending Review" },
    { $set: changes },
    { new: true, runValidators: true }
  );
  if (!updated) {
    return res.status(400).json({ error: "This entry was reviewed a moment ago and can no longer be edited." });
  }

  await logAction(req.user.name, "Transaction Updated", `${updated.category} (${updated.amount}) edited before review.`);
  res.json(updated);
}

async function remove(req, res) {
  const tx = await Transaction.findById(req.params.id);
  if (!tx) return res.status(404).json({ error: "Transaction not found." });
  if (String(tx.submittedBy) !== req.user.id) {
    return res.status(403).json({ error: "You can only delete your own entries." });
  }
  if (tx.status !== "Pending Review") {
    return res.status(400).json({ error: `This entry is "${tx.status}" and is part of the audit record.` });
  }
  const removed = await Transaction.deleteOne({ _id: tx._id, status: "Pending Review" });
  if (!removed.deletedCount) {
    return res.status(400).json({ error: "This entry was reviewed a moment ago and is now part of the audit record." });
  }
  await logAction(req.user.name, "Transaction Deleted", `${tx.category} (${tx.amount}) withdrawn before review.`);
  res.json({ ok: true });
}

module.exports = { list, create, review, resubmit, versions, update, remove };
