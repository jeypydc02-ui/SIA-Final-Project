const express = require("express");
const { wrap } = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const billController = wrap(require("../controllers/billController"));

const router = express.Router();

// Personal finance is for Users. An Admin administers the system and has no
// wallet of their own (separation of duties, §8.2).
const member = [requireAuth, requireRole("User")];

router.get("/", ...member, billController.list);
router.post("/", ...member, billController.create);
router.put("/:id", ...member, billController.update);
router.delete("/:id", ...member, billController.remove);
router.post("/:id/pay", ...member, billController.pay);

module.exports = router;
