const express = require("express");
const { wrap } = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const budgetController = wrap(require("../controllers/budgetController"));

const router = express.Router();

// Personal finance is for Users. An Admin administers the system and reviews
// receipts, but has no wallet of their own (separation of duties, §8.2).
const member = [requireAuth, requireRole("User")];

router.get("/", ...member, budgetController.list);
router.post("/", ...member, budgetController.create);
router.put("/:id", ...member, budgetController.update);
router.delete("/:id", ...member, budgetController.remove);

module.exports = router;
