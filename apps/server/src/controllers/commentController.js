const Comment = require("../models/Comment");
const Transaction = require("../models/Transaction");

// Two kinds of comment live in this collection, and they have different
// audiences (NFR-002):
//   - a personal note (no transactionId) is private to its author, always;
//   - review feedback on an entry is visible to that entry's submitter and to
//     the reviewers who run the queue.
async function visibilityFilter(user) {
  const ownNotes = { authorId: user.id, transactionId: null };
  if (user.role !== "User") {
    return { $or: [ownNotes, { transactionId: { $ne: null } }] };
  }
  const ownTx = await Transaction.find({ submittedBy: user.id }).select("_id");
  return { $or: [ownNotes, { transactionId: { $in: ownTx.map((t) => t._id) } }] };
}

async function list(req, res) {
  const filter = await visibilityFilter(req.user);
  if (req.query.transactionId) {
    Object.assign(filter, { transactionId: req.query.transactionId });
  }
  const comments = await Comment.find(filter).sort({ ts: -1 }).limit(200);
  res.json(comments);
}

async function create(req, res) {
  const { text, transactionId } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Comment text is required." });
  }

  // You may only attach a comment to an entry you can actually see.
  if (transactionId) {
    const tx = await Transaction.findById(transactionId);
    if (!tx) return res.status(404).json({ error: "Transaction not found." });
    if (req.user.role === "User" && String(tx.submittedBy) !== req.user.id) {
      return res.status(403).json({ error: "You can only comment on your own entries." });
    }
  }

  const comment = await Comment.create({
    author: req.user.name,
    authorId: req.user.id,
    text: text.trim(),
    transactionId: transactionId || null,
  });
  res.status(201).json(comment);
}

async function remove(req, res) {
  const comment = await Comment.findById(req.params.id);
  if (!comment) return res.status(404).json({ error: "Comment not found." });
  if (String(comment.authorId) !== req.user.id) {
    return res.status(403).json({ error: "You can only delete your own comments." });
  }
  await comment.deleteOne();
  res.json({ ok: true });
}

module.exports = { list, create, remove };
