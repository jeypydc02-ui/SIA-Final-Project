const crypto = require("crypto");
const User = require("../models/User");
const Bill = require("../models/Bill");
const Budget = require("../models/Budget");
const Notification = require("../models/Notification");
const Comment = require("../models/Comment");
const Transaction = require("../models/Transaction");
const { refreshUserSessions, destroyUserSessions } = require("../services/sessions");
const { hashPassword } = require("../services/passwords");
const { logAction } = require("../services/audit");
const { notify } = require("../services/notifications");
const { publish } = require("../services/events");

const ROLES = ["Admin", "User"];

async function list(req, res) {
  const users = await User.find().select("-passwordHash").sort({ role: 1, name: 1 });
  res.json(users);
}

// Role assignment is Admin-only and never self-service: this is the other half
// of least privilege (spec section 8.2). Registration always creates a User;
// promotion to Admin happens only here.
async function setRole(req, res) {
  const { role } = req.body || {};
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: `Role must be one of: ${ROLES.join(", ")}.` });
  }
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });

  if (String(user._id) === req.user.id) {
    return res.status(400).json({ error: "You cannot change your own role." });
  }
  // Never let the last Admin be demoted, or nobody can administer the system.
  if (user.role === "Admin" && role !== "Admin") {
    const admins = await User.countDocuments({ role: "Admin" });
    if (admins <= 1) {
      return res.status(400).json({ error: "This is the only Admin account — promote another Admin first." });
    }
  }
  if (user.role === role) {
    return res.status(400).json({ error: `${user.name} is already a ${role}.` });
  }

  const previous = user.role;
  user.role = role;
  await user.save();

  // A live session still carries the old role until it is refreshed.
  await refreshUserSessions(user._id, { role });
  await logAction(req.user.name, "Role Changed", `${user.name}: ${previous} -> ${role}.`);
  await notify("role", `Your role was changed from ${previous} to ${role}.`, user._id);
  // Their open tabs reload, so the menu matches the new role straight away.
  publish(user._id, "session");

  res.json({ id: user._id, name: user.name, email: user.email, role: user.role });
}

// Account recovery without email: there is no mail service to send a reset
// link, so a person who forgets their password asks an Admin, who issues a
// one-time temporary password. It is shown to the Admin once, every session
// the account had is ended, and the owner must replace it at their next login
// (see requireAuth), so the Admin does not keep a working password for it.
async function resetPassword(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  if (String(user._id) === req.user.id) {
    return res.status(400).json({ error: "Use Settings to change your own password." });
  }

  // 12 characters from an alphabet without look-alikes (0/O, 1/l/I), so it
  // can be read out or copied by hand without mistakes.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  // randomInt, not a byte modulo the alphabet size, so every character is
  // equally likely.
  const temporaryPassword = Array.from({ length: 12 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");

  user.passwordHash = await hashPassword(temporaryPassword);
  user.mustChangePassword = true;
  await user.save();
  await destroyUserSessions(user._id);
  await logAction(req.user.name, "Password Reset", `Temporary password issued for ${user.name} (${user.email}).`);

  res.json({ temporaryPassword });
}

async function remove(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  if (String(user._id) === req.user.id) {
    return res.status(400).json({ error: "You cannot delete your own account." });
  }
  if (user.role === "Admin") {
    const admins = await User.countDocuments({ role: "Admin" });
    if (admins <= 1) {
      return res.status(400).json({ error: "This is the only Admin account and cannot be deleted." });
    }
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
  ]);

  await logAction(req.user.name, "Account Deleted", `${user.name} (${user.email}) removed, with their bills, budgets, entries and notes.`);
  res.json({ ok: true });
}

module.exports = { list, setRole, resetPassword, remove };
