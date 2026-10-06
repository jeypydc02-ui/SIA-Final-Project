const { runReminderSweep } = require("./reminderSweep");
const { todayISO } = require("../utils/dates");
const { logFailure } = require("./audit");

// Runs the bill reminder sweep from inside the API, once per Philippine day.
//
// Why: on free hosting the API is the only process that runs, and it sleeps
// when nobody uses it, so a separate scheduled worker (services/reminder) is
// not available and a timer inside the API would not fire while asleep.
// Instead the sweep runs when the API starts or wakes, and is re-checked as
// requests come in, so the first visit of each day raises that day's alerts.
// Where the separate worker does run, both are safe together: the sweep
// claims each bill atomically, so no alert is ever sent twice.

const LEAD_DAYS = Number(process.env.REMINDER_LEAD_DAYS) || 3;
const RETRY_AFTER_MS = 5 * 60 * 1000;          // after a failed sweep
const CHECK_EVERY_MS = 15 * 60 * 1000;         // while the API stays awake

let lastSweepDay = null;   // PH date of the last successful sweep
let lastFailureAt = 0;
let running = null;

function ensureTodaysSweep() {
  const today = todayISO();
  if (lastSweepDay === today || running) return running;
  if (Date.now() - lastFailureAt < RETRY_AFTER_MS) return null;

  running = runReminderSweep({ leadDays: LEAD_DAYS, today })
    .then(() => { lastSweepDay = today; })
    .catch((err) => {
      lastFailureAt = Date.now();
      console.error("[reminder] in-API sweep failed:", err.message);
      logFailure("Reminder Service", "Reminder Sweep", `${today}: sweep failed — ${err.message}. Retrying in 5 minutes.`);
    })
    .finally(() => { running = null; });
  return running;
}

function startInProcessReminders() {
  ensureTodaysSweep();
  const timer = setInterval(ensureTodaysSweep, CHECK_EVERY_MS);
  if (typeof timer.unref === "function") timer.unref();
}

// Express middleware: a request is the sign that a new day may have begun
// while the API slept. The check never delays the request itself.
function reminderCheck(req, res, next) {
  ensureTodaysSweep();
  next();
}

const reminderStatus = () => ({ lastSweep: lastSweepDay });

module.exports = { startInProcessReminders, reminderCheck, reminderStatus, ensureTodaysSweep };
