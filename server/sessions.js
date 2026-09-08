// In-memory session store: token -> { id, name, email, role }
// A demo-scale prototype does not need a persisted session table; documented as
// a known simplification (sessions reset on server restart).
const sessions = new Map();

function createSession(user) {
  const token = "tok_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessions.set(token, { id: String(user._id), name: user.name, email: user.email, role: user.role });
  return token;
}

function getSession(token) {
  return sessions.get(token) || null;
}

function destroySession(token) {
  sessions.delete(token);
}

module.exports = { createSession, getSession, destroySession };
