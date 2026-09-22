const express = require("express");
const { wrap } = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const billController = wrap(require("../controllers/billController"));

const router = express.Router();

router.get("/", requireAuth, billController.list);
router.post("/", requireAuth, billController.create);
router.put("/:id", requireAuth, billController.update);
router.delete("/:id", requireAuth, billController.remove);
router.post("/:id/pay", requireAuth, billController.pay);

module.exports = router;
