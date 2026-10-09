const { Schema, model } = require("mongoose");

// The audit trail and the integration log in one place (spec sections 8.4,
// 7.6 and 15): when, who, what, whether it worked, the record it concerned,
// and — for a failure — why.
//
// Each line also says who may see it:
//   "user"   — the person's own money activity (My Activity); the Admin does
//              not see it, because it would show what people spend.
//   "system" — sign-ins, accounts, settings, security (Admin Activity Log).
//   "both"   — security events about a person's own account, such as a
//              password change: shown to that person and to the Admin.
const AuditLogSchema = new Schema({
  ts: { type: Date, default: Date.now, index: true },
  user: { type: String, required: true },
  // Who did it, for the person's own feed. Empty for the reminder service.
  actorId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  action: { type: String, required: true },
  detail: { type: String, default: "" },
  // Entries written before these fields existed read as successes.
  status: { type: String, enum: ["Success", "Failed"], default: "Success" },
  scope: { type: String, enum: ["user", "system", "both"], default: "system", index: true },
  // The id of the record the action concerned (an entry, bill, account …),
  // so every log line of one workflow run can be traced together.
  ref: { type: String, default: "" },
});

module.exports = model("AuditLog", AuditLogSchema);
