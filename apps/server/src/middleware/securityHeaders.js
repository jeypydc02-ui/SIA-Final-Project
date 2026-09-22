// Baseline security response headers.
//
// Written out by hand rather than pulled from a package so that each header can
// be explained on its own terms during the defense. These are the four that
// actually matter for a same-origin SPA talking to this API.
function securityHeaders(req, res, next) {
  // Never let a browser second-guess a response's declared Content-Type.
  res.setHeader("X-Content-Type-Options", "nosniff");
  // The app is never meant to be embedded, so refuse framing outright.
  res.setHeader("X-Frame-Options", "DENY");
  // Do not leak the current URL (which can carry record ids) to third parties.
  res.setHeader("Referrer-Policy", "no-referrer");
  // No part of this system needs the camera, microphone, or location.
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
}

module.exports = { securityHeaders };
