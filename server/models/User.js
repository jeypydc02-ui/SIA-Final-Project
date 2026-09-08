const { Schema, model } = require("mongoose");

const UserSchema = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  // Derived full name, stored alongside firstName/lastName so audit logs,
  // notifications, and the sidebar can keep displaying one string.
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["Admin", "Reviewer", "User"], required: true },
});

module.exports = model("User", UserSchema);
