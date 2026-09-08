const express = require("express");
const User = require("../models/User");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, requireRole("Admin"), async (req, res) => {
  const users = await User.find().select("-passwordHash").sort({ role: 1, name: 1 });
  res.json(users);
});

module.exports = router;
