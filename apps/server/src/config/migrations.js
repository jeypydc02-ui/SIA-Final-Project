const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");
const User = require("../models/User");
const Session = require("../models/Session");
const AuditLog = require("../models/AuditLog");
const { scopeOf } = require("../services/audit");

// One-off data changes that run every time the API starts. Each step is a
// no-op once the data has been converted, so running it again is harmless.
//
//   - Entries still waiting under the old entry-approval step become current,
//     counted entries. The Admin alerts that asked someone to act on a
//     review queue (old entries, then receipts) are removed: those queues no
//     longer exist. A User's own past messages are kept.
//   - Reviewer accounts become ordinary Users rather than Admins, so nobody
//     gains account-management rights by accident.
//   - Admin-issued temporary passwords are gone (people reset their own
//     password by e-mail), so the old "must change password" flag is removed
//     from accounts and sessions.
//   - Audit lines written before the log was split get their scope: what a
//     User did with their own money belongs on their My Activity feed, the
//     rest on the Admin's security log. Lines from before the split carry no
//     actor id, so they never appear on anyone's feed; they are classified
//     only so the Admin's log keeps its security history.
//   - Receipts from the retired receipt-review feature are left in the
//     database untouched; nothing reads them any more.
async function runMigrations(log = console.log) {
  const pending = await Transaction.updateMany(
    { status: "Pending Review" },
    { $set: { status: "Approved" } }
  );
  const queueAlerts = await Notification.deleteMany({ type: { $in: ["submission", "receipt"] } });
  const reviewers = await User.collection.updateMany({ role: "Reviewer" }, { $set: { role: "User" } });
  await Session.collection.updateMany({ role: "Reviewer" }, { $set: { role: "User" } });
  await User.collection.updateMany({ mustChangePassword: { $exists: true } }, { $unset: { mustChangePassword: "" } });
  await Session.collection.updateMany({ mustChangePassword: { $exists: true } }, { $unset: { mustChangePassword: "" } });

  let scoped = 0;
  const unscoped = await AuditLog.collection.distinct("action", { scope: { $exists: false } });
  for (const action of unscoped) {
    const r = await AuditLog.collection.updateMany(
      { action, scope: { $exists: false } },
      { $set: { scope: action.startsWith("Failed:") ? "system" : scopeOf(action), actorId: null } }
    );
    scoped += r.modifiedCount;
  }

  if (pending.modifiedCount || queueAlerts.deletedCount || reviewers.modifiedCount || scoped) {
    log(`[migrate] ${pending.modifiedCount} pending entr(ies) recorded; ${queueAlerts.deletedCount} old review alert(s) removed; ${reviewers.modifiedCount} Reviewer account(s) changed to User; ${scoped} old audit line(s) classified.`);
  }
}

module.exports = { runMigrations };
