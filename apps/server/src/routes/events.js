const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { subscribe } = require("../services/events");

// GET /api/events — a Server-Sent Events stream of "your data changed"
// messages for the signed-in user, so screens update the moment a
// notification or change arrives instead of waiting for a refresh.
//
// The browser opens it with fetch() rather than EventSource, because
// EventSource cannot send the Authorization header and the session token must
// not travel in the URL (URLs end up in logs).
const router = express.Router();

// Proxies and hosting platforms close connections that stay silent; a comment
// line every 25 seconds keeps the stream open.
const HEARTBEAT_MS = 25000;

router.get("/", requireAuth, (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // tells nginx-style proxies not to buffer
  });
  res.flushHeaders();
  res.write("retry: 3000\n");
  res.write("event: ready\ndata: {}\n\n");

  const me = req.user;
  const unsubscribe = subscribe((change) => {
    const forMe = change.userId === me.id || (change.role && change.role === me.role);
    if (forMe) res.write(`event: change\ndata: ${JSON.stringify({ topic: change.topic })}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

module.exports = router;
