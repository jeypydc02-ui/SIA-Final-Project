const express = require("express");
const { devMailbox, lastMailTo } = require("../services/mailer");

const router = express.Router();

// GET /api/dev/outbox?to=<email> — the last e-mail "sent" to an address while
// no mail service is configured. Exists only for the automated tests
// (DEV_MAILBOX=1); in production, or without that setting, it is not found.
router.get("/outbox", (req, res) => {
  if (!devMailbox()) return res.status(404).json({ error: "No such API endpoint." });
  const mail = lastMailTo(req.query.to || "");
  if (!mail) return res.status(404).json({ error: "No e-mail for that address." });
  res.json(mail);
});

module.exports = router;
