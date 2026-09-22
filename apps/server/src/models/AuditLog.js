const { Schema, model } = require("mongoose");

const AuditLogSchema = new Schema({
  ts: { type: Date, default: Date.now },
  user: { type: String, required: true },
  action: { type: String, required: true },
  detail: { type: String, default: "" },
});

module.exports = model("AuditLog", AuditLogSchema);
