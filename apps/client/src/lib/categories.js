// The one list of categories, identical to apps/server/src/utils/categories.js
// (the server refuses anything else). Every form reads from here so a bill,
// its payment and the budget it counts against always agree.

export const EXPENSE_CATEGORIES = ["Food", "Transport", "Utilities", "Housing", "Internet", "Credit", "Subscription", "Other"];
export const INCOME_CATEGORIES = ["Salary", "Freelance", "Allowance", "Other Income"];
export const BILL_CATEGORIES = ["Utilities", "Housing", "Internet", "Credit", "Subscription", "Other"];

export const categoriesFor = (type) => (type === "Income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES);

// Keeps a category valid when the type changes: Food stays Food on an
// expense, but switching to Income picks the first income category.
export const fitCategory = (type, category) => (categoriesFor(type).includes(category) ? category : categoriesFor(type)[0]);
