const express = require("express");
const { wrap } = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const transactionController = wrap(require("../controllers/transactionController"));

const router = express.Router();

// Personal finance is for Users. An Admin administers the system and has no
// wallet of their own (separation of duties, §8.2).
const member = [requireAuth, requireRole("User")];

router.get("/", ...member, transactionController.list);
router.post("/", ...member, transactionController.create);
router.get("/:id/versions", ...member, transactionController.versions);
router.put("/:id", ...member, transactionController.update);
router.delete("/:id", ...member, transactionController.remove);

module.exports = router;
