const { EventEmitter } = require("events");

// In-process change feed for live updates (see routes/events.js).
//
// Whenever something a user can see changes — a notification, a bill, an
// entry — the code that changed it publishes a small "something changed"
// message here, addressed to that user (or to every Admin, for system-wide
// things like the audit log). Each open browser tab holds a Server-Sent Events
// connection and, on a message meant for it, fetches fresh data.
//
// Only "what changed", never the data itself, travels this way: the browser
// always reloads through the normal, authorised API.
//
// One process is enough for this deployment. Several API processes would need
// a shared channel (for example MongoDB change streams) instead of this
// EventEmitter.
const bus = new EventEmitter();
bus.setMaxListeners(0); // one listener per open tab

function publish(userId, topic) {
  if (!userId) return;
  bus.emit("change", { userId: String(userId), topic });
}

function publishToAdmins(topic) {
  bus.emit("change", { role: "Admin", topic });
}

function subscribe(listener) {
  bus.on("change", listener);
  return () => bus.off("change", listener);
}

module.exports = { publish, publishToAdmins, subscribe };
