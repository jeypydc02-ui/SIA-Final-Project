const AuditLog = require("../models/AuditLog");
const { publishToAdmins } = require("./events");

// Records who did what, for the Audit Log screen.
//   logAction(user, action, detail)                         a success
//   logAction(user, action, detail, { status: "Failed", ref })
async function logAction(userName, action, detail, { status = "Success", ref = "" } = {}) {
  await AuditLog.create({ user: userName, action, detail, status, ref: ref ? String(ref) : "" });
  // Every recorded action shows up on the Admin Console as it happens.
  publishToAdmins("audit");
}

// A failure is logged without ever turning into a second failure: if the
// database itself is what failed, the original error is what matters.
async function logFailure(userName, action, detail, ref) {
  try {
    await logAction(userName, action, detail, { status: "Failed", ref });
  } catch (err) {
    console.error("[audit] could not record a failure:", err.message);
  }
}

module.exports = { logAction, logFailure };
