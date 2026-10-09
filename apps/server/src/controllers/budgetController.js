const Budget = require("../models/Budget");
const { logAction } = require("../services/audit");
const { publish } = require("../services/events");
const { EXPENSE_CATEGORIES, OVERALL_BUDGET } = require("../utils/categories");
const { isString, parseAmount } = require("../utils/validate");

// Budgets limit spending, so only expense categories can have one — plus
// "Overall", one limit on all spending in the month together.
const notBudgetable = (name) => !EXPENSE_CATEGORIES.includes(name) && name !== OVERALL_BUDGET;
const BUDGET_CATEGORY_ERROR = "Budget category must be one of: " + [OVERALL_BUDGET, ...EXPENSE_CATEGORIES].join(", ") + ".";
const budgetName = (category) => (category === OVERALL_BUDGET ? "overall monthly budget" : `budget for "${category}"`);

// Budgets are a User's own; an Admin keeps no wallet (the routes refuse them).
async function list(req, res) {
  const budgets = await Budget.find({ user: req.user.id }).sort({ category: 1 }).lean();
  res.json(budgets);
}

async function create(req, res) {
  const { category, limit } = req.body || {};
  if (!isString(category) || !category.trim()) {
    return res.status(400).json({ error: "Category is required." });
  }
  if (limit === undefined || limit === null || limit === "" || parseAmount(limit) === null) {
    return res.status(400).json({ error: "Limit must be a number greater than zero." });
  }
  const name = String(category).trim();
  if (notBudgetable(name)) return res.status(400).json({ error: BUDGET_CATEGORY_ERROR });
  const existing = await Budget.findOne({ user: req.user.id, category: name });
  if (existing) {
    return res.status(409).json({ error: `You already have a ${budgetName(name)}.` });
  }
  const budget = await Budget.create({ user: req.user.id, category: name, limit: parseAmount(limit) });
  await logAction(req.user, "Budget Created", `${budget.category} limit set to ${budget.limit}.`);
  publish(req.user.id, "budgets");
  res.status(201).json(budget);
}

async function update(req, res) {
  const budget = await Budget.findById(req.params.id);
  if (!budget) return res.status(404).json({ error: "Budget not found." });
  if (String(budget.user) !== req.user.id) {
    return res.status(403).json({ error: "You can only edit your own budgets." });
  }

  const { category, limit } = req.body || {};
  if (limit !== undefined && parseAmount(limit) === null) {
    return res.status(400).json({ error: "Limit must be a number greater than zero." });
  }
  if (category !== undefined) {
    if (!isString(category)) return res.status(400).json({ error: "Category is required." });
    const name = category.trim();
    if (!name) return res.status(400).json({ error: "Category cannot be empty." });
    if (notBudgetable(name)) return res.status(400).json({ error: BUDGET_CATEGORY_ERROR });
    const clash = await Budget.findOne({ user: req.user.id, category: name, _id: { $ne: budget._id } });
    if (clash) return res.status(409).json({ error: `You already have a ${budgetName(name)}.` });
    budget.category = name;
  }
  const before = budget.limit;
  if (limit !== undefined && parseAmount(limit) !== before) {
    budget.previousLimit = before;
    budget.limit = parseAmount(limit);
    budget.limitChangedAt = new Date();
  }
  await budget.save();

  const change = budget.limit - before;
  const how = change < 0 ? `reduced by ${-change}` : change > 0 ? `raised by ${change}` : "unchanged";
  await logAction(req.user, "Budget Updated", `${budget.category} limit ${before} -> ${budget.limit} (${how}).`);
  publish(req.user.id, "budgets");
  res.json(budget);
}

async function remove(req, res) {
  const budget = await Budget.findById(req.params.id);
  if (!budget) return res.status(404).json({ error: "Budget not found." });
  if (String(budget.user) !== req.user.id) {
    return res.status(403).json({ error: "You can only delete your own budgets." });
  }
  await budget.deleteOne();
  await logAction(req.user, "Budget Deleted", `${budget.category} budget removed.`);
  publish(req.user.id, "budgets");
  res.json({ ok: true });
}

module.exports = { list, create, update, remove };
