const express = require("express");
const { wrap } = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const c = require("../controllers/receiptController");

const receiptController = wrap({ list: c.list, create: c.create, file: c.file, review: c.review, queue: c.queue });
const router = express.Router();

// Users submit receipts for their own entries; the Admin reviews them.
router.get("/", requireAuth, requireRole("User"), receiptController.list);
router.post("/", requireAuth, requireRole("User"), receiptController.create);
router.get("/review", requireAuth, requireRole("Admin"), receiptController.queue);
router.get("/:id/file", requireAuth, receiptController.file);
router.post("/:id/review", requireAuth, requireRole("Admin"), receiptController.review);

module.exports = router;
