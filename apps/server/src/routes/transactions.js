const express = require("express");
const { wrap } = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const transactionController = wrap(require("../controllers/transactionController"));

const router = express.Router();

router.get("/", requireAuth, transactionController.list);
router.post("/", requireAuth, transactionController.create);
router.get("/:id/versions", requireAuth, transactionController.versions);
router.put("/:id", requireAuth, transactionController.update);
router.delete("/:id", requireAuth, transactionController.remove);

module.exports = router;
