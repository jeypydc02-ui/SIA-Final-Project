const { Schema, model } = require("mongoose");

// A sign-up waiting for its e-mail code. The account itself is created only
// when the code is entered, so an address nobody controls never becomes an
// account. The row deletes itself when it expires.
const PendingRegistrationSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  firstName: { type: String, required: true, trim: true, maxlength: 60 },
  lastName: { type: String, required: true, trim: true, maxlength: 60 },
  passwordHash: { type: String, required: true },
  // SHA-256 of the 6-digit code; the code itself is only ever in the e-mail.
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

module.exports = model("PendingRegistration", PendingRegistrationSchema);
