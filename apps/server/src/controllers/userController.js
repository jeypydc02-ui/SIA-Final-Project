const User = require("../models/User");
const Bill = require("../models/Bill");
const Budget = require("../models/Budget");
const Notification = require("../models/Notification");
const Comment = require("../models/Comment");
const Transaction = require("../models/Transaction");
const mongoose = require("mongoose");
const PaymentRequest = require("../models/PaymentRequest");
const { destroyUserSessions, refreshUserSessions } = require("../services/sessions");
const { notify } = require("../services/notifications");
const { ACTIVE_STATUSES } = require("../services/paymentRequests");
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

// PUT /api/users/:id/role { role: "User" | "Approver" } — the Admin decides who
// reviews payment requests. The Admin account itself never changes, and nobody
// can change their own role.
async function setRole(req, res) {
  const { role } = req.body || {};
  if (role !== "User" && role !== "Approver") {
    return res.status(400).json({ error: "Role must be User or Approver." });
  }
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  if (String(user._id) === req.user.id) {
    return res.status(400).json({ error: "You cannot change your own role." });
  }
  if (user.role === "Admin") {
    return res.status(400).json({ error: "The Admin account's role cannot be changed." });
  }
  if (user.role === role) {
    return res.status(400).json({ error: `${user.name} is already ${role === "Approver" ? "an Approver" : "a User"}.` });
  }
  // A person with a payment request still in progress would be stranded: an
  // Approver has no wallet screen to follow it on.
  if (user.role === "User") {
    const open = await PaymentRequest.exists({ requester: user._id, status: { $in: ACTIVE_STATUSES } });
    if (open) {
      return res.status(400).json({ error: `${user.name} still has a payment request in progress. Wait until it is closed first.` });
    }
  }
  user.role = role;
  await user.save();
  // Their open sessions carry the new role at once.
  await refreshUserSessions(user._id, { role });
  publish(user._id, "session");
  await notify("role", role === "Approver"
    ? "The Admin made you an Approver. You can now review payment requests under Payment Approvals."
    : "The Admin changed your role to User. You can manage your own bills and payments again.", user._id);
  await logAction(req.user, "Role Changed", `${user.name} (${user.email}) is now ${role}.`, { ref: user._id });
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
    PaymentRequest.deleteMany({ requester: user._id }),
    // Receipts from the retired receipt-review feature, if any remain.
    mongoose.connection.collection("receipts").deleteMany({ owner: user._id }),
  ]);

  await logAction(req.user, "Account Deleted", `${user.name} (${user.email}) removed, with their bills, budgets, entries and notes.`, { ref: user._id });
  res.json({ ok: true });
}

module.exports = { list, setStatus, setRole, remove };
