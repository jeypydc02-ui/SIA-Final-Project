// Fixed-window rate limiter, kept deliberately small and dependency-free so
// the team can explain exactly how it works during the technical defense.
//
// Counts requests per client IP inside a rolling window and refuses further
// attempts once the ceiling is reached. Used on the login route so a stolen
// email address cannot be paired with unlimited password guesses.
function rateLimit({ windowMs, max, message }) {
  const hits = new Map(); // ip -> { count, resetAt }

  // Drop expired buckets periodically so the map cannot grow without bound.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of hits) {
      if (bucket.resetAt <= now) hits.delete(ip);
    }
  }, windowMs);
  // Do not hold the event loop open just for the sweeper.
  if (typeof sweeper.unref === "function") sweeper.unref();

  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const bucket = hits.get(ip);

    if (!bucket || bucket.resetAt <= now) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ error: message || "Too many requests. Please try again later." });
    }
    next();
  };
}

module.exports = { rateLimit };
