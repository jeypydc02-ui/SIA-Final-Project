const { Schema, model } = require("mongoose");

// Sessions live in the database rather than in the API's memory. In memory,
// every restart or redeploy silently signed out everyone at once, and the API
// could never run as more than one process because each held its own list.
const SessionSchema = new Schema({
  // SHA-256 of the bearer token. The token itself is never stored, so a leaked
  // database backup does not hand out working sessions.
  tokenHash: { type: String, required: true, unique: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, required: true },
  // Copied from the user at login: a session opened with an Admin-issued
  // temporary password can do nothing but replace it.
  mustChangePassword: { type: Boolean, default: false },
  // MongoDB's TTL monitor deletes the row once this moment passes, so expired
  // sessions clean themselves up.
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

module.exports = model("Session", SessionSchema);
