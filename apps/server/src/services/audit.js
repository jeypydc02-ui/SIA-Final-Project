const AuditLog = require("../models/AuditLog");

// Records who did what, for the Audit Log screen.
async function logAction(userName, action, detail) {
  await AuditLog.create({ user: userName, action, detail });
}

module.exports = { logAction };
