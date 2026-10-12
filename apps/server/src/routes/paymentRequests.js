const express = require("express");
const { wrap } = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const controller = wrap(require("../controllers/paymentRequestController"));

const router = express.Router();

// Users ask; Approvers decide. The Admin has no part in approving.
router.get("/", requireAuth, requireRole("User", "Approver"), controller.list);
router.post("/", requireAuth, requireRole("User"), controller.create);
router.put("/:id/resubmit", requireAuth, requireRole("User"), controller.resubmit);
router.patch("/:id/decision", requireAuth, requireRole("Approver"), controller.decide);

module.exports = router;