const Bill = require("../models/Bill");
const Notification = require("../models/Notification");
const AuditLog = require("../models/AuditLog");
const { publish, publishToAdmins } = require("./events");
// Philippine calendar dates, shared with the rest of the API.
const { todayISO, addDaysISO, daysBetweenISO } = require("../utils/dates");

// The bill reminder sweep. Two callers run it:
//   - the stand-alone reminder worker (services/reminder), on its schedule;
//   - the API itself (services/reminderScheduler.js), once a day when it is
//     awake, for hosting where a separate worker is not available.
// Both may run on the same day, even at the same moment; see the claim step
// below for why that never produces a duplicate alert.

// Matches the peso() formatting the interface uses, so a reminder reads the
// same way as the amount shown on the bill.
function peso(n) {
  return "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// How the reminder reads depends on how close the due date is.
function describe(bill, today) {
  const delta = daysBetweenISO(bill.due, today);
  if (delta < 0) {
    const n = Math.abs(delta);
    return { type: "overdue", message: `"${bill.name}" is overdue by ${n} day${n === 1 ? "" : "s"} — ${peso(bill.amount)} still unpaid.` };
  }
  if (delta === 0) {
    return { type: "reminder", message: `"${bill.name}" is due today — ${peso(bill.amount)}.` };
  }
  return { type: "reminder", message: `"${bill.name}" is due in ${delta} day${delta === 1 ? "" : "s"} — ${peso(bill.amount)}.` };
}

/**
 * One sweep of the reminder service.
 *
 * Finds every unpaid bill that is due within `leadDays` or already overdue,
 * raises a notification addressed to the bill's owner, and records the sweep
 * in the audit trail. Bills already reminded today are skipped, so the job is
 * safe to run repeatedly.
 *
 * This is the integration point: the worker never calls the API. It writes to
 * the same MongoDB the API reads from — the shared-database integration
 * pattern (spec section 8), with the reminder service owning the
 * `lastRemindedOn` field and the API owning everything else on a bill.
 */
async function runReminderSweep({ leadDays = 3, today = todayISO(), log = console.log } = {}) {
  const horizonISO = addDaysISO(today, leadDays);

  const due = await Bill.find({
    paid: false,
    due: { $lte: horizonISO },
    createdBy: { $ne: null },
  });

  // Claim each bill for today before alerting about it. Matching on
  // lastRemindedOn inside the update means that if two sweeps run at once,
  // exactly one of them wins each bill and only that one sends the alert.
  const toRemind = [];
  for (const bill of due) {
    if (bill.lastRemindedOn === today) continue;
    const claim = await Bill.updateOne(
      { _id: bill._id, paid: false, lastRemindedOn: { $ne: today } },
      { $set: { lastRemindedOn: today } }
    );
    if (claim.modifiedCount === 1) toRemind.push(bill);
  }

  if (toRemind.length === 0) {
    log(`[reminder] ${today}: ${due.length} bill(s) in range, none need a new alert.`);
    return { scanned: due.length, notified: 0, notifications: [] };
  }

  const notifications = toRemind.map((bill) => {
    const { type, message } = describe(bill, today);
    return { user: bill.createdBy, type, message };
  });

  await Notification.insertMany(notifications);
  // Inside the API this reaches open tabs at once; in the stand-alone worker
  // nobody is listening, and the alerts appear on the next refresh.
  new Set(toRemind.map((b) => String(b.createdBy))).forEach((id) => publish(id, "notifications"));

  const overdue = notifications.filter((n) => n.type === "overdue").length;
  await AuditLog.create({
    user: "Reminder Service",
    action: "Reminder Sweep",
    detail: `${today}: scanned ${due.length} unpaid bill(s) within ${leadDays} day(s); raised ${notifications.length} alert(s) (${overdue} overdue).`,
  });
  publishToAdmins("audit");

  log(`[reminder] ${today}: raised ${notifications.length} alert(s) across ${new Set(toRemind.map((b) => String(b.createdBy))).size} account(s).`);
  return { scanned: due.length, notified: notifications.length, notifications };
}

module.exports = { runReminderSweep };
