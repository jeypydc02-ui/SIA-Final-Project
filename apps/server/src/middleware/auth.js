const { getSession } = require("../services/sessions");
const { asyncHandler } = require("./asyncHandler");

// Sessions are looked up in the database, so this is async; asyncHandler
// routes a dropped connection to the central error handler.
const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const session = token ? await getSession(token) : null;
  if (!session) {
    // sessionEnded tells the client this is about the session itself, not a
    // wrong password typed into a form (which is also a 401).
    return res.status(401).json({ error: "Not authenticated. Please log in.", sessionEnded: true });
  }
  // A temporary password issued by an Admin is known to that Admin, so the
  // session it opens may only read the account and replace the password.
  if (session.mustChangePassword) {
    const route = req.baseUrl + req.path;
    const allowed = ["/api/auth/me", "/api/auth/me/password", "/api/auth/logout"];
    if (!allowed.includes(route) || (route === "/api/auth/me" && req.method !== "GET")) {
      return res.status(403).json({ error: "Please choose a new password before continuing.", mustChangePassword: true });
    }
  }
  req.user = session;
  req.token = token;
  next();
});

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to perform this action." });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
