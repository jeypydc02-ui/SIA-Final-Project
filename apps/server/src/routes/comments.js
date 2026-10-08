const express = require("express");
const { wrap } = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const commentController = wrap(require("../controllers/commentController"));

const router = express.Router();

// Personal finance is for Users. An Admin administers the system and has no
// wallet of their own (separation of duties, §8.2).
const member = [requireAuth, requireRole("User")];

router.get("/", ...member, commentController.list);
router.post("/", ...member, commentController.create);
router.put("/:id", ...member, commentController.update);
router.delete("/:id", ...member, commentController.remove);

module.exports = router;
