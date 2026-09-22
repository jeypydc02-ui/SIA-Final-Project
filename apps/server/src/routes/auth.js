const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { createSession, destroySession } = require("../services/sessions");
const { requireAuth } = require("../middleware/auth");
const { logAction } = require("../services/audit");

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials." });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials." });
  }
  const token = createSession(user);
  await logAction(user.name, "Login", `Successful authentication (${user.role})`);
  res.json({
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

// Public self-registration. Always creates a "User" role account — Reviewer
// and Admin accounts are assigned by an existing Admin, never self-selected,
// to keep least-privilege intact.
router.post("/register", async (req, res) => {
  const { firstName, lastName, email, password } = req.body || {};
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: "First name, last name, email, and password are required." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }
  const normalizedEmail = String(email).toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const name = `${firstName.trim()} ${lastName.trim()}`.trim();
  const user = await User.create({
    firstName: firstName.trim(), lastName: lastName.trim(), name,
    email: normalizedEmail, passwordHash, role: "User",
  });
  const token = createSession(user);
  await logAction(user.name, "Account Created", "Self-registered account (role: User).");
  res.status(201).json({
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

router.post("/logout", requireAuth, async (req, res) => {
  await logAction(req.user.name, "Logout", "Session ended.");
  destroySession(req.token);
  res.json({ ok: true });
});

module.exports = router;
