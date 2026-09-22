const AuditLog = require("../models/AuditLog");
const Notification = require("../models/Notification");
const User = require("../models/User");

async function logAction(userName, action, detail) {
  await AuditLog.create({ user: userName, action, detail });
}

// Notify one user.
async function notify(type, message, userId) {
  if (!userId) return;
  await Notification.create({ type, message, user: userId });
}

// Notify everyone holding one of the given roles — used for events that the
// approval queue needs to see, such as a new submission awaiting review.
// One row per recipient keeps the per-user filter in the notifications route
// simple and makes the audit trail explicit about who was told what.
async function notifyRoles(type, message, roles) {
  const recipients = await User.find({ role: { $in: roles } }).select("_id");
  if (!recipients.length) return;
  await Notification.insertMany(
    recipients.map((r) => ({ type, message, user: r._id }))
  );
}

module.exports = { logAction, notify, notifyRoles };
