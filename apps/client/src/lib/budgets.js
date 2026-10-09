// The overall monthly budget: one limit on all spending together, stored as a
// budget under this name next to the per-category ones (same name as the
// server's OVERALL_BUDGET).
export const OVERALL = "Overall";

export const splitBudgets = (budgets) => ({
  overall: budgets.find((b) => b.category === OVERALL) || null,
  categories: budgets.filter((b) => b.category !== OVERALL),
});

// "2026-10" shifted by n months.
export function shiftMonth(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}
export const monthLabel = (ym) => new Date(ym + "-01T00:00:00Z").toLocaleDateString("en-PH", { month: "long", timeZone: "UTC" });
export const monthYearLabel = (ym) => new Date(ym + "-01T00:00:00Z").toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });

// What was spent in a month: per category, and in all. Only current entries
// count (earlier versions and deleted entries are history).
export function monthSpending(tx, month) {
  const byCategory = {};
  let total = 0;
  for (const t of tx) {
    if (t.status !== "Approved" || t.type !== "Expense" || !String(t.date).startsWith(month)) continue;
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    total += t.amount;
  }
  return { byCategory, total };
}

export const spentFor = (budget, spending) =>
  budget.category === OVERALL ? spending.total : spending.byCategory[budget.category] || 0;
