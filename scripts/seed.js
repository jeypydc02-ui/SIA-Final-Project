const bcrypt = require("bcryptjs");
const { connectDB, mongoose } = require("../apps/server/src/config/db");
const User = require("../apps/server/src/models/User");
const Bill = require("../apps/server/src/models/Bill");
const Transaction = require("../apps/server/src/models/Transaction");
const Budget = require("../apps/server/src/models/Budget");
const Notification = require("../apps/server/src/models/Notification");
const AuditLog = require("../apps/server/src/models/AuditLog");
const Comment = require("../apps/server/src/models/Comment");

// `npm run seed -- --reset` wipes the collections first. Used when the schema
// changes and when demonstrating the recovery plan (spec section 10.4).
const RESET = process.argv.includes("--reset");

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function todayISO() {
  return addDays(0);
}

async function seed() {
  await connectDB();

  if (RESET) {
    await Promise.all([
      User.deleteMany({}), Bill.deleteMany({}), Transaction.deleteMany({}),
      Budget.deleteMany({}), Notification.deleteMany({}), AuditLog.deleteMany({}),
      Comment.deleteMany({}),
    ]);
    // Indexes are rebuilt from the current schemas, so a changed unique
    // constraint does not survive from the previous shape of the data.
    await Promise.all([
      User.syncIndexes(), Bill.syncIndexes(), Transaction.syncIndexes(),
      Budget.syncIndexes(), Notification.syncIndexes(), Comment.syncIndexes(),
    ]);
    console.log("[seed] --reset: all collections cleared and indexes rebuilt.");
  }

  const existing = await User.countDocuments();
  if (existing > 0) {
    console.log("[seed] data already present, skipping. Run with --reset to rebuild.");
    await mongoose.disconnect();
    return;
  }

  const [userHash, reviewerHash, adminHash] = await Promise.all([
    bcrypt.hash("demo123", 10),
    bcrypt.hash("reviewer123", 10),
    bcrypt.hash("admin123", 10),
  ]);

  const jp = await User.create({
    firstName: "John Paul",
    lastName: "Dela Cruz",
    name: "John Paul Dela Cruz",
    email: "jp@fintrackstark.app",
    passwordHash: userHash,
    role: "User",
  });
  const reviewer = await User.create({
    firstName: "Arvy Karlson",
    lastName: "Dabasol",
    name: "Arvy Karlson Dabasol",
    email: "reviewer@fintrackstark.app",
    passwordHash: reviewerHash,
    role: "Reviewer",
  });
  const admin = await User.create({
    firstName: "System",
    lastName: "Admin",
    name: "System Admin",
    email: "admin@fintrackstark.app",
    passwordHash: adminHash,
    role: "Admin",
  });

  // Budgets are per-user, so the demo User gets their own set.
  await Budget.insertMany([
    { user: jp._id, category: "Food", limit: 6000 },
    { user: jp._id, category: "Transport", limit: 3500 },
    { user: jp._id, category: "Utilities", limit: 5000 },
    { user: jp._id, category: "Subscription", limit: 1000 },
  ]);

  await Bill.insertMany([
    { name: "Meralco Electricity", category: "Utilities", amount: 2450, due: addDays(2), paid: false, createdBy: jp._id },
    { name: "Maynilad Water", category: "Utilities", amount: 680, due: addDays(-1), paid: false, createdBy: jp._id },
    { name: "PLDT Home Fibr", category: "Internet", amount: 1699, due: addDays(9), paid: false, createdBy: jp._id },
    { name: "Condo Rent", category: "Housing", amount: 14000, due: addDays(0), paid: false, createdBy: jp._id },
    { name: "Netflix Subscription", category: "Subscription", amount: 549, due: addDays(-6), paid: true, paidOn: addDays(-6), paidAmount: 549, createdBy: jp._id },
    { name: "BPI Credit Card", category: "Credit", amount: 5230, due: addDays(15), paid: false, createdBy: jp._id },
  ]);

  await Transaction.insertMany([
    { type: "Income", category: "Salary", amount: 32000, date: addDays(-20), note: "Monthly salary", status: "Approved", submittedBy: jp._id, reviewedBy: reviewer._id, reviewComment: "Seed data." },
    { type: "Expense", category: "Food", amount: 2100, date: addDays(-18), note: "Groceries", status: "Approved", submittedBy: jp._id, reviewedBy: reviewer._id, reviewComment: "Seed data." },
    { type: "Expense", category: "Transport", amount: 850, date: addDays(-15), note: "Grab + fare", status: "Approved", submittedBy: jp._id, reviewedBy: reviewer._id, reviewComment: "Seed data." },
    { type: "Income", category: "Freelance", amount: 6000, date: addDays(-10), note: "Web dev gig", status: "Approved", submittedBy: jp._id, reviewedBy: reviewer._id, reviewComment: "Seed data." },
    { type: "Expense", category: "Utilities", amount: 549, date: addDays(-6), note: "Netflix", status: "Approved", autoApproved: true, submittedBy: jp._id, reviewedBy: jp._id, reviewComment: "Auto-approved via bill payment workflow." },
    { type: "Expense", category: "Food", amount: 1200, date: todayISO(), note: "Weekly market run", status: "Pending Review", submittedBy: jp._id },
  ]);

  // One entry that has been through the full revision loop, so the Revision
  // History screen has a real v1 -> v2 chain to show at demo time rather than
  // a table of single-version rows. Created in two steps because the second
  // version has to reference the first.
  const originalClaim = await Transaction.create({
    type: "Expense", category: "Transport", amount: 2400, date: addDays(-8),
    note: "Airport transfer (original claim)",
    status: "Superseded", version: 1,
    submittedBy: jp._id, reviewedBy: reviewer._id,
    reviewComment: "Amount looks high for this route — please check the receipt.",
  });
  await Transaction.create({
    type: "Expense", category: "Transport", amount: 1650, date: addDays(-8),
    note: "Airport transfer (corrected)",
    status: "Approved", version: 2, parentId: originalClaim._id,
    submittedBy: jp._id, reviewedBy: reviewer._id,
    reviewComment: "Approved after revision.",
  });
  await Comment.create({
    transactionId: originalClaim._id,
    author: reviewer.name, authorId: reviewer._id,
    text: "Amount looks high for this route — please check the receipt.",
  });

  // Notifications are addressed to a recipient. Bill reminders are deliberately
  // NOT seeded: the reminder service raises those itself on its first sweep,
  // which is what makes them real rather than sample text.
  await Notification.insertMany([
    { user: reviewer._id, type: "submission", message: "John Paul Dela Cruz submitted an expense of 1200 for review." },
  ]);

  await AuditLog.create({ user: "System", action: "Seed", detail: "Sample data initialized for demo." });

  console.log("[seed] done. Demo accounts:");
  console.log("  User     -> jp@fintrackstark.app / demo123");
  console.log("  Reviewer -> reviewer@fintrackstark.app / reviewer123");
  console.log("  Admin    -> admin@fintrackstark.app / admin123");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
