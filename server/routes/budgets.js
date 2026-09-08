const express = require("express");
const Budget = require("../models/Budget");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const budgets = await Budget.find().sort({ category: 1 });
  res.json(budgets);
});

module.exports = router;
