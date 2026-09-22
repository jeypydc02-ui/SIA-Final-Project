const cron = require("node-cron");
const { connectDB, mongoose } = require("../../apps/server/src/config/db");
const { runReminderSweep } = require("./src/reminderJob");

// FinTrack Stark Reminder Service.
//
// A separate process from the API. It answers to the clock rather than to HTTP
// requests: nobody has to have the app open for a bill reminder to be raised.
// It shares the API's MongoDB and models, which is the shared-database
// integration pattern the documentation selects in section 5.4.
//
//   node services/reminder/index.js          run on a schedule
//   node services/reminder/index.js --once   one sweep, then exit

const ONCE = process.argv.includes("--once");
// 08:00 every day, local time. Override with REMINDER_CRON.
const SCHEDULE = process.env.REMINDER_CRON || "0 8 * * *";
const LEAD_DAYS = Number(process.env.REMINDER_LEAD_DAYS) || 3;

async function main() {
  await connectDB();

  if (ONCE) {
    await runReminderSweep({ leadDays: LEAD_DAYS });
    await mongoose.disconnect();
    return;
  }

  if (!cron.validate(SCHEDULE)) {
    console.error(`[reminder] invalid REMINDER_CRON: "${SCHEDULE}"`);
    process.exit(1);
  }

  // Sweep once at startup so a machine that was switched off overnight still
  // catches up, and so a demo does not have to wait until 08:00.
  await runReminderSweep({ leadDays: LEAD_DAYS });

  cron.schedule(SCHEDULE, async () => {
    try {
      await runReminderSweep({ leadDays: LEAD_DAYS });
    } catch (err) {
      // A failed sweep must not take the worker down; the next tick retries.
      console.error("[reminder] sweep failed:", err.message);
    }
  });

  console.log(`[reminder] service running — schedule "${SCHEDULE}", ${LEAD_DAYS} day lead time.`);

  const shutdown = async (signal) => {
    console.log(`[reminder] ${signal} received, shutting down.`);
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[reminder] failed to start:", err);
  process.exit(1);
});
