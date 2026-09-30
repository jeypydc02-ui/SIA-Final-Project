const Budget = require("../models/Budget");
const Transaction = require("../models/Transaction");
const { notify } = require("./notifications");
const { todayISO } = require("../utils/dates");

// Warns a user when an approved expense pushes a category past 80% or 100% of
// its monthly budget. Called whenever an expense becomes Approved: a
// reviewer's approval, or a bill payment (which is approved automatically).
//
// Only the threshold this expense actually crossed is reported, so a user is
// told once at 80% and once when they go over, not after every purchase.
const THRESHOLDS = [
  { at: 1.0, message: (b, spent) => `You are over your ${b.category} budget for this month: ₱${fmt(spent)} spent of ₱${fmt(b.limit)} (over by ₱${fmt(spent - b.limit)}).` },
  { at: 0.8, message: (b, spent) => `You have used ${Math.round((spent / b.limit) * 100)}% of your ${b.category} budget this month: ₱${fmt(spent)} of ₱${fmt(b.limit)}.` },
];

function fmt(n) {
  return Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function checkBudget(tx) {
  if (!tx || tx.type !== "Expense" || tx.status !== "Approved") return;
  // Budgets are for the month in progress; approving an old entry from a past
  // month cannot change what someone does with this month's money.
  const month = todayISO().slice(0, 7);
  if (!String(tx.date).startsWith(month)) return;

  const budget = await Budget.findOne({ user: tx.submittedBy, category: tx.category }).lean();
  if (!budget) return;

  const monthEntries = await Transaction.find({
    submittedBy: tx.submittedBy,
    type: "Expense",
    status: "Approved",
    category: tx.category,
    date: { $gte: month + "-01", $lte: month + "-31" },
  }).select("amount").lean();

  const spent = monthEntries.reduce((s, t) => s + t.amount, 0);
  const before = spent - tx.amount;

  const crossed = THRESHOLDS.find((t) => before < t.at * budget.limit && spent >= t.at * budget.limit);
  if (crossed) await notify("budget", crossed.message(budget, spent), tx.submittedBy);
}

module.exports = { checkBudget };
