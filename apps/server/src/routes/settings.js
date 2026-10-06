const express = require("express");
const { wrap } = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const settingsController = wrap(require("../controllers/settingsController"));

const router = express.Router();

// System settings belong to the Admin (spec §12).
router.get("/", requireAuth, requireRole("Admin"), settingsController.get);
router.put("/", requireAuth, requireRole("Admin"), settingsController.update);

module.exports = router;
