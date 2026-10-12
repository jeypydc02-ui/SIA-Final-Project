const express = require("express");
const { wrap } = require("../middleware/asyncHandler");
const controller = wrap(require("../controllers/paymentRequestController"));

const router = express.Router();

// The simulated gateway calls this when a payment is done. No login: it is
// protected by the HMAC signature checked inside the handler.
router.post("/webhook", controller.webhook);

module.exports = router;