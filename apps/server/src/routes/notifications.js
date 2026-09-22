const express = require("express");
const { wrap } = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const notificationController = wrap(require("../controllers/notificationController"));

const router = express.Router();

router.get("/", requireAuth, notificationController.list);
router.put("/read-all", requireAuth, notificationController.markAllRead);
router.put("/:id/read", requireAuth, notificationController.markRead);

module.exports = router;
