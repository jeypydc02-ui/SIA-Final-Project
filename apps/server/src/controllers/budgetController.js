const Budget = require("../models/Budget");
const { logAction } = require("../services/audit");
const { publish } = require("../services/events");
const { EXPENSE_CATEGORIES } = require("../utils/categories");
const { isString, parseAmount } = require("../utils/validate");

// Budgets limit spending, so only expense categories can have one.
const notBudgetable = (name) => !EXPENSE_CATEGORIES.includes(name);
const BUDGET_CATEGORY_ERROR = "Budget category must be one of: " + EXPENSE_CATEGORIES.join(", ") + ".";

// Budgets are personal for every role, including Admin: an administrator's
// budgets are their own money, not something they oversee for others.
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
    return res.status(409).json({ error: `You already have a budget for "${name}".` });
  }
  const budget = await Budget.create({ user: req.user.id, category: name, limit: parseAmount(limit) });
  await logAction(req.user.name, "Budget Created", `${budget.category} limit set to ${budget.limit}.`);
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
    if (clash) return res.status(409).json({ error: `You already have a budget for "${name}".` });
    budget.category = name;
  }
  if (limit !== undefined) budget.limit = parseAmount(limit);
  await budget.save();

  await logAction(req.user.name, "Budget Updated", `${budget.category} limit now ${budget.limit}.`);
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
  await logAction(req.user.name, "Budget Deleted", `${budget.category} budget removed.`);
  publish(req.user.id, "budgets");
  res.json({ ok: true });
}

module.exports = { list, create, update, remove };
