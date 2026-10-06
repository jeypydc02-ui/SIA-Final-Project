const AuditLog = require("../models/AuditLog");

async function list(req, res) {
  const filter = req.query.status === "Failed" ? { status: "Failed" } : {};
  const logs = await AuditLog.find(filter).sort({ ts: -1 }).limit(300).lean();
  res.json(logs);
}

module.exports = { list };
