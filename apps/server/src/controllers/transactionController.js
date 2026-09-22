const Transaction = require("../models/Transaction");
const Comment = require("../models/Comment");
const { logAction, notify, notifyRoles } = require("../services/audit");

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const REVIEWER_ROLES = ["Reviewer", "Admin"];

// "an expense" / "an income" — both entry types start with a vowel, but pick
// the article from the word so the messages stay correct if a type is added.
function article(word) {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

// Reviewers/Admins see everything (needed to run the approval queue);
// a regular User only sees their own submissions (NFR-002).
async function list(req, res) {
  const filter = req.user.role === "User" ? { submittedBy: req.user.id } : {};
  const txs = await Transaction.find(filter).sort({ createdAt: -1 });
  res.json(txs);
}

async function create(req, res) {
  const { type, category, amount, date, note } = req.body || {};
  if (!type || !["Income", "Expense"].includes(type)) {
    return res.status(400).json({ error: "Type must be Income or Expense." });
  }
  if (!category || amount === undefined || amount === null || isNaN(Number(amount))) {
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
  if (!action || !map[action]) {
    return res.status(400).json({ error: "Action must be one of: approve, reject, revise." });
  }
  const tx = await Transaction.findById(req.params.id);
  if (!tx) return res.status(404).json({ error: "Transaction not found." });
  if (tx.status !== "Pending Review") {
    return res.status(400).json({ error: `This entry is already "${tx.status}" and cannot be reviewed again.` });
  }

  tx.status = map[action];
  tx.reviewedBy = req.user.id;
  tx.reviewComment = comment || "";
  await tx.save();

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
  const original = await Transaction.findById(req.params.id);
  if (!original) return res.status(404).json({ error: "Transaction not found." });
  if (String(original.submittedBy) !== req.user.id) {
    return res.status(403).json({ error: "You can only resubmit your own entries." });
  }
  if (original.status !== "Needs Revision") {
    return res.status(400).json({ error: "Only entries marked \"Needs Revision\" can be resubmitted." });
  }

  const { type, category, amount, date, note } = req.body || {};
  if (amount !== undefined && isNaN(Number(amount))) {
    return res.status(400).json({ error: "Amount must be numeric." });
  }

  original.status = "Superseded";
  await original.save();

  const revised = await Transaction.create({
    type: type || original.type,
    category: category || original.category,
    amount: amount !== undefined ? Number(amount) : original.amount,
    date: date || original.date,
    note: note !== undefined ? note : original.note,
    status: "Pending Review",
    version: (original.version || 1) + 1,
    parentId: original._id,
    submittedBy: req.user.id,
  });

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
  if (type !== undefined && !["Income", "Expense"].includes(type)) {
    return res.status(400).json({ error: "Type must be Income or Expense." });
  }
  if (amount !== undefined && (isNaN(Number(amount)) || Number(amount) <= 0)) {
    return res.status(400).json({ error: "Amount must be a number greater than zero." });
  }
  if (type !== undefined) tx.type = type;
  if (category !== undefined) tx.category = category;
  if (amount !== undefined) tx.amount = Number(amount);
  if (date !== undefined) tx.date = date;
  if (note !== undefined) tx.note = note;
  await tx.save();

  await logAction(req.user.name, "Transaction Updated", `${tx.category} (${tx.amount}) edited before review.`);
  res.json(tx);
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
  await tx.deleteOne();
  await logAction(req.user.name, "Transaction Deleted", `${tx.category} (${tx.amount}) withdrawn before review.`);
  res.json({ ok: true });
}

module.exports = { list, create, review, resubmit, versions, update, remove };
