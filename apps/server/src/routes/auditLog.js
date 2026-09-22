const express = require("express");
const { wrap } = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const auditLogController = wrap(require("../controllers/auditLogController"));

const router = express.Router();

router.get("/", requireAuth, requireRole("Admin", "Reviewer"), auditLogController.list);

module.exports = router;
