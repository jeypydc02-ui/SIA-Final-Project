const Budget = require("../models/Budget");
const { logAction } = require("../services/audit");

// Budgets are personal for every role, including Admin: an administrator's
// budgets are their own money, not something they oversee for others.
async function list(req, res) {
  const budgets = await Budget.find({ user: req.user.id }).sort({ category: 1 });
  res.json(budgets);
}

async function create(req, res) {
  const { category, limit } = req.body || {};
  if (!category || !String(category).trim()) {
    return res.status(400).json({ error: "Category is required." });
  }
  if (limit === undefined || limit === null || isNaN(Number(limit)) || Number(limit) <= 0) {
    return res.status(400).json({ error: "Limit must be a number greater than zero." });
  }
  const name = String(category).trim();
  const existing = await Budget.findOne({ user: req.user.id, category: name });
  if (existing) {
    return res.status(409).json({ error: `You already have a budget for "${name}".` });
  }
  const budget = await Budget.create({ user: req.user.id, category: name, limit: Number(limit) });
  await logAction(req.user.name, "Budget Created", `${budget.category} limit set to ${budget.limit}.`);
  res.status(201).json(budget);
}

async function update(req, res) {
  const budget = await Budget.findById(req.params.id);
  if (!budget) return res.status(404).json({ error: "Budget not found." });
  if (String(budget.user) !== req.user.id) {
    return res.status(403).json({ error: "You can only edit your own budgets." });
  }

  const { category, limit } = req.body || {};
  if (limit !== undefined && (isNaN(Number(limit)) || Number(limit) <= 0)) {
    return res.status(400).json({ error: "Limit must be a number greater than zero." });
  }
  if (category !== undefined) {
    const name = String(category).trim();
    if (!name) return res.status(400).json({ error: "Category cannot be empty." });
    const clash = await Budget.findOne({ user: req.user.id, category: name, _id: { $ne: budget._id } });
    if (clash) return res.status(409).json({ error: `You already have a budget for "${name}".` });
    budget.category = name;
  }
  if (limit !== undefined) budget.limit = Number(limit);
  await budget.save();

  await logAction(req.user.name, "Budget Updated", `${budget.category} limit now ${budget.limit}.`);
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
  res.json({ ok: true });
}

module.exports = { list, create, update, remove };
