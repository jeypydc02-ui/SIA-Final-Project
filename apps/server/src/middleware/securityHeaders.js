// Baseline security response headers.
//
// Written out by hand rather than pulled from a package so that each header can
// be explained on its own terms during the defense.

// Content Security Policy: the browser only runs scripts this server sent, so
// even if some text slipped past React's escaping it could not execute or
// send the session token elsewhere. The only outside origin is Google Fonts,
// which index.css imports. Inline style attributes are allowed because React
// components set them.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

function securityHeaders(req, res, next) {
  // Never let a browser second-guess a response's declared Content-Type.
  res.setHeader("X-Content-Type-Options", "nosniff");
  // The app is never meant to be embedded, so refuse framing outright.
  res.setHeader("X-Frame-Options", "DENY");
  // Do not leak the current URL (which can carry record ids) to third parties.
  res.setHeader("Referrer-Policy", "no-referrer");
  // No part of this system needs the camera, microphone, or location.
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", CSP);
  // Once a browser has reached the site over HTTPS, it refuses plain HTTP for
  // the next six months. Browsers ignore this header on plain-HTTP responses,
  // so it is harmless during local development.
  res.setHeader("Strict-Transport-Security", "max-age=15552000");
  next();
}

module.exports = { securityHeaders };
