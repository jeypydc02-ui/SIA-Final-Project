const AuditLog = require("../models/AuditLog");
const { publishToAdmins } = require("./events");

// Records who did what, for the Audit Log screen.
async function logAction(userName, action, detail) {
  await AuditLog.create({ user: userName, action, detail });
  // Every recorded action shows up on the Admin Console as it happens.
  publishToAdmins("audit");
}

module.exports = { logAction };
