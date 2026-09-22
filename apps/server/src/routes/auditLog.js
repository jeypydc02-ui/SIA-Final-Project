const express = require("express");
const AuditLog = require("../models/AuditLog");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, requireRole("Admin", "Reviewer"), async (req, res) => {
  const logs = await AuditLog.find().sort({ ts: -1 }).limit(300);
  res.json(logs);
});

module.exports = router;
