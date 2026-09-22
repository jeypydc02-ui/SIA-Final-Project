const Notification = require("../models/Notification");

async function list(req, res) {
  const notifs = await Notification.find({ user: req.user.id }).sort({ ts: -1 }).limit(100);
  res.json(notifs);
}

// Puts the previously unused `read` flag to work, so the bell can show an
// unread count instead of an ever-growing list.
async function markRead(req, res) {
  const notif = await Notification.findById(req.params.id);
  if (!notif) return res.status(404).json({ error: "Notification not found." });
  if (String(notif.user) !== req.user.id) {
    return res.status(403).json({ error: "You can only update your own notifications." });
  }
  notif.read = true;
  await notif.save();
  res.json(notif);
}

async function markAllRead(req, res) {
  const result = await Notification.updateMany(
    { user: req.user.id, read: false },
    { $set: { read: true } }
  );
  res.json({ ok: true, updated: result.modifiedCount });
}

module.exports = { list, markRead, markAllRead };
