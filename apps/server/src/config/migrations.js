const Transaction = require("../models/Transaction");
const User = require("../models/User");
const Session = require("../models/Session");
const Notification = require("../models/Notification");

// One-off data changes that run every time the API starts. Each step is a
// no-op once the data has been converted, so running it again is harmless.
//
// Review and approval was removed: entries now count the moment they are
// recorded, and the Reviewer role no longer exists.
//   - Entries still waiting for a decision become current, counted entries.
//   - Reviewer accounts, and their open sessions, become ordinary Users.
//   - "X submitted an entry for review" alerts are removed: they asked an
//     Admin to act on a queue that no longer exists.
// Rejected and "Needs Revision" entries are left as they were: a decision was
// made on them, and the owner can still edit a "Needs Revision" entry.
async function runMigrations(log = console.log) {
  const pending = await Transaction.updateMany(
    { status: "Pending Review" },
    { $set: { status: "Approved" } }
  );
  const reviewers = await User.updateMany({ role: "Reviewer" }, { $set: { role: "User" } });
  await Session.updateMany({ role: "Reviewer" }, { $set: { role: "User" } });
  const queueAlerts = await Notification.deleteMany({ type: "submission" });

  if (pending.modifiedCount || reviewers.modifiedCount || queueAlerts.deletedCount) {
    log(`[migrate] ${pending.modifiedCount} pending entr(ies) recorded; ${reviewers.modifiedCount} Reviewer account(s) changed to User; ${queueAlerts.deletedCount} old review alert(s) removed.`);
  }
}

module.exports = { runMigrations };
