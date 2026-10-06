const crypto = require("crypto");
const Session = require("../models/Session");
const { getSettings } = require("./settings");

// Persisted session store (see models/Session.js for why it is not in memory).
// The public shape of a session is unchanged: { id, name, email, role }.

// Eight hours by default: longer than any working day on the app but short
// enough that a token left behind on a shared lab machine stops working the
// same day. The Admin can change it (system settings); it applies to new
// sign-ins, never cutting short a session already open.
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function createSession(user) {
  // crypto.randomBytes, not Math.random: session tokens are credentials, and
  // Math.random is a predictable PRNG that must never be used for one.
  const token = crypto.randomBytes(32).toString("hex");
  await Session.create({
    tokenHash: hashToken(token),
    user: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: !!user.mustChangePassword,
    expiresAt: new Date(Date.now() + (await getSettings()).sessionHours * 60 * 60 * 1000),
  });
  return token;
}

async function getSession(token) {
  if (typeof token !== "string" || !token) return null;
  const s = await Session.findOne({ tokenHash: hashToken(token) }).lean();
  if (!s) return null;
  // The TTL monitor only runs about once a minute, so check the clock too.
  if (s.expiresAt.getTime() <= Date.now()) {
    await Session.deleteOne({ _id: s._id });
    return null;
  }
  return { id: String(s.user), name: s.name, email: s.email, role: s.role, mustChangePassword: !!s.mustChangePassword };
}

async function destroySession(token) {
  await Session.deleteOne({ tokenHash: hashToken(token) });
}

// When an Admin changes someone's role, that user's live sessions must stop
// carrying the old role — otherwise the demotion does not take effect until
// they happen to log out.
async function refreshUserSessions(userId, changes) {
  await Session.updateMany({ user: userId }, { $set: changes });
}

async function destroyUserSessions(userId) {
  await Session.deleteMany({ user: userId });
}

module.exports = {
  createSession,
  getSession,
  destroySession,
  refreshUserSessions,
  destroyUserSessions,
  SESSION_TTL_MS,
};
