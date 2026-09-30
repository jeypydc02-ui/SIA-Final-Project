// Fixed-window rate limiter, kept deliberately small and dependency-free so
// the team can explain exactly how it works during the technical defense.
//
// Counts requests per key inside a fixed window and refuses further
// attempts once the ceiling is reached. Used on the login route so a stolen
// email address cannot be paired with unlimited password guesses.
// `key` picks what is counted: the client IP by default, or anything else
// derived from the request (the login route also counts per email address, so
// rotating IPs does not buy an attacker more guesses at one account).
function rateLimit({ windowMs, max, message, key }) {
  const hits = new Map(); // key -> { count, resetAt }

  // Drop expired buckets periodically so the map cannot grow without bound.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [id, bucket] of hits) {
      if (bucket.resetAt <= now) hits.delete(id);
    }
  }, windowMs);
  // Do not hold the event loop open just for the sweeper.
  if (typeof sweeper.unref === "function") sweeper.unref();

  return (req, res, next) => {
    const id = key ? key(req) : (req.ip || req.socket.remoteAddress || "unknown");
    // Nothing to count against (e.g. no email in the body): let the route
    // handler reject the request on its own terms.
    if (id === null || id === undefined) return next();
    const now = Date.now();
    const bucket = hits.get(id);

    if (!bucket || bucket.resetAt <= now) {
      hits.set(id, { count: 1, resetAt: now + windowMs });
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
