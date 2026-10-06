const bcrypt = require("bcryptjs");
const { connectDB, mongoose } = require("../apps/server/src/config/db");
const User = require("../apps/server/src/models/User");
const Bill = require("../apps/server/src/models/Bill");
const Transaction = require("../apps/server/src/models/Transaction");
const Budget = require("../apps/server/src/models/Budget");
const Notification = require("../apps/server/src/models/Notification");
const AuditLog = require("../apps/server/src/models/AuditLog");
const Comment = require("../apps/server/src/models/Comment");
const Session = require("../apps/server/src/models/Session");
const Receipt = require("../apps/server/src/models/Receipt");
const { samplePng } = require("./sample-receipt");
const { todayISO: phToday, addDaysISO } = require("../apps/server/src/utils/dates");

// `npm run seed -- --reset` wipes the collections first. Used when the schema
// changes and when demonstrating the recovery plan (spec section 10.4).
const RESET = process.argv.includes("--reset");

function addDays(n) {
  return addDaysISO(phToday(), n);
}
function todayISO() {
  return addDays(0);
}

async function seed() {
  // The demo accounts have published passwords (admin123 and friends). On a
  // production database they would be an open door, so the seed refuses to
  // run there. Create the real first Admin with `npm run create-admin`.
  if (process.env.NODE_ENV === "production") {
    console.error("[seed] refusing to run with NODE_ENV=production: the demo accounts have public passwords.");
    console.error("[seed] use `npm run create-admin` to create the first Admin account instead.");
    process.exit(1);
  }

  await connectDB();

  if (RESET) {
    await Promise.all([
      User.deleteMany({}), Bill.deleteMany({}), Transaction.deleteMany({}),
      Budget.deleteMany({}), Notification.deleteMany({}), AuditLog.deleteMany({}),
      Comment.deleteMany({}), Session.deleteMany({}), Receipt.deleteMany({}),
    ]);
    // Indexes are rebuilt from the current schemas, so a changed unique
    // constraint does not survive from the previous shape of the data.
    await Promise.all([
      User.syncIndexes(), Bill.syncIndexes(), Transaction.syncIndexes(),
      Budget.syncIndexes(), Notification.syncIndexes(), Comment.syncIndexes(),
      Session.syncIndexes(), Receipt.syncIndexes(),
    ]);
    console.log("[seed] --reset: all collections cleared and indexes rebuilt.");
  }

  const existing = await User.countDocuments();
  if (existing > 0) {
    console.log("[seed] data already present, skipping. Run with --reset to rebuild.");
    await mongoose.disconnect();
    return;
  }

  const [userHash, user2Hash, adminHash, reviewerHash] = await Promise.all([
    bcrypt.hash("demo123", 10),
    bcrypt.hash("demo456", 10),
    bcrypt.hash("admin123", 10),
    bcrypt.hash("review123", 10),
  ]);

  const jp = await User.create({
    firstName: "John Paul",
    lastName: "Dela Cruz",
    name: "John Paul Dela Cruz",
    email: "jp@fintrackstark.app",
    passwordHash: userHash,
    role: "User",
  });
  // A second ordinary account, so the Admin Console has more than one person
  // to show and per-user privacy can be demonstrated.
  const arvy = await User.create({
    firstName: "Arvy Karlson",
    lastName: "Dabasol",
    name: "Arvy Karlson Dabasol",
    email: "arvy@fintrackstark.app",
    passwordHash: user2Hash,
    role: "User",
  });
  await User.create({
    firstName: "System",
    lastName: "Admin",
    name: "System Admin",
    email: "admin@fintrackstark.app",
    passwordHash: adminHash,
    role: "Admin",
  });
  // Checks the receipts people attach (Review and Approval, spec section 5).
  const reviewer = await User.create({
    firstName: "Rhea",
    lastName: "Santos",
    name: "Rhea Santos",
    email: "reviewer@fintrackstark.app",
    passwordHash: reviewerHash,
    role: "Reviewer",
  });

  // Budgets are per-user, so the demo User gets their own set.
  await Budget.insertMany([
    { user: jp._id, category: "Food", limit: 6000 },
    { user: jp._id, category: "Transport", limit: 3500 },
    { user: jp._id, category: "Utilities", limit: 5000 },
    { user: jp._id, category: "Subscription", limit: 1000 },
  ]);

  await Bill.insertMany([
    { name: "Meralco Electricity", category: "Utilities", amount: 2450, due: addDays(2), paid: false, createdBy: jp._id, repeat: "monthly", repeatDay: Number(addDays(2).slice(8, 10)) },
    { name: "Maynilad Water", category: "Utilities", amount: 680, due: addDays(-1), paid: false, createdBy: jp._id },
    { name: "PLDT Home Fibr", category: "Internet", amount: 1699, due: addDays(9), paid: false, createdBy: jp._id, repeat: "monthly", repeatDay: Number(addDays(9).slice(8, 10)) },
    { name: "Condo Rent", category: "Housing", amount: 14000, due: addDays(0), paid: false, createdBy: jp._id, repeat: "monthly", repeatDay: Number(addDays(0).slice(8, 10)) },
    { name: "Netflix Subscription", category: "Subscription", amount: 549, due: addDays(-6), paid: true, paidOn: addDays(-6), paidAmount: 549, createdBy: jp._id },
    { name: "BPI Credit Card", category: "Credit", amount: 5230, due: addDays(15), paid: false, createdBy: jp._id },
    { name: "Globe Postpaid", category: "Internet", amount: 999, due: addDays(5), paid: false, createdBy: arvy._id, repeat: "monthly", repeatDay: Number(addDays(5).slice(8, 10)) },
  ]);

  // Entries count the moment they are recorded ("Approved" is the stored
  // status for a current, counted entry).
  const entries = await Transaction.insertMany([
    { type: "Income", category: "Salary", amount: 32000, date: addDays(-20), note: "Monthly salary", status: "Approved", submittedBy: jp._id },
    { type: "Expense", category: "Food", amount: 2100, date: addDays(-18), note: "Groceries", status: "Approved", submittedBy: jp._id },
    { type: "Expense", category: "Transport", amount: 850, date: addDays(-15), note: "Grab + fare", status: "Approved", submittedBy: jp._id },
    { type: "Income", category: "Freelance", amount: 6000, date: addDays(-10), note: "Web dev gig", status: "Approved", submittedBy: jp._id },
    { type: "Expense", category: "Subscription", amount: 549, date: addDays(-6), note: "Bill payment: Netflix Subscription", status: "Approved", autoApproved: true, submittedBy: jp._id, reviewComment: "Recorded by the bill payment workflow." },
    { type: "Expense", category: "Food", amount: 1200, date: todayISO(), note: "Weekly market run", status: "Approved", submittedBy: jp._id },
    { type: "Income", category: "Allowance", amount: 5000, date: addDays(-3), note: "Allowance", status: "Approved", submittedBy: arvy._id },
  ]);

  // One entry that was corrected after it was recorded, so the Revision
  // History screen has a real v1 -> v2 chain to show at demo time. Created in
  // two steps because the second version has to reference the first.
  const originalEntry = await Transaction.create({
    type: "Expense", category: "Transport", amount: 2400, date: addDays(-8),
    note: "Airport transfer",
    status: "Superseded", version: 1,
    submittedBy: jp._id,
  });
  const correctedEntry = await Transaction.create({
    type: "Expense", category: "Transport", amount: 1650, date: addDays(-8),
    note: "Airport transfer (corrected from receipt)",
    status: "Approved", version: 2, parentId: originalEntry._id,
    submittedBy: jp._id,
  });
  await Comment.create({
    transactionId: originalEntry._id,
    author: jp.name, authorId: jp._id,
    title: "Airport transfer fix",
    text: "Typed 2,400 by mistake — the receipt says 1,650.",
  });
  await Comment.create({
    author: jp.name, authorId: jp._id,
    title: "Ipon goal for December",
    text: [
      "Set aside ₱3,000 every payday.",
      "",
      "- Christmas gifts: ₱5,000",
      "- Noche Buena: ₱4,000",
      "- Emergency fund top-up: ₱3,000",
      "",
      "Check the Food budget mid-month — it went over last time.",
    ].join("\n"),
  });

  // Receipts in every state the review screen shows. Links point nowhere
  // real: sample data only (spec section 21.8).
  const [, groceries, , , netflix, market] = entries;
  const hoursAgo = (h) => new Date(Date.now() - h * 3600000);
  const reviewed = (note, h) => ({ reviewedBy: reviewer._id, reviewerName: reviewer.name, reviewedAt: hoursAgo(h), reviewNote: note });
  const base = { owner: jp._id, ownerName: jp.name };
  await Receipt.create([
    { ...base, entryId: groceries._id, kind: "link", url: "https://drive.google.com/file/d/sample-groceries-receipt/view", provider: "Google Drive",
      status: "Verified", submittedAt: hoursAgo(400), ...reviewed("Matches the amount and date.", 390) },
    { ...base, entryId: netflix._id, kind: "link", url: "https://onedrive.live.com/sample/netflix-invoice", provider: "OneDrive",
      status: "Verified", submittedAt: hoursAgo(140), ...reviewed("", 130) },
    { ...base, entryId: market._id, kind: "file", fileName: "market-receipt.png", mimeType: "image/png",
      data: samplePng(), status: "For Review", submittedAt: hoursAgo(2) },
  ]);
  const blurry = await Receipt.create({
    ...base, entryId: correctedEntry._id, kind: "link", url: "https://www.dropbox.com/s/sample/airport-blurry.jpg", provider: "Dropbox",
    status: "Needs Revision", latest: false, submittedAt: hoursAgo(180), ...reviewed("The photo is blurry — the total cannot be read.", 170),
  });
  await Receipt.create({
    ...base, entryId: correctedEntry._id, kind: "link", url: "https://www.dropbox.com/s/sample/airport-receipt.jpg", provider: "Dropbox",
    version: 2, parentId: blurry._id, status: "For Review", submittedAt: hoursAgo(20),
  });
  await Comment.create({
    transactionId: correctedEntry._id, author: reviewer.name, authorId: reviewer._id,
    title: "Receipt v1 needs revision", text: "The photo is blurry — the total cannot be read.", ts: hoursAgo(170),
  });

  // Bill reminders are deliberately NOT seeded: the reminder service raises
  // those itself on its first sweep, which is what makes them real.
  await Notification.insertMany([
    { user: jp._id, type: "bill", message: "Welcome to FinTrack Stark. Your sample bills are set up — the reminder service will alert you before each due date." },
  ]);

  await AuditLog.create({ user: "System", action: "Seed", detail: "Sample data initialized for demo." });

  console.log("[seed] done. Demo accounts:");
  console.log("  User   -> jp@fintrackstark.app / demo123");
  console.log("  User   -> arvy@fintrackstark.app / demo456");
  console.log("  Reviewer -> reviewer@fintrackstark.app / review123");
  console.log("  Admin  -> admin@fintrackstark.app / admin123");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
