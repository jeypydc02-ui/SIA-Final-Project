// Express 4 does not catch rejections from an async route handler: the request
// just hangs and the central error handler never runs. `wrap` re-exports a
// whole controller with every handler funnelling its rejections into next(),
// so a bad ObjectId or a dropped database connection becomes a clean JSON
// error instead of a stalled request (spec section 7.5).
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function wrap(controller) {
  return Object.fromEntries(
    Object.entries(controller).map(([name, fn]) => [name, asyncHandler(fn)])
  );
}

module.exports = { asyncHandler, wrap };
