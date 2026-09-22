const express = require("express");
const Transaction = require("../models/Transaction");
const Comment = require("../models/Comment");
const { requireAuth, requireRole } = require("../middleware/auth");
const { logAction, notify } = require("../services/audit");

const router = express.Router();

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Reviewers/Admins see everything (needed to run the approval queue);
// a regular User only sees their own submissions.
router.get("/", requireAuth, async (req, res) => {
  const filter = req.user.role === "User" ? { submittedBy: req.user.id } : {};
  const txs = await Transaction.find(filter).sort({ createdAt: -1 });
  res.json(txs);
});

router.post("/", requireAuth, async (req, res) => {
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
  await notify("submission", `${req.user.name} submitted a ${type.toLowerCase()} of ${amount} for review.`);
  res.status(201).json(tx);
});

// Review and Approval workflow: a Reviewer or Admin approves, rejects, or
// requests revision on a pending submission.
router.post("/:id/review", requireAuth, requireRole("Reviewer", "Admin"), async (req, res) => {
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
    await Comment.create({ transactionId: tx._id, author: req.user.name, text: comment });
  }

  await logAction(req.user.name, `Transaction ${map[action]}`, `${tx.category} (${tx.amount}) — ${comment || "no comment"}.`);
  await notify(
    action === "approve" ? "approved" : action === "reject" ? "rejected" : "revision",
    `Your ${tx.type.toLowerCase()} of ${tx.amount} was ${map[action].toLowerCase()}${comment ? `: "${comment}"` : "."}`
  );

  res.json(tx);
});

// A submitter resubmits a "Needs Revision" entry as a new version.
router.post("/:id/resubmit", requireAuth, async (req, res) => {
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
  await notify("submission", `${req.user.name} resubmitted a revised ${revised.type.toLowerCase()} for review.`);

  res.status(201).json(revised);
});

module.exports = router;
