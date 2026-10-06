const Transaction = require("../models/Transaction");
const { logAction } = require("../services/audit");
const { checkBudget } = require("../services/budgetAlerts");
const { publish } = require("../services/events");
const { todayISO } = require("../utils/dates");
const { isNonEmptyString, isString, parseAmount } = require("../utils/validate");
const { categoriesFor } = require("../utils/categories");

// Income and expense entries. An entry counts toward the owner's balance and
// budgets the moment it is recorded — there is no approval step. Mistakes are
// fixed by editing, which keeps the old figures as an earlier version, so the
// history of every entry stays visible (Revision History screen).
//
// Status values:
//   "Approved"   the current version, counted in balances and budgets
//                (shown as "Recorded" in the interface)
//   "Superseded" an earlier version, replaced by an edit
//   "Deleted"    removed by its owner; kept so the history and audit trail
//                still make sense, but never counted
//   "Pending Review", "Needs Revision", "Rejected"
//                left over from the former review workflow (see
//                config/migrations.js); never created any more

const COUNTED = "Approved";
// Entries their owner may still change. Rejected ones are kept as they were.
const EDITABLE = ["Approved", "Needs Revision"];

// An income category on an expense (or the reverse) is refused, so every
// expense can be counted against a budget and no income is.
function categoryProblem(type, category) {
  const allowed = categoriesFor(type);
  return allowed.includes(category)
    ? null
    : `${type} category must be one of: ${allowed.join(", ")}.`;
}

function validateFields({ type, category, amount, date, note }) {
  if (type !== undefined && !["Income", "Expense"].includes(type)) return "Type must be Income or Expense.";
  if (category !== undefined && !isNonEmptyString(category)) return "Category cannot be empty.";
  if (amount !== undefined && parseAmount(amount) === null) {
    return "Amount must be a number between 0.01 and 1,000,000,000,000.";
  }
  if (date !== undefined && !isString(date)) return "Date must be a real calendar date (YYYY-MM-DD).";
  if (note !== undefined && note !== null && !isString(note)) return "Note must be text.";
  return null;
}

// The caller's own entries (NFR-002): what the dashboard, budgets and reports
// add up, so it must be their money only, whatever their role.
async function list(req, res) {
  const txs = await Transaction.find({ submittedBy: req.user.id }).sort({ createdAt: -1 }).lean();
  res.json(txs);
}

async function create(req, res) {
  const { type, category, amount, date, note } = req.body || {};
  if (!type || !["Income", "Expense"].includes(type)) {
    return res.status(400).json({ error: "Type must be Income or Expense." });
  }
  if (!isNonEmptyString(category) || amount === undefined || amount === null || amount === "") {
    return res.status(400).json({ error: "Category and a numeric amount are required." });
  }
  const fieldProblem = validateFields({ amount, date, note });
  if (fieldProblem) return res.status(400).json({ error: fieldProblem });
  const catProblem = categoryProblem(type, category);
  if (catProblem) return res.status(400).json({ error: catProblem });

  const tx = await Transaction.create({
    type,
    category,
    amount: parseAmount(amount),
    date: date || todayISO(),
    note: note || "",
    status: COUNTED,
    submittedBy: req.user.id,
  });
  await logAction(req.user.name, `${type} Recorded`, `${category}: ${tx.amount} on ${tx.date}.`);
  await checkBudget(tx);
  publish(req.user.id, "transactions");
  res.status(201).json(tx);
}

// Full version chain for one entry, oldest first — backs the Revision History
// screen with the stored versions rather than a trail made up at render time.
async function versions(req, res) {
  const tx = await Transaction.findById(req.params.id);
  if (!tx) return res.status(404).json({ error: "Transaction not found." });
  // Private to the owner, Admin included (NFR-002): with no review step,
  // nobody else has a reason to read someone's entries.
  if (String(tx.submittedBy) !== req.user.id) {
    return res.status(403).json({ error: "You can only view your own entries." });
  }

  // Walk back to the root of the chain, then collect forward.
  let root = tx;
  while (root.parentId) {
    const parent = await Transaction.findById(root.parentId);
    if (!parent) break;
    root = parent;
  }
  const chain = [root];
  let current = root;
  for (;;) {
    const child = await Transaction.findOne({ parentId: current._id });
    if (!child) break;
    chain.push(child);
    current = child;
  }
  res.json(chain);
}

// Shared by edit and delete: the entry must be the owner's, still current, and
// not one the bill-payment workflow created (that one follows its bill).
async function loadOwnCurrent(req, res) {
  const tx = await Transaction.findById(req.params.id);
  if (!tx) { res.status(404).json({ error: "Transaction not found." }); return null; }
  if (String(tx.submittedBy) !== req.user.id) {
    res.status(403).json({ error: "You can only change your own entries." });
    return null;
  }
  if (tx.autoApproved) {
    res.status(400).json({ error: "This expense was recorded by paying a bill, so it follows that bill and cannot be changed here." });
    return null;
  }
  if (!EDITABLE.includes(tx.status)) {
    res.status(400).json({ error: `This entry is "${tx.status}" and can no longer be changed.` });
    return null;
  }
  return tx;
}

// Editing records a new version (v2, v3 …) and keeps the previous one as
// "Superseded", so the change is visible in Revision History.
async function update(req, res) {
  const existing = await loadOwnCurrent(req, res);
  if (!existing) return;

  const { type, category, amount, date, note } = req.body || {};
  const fieldProblem = validateFields({ type, category, amount, date, note });
  if (fieldProblem) return res.status(400).json({ error: fieldProblem });

  // Build and fully validate the new version BEFORE touching the current one,
  // so a refused edit can never leave the entry without a current version.
  const revised = new Transaction({
    type: type !== undefined ? type : existing.type,
    category: category !== undefined ? category : existing.category,
    amount: amount !== undefined ? parseAmount(amount) : existing.amount,
    date: date !== undefined ? date : existing.date,
    note: note !== undefined ? note : existing.note,
    status: COUNTED,
    version: (existing.version || 1) + 1,
    parentId: existing._id,
    submittedBy: req.user.id,
  });
  const catProblem = categoryProblem(revised.type, revised.category);
  if (catProblem) return res.status(400).json({ error: catProblem });
  await revised.validate();

  // Claim the current version atomically, so two quick edits (two tabs, a
  // double tap) cannot both branch a v2 off the same v1.
  const claimed = await Transaction.findOneAndUpdate(
    { _id: existing._id, submittedBy: req.user.id, status: { $in: EDITABLE } },
    { $set: { status: "Superseded" } },
    { new: false }
  );
  if (!claimed) {
    return res.status(409).json({ error: "This entry was changed a moment ago. Reload and try again." });
  }

  try {
    await revised.save();
  } catch (err) {
    // Validation already passed, so this is the database itself failing.
    // Put the previous version back so the entry is never left without one.
    await Transaction.updateOne({ _id: claimed._id }, { $set: { status: claimed.status } });
    throw err;
  }

  await logAction(req.user.name, "Transaction Edited", `${revised.category} ${revised.amount} — v${revised.version} replaces v${claimed.version || 1}.`);
  await checkBudget(revised);
  publish(req.user.id, "transactions");
  res.json(revised);
}

// Deleting keeps the record, marked "Deleted": it stops counting at once, but
// the version history and the audit log still make sense afterwards.
async function remove(req, res) {
  const existing = await loadOwnCurrent(req, res);
  if (!existing) return;

  const removed = await Transaction.findOneAndUpdate(
    { _id: existing._id, submittedBy: req.user.id, status: { $in: EDITABLE } },
    { $set: { status: "Deleted" } },
    { new: true }
  );
  if (!removed) {
    return res.status(409).json({ error: "This entry was changed a moment ago. Reload and try again." });
  }
  await logAction(req.user.name, "Transaction Deleted", `${removed.type} ${removed.category} ${removed.amount} (v${removed.version || 1}) deleted.`);
  publish(req.user.id, "transactions");
  res.json({ ok: true });
}

module.exports = { list, create, versions, update, remove };
