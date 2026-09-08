const { Schema, model } = require("mongoose");

const NotificationSchema = new Schema({
  type: { type: String, required: true },
  message: { type: String, required: true },
  ts: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
});

module.exports = model("Notification", NotificationSchema);
