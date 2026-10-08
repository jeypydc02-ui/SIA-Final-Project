const crypto = require("crypto");
const User = require("../models/User");
const PendingRegistration = require("../models/PendingRegistration");
const PasswordReset = require("../models/PasswordReset");
const {
  createSession,
  destroySession,
  refreshUserSessions,
  destroyUserSessions,
} = require("../services/sessions");
const { hashPassword, verifyPassword, burnTime } = require("../services/passwords");
const { logAction } = require("../services/audit");
const { publish } = require("../services/events");
const { sendMail, layout } = require("../services/mailer");
const { isString, isNonEmptyString, passwordProblem } = require("../utils/validate");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_MS = 10 * 60 * 1000;      // a sign-up code lasts 10 minutes
const CODE_MAX_ATTEMPTS = 5;             // then a new code must be requested
const RESEND_AFTER_MS = 60 * 1000;       // at most one new code a minute
const RESET_TTL_MS = 30 * 60 * 1000;     // a reset link lasts 30 minutes

const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const sameHash = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const newCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");

// Sends an e-mail; if the mail service fails, answers 503 with a plain
// message (and logs it) instead of a generic server error. Returns false then.
async function mailOrFail(res, send, who) {
  try {
    await send();
    return true;
  } catch (err) {
    console.error("[mail] could not send:", err.message);
    await logAction(who || "System", "E-mail Failed", err.message, { status: "Failed" }).catch(() => {});
    res.status(503).json({ error: "We could not send the e-mail right now. Please try again in a few minutes." });
    return false;
  }
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}

// Where a reset link points: APP_URL, or the address Render gives the
// service (RENDER_EXTERNAL_URL). In production it is never taken from the
// request, or a forged Host header could make the e-mail carry a link to
// someone else's site; without either setting the e-mail is not sent. In
// development it is the localhost client, or this server.
function appUrl(req) {
  const configured = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("APP_URL is not set, so no reset link can be made.");
  const origin = req.get("origin") || "";
  if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return origin;
  return `${req.protocol}://${req.get("host")}`;
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
    await logAction(user, "Failed Login", "Incorrect password.", { status: "Failed", ref: user._id });
    return res.status(401).json({ error: "Invalid email or password." });
  }
  // Checked only after the password, so the message never tells a stranger
  // which addresses belong to deactivated accounts.
  if (user.active === false) {
    await logAction(user, "Failed Login", "Account is deactivated.", { status: "Failed", ref: user._id });
    return res.status(403).json({ error: "This account has been deactivated. Contact your administrator." });
  }
  if (needsRehash) {
    // Written with updateOne so an older account missing a newer schema field
    // is not blocked from logging in by validation of unrelated fields.
    await User.updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(password) } });
  }
  const token = await createSession(user);
  await logAction(user, "Login", `Successful authentication (${user.role})`, { ref: user._id });
  res.json({ token, user: publicUser(user) });
}

// ---- Registration with an e-mail code ----------------------------------
// Step 1: details in, code out. Nothing is created but a pending row.
async function registerStart(req, res) {
  const { firstName, lastName, email, password } = req.body || {};
  if (!isNonEmptyString(firstName) || !isNonEmptyString(lastName) || !isNonEmptyString(email) || !isString(password)) {
    return res.status(400).json({ error: "First name, last name, email, and password are required." });
  }
  if (firstName.trim().length > 60 || lastName.trim().length > 60) {
    return res.status(400).json({ error: "Names cannot be longer than 60 characters." });
  }
  const pwProblem = passwordProblem(password);
  if (pwProblem) return res.status(400).json({ error: pwProblem });
  const normalizedEmail = email.toLowerCase().trim();
  if (!EMAIL_RE.test(normalizedEmail) || normalizedEmail.length > 160) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  if (await User.exists({ email: normalizedEmail })) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  const code = newCode();
  await PendingRegistration.findOneAndUpdate(
    { email: normalizedEmail },
    { $set: {
      firstName: firstName.trim(), lastName: lastName.trim(), passwordHash: await hashPassword(password),
      codeHash: sha256(code), attempts: 0, lastSentAt: new Date(), expiresAt: new Date(Date.now() + CODE_TTL_MS),
    } },
    { upsert: true }
  );
  if (!(await mailOrFail(res, () => sendCode(normalizedEmail, firstName.trim(), code)))) return;
  res.json({ ok: true, email: normalizedEmail, expiresInMinutes: CODE_TTL_MS / 60000 });
}

async function sendCode(email, firstName, code) {
  await sendMail({
    to: email,
    subject: `${code} is your FinTrack Stark code`,
    text: `Hi ${firstName},\n\nYour FinTrack Stark sign-up code is ${code}. It expires in 10 minutes.\n\nIf you did not try to create an account, ignore this e-mail.`,
    html: layout({ heading: `Hi ${firstName}, confirm your e-mail`, intro: "Enter this code in FinTrack Stark to finish creating your account:", highlight: code, outro: "The code expires in 10 minutes. If you did not try to create an account, you can ignore this e-mail." }),
  });
}

// Step 1b: a new code, at most once a minute.
async function registerResend(req, res) {
  const email = isString(req.body && req.body.email) ? req.body.email.toLowerCase().trim() : "";
  const pending = email && await PendingRegistration.findOne({ email });
  if (!pending) return res.status(404).json({ error: "Start again — that sign-up has expired." });
  const wait = RESEND_AFTER_MS - (Date.now() - pending.lastSentAt.getTime());
  if (wait > 0) {
    return res.status(429).json({ error: `Please wait ${Math.ceil(wait / 1000)} seconds before asking for a new code.` });
  }
  const code = newCode();
  pending.codeHash = sha256(code);
  pending.attempts = 0;
  pending.lastSentAt = new Date();
  pending.expiresAt = new Date(Date.now() + CODE_TTL_MS);
  await pending.save();
  if (!(await mailOrFail(res, () => sendCode(email, pending.firstName, code)))) return;
  res.json({ ok: true });
}

// Step 2: the right code creates the account and signs it in.
async function registerVerify(req, res) {
  const { email, code } = req.body || {};
  if (!isNonEmptyString(email) || !isString(code) || !/^\d{6}$/.test(code.trim())) {
    return res.status(400).json({ error: "Enter the 6-digit code from the e-mail." });
  }
  const normalizedEmail = email.toLowerCase().trim();
  // Each try is claimed atomically before the code is compared, so guesses
  // sent in parallel still get CODE_MAX_ATTEMPTS tries in all, not each.
  const pending = await PendingRegistration.findOneAndUpdate(
    { email: normalizedEmail, expiresAt: { $gt: new Date() }, attempts: { $lt: CODE_MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { new: true }
  );
  if (!pending) {
    const stale = await PendingRegistration.findOne({ email: normalizedEmail });
    if (stale && stale.expiresAt.getTime() > Date.now()) {
      return res.status(429).json({ error: "Too many wrong codes. Ask for a new one." });
    }
    return res.status(410).json({ error: "This code has expired. Ask for a new one." });
  }
  if (!sameHash(sha256(code.trim()), pending.codeHash)) {
    const left = CODE_MAX_ATTEMPTS - pending.attempts;
    return res.status(400).json({ error: left > 0 ? `That code is not right. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many wrong codes. Ask for a new one." });
  }

  let user;
  try {
    user = await User.create({
      firstName: pending.firstName, lastName: pending.lastName, name: `${pending.firstName} ${pending.lastName}`.trim(),
      email: normalizedEmail, passwordHash: pending.passwordHash, role: "User",
    });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "An account with this email already exists." });
    throw err;
  }
  await PendingRegistration.deleteOne({ _id: pending._id });
  const token = await createSession(user);
  await logAction(user, "Account Created", "Self-registered account, e-mail confirmed with a code (role: User).", { ref: user._id });
  res.status(201).json({ token, user: publicUser(user) });
}

// ---- Forgot password by e-mail -------------------------------------------
// Always the same answer, so the form never reveals which e-mails have accounts.
async function forgotPassword(req, res) {
  const email = isString(req.body && req.body.email) ? req.body.email.toLowerCase().trim() : "";
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Please enter a valid email address." });
  const answer = { ok: true, message: "If an account uses that e-mail, a link to set a new password is on its way." };

  const user = await User.findOne({ email });
  if (!user || user.active === false) return res.json(answer);

  const token = crypto.randomBytes(32).toString("hex");
  await PasswordReset.create({ user: user._id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) });
  const sent = await mailOrFail(res, () => {
    const link = `${appUrl(req)}/reset-password?token=${token}`;
    return sendMail({
      to: user.email,
      subject: "Set a new FinTrack Stark password",
      text: `Hi ${user.firstName},\n\nSomeone asked to reset the password of your FinTrack Stark account. To choose a new password, open this link (it works once and expires in 30 minutes):\n\n${link}\n\nIf it was not you, ignore this e-mail — your password stays the same.`,
      html: layout({ heading: `Hi ${user.firstName}, set a new password`, intro: "Someone asked to reset the password of your FinTrack Stark account. The link works once and expires in 30 minutes.", button: { href: link, label: "Set a new password" }, outro: "If it was not you, ignore this e-mail — your password stays the same." }),
    });
  }, user);
  if (!sent) return;
  await logAction(user, "Password Reset Requested", "Reset link sent by e-mail.", { ref: user._id });
  res.json(answer);
}

async function resetPassword(req, res) {
  const { token, password } = req.body || {};
  if (!isNonEmptyString(token) || !isString(password)) {
    return res.status(400).json({ error: "The link and a new password are both required." });
  }
  const pwProblem = passwordProblem(password, "New password");
  if (pwProblem) return res.status(400).json({ error: pwProblem });

  // Claimed atomically, so one link sets one password.
  const reset = await PasswordReset.findOneAndUpdate(
    { tokenHash: sha256(token), usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { new: true }
  );
  if (!reset) return res.status(400).json({ error: "This link has expired or was already used. Ask for a new one." });
  const user = await User.findById(reset.user);
  if (!user || user.active === false) return res.status(400).json({ error: "This link has expired or was already used. Ask for a new one." });

  user.passwordHash = await hashPassword(password);
  await user.save();
  // Every device signs in again with the new password; older links stop working.
  await destroyUserSessions(user._id);
  await PasswordReset.deleteMany({ user: user._id, _id: { $ne: reset._id } });
  // Tabs still open on the old password ask for the new one at once.
  publish(user._id, "session");
  await logAction(user, "Password Reset", "New password set from the e-mailed link; all sessions signed out.", { ref: user._id });
  res.json({ ok: true });
}

// Lets the client restore a session after a page refresh: the token lives in
// sessionStorage, but only the server can say whether it is still valid.
async function me(req, res) {
  const user = await User.findById(req.user.id).select("-passwordHash");
  if (!user || user.active === false) {
    await destroySession(req.token);
    return res.status(401).json({ error: "Account no longer exists.", sessionEnded: true });
  }
  res.json({ user: publicUser(user) });
}

async function updateProfile(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: "Account not found." });

  const { firstName, lastName, email } = req.body || {};
  if ([firstName, lastName, email].some((v) => v !== undefined && !isString(v))) {
    return res.status(400).json({ error: "Name and email must be text." });
  }
  if (email !== undefined) {
    const normalized = email.toLowerCase().trim();
    if (!EMAIL_RE.test(normalized)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }
    const clash = await User.findOne({ email: normalized, _id: { $ne: user._id } });
    if (clash) return res.status(409).json({ error: "That email is already in use." });
    user.email = normalized;
  }
  if (firstName !== undefined) {
    if (!firstName.trim()) return res.status(400).json({ error: "First name cannot be empty." });
    user.firstName = firstName.trim();
  }
  if (lastName !== undefined) {
    if (!lastName.trim()) return res.status(400).json({ error: "Last name cannot be empty." });
    user.lastName = lastName.trim();
  }
  user.name = `${user.firstName} ${user.lastName}`.trim();
  await user.save();

  // Keep the live session in step so the sidebar and audit entries stop
  // showing the old name immediately.
  await refreshUserSessions(user._id, { name: user.name, email: user.email });
  await logAction(user, "Profile Updated", "Account details changed by the owner.", { ref: user._id });
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
    await logAction(user, "Failed Password Change", "Current password did not match.", { status: "Failed", ref: user._id });
    return res.status(401).json({ error: "Your current password is incorrect." });
  }
  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  // Changing a password logs out every other device, then re-issues a token
  // for the session that made the change.
  await destroyUserSessions(user._id);
  const token = await createSession(user);
  await logAction(user, "Password Changed", "All other sessions were signed out.", { ref: user._id });
  res.json({ token, user: publicUser(user) });
}

async function logout(req, res) {
  await logAction(req.user, "Logout", "Session ended.", { ref: req.user.id });
  await destroySession(req.token);
  res.json({ ok: true });
}

module.exports = {
  login, registerStart, registerResend, registerVerify, forgotPassword, resetPassword,
  me, updateProfile, changePassword, logout,
};
