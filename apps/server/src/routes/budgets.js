const express = require("express");
const { wrap } = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const budgetController = wrap(require("../controllers/budgetController"));

const router = express.Router();

router.get("/", requireAuth, budgetController.list);
router.post("/", requireAuth, budgetController.create);
router.put("/:id", requireAuth, budgetController.update);
router.delete("/:id", requireAuth, budgetController.remove);

module.exports = router;
