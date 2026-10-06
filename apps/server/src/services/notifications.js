const Notification = require("../models/Notification");
const { publish } = require("./events");

// Notify one user.
async function notify(type, message, userId) {
  if (!userId) return;
  await Notification.create({ type, message, user: userId });
  publish(userId, "notifications");
}

module.exports = { notify };
