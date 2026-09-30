const User = require("../models/User");
const {
  createSession,
  destroySession,
  refreshUserSessions,
  destroyUserSessions,
} = require("../services/sessions");
const { hashPassword, verifyPassword, burnTime } = require("../services/passwords");
const { logAction } = require("../services/audit");
const { isString, isNonEmptyString, passwordProblem } = require("../utils/validate");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user) {
  return {
    id: user._id, name: user.name, email: user.email, role: user.role,
    // Set when an Admin issued a temporary password; the client then asks the
    // user to choose their own before doing anything else.
    mustChangePassword: !!user.mustChangePassword,
  };
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    await burnTime(password);
    return res.status(401).json({ error: "Invalid email or password." });
  }
  const { ok, needsRehash } = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await logAction(user.name, "Failed Login", "Incorrect password.");
    return res.status(401).json({ error: "Invalid email or password." });
  }
  if (needsRehash) {
    // Written with updateOne so an older account missing a newer schema field
    // is not blocked from logging in by validation of unrelated fields.
    await User.updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(password) } });
  }
  const token = await createSession(user);
  await logAction(user.name, "Login", `Successful authentication (${user.role})`);
  res.json({ token, user: publicUser(user) });
}

// Public self-registration. Always creates a "User" role account — Reviewer
// and Admin accounts are assigned by an existing Admin, never self-selected,
// to keep least-privilege intact (spec section 8.2).
async function register(req, res) {
  const { firstName, lastName, email, password } = req.body || {};
  if (!isNonEmptyString(firstName) || !isNonEmptyString(lastName) || !isNonEmptyString(email) || !isString(password)) {
    return res.status(400).json({ error: "First name, last name, email, and password are required." });
  }
  const pwProblem = passwordProblem(password);
  if (pwProblem) return res.status(400).json({ error: pwProblem });

  const normalizedEmail = email.toLowerCase().trim();
  if (!EMAIL_RE.test(normalizedEmail)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }
  const passwordHash = await hashPassword(password);
  const name = `${firstName.trim()} ${lastName.trim()}`.trim();
  const user = await User.create({
    firstName: firstName.trim(), lastName: lastName.trim(), name,
    email: normalizedEmail, passwordHash, role: "User",
  });
  const token = await createSession(user);
  await logAction(user.name, "Account Created", "Self-registered account (role: User).");
  res.status(201).json({ token, user: publicUser(user) });
}

// Lets the client restore a session after a page refresh: the token lives in
// sessionStorage, but only the server can say whether it is still valid.
async function me(req, res) {
  const user = await User.findById(req.user.id).select("-passwordHash");
  if (!user) {
    await destroySession(req.token);
    return res.status(401).json({ error: "Account no longer exists.", sessionEnded: true });
  }
  res.json({ user: publicUser(user) });
}

async function updateProfile(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: "Account not found." });

  const { firstName, lastName, email } = req.body || {};
  if (email !== undefined) {
    const normalized = String(email).toLowerCase().trim();
    if (!EMAIL_RE.test(normalized)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }
    const clash = await User.findOne({ email: normalized, _id: { $ne: user._id } });
    if (clash) return res.status(409).json({ error: "That email is already in use." });
    user.email = normalized;
  }
  if (firstName !== undefined) {
    if (!String(firstName).trim()) return res.status(400).json({ error: "First name cannot be empty." });
    user.firstName = String(firstName).trim();
  }
  if (lastName !== undefined) {
    if (!String(lastName).trim()) return res.status(400).json({ error: "Last name cannot be empty." });
    user.lastName = String(lastName).trim();
  }
  user.name = `${user.firstName} ${user.lastName}`.trim();
  await user.save();

  // Keep the live session in step so the sidebar and audit entries stop
  // showing the old name immediately.
  await refreshUserSessions(user._id, { name: user.name, email: user.email });
  await logAction(user.name, "Profile Updated", "Account details changed by the owner.");
  res.json({ user: publicUser(user) });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};
  if (!isNonEmptyString(currentPassword) || !isString(newPassword)) {
    return res.status(400).json({ error: "Current and new password are both required." });
  }
  const pwProblem = passwordProblem(newPassword, "New password");
  if (pwProblem) return res.status(400).json({ error: pwProblem });

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: "Account not found." });

  const { ok } = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    await logAction(user.name, "Failed Password Change", "Current password did not match.");
    return res.status(401).json({ error: "Your current password is incorrect." });
  }
  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();

  // Changing a password logs out every other device, then re-issues a token
  // for the session that made the change.
  await destroyUserSessions(user._id);
  const token = await createSession(user);
  await logAction(user.name, "Password Changed", "All other sessions were signed out.");
  res.json({ token, user: publicUser(user) });
}

async function logout(req, res) {
  await logAction(req.user.name, "Logout", "Session ended.");
  await destroySession(req.token);
  res.json({ ok: true });
}

module.exports = { login, register, me, updateProfile, changePassword, logout };
