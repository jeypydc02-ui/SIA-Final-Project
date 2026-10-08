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
// Sign-up codes and reset links send e-mail, so they are rationed per address
// and per e-mail; code guesses are also capped per sign-up (5 tries).
const mailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAIL_MAX) || 10,
  message: "Too many e-mails requested. Please try again later.",
});
const mailPerAddress = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAIL_MAX) || 5,
  message: "Too many e-mails requested for this address. Please try again later.",
  key: (req) => (req.body && typeof req.body.email === "string" ? "mail:" + req.body.email.toLowerCase().trim() : null),
});
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: LOGIN_MAX * 3,
  message: "Too many attempts. Please try again later.",
});

router.post("/login", loginLimiter, accountLimiter, authController.login);
// Sign-up in two steps: details → e-mailed 6-digit code → account.
router.post("/register", registerLimiter, mailLimiter, mailPerAddress, authController.registerStart);
router.post("/register/resend", mailLimiter, mailPerAddress, authController.registerResend);
router.post("/register/verify", verifyLimiter, authController.registerVerify);
// Forgot password: an e-mailed link, then a new password.
router.post("/forgot", mailLimiter, mailPerAddress, authController.forgotPassword);
router.post("/reset", verifyLimiter, authController.resetPassword);
router.get("/me", requireAuth, authController.me);
router.put("/me", requireAuth, authController.updateProfile);
router.put("/me/password", requireAuth, authController.changePassword);
router.post("/logout", requireAuth, authController.logout);

module.exports = router;
