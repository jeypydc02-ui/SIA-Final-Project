const express = require("express");
const { wrap } = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const userController = wrap(require("../controllers/userController"));

const router = express.Router();

router.get("/", requireAuth, requireRole("Admin"), userController.list);
router.put("/:id/status", requireAuth, requireRole("Admin"), userController.setStatus);
router.delete("/:id", requireAuth, requireRole("Admin"), userController.remove);

module.exports = router;
