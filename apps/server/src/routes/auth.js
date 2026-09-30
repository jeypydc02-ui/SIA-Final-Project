const express = require("express");
const { wrap } = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rateLimit");
const authController = wrap(require("../controllers/authController"));

const router = express.Router();

// Credential endpoints are the ones worth guessing at, so they get a ceiling.
// The ceilings are env-overridable so the end-to-end suite can log in more
// often than a real person would; the defaults are what production runs with.
const LOGIN_MAX = Number(process.env.RATE_LIMIT_LOGIN_MAX) || 10;
const LOGIN_MESSAGE = "Too many login attempts. Please wait a few minutes and try again.";
// Per address: one machine guessing at many accounts. Looser than the
// per-account ceiling, because a school lab or a mobile carrier puts many
// honest people behind one IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: LOGIN_MAX * 3,
  message: LOGIN_MESSAGE,
});
// Per account: many machines guessing at one account. Counting by IP alone
// was bypassed by rotating addresses; the email cannot be rotated.
const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: LOGIN_MAX,
  message: LOGIN_MESSAGE,
  key: (req) => {
    const email = req.body && req.body.email;
    return typeof email === "string" ? "acct:" + email.toLowerCase().trim() : null;
  },
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_REGISTER_MAX) || 20,
  message: "Too many accounts created from this address. Please try again later.",
});

router.post("/login", loginLimiter, accountLimiter, authController.login);
router.post("/register", registerLimiter, authController.register);
router.get("/me", requireAuth, authController.me);
router.put("/me", requireAuth, authController.updateProfile);
router.put("/me/password", requireAuth, authController.changePassword);
router.post("/logout", requireAuth, authController.logout);

module.exports = router;
