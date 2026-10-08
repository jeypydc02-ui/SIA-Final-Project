const express = require("express");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const AuditLog = require("../models/AuditLog");

const router = express.Router();

// GET /api/activity — My Activity: what this User did with their own money
// and account (expenses, bills, payments, budgets, profile, password), newest
// first. Only their own lines; the Admin's log never includes these.
router.get("/", requireAuth, requireRole("User"), asyncHandler(async (req, res) => {
  const rows = await AuditLog.find({ actorId: req.user.id, scope: { $in: ["user", "both"] } })
    .sort({ ts: -1 }).limit(200).lean();
  res.json(rows);
}));

module.exports = router;
