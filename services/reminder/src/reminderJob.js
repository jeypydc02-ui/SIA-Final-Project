const Bill = require("../../../apps/server/src/models/Bill");
const Notification = require("../../../apps/server/src/models/Notification");
const AuditLog = require("../../../apps/server/src/models/AuditLog");

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Matches the peso() formatting the interface uses, so a reminder reads the
// same way as the amount shown on the bill.
function peso(n) {
  return "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function daysBetween(fromISO, toISO) {
  const a = new Date(fromISO + "T00:00:00");
  const b = new Date(toISO + "T00:00:00");
  return Math.round((a - b) / 86400000);
}

// How the reminder reads depends on how close the due date is.
function describe(bill, today) {
  const delta = daysBetween(bill.due, today);
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
  const horizon = new Date(today + "T00:00:00");
  horizon.setDate(horizon.getDate() + leadDays);
  const horizonISO = horizon.toISOString().slice(0, 10);

  const due = await Bill.find({
    paid: false,
    due: { $lte: horizonISO },
    createdBy: { $ne: null },
  });

  const toRemind = due.filter((b) => b.lastRemindedOn !== today);

  if (toRemind.length === 0) {
    log(`[reminder] ${today}: ${due.length} bill(s) in range, none need a new alert.`);
    return { scanned: due.length, notified: 0, notifications: [] };
  }

  const notifications = toRemind.map((bill) => {
    const { type, message } = describe(bill, today);
    return { user: bill.createdBy, type, message };
  });

  await Notification.insertMany(notifications);
  await Bill.updateMany(
    { _id: { $in: toRemind.map((b) => b._id) } },
    { $set: { lastRemindedOn: today } }
  );

  const overdue = notifications.filter((n) => n.type === "overdue").length;
  await AuditLog.create({
    user: "Reminder Service",
    action: "Reminder Sweep",
    detail: `${today}: scanned ${due.length} unpaid bill(s) within ${leadDays} day(s); raised ${notifications.length} alert(s) (${overdue} overdue).`,
  });

  log(`[reminder] ${today}: raised ${notifications.length} alert(s) across ${new Set(toRemind.map((b) => String(b.createdBy))).size} account(s).`);
  return { scanned: due.length, notified: notifications.length, notifications };
}

module.exports = { runReminderSweep, todayISO };
