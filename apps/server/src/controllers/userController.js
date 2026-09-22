const User = require("../models/User");
const { refreshUserSessions, destroyUserSessions } = require("../services/sessions");
const { logAction, notify } = require("../services/audit");

const ROLES = ["Admin", "Reviewer", "User"];

async function list(req, res) {
  const users = await User.find().select("-passwordHash").sort({ role: 1, name: 1 });
  res.json(users);
}

// Role assignment is Admin-only and never self-service: this is the other half
// of least privilege (spec section 8.2). Registration always creates a User;
// promotion to Reviewer or Admin happens only here.
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
  refreshUserSessions(user._id, { role });
  await logAction(req.user.name, "Role Changed", `${user.name}: ${previous} -> ${role}.`);
  await notify("role", `Your role was changed from ${previous} to ${role}.`, user._id);

  res.json({ id: user._id, name: user.name, email: user.email, role: user.role });
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
  destroyUserSessions(user._id);
  await logAction(req.user.name, "Account Deleted", `${user.name} (${user.email}) removed.`);
  res.json({ ok: true });
}

module.exports = { list, setRole, remove };
