const fs = require("fs");
const path = require("path");
const { connectDB, mongoose } = require("../apps/server/src/config/db");

const User = require("../apps/server/src/models/User");
const Bill = require("../apps/server/src/models/Bill");
const Transaction = require("../apps/server/src/models/Transaction");
const Budget = require("../apps/server/src/models/Budget");
const Notification = require("../apps/server/src/models/Notification");
const Comment = require("../apps/server/src/models/Comment");
const AuditLog = require("../apps/server/src/models/AuditLog");

// Database backup (spec section 10.3).
//
// Writes every collection to one timestamped JSON file. Deliberately built on
// the application's own Mongoose models rather than mongodump, so the backup
// runs anywhere Node runs — no MongoDB command-line tools to install on a lab
// machine, and the output is readable enough to include as an appendix.
//
//   npm run backup              -> backups/fintrack-stark-<timestamp>.json
//   npm run backup -- --out x.json

const COLLECTIONS = {
  users: User,
  bills: Bill,
  transactions: Transaction,
  budgets: Budget,
  notifications: Notification,
  comments: Comment,
  auditLogs: AuditLog,
};

function outputPath() {
  const flagIndex = process.argv.indexOf("--out");
  if (flagIndex !== -1 && process.argv[flagIndex + 1]) {
    return path.resolve(process.argv[flagIndex + 1]);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return path.join(__dirname, "..", "backups", `fintrack-stark-${stamp}.json`);
}

async function backup() {
  await connectDB();

  const data = {};
  const counts = {};
  for (const [name, Model] of Object.entries(COLLECTIONS)) {
    // .lean() gives plain objects; ObjectIds and Dates serialise to strings
    // that restore.js converts back on the way in.
    data[name] = await Model.find().lean();
    counts[name] = data[name].length;
  }

  const payload = {
    meta: {
      application: "FinTrack Stark",
      database: mongoose.connection.name,
      takenAt: new Date().toISOString(),
      counts,
      // Restoring into a different schema version would silently corrupt data,
      // so the shape is stamped and checked on the way back in.
      schemaVersion: 1,
    },
    data,
  };

  const target = outputPath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(payload, null, 2));

  const sizeKb = (fs.statSync(target).size / 1024).toFixed(1);
  console.log(`[backup] wrote ${target} (${sizeKb} KB)`);
  for (const [name, n] of Object.entries(counts)) {
    console.log(`  ${String(n).padStart(5)}  ${name}`);
  }

  await mongoose.disconnect();
}

backup().catch((err) => {
  console.error("[backup] failed:", err);
  process.exit(1);
});
