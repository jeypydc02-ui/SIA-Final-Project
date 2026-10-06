const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");

// One-off data changes that run every time the API starts. Each step is a
// no-op once the data has been converted, so running it again is harmless.
//
// Entries no longer wait for approval before they count (what is reviewed
// now is the receipt attached to an entry, see models/Receipt.js):
//   - Entries still waiting under the old entry-approval step become current,
//     counted entries.
//   - "X submitted an entry for review" alerts from that step are removed:
//     they asked someone to act on a queue that no longer exists.
// Rejected and "Needs Revision" entries are left as they were: a decision was
// made on them, and the owner can still edit a "Needs Revision" entry.
async function runMigrations(log = console.log) {
  const pending = await Transaction.updateMany(
    { status: "Pending Review" },
    { $set: { status: "Approved" } }
  );
  const queueAlerts = await Notification.deleteMany({ type: "submission" });

  if (pending.modifiedCount || queueAlerts.deletedCount) {
    log(`[migrate] ${pending.modifiedCount} pending entr(ies) recorded; ${queueAlerts.deletedCount} old entry-review alert(s) removed.`);
  }
}

module.exports = { runMigrations };
