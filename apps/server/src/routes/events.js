const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { subscribe } = require("../services/events");
const { getSession } = require("../services/sessions");

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
// Open streams per account. A person has a few tabs and devices at most; the
// cap stops one account holding hundreds of connections open.
const MAX_STREAMS_PER_USER = 10;
const openStreams = new Map(); // userId -> count

router.get("/", requireAuth, (req, res) => {
  const userId = req.user.id;
  if ((openStreams.get(userId) || 0) >= MAX_STREAMS_PER_USER) {
    return res.status(429).json({ error: "Too many open windows for this account." });
  }
  openStreams.set(userId, (openStreams.get(userId) || 0) + 1);

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // tells nginx-style proxies not to buffer
  });
  res.flushHeaders();
  res.write("retry: 3000\n");
  res.write("event: ready\ndata: {}\n\n");

  let me = req.user;
  const unsubscribe = subscribe((change) => {
    const forMe = change.userId === me.id || (change.role && change.role === me.role);
    if (forMe) res.write(`event: change\ndata: ${JSON.stringify({ topic: change.topic })}\n\n`);
  });
  // Each heartbeat re-checks the session: after a logout, a password change
  // or the session expiry the stream closes, and a role change takes effect.
  const heartbeat = setInterval(async () => {
    try {
      const current = await getSession(req.token);
      if (!current || current.mustChangePassword) return res.end();
      me = current;
      res.write(": ping\n\n");
    } catch (e) {
      res.write(": ping\n\n"); // database hiccup: keep the stream, check next time
    }
  }, HEARTBEAT_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    const left = (openStreams.get(userId) || 1) - 1;
    if (left > 0) openStreams.set(userId, left); else openStreams.delete(userId);
  });
});

module.exports = router;
