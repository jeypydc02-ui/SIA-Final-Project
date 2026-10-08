const User = require("../models/User");
const Bill = require("../models/Bill");
const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");
const Notification = require("../models/Notification");
const Comment = require("../models/Comment");
const AuditLog = require("../models/AuditLog");
const { visibilityFilter } = require("./commentController");

// GET /api/sync — everything the signed-in screens show, in one response.
//
// The app used to fetch bills, entries, budgets, notifications and notes as
// five requests, then the audit log and the user list as two more. On hosting
// a few hundred milliseconds away that added up to seconds after every save.
// One request makes each refresh a single round trip; the queries themselves
// run in parallel on the server, close to the database.
//
// Every list is the caller's own data (NFR-002); the audit log and the
// account list are added only for an Admin. The individual endpoints remain
// for anything that needs just one list.
async function sync(req, res) {
  const me = req.user;
  const isAdmin = me.role === "Admin";
  // Users have a wallet and their own activity feed; an Admin has the system
  // lists (accounts, and the security/system activity log).
  const wallet = (query) => (isAdmin ? Promise.resolve([]) : query);

  const [user, bills, transactions, budgets, notifications, comments, auditLog, users, activity] = await Promise.all([
    User.findById(me.id).select("-passwordHash").lean(),
    wallet(Bill.find({ createdBy: me.id }).sort({ due: 1 }).lean()),
    wallet(Transaction.find({ submittedBy: me.id }).sort({ createdAt: -1 }).lean()),
    wallet(Budget.find({ user: me.id }).sort({ category: 1 }).lean()),
    Notification.find({ user: me.id }).sort({ ts: -1 }).limit(100).lean(),
    wallet(visibilityFilter(me).then((f) => Comment.find(f).sort({ ts: -1 }).limit(200).lean())),
    isAdmin ? AuditLog.find({ scope: { $in: ["system", "both"] } }).sort({ ts: -1 }).limit(300).lean() : null,
    isAdmin ? User.find().select("-passwordHash").sort({ role: 1, name: 1 }).lean() : null,
    wallet(AuditLog.find({ actorId: me.id, scope: { $in: ["user", "both"] } }).sort({ ts: -1 }).limit(100).lean()),
  ]);

  if (!user || user.active === false) return res.status(401).json({ error: "Account no longer exists.", sessionEnded: true });

  res.json({
    me: { id: user._id, name: user.name, email: user.email, role: user.role },
    bills, transactions, budgets, notifications, comments,
    auditLog: auditLog || [],
    users: users || [],
    // Users only: their own activity (My Activity).
    activity,
  });
}

module.exports = { sync };
