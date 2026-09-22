const crypto = require("crypto");

// In-memory session store: token -> { id, name, email, role, expiresAt }
// A demo-scale prototype does not need a persisted session table; documented as
// a known simplification (sessions reset on server restart).
const sessions = new Map();

// Eight hours is longer than any demo or defense session but short enough that
// a token left behind on a shared lab machine stops working the same day.
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function createSession(user) {
  // crypto.randomBytes, not Math.random: session tokens are credentials, and
  // Math.random is a predictable PRNG that must never be used for one.
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

function getSession(token) {
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function destroySession(token) {
  sessions.delete(token);
}

// When an Admin changes someone's role, that user's live sessions must stop
// carrying the old role — otherwise the demotion does not take effect until
// they happen to log out.
function refreshUserSessions(userId, changes) {
  for (const [token, session] of sessions) {
    if (session.id === String(userId)) {
      sessions.set(token, { ...session, ...changes });
    }
  }
}

function destroyUserSessions(userId) {
  for (const [token, session] of sessions) {
    if (session.id === String(userId)) sessions.delete(token);
  }
}

module.exports = {
  createSession,
  getSession,
  destroySession,
  refreshUserSessions,
  destroyUserSessions,
  SESSION_TTL_MS,
};
