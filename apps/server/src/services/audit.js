const AuditLog = require("../models/AuditLog");
const { publish, publishToAdmins } = require("./events");

// Who sees which action (see models/AuditLog.js). Anything not listed is a
// system/security event for the Admin.
const USER_ACTIONS = new Set([
  "Income Recorded", "Expense Recorded", "Transaction Edited", "Transaction Deleted",
  "Bill Created", "Bill Updated", "Bill Deleted", "Payment Recorded",
  "Budget Created", "Budget Updated", "Budget Deleted", "Profile Updated",
]);
const BOTH_ACTIONS = new Set(["Password Changed", "Password Reset", "Failed Password Change"]);

function scopeOf(action) {
  if (USER_ACTIONS.has(action)) return "user";
  if (BOTH_ACTIONS.has(action)) return "both";
  return "system";
}

// Records who did what.
//   logAction(req.user, "Bill Created", "…")                  a person (has id + name)
//   logAction("Reminder Service", "Reminder Sweep", "…")      a service (a name only)
//   logAction(user, action, detail, { status: "Failed", ref, scope })
async function logAction(actor, action, detail, { status = "Success", ref = "", scope } = {}) {
  const name = typeof actor === "string" ? actor : actor.name;
  const actorId = typeof actor === "string" ? null : (actor.id || actor._id || null);
  const finalScope = scope || scopeOf(action);
  await AuditLog.create({ user: name, actorId, action, detail, status, scope: finalScope, ref: ref ? String(ref) : "" });
  // Open screens refresh: the person's own feed, and/or the Admin's log.
  if (actorId && finalScope !== "system") publish(actorId, "activity");
  if (finalScope !== "user") publishToAdmins("audit");
}

// A failure is logged without ever turning into a second failure: if the
// database itself is what failed, the original error is what matters.
async function logFailure(actor, action, detail, ref, scope) {
  try {
    await logAction(actor, action, detail, { status: "Failed", ref, scope });
  } catch (err) {
    console.error("[audit] could not record a failure:", err.message);
  }
}

module.exports = { logAction, logFailure, scopeOf };
