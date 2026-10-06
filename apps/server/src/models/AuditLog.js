const { Schema, model } = require("mongoose");

// The audit trail and the integration log in one place (spec sections 8.4,
// 7.6 and 15): when, who, what, whether it worked, the record it concerned,
// and — for a failure — why.
const AuditLogSchema = new Schema({
  ts: { type: Date, default: Date.now, index: true },
  user: { type: String, required: true },
  action: { type: String, required: true },
  detail: { type: String, default: "" },
  // Entries written before these fields existed read as successes.
  status: { type: String, enum: ["Success", "Failed"], default: "Success" },
  // The id of the record the action concerned (an entry, bill, receipt …),
  // so every log line of one workflow run can be traced together.
  ref: { type: String, default: "" },
});

module.exports = model("AuditLog", AuditLogSchema);
