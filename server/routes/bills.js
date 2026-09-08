const express = require("express");
const Bill = require("../models/Bill");
const Transaction = require("../models/Transaction");
const { requireAuth } = require("../middleware/auth");
const { logAction, notify } = require("../audit");

const router = express.Router();

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

router.get("/", requireAuth, async (req, res) => {
  const bills = await Bill.find().sort({ due: 1 });
  res.json(bills);
});

router.post("/", requireAuth, async (req, res) => {
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
  await notify("reminder", `New bill "${bill.name}" scheduled — due ${bill.due}.`);
  res.status(201).json(bill);
});

// Workflow automation + webhook-style cascade: payment -> auto-approved expense
// transaction -> notification -> audit log, all triggered by one action.
router.post("/:id/pay", requireAuth, async (req, res) => {
  const bill = await Bill.findById(req.params.id);
  if (!bill) return res.status(404).json({ error: "Bill not found." });
  if (bill.paid) return res.status(400).json({ error: "This bill is already marked as paid." });

  const amount = Number(req.body?.amount ?? bill.amount);
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: "A valid payment amount is required." });
  }

  bill.paid = true;
  bill.paidOn = todayISO();
  bill.paidAmount = amount;
  await bill.save();

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

  await notify("payment", `Payment recorded for "${bill.name}" — status auto-updated to Paid.`);
  await logAction(
    req.user.name,
    "Payment Recorded",
    `${bill.name} (${bill._id}) marked Paid, amount ${amount}. Triggered: expense log entry + notification.`
  );

  res.json({ bill, transaction: tx });
});

module.exports = router;
