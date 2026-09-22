const { Schema, model } = require("mongoose");

const UserSchema = new Schema({
  firstName: { type: String, required: true, trim: true, maxlength: [60, "First name cannot be longer than 60 characters."] },
  lastName: { type: String, required: true, trim: true, maxlength: [60, "Last name cannot be longer than 60 characters."] },
  // Derived full name, stored alongside firstName/lastName so audit logs,
  // notifications, and the sidebar can keep displaying one string.
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: [160, "Email cannot be longer than 160 characters."] },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["Admin", "Reviewer", "User"], required: true },
});

module.exports = model("User", UserSchema);
