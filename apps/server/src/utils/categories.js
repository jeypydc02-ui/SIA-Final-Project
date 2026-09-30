// The one list of categories. Every screen used to keep its own, so a bill
// could be filed under "Internet" while no budget could be set for Internet,
// and an entry could be logged as "Income: Food". The client keeps an
// identical copy in apps/client/src/lib/categories.js.

// What money is spent on. Budgets and bills draw from this list.
const EXPENSE_CATEGORIES = ["Food", "Transport", "Utilities", "Housing", "Internet", "Credit", "Subscription", "Other"];

// Where money comes from.
const INCOME_CATEGORIES = ["Salary", "Freelance", "Allowance", "Other Income"];

// Bills are recurring obligations, a subset of expenses. Paying one records
// an expense under the same category, so it always counts against a budget.
const BILL_CATEGORIES = ["Utilities", "Housing", "Internet", "Credit", "Subscription", "Other"];

function categoriesFor(type) {
  return type === "Income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

module.exports = { EXPENSE_CATEGORIES, INCOME_CATEGORIES, BILL_CATEGORIES, categoriesFor };
