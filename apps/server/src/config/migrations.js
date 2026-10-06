const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");
const User = require("../models/User");
const Session = require("../models/Session");

// One-off data changes that run every time the API starts. Each step is a
// no-op once the data has been converted, so running it again is harmless.
//
// Entries no longer wait for approval before they count (what is reviewed
// now is the receipt attached to an entry, see models/Receipt.js):
//   - Entries still waiting under the old entry-approval step become current,
//     counted entries.
//   - "X submitted an entry for review" alerts from that step are removed:
//     they asked someone to act on a queue that no longer exists.
//   - The Reviewer role was folded into Admin (the Admin now reviews
//     receipts). Reviewer accounts become ordinary Users rather than Admins,
//     so nobody gains account-management rights by accident; an Admin can
//     promote them if that is wanted.
// Rejected and "Needs Revision" entries are left as they were: a decision was
// made on them, and the owner can still edit a "Needs Revision" entry.
async function runMigrations(log = console.log) {
  const pending = await Transaction.updateMany(
    { status: "Pending Review" },
    { $set: { status: "Approved" } }
  );
  const queueAlerts = await Notification.deleteMany({ type: "submission" });
  const reviewers = await User.collection.updateMany({ role: "Reviewer" }, { $set: { role: "User" } });
  await Session.collection.updateMany({ role: "Reviewer" }, { $set: { role: "User" } });

  if (pending.modifiedCount || queueAlerts.deletedCount || reviewers.modifiedCount) {
    log(`[migrate] ${pending.modifiedCount} pending entr(ies) recorded; ${queueAlerts.deletedCount} old entry-review alert(s) removed; ${reviewers.modifiedCount} Reviewer account(s) changed to User.`);
  }
}

module.exports = { runMigrations };
