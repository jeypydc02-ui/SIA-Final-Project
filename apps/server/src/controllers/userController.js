const User = require("../models/User");
const Bill = require("../models/Bill");
const Budget = require("../models/Budget");
const Notification = require("../models/Notification");
const Comment = require("../models/Comment");
const Transaction = require("../models/Transaction");
const mongoose = require("mongoose");
const { destroyUserSessions } = require("../services/sessions");
const { logAction } = require("../services/audit");
const { publish } = require("../services/events");

// The system has one Admin, created with `npm run create-admin`. Roles are
// never changed from the app: everyone who signs up is a User, and nobody can
// be promoted (least privilege, spec section 8.2).

async function list(req, res) {
  const users = await User.find().select("-passwordHash").sort({ role: 1, name: 1 });
  res.json(users);
}

// PUT /api/users/:id/status { active: true | false } — deactivate or
// reactivate an account. A deactivated account keeps all its data but cannot
// sign in; its open sessions end at once.
async function setStatus(req, res) {
  const { active } = req.body || {};
  if (typeof active !== "boolean") return res.status(400).json({ error: "Status must be active (true) or deactivated (false)." });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  if (String(user._id) === req.user.id) {
    return res.status(400).json({ error: "You cannot deactivate your own account." });
  }
  const wasActive = user.active !== false;
  if (wasActive === active) {
    return res.status(400).json({ error: `${user.name} is already ${active ? "active" : "deactivated"}.` });
  }
  if (user.role === "Admin") {
    return res.status(400).json({ error: "The Admin account cannot be deactivated." });
  }
  user.active = active;
  await user.save();
  if (!active) await destroyUserSessions(user._id);
  // Their open tabs find out at once and fall back to the sign-in prompt.
  publish(user._id, "session");
  await logAction(req.user, active ? "Account Reactivated" : "Account Deactivated", `${user.name} (${user.email}).`, { ref: user._id });
  res.json({ id: user._id, name: user.name, email: user.email, role: user.role, active: user.active });
}

async function remove(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  if (String(user._id) === req.user.id) {
    return res.status(400).json({ error: "You cannot delete your own account." });
  }
  if (user.role === "Admin") {
    return res.status(400).json({ error: "The Admin account cannot be deleted." });
  }
  await user.deleteOne();
  await destroyUserSessions(user._id);

  // The person's own records go with them, so nothing is left orphaned and
  // nobody else's screens show a deleted person's money. The audit log keeps
  // the history of what was done.
  await Promise.all([
    Bill.deleteMany({ createdBy: user._id }),
    Budget.deleteMany({ user: user._id }),
    Notification.deleteMany({ user: user._id }),
    Comment.deleteMany({ authorId: user._id }),
    Transaction.deleteMany({ submittedBy: user._id }),
    // Receipts from the retired receipt-review feature, if any remain.
    mongoose.connection.collection("receipts").deleteMany({ owner: user._id }),
  ]);

  await logAction(req.user, "Account Deleted", `${user.name} (${user.email}) removed, with their bills, budgets, entries and notes.`, { ref: user._id });
  res.json({ ok: true });
}

module.exports = { list, setStatus, remove };
