const Bill = require("../models/Bill");
const Transaction = require("../models/Transaction");
const { logAction } = require("../services/audit");
const { notify } = require("../services/notifications");
const { checkBudget } = require("../services/budgetAlerts");
const { todayISO, nextMonthlyDueISO, isRealDate } = require("../utils/dates");
const { isNonEmptyString, parseAmount } = require("../utils/validate");

const REPEATS = ["none", "monthly"];
const dayOf = (iso) => Number(String(iso).slice(8, 10));

// NFR-002: a bill is personal money, so everyone — Admin and Reviewer
// included — sees only the bills they created. Returning every user's bills to
// staff accounts put other people's figures into their dashboard, reports and
// bill list as though they were their own, with Mark Paid buttons that could
// only ever fail. Nothing in the review workflow needs anyone else's bills.
async function list(req, res) {
  const bills = await Bill.find({ createdBy: req.user.id }).sort({ due: 1 }).lean();
  res.json(bills);
}

async function create(req, res) {
  const { name, category, amount, due, repeat = "none" } = req.body || {};
  if (!isNonEmptyString(name) || !isNonEmptyString(category) || !due || amount === undefined || amount === null || isNaN(Number(amount))) {
    return res.status(400).json({ error: "Bill name, category, due date, and a numeric amount are required." });
  }
  if (Number(amount) <= 0) {
    return res.status(400).json({ error: "Amount must be greater than zero." });
  }
  if (!REPEATS.includes(repeat)) {
    return res.status(400).json({ error: "Repeat must be none or monthly." });
  }
  const bill = await Bill.create({
    name, category, amount: Number(amount), due, paid: false, createdBy: req.user.id,
    repeat, repeatDay: repeat === "monthly" && isRealDate(due) ? dayOf(due) : null,
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

  // Validated in full before anything is written. Previously an amount the
  // expense record would refuse (such as 1e13) got as far as marking the bill
  // Paid, then failed — leaving a paid bill with no payment behind it.
  const amount = parseAmount(req.body?.amount ?? bill.amount);
  if (amount === null) {
    return res.status(400).json({ error: "Enter a payment amount between 0.01 and 1,000,000,000,000." });
  }
  const paidOn = todayISO();

  // Claim the bill atomically. Reading `paid` and then saving leaves a window
  // in which two clicks — or two tabs — both pass the check and both record a
  // payment, producing two expense rows for one bill. Matching on paid:false
  // inside the update means the database picks exactly one winner.
  const claimed = await Bill.findOneAndUpdate(
    { _id: bill._id, paid: false },
    { $set: { paid: true, paidOn, paidAmount: amount } },
    { new: true }
  );
  if (!claimed) {
    return res.status(400).json({ error: "This bill is already marked as paid." });
  }

  // If the expense record cannot be written, put the bill back the way it
  // was: a bill must never read Paid without the payment that paid it.
  let tx;
  try {
    tx = await Transaction.create({
      type: "Expense",
      category: bill.category,
      amount,
      date: paidOn,
      // Bill names can be 120 characters and a note only 300, so this fits.
      note: `Bill payment: ${bill.name}`,
      status: "Approved",
      autoApproved: true,
      submittedBy: req.user.id,
      reviewedBy: req.user.id,
      reviewComment: "Auto-approved via bill payment workflow.",
    });
  } catch (err) {
    await Bill.updateOne(
      { _id: bill._id },
      { $set: { paid: false, paidOn: null, paidAmount: null } }
    );
    throw err;
  }

  // A monthly bill comes back: paying this month's creates next month's, due
  // on the same day. The payment itself is already safely recorded, so if
  // this step fails the payment stands and the user can add the bill again.
  let nextBill = null;
  if (claimed.repeat === "monthly") {
    try {
      nextBill = await Bill.create({
        name: claimed.name,
        category: claimed.category,
        amount: claimed.amount,
        due: nextMonthlyDueISO(claimed.due, claimed.repeatDay || dayOf(claimed.due)),
        createdBy: claimed.createdBy,
        repeat: "monthly",
        repeatDay: claimed.repeatDay || dayOf(claimed.due),
        previousBill: claimed._id,
      });
    } catch (err) {
      console.error("[bills] could not schedule the next monthly bill:", err.message);
    }
  }

  await notify(
    "payment",
    `Payment recorded for "${claimed.name}" — status auto-updated to Paid.` +
      (nextBill ? ` Next bill scheduled for ${nextBill.due}.` : ""),
    req.user.id
  );
  await logAction(
    req.user.name,
    "Payment Recorded",
    `${claimed.name} (${claimed._id}) marked Paid, amount ${amount}. Triggered: expense log entry + notification` +
      (nextBill ? ` + next monthly bill due ${nextBill.due}.` : ".")
  );
  // The payment is an approved expense, so it may have pushed a budget over.
  await checkBudget(tx);

  res.json({ bill: claimed, transaction: tx, nextBill });
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

  const { name, category, amount, due, repeat } = req.body || {};
  if (repeat !== undefined && !REPEATS.includes(repeat)) {
    return res.status(400).json({ error: "Repeat must be none or monthly." });
  }
  if (amount !== undefined && (isNaN(Number(amount)) || Number(amount) <= 0)) {
    return res.status(400).json({ error: "Amount must be a number greater than zero." });
  }
  if (name !== undefined && !isNonEmptyString(name)) {
    return res.status(400).json({ error: "Bill name cannot be empty." });
  }
  if (category !== undefined && !isNonEmptyString(category)) {
    return res.status(400).json({ error: "Category cannot be empty." });
  }
  const changes = {};
  if (name !== undefined) changes.name = name;
  if (category !== undefined) changes.category = category;
  if (amount !== undefined) changes.amount = Number(amount);
  if (due !== undefined) changes.due = due;
  if (repeat !== undefined) changes.repeat = repeat;
  // The monthly schedule follows the (possibly new) due date's day.
  const finalRepeat = repeat !== undefined ? repeat : bill.repeat;
  const finalDue = due !== undefined ? due : bill.due;
  changes.repeatDay = finalRepeat === "monthly" && isRealDate(finalDue) ? dayOf(finalDue) : null;

  // Written only while the bill is still unpaid. Checking `paid` and then
  // saving let an edit that raced a payment rewrite a bill already paid.
  const updated = await Bill.findOneAndUpdate(
    { _id: bill._id, paid: false },
    { $set: changes },
    { new: true, runValidators: true }
  );
  if (!updated) {
    return res.status(400).json({ error: "A paid bill can no longer be edited." });
  }

  await logAction(req.user.name, "Bill Updated", `${updated.name} (${updated._id}) edited.`);
  res.json(updated);
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
  // Same race as update(): only an unpaid bill may go.
  const removed = await Bill.deleteOne({ _id: bill._id, paid: false });
  if (!removed.deletedCount) {
    return res.status(400).json({ error: "A paid bill is part of the payment record and cannot be deleted." });
  }
  await logAction(req.user.name, "Bill Deleted", `${bill.name} (${bill._id}) removed.`);
  res.json({ ok: true });
}

module.exports = { list, create, pay, update, remove };
