const express = require("express");
const { wrap } = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const commentController = wrap(require("../controllers/commentController"));

const router = express.Router();

router.get("/", requireAuth, commentController.list);
router.post("/", requireAuth, commentController.create);
router.delete("/:id", requireAuth, commentController.remove);

module.exports = router;
