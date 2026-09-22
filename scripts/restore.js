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

// Database recovery (spec section 10.4).
//
// Restores a backup produced by scripts/backup.js. Replaces the current
// contents entirely — a restore returns the system to the state captured in
// the file, it does not merge.
//
//   npm run restore -- backups/fintrack-stark-2026-09-23T01-00-00.json
//   npm run restore -- --latest

const COLLECTIONS = {
  users: User,
  bills: Bill,
  transactions: Transaction,
  budgets: Budget,
  notifications: Notification,
  comments: Comment,
  auditLogs: AuditLog,
};

const SUPPORTED_SCHEMA = 1;

function resolveSource() {
  const args = process.argv.slice(2).filter((a) => a !== "--latest" && a !== "--yes");

  if (process.argv.includes("--latest")) {
    const dir = path.join(__dirname, "..", "backups");
    if (!fs.existsSync(dir)) throw new Error("no backups/ directory — run `npm run backup` first");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
    if (!files.length) throw new Error("backups/ contains no .json backup");
    return path.join(dir, files[files.length - 1]);
  }

  if (!args[0]) {
    throw new Error("usage: npm run restore -- <backup.json>   (or --latest)");
  }
  return path.resolve(args[0]);
}

async function restore() {
  const source = resolveSource();
  if (!fs.existsSync(source)) throw new Error(`backup not found: ${source}`);

  const payload = JSON.parse(fs.readFileSync(source, "utf8"));
  if (!payload.meta || !payload.data) {
    throw new Error("that file is not a FinTrack Stark backup");
  }
  if (payload.meta.schemaVersion !== SUPPORTED_SCHEMA) {
    throw new Error(
      `backup schema v${payload.meta.schemaVersion} cannot be restored by this version (expects v${SUPPORTED_SCHEMA})`
    );
  }

  console.log(`[restore] source: ${source}`);
  console.log(`[restore] taken:  ${payload.meta.takenAt}`);

  await connectDB();

  // Clear first: a restore reproduces a point in time, so anything written
  // after the backup is intentionally discarded.
  for (const Model of Object.values(COLLECTIONS)) {
    await Model.deleteMany({});
  }

  for (const [name, Model] of Object.entries(COLLECTIONS)) {
    const rows = payload.data[name] || [];
    if (!rows.length) {
      console.log(`      0  ${name}`);
      continue;
    }
    // Bypasses validation and casting hooks deliberately: these documents were
    // already valid when they were written, and _id values must be preserved
    // so that references between collections survive.
    await Model.collection.insertMany(rows.map(reviveIds), { ordered: false });
    console.log(`  ${String(rows.length).padStart(5)}  ${name}`);
  }

  await Promise.all(Object.values(COLLECTIONS).map((M) => M.syncIndexes()));

  console.log("[restore] complete — indexes rebuilt.");
  await mongoose.disconnect();
}

// JSON turns ObjectIds and Dates into strings; convert the ones the schemas
// expect back into their real types.
const ID_FIELDS = ["_id", "user", "createdBy", "submittedBy", "reviewedBy", "parentId", "transactionId", "authorId"];
const DATE_FIELDS = ["ts", "createdAt"];

function reviveIds(row) {
  const out = { ...row };
  for (const field of ID_FIELDS) {
    if (out[field] && mongoose.Types.ObjectId.isValid(out[field])) {
      out[field] = new mongoose.Types.ObjectId(String(out[field]));
    }
  }
  for (const field of DATE_FIELDS) {
    if (out[field]) out[field] = new Date(out[field]);
  }
  return out;
}

restore().catch((err) => {
  console.error("[restore] failed:", err.message);
  process.exit(1);
});
