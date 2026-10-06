const Notification = require("../models/Notification");
const User = require("../models/User");
const { publish } = require("./events");

// Notify one user.
async function notify(type, message, userId) {
  if (!userId) return;
  await Notification.create({ type, message, user: userId });
  publish(userId, "notifications");
}

// Notify everyone with a role (a new receipt reaches every Reviewer), except
// the person who caused it.
async function notifyRole(role, type, message, exceptUserId) {
  const recipients = await User.find({ role, _id: { $ne: exceptUserId } }).select("_id").lean();
  if (!recipients.length) return;
  await Notification.insertMany(recipients.map((u) => ({ type, message, user: u._id })));
  recipients.forEach((u) => publish(u._id, "notifications"));
}

module.exports = { notify, notifyRole };
