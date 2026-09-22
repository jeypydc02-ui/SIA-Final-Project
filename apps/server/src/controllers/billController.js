const Bill = require("../models/Bill");
const Transaction = require("../models/Transaction");
const { logAction, notify } = require("../services/audit");

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// NFR-002 ("users can only access projects assigned to them"): a regular User
// only ever sees the bills they created. Reviewers and Admins see everything,
// which they need to run the approval queue and to answer support questions.
function visibilityFilter(user) {
  return user.role === "User" ? { createdBy: user.id } : {};
}

async function list(req, res) {
  const bills = await Bill.find(visibilityFilter(req.user)).sort({ due: 1 });
  res.json(bills);
}

async function create(req, res) {
  const { name, category, amount, due } = req.body || {};
  if (!name || !category || !due || amount === undefined || amount === null || isNaN(Number(amount))) {
    return res.status(400).json({ error: "Bill name, category, due date, and a numeric amount are required." });
  }
  if (Number(amount) <= 0) {
    return res.status(400).json({ error: "Amount must be greater than zero." });
  }
  const bill = await Bill.create({
    name, category, amount: Number(amount), due, paid: false, createdBy: req.user.id,
  });
  await logAction(req.user.name, "Bill Created", `${bill.name} added, due ${bill.due}, amount ${bill.amount}.`);
  await notify("bill", `Bill "${bill.name}" added — due ${bill.due}. The reminder service will alert you as the date approaches.`, req.user.id);
  res.status(201).json(bill);
}

// Workflow automation + webhook-style cascade: payment -> auto-approved expense
// transaction -> notification -> audit log, all triggered by one action.
//
// Paying is an owner-only action even for an Admin: separation of duties (spec
// section 8.2) means an administrator can oversee a bill without being able to
// settle someone else's money.
async function pay(req, res) {
  const bill = await Bill.findById(req.params.id);
  if (!bill) return res.status(404).json({ error: "Bill not found." });
  if (String(bill.createdBy) !== req.user.id) {
    return res.status(403).json({ error: "You can only pay your own bills." });
  }
  if (bill.paid) return res.status(400).json({ error: "This bill is already marked as paid." });

  const amount = Number(req.body?.amount ?? bill.amount);
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: "A valid payment amount is required." });
  }

  // Claim the bill atomically. Reading `paid` and then saving leaves a window
  // in which two clicks — or two tabs — both pass the check and both record a
  // payment, producing two expense rows for one bill. Matching on paid:false
  // inside the update means the database picks exactly one winner.
  const claimed = await Bill.findOneAndUpdate(
    { _id: bill._id, paid: false },
    { $set: { paid: true, paidOn: todayISO(), paidAmount: amount } },
    { new: true }
  );
  if (!claimed) {
    return res.status(400).json({ error: "This bill is already marked as paid." });
  }

  const tx = await Transaction.create({
    type: "Expense",
    category: bill.category,
    amount,
    date: todayISO(),
    note: `Bill payment: ${bill.name}`,
    status: "Approved",
    autoApproved: true,
    submittedBy: req.user.id,
    reviewedBy: req.user.id,
    reviewComment: "Auto-approved via bill payment workflow.",
  });

  await notify("payment", `Payment recorded for "${claimed.name}" — status auto-updated to Paid.`, req.user.id);
  await logAction(
    req.user.name,
    "Payment Recorded",
    `${claimed.name} (${claimed._id}) marked Paid, amount ${amount}. Triggered: expense log entry + notification.`
  );

  res.json({ bill: claimed, transaction: tx });
}

async function update(req, res) {
  const bill = await Bill.findById(req.params.id);
  if (!bill) return res.status(404).json({ error: "Bill not found." });
  if (String(bill.createdBy) !== req.user.id) {
    return res.status(403).json({ error: "You can only edit your own bills." });
  }
  if (bill.paid) {
    return res.status(400).json({ error: "A paid bill can no longer be edited." });
  }

  const { name, category, amount, due } = req.body || {};
  if (amount !== undefined && (isNaN(Number(amount)) || Number(amount) <= 0)) {
    return res.status(400).json({ error: "Amount must be a number greater than zero." });
  }
  if (name !== undefined) bill.name = name;
  if (category !== undefined) bill.category = category;
  if (amount !== undefined) bill.amount = Number(amount);
  if (due !== undefined) bill.due = due;
  await bill.save();

  await logAction(req.user.name, "Bill Updated", `${bill.name} (${bill._id}) edited.`);
  res.json(bill);
}

async function remove(req, res) {
  const bill = await Bill.findById(req.params.id);
  if (!bill) return res.status(404).json({ error: "Bill not found." });
  if (String(bill.createdBy) !== req.user.id) {
    return res.status(403).json({ error: "You can only delete your own bills." });
  }
  if (bill.paid) {
    return res.status(400).json({ error: "A paid bill is part of the payment record and cannot be deleted." });
  }
  await bill.deleteOne();
  await logAction(req.user.name, "Bill Deleted", `${bill.name} (${bill._id}) removed.`);
  res.json({ ok: true });
}

module.exports = { list, create, pay, update, remove };
