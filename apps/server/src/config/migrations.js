const Transaction = require("../models/Transaction");
const User = require("../models/User");
const Session = require("../models/Session");

// One-off data changes that run every time the API starts. Each step is a
// no-op once the data has been converted, so running it again is harmless.
//
// Review and approval was removed: entries now count the moment they are
// recorded, and the Reviewer role no longer exists.
//   - Entries still waiting for a decision become current, counted entries.
//   - Reviewer accounts, and their open sessions, become ordinary Users.
// Rejected and "Needs Revision" entries are left as they were: a decision was
// made on them, and the owner can still edit a "Needs Revision" entry.
async function runMigrations(log = console.log) {
  const pending = await Transaction.updateMany(
    { status: "Pending Review" },
    { $set: { status: "Approved" } }
  );
  const reviewers = await User.updateMany({ role: "Reviewer" }, { $set: { role: "User" } });
  await Session.updateMany({ role: "Reviewer" }, { $set: { role: "User" } });

  if (pending.modifiedCount || reviewers.modifiedCount) {
    log(`[migrate] ${pending.modifiedCount} pending entr(ies) recorded; ${reviewers.modifiedCount} Reviewer account(s) changed to User.`);
  }
}

module.exports = { runMigrations };
