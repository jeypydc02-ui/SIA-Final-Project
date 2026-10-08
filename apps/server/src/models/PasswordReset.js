const { Schema, model } = require("mongoose");

// A "forgot password" link. Only the SHA-256 of the link's token is stored;
// it works once and expires after 30 minutes (the row then deletes itself).
const PasswordResetSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  usedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

module.exports = model("PasswordReset", PasswordResetSchema);
