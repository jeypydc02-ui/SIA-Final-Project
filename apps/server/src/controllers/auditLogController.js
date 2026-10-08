const AuditLog = require("../models/AuditLog");

// The Admin's log holds security and system events only (sign-ins, sign-ups,
// account changes, settings). What a User does with their own money stays on
// their own My Activity feed; password changes appear in both.
async function list(req, res) {
  const filter = { scope: { $in: ["system", "both"] } };
  if (req.query.status === "Failed") filter.status = "Failed";
  const logs = await AuditLog.find(filter).sort({ ts: -1 }).limit(300).lean();
  res.json(logs);
}

module.exports = { list };
