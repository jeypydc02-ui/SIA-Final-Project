const { Schema, model } = require("mongoose");

const NotificationSchema = new Schema({
  // Recipient. Every notification is addressed to exactly one user so that
  // "your expense was approved" reaches only the submitter (NFR-002).
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, required: true },
  message: { type: String, required: true },
  ts: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
});

module.exports = model("Notification", NotificationSchema);
