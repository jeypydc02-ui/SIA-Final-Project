const express = require("express");
const Comment = require("../models/Comment");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const filter = {};
  if (req.query.transactionId) filter.transactionId = req.query.transactionId;
  const comments = await Comment.find(filter).sort({ ts: -1 }).limit(200);
  res.json(comments);
});

router.post("/", requireAuth, async (req, res) => {
  const { text, transactionId } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Comment text is required." });
  }
  const comment = await Comment.create({
    author: req.user.name,
    text: text.trim(),
    transactionId: transactionId || null,
  });
  res.status(201).json(comment);
});

module.exports = router;
