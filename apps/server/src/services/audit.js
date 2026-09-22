const AuditLog = require("../models/AuditLog");
const Notification = require("../models/Notification");

async function logAction(userName, action, detail) {
  await AuditLog.create({ user: userName, action, detail });
}

async function notify(type, message) {
  await Notification.create({ type, message });
}

module.exports = { logAction, notify };
