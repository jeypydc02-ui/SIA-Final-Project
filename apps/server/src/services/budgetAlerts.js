const Budget = require("../models/Budget");
const Transaction = require("../models/Transaction");
const { notify } = require("./notifications");
const { todayISO } = require("../utils/dates");
const { getSettings } = require("./settings");
const { OVERALL_BUDGET } = require("../utils/categories");

// Warns a user when a recorded expense pushes a category past 80% or 100% of
// its monthly budget, and the same for the overall monthly budget (all
// spending together). Called whenever an expense is recorded, edited, or paid
// through a bill.
//
// Only the threshold this expense actually crossed is reported, so a user is
// told once at 80% and once when they go over, not after every purchase.
// The warning level (80% by default) is a system setting the Admin manages;
// going over (100%) always warns.
const label = (b) => (b.category === OVERALL_BUDGET ? "overall monthly" : b.category);
const thresholds = (warnPercent) => [
  { at: 1.0, message: (b, spent) => `You are over your ${label(b)} budget for this month: ₱${fmt(spent)} spent of ₱${fmt(b.limit)} (over by ₱${fmt(spent - b.limit)}).` },
  { at: warnPercent / 100, message: (b, spent) => `You have used ${Math.round((spent / b.limit) * 100)}% of your ${label(b)} budget this month: ₱${fmt(spent)} of ₱${fmt(b.limit)}.` },
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

  const budgets = await Budget.find({ user: tx.submittedBy, category: { $in: [tx.category, OVERALL_BUDGET] } }).lean();
  if (!budgets.length) return;

  const monthEntries = await Transaction.find({
    submittedBy: tx.submittedBy,
    type: "Expense",
    status: "Approved",
    date: { $gte: month + "-01", $lte: month + "-31" },
  }).select("amount category").lean();

  const { budgetWarningPercent } = await getSettings();
  for (const budget of budgets) {
    const counted = budget.category === OVERALL_BUDGET ? monthEntries : monthEntries.filter((t) => t.category === tx.category);
    const spent = counted.reduce((s, t) => s + t.amount, 0);
    const before = spent - tx.amount;
    const crossed = thresholds(budgetWarningPercent).find((t) => before < t.at * budget.limit && spent >= t.at * budget.limit);
    if (crossed) await notify("budget", crossed.message(budget, spent), tx.submittedBy);
  }
}

module.exports = { checkBudget };
