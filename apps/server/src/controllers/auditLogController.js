const AuditLog = require("../models/AuditLog");

async function list(req, res) {
  const logs = await AuditLog.find().sort({ ts: -1 }).limit(300);
  res.json(logs);
}

module.exports = { list };
