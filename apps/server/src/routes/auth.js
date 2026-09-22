const express = require("express");
const { wrap } = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rateLimit");
const authController = wrap(require("../controllers/authController"));

const router = express.Router();

// Credential endpoints are the ones worth guessing at, so they get a ceiling.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Please wait a few minutes and try again.",
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: "Too many accounts created from this address. Please try again later.",
});

router.post("/login", loginLimiter, authController.login);
router.post("/register", registerLimiter, authController.register);
router.get("/me", requireAuth, authController.me);
router.put("/me", requireAuth, authController.updateProfile);
router.put("/me/password", requireAuth, authController.changePassword);
router.post("/logout", requireAuth, authController.logout);

module.exports = router;
