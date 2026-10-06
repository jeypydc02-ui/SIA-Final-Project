const express = require("express");
const { wrap } = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const c = require("../controllers/receiptController");

const receiptController = wrap({ list: c.list, create: c.create, file: c.file, review: c.review, queue: c.queue });
const router = express.Router();

router.get("/", requireAuth, receiptController.list);
router.post("/", requireAuth, receiptController.create);
router.get("/review", requireAuth, requireRole("Reviewer"), receiptController.queue);
router.get("/:id/file", requireAuth, receiptController.file);
router.post("/:id/review", requireAuth, requireRole("Reviewer"), receiptController.review);

module.exports = router;
