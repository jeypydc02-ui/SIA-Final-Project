const express = require("express");
const Notification = require("../models/Notification");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const notifs = await Notification.find().sort({ ts: -1 }).limit(100);
  res.json(notifs);
});

module.exports = router;
