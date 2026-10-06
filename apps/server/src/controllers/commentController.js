const Comment = require("../models/Comment");
const Transaction = require("../models/Transaction");
const { isNonEmptyString } = require("../utils/validate");
const { publish } = require("../services/events");

// Two kinds of comment live in this collection, both private to the person
// whose money they are about (NFR-002), whatever their role:
//   - a personal note (no transactionId), visible to its author;
//   - a note on an entry, visible to that entry's owner.
async function visibilityFilter(user) {
  const ownNotes = { authorId: user.id, transactionId: null };
  const ownTx = await Transaction.find({ submittedBy: user.id }).select("_id");
  return { $or: [ownNotes, { transactionId: { $in: ownTx.map((t) => t._id) } }] };
}

async function list(req, res) {
  const filter = await visibilityFilter(req.user);
  if (req.query.transactionId) {
    // Express parses ?transactionId[$ne]=x into an object; only a plain id is
    // a filter, anything else is not passed to the database as an operator.
    if (typeof req.query.transactionId !== "string") {
      return res.status(400).json({ error: "That record id is not valid." });
    }
    Object.assign(filter, { transactionId: req.query.transactionId });
  }
  const comments = await Comment.find(filter).sort({ ts: -1 }).limit(200).lean();
  res.json(comments);
}

async function create(req, res) {
  const { text, transactionId } = req.body || {};
  if (!isNonEmptyString(text)) {
    return res.status(400).json({ error: "Comment text is required." });
  }

  // You may only attach a comment to an entry you can actually see.
  if (transactionId) {
    const tx = await Transaction.findById(transactionId);
    if (!tx) return res.status(404).json({ error: "Transaction not found." });
    if (String(tx.submittedBy) !== req.user.id) {
      return res.status(403).json({ error: "You can only comment on your own entries." });
    }
  }

  const comment = await Comment.create({
    author: req.user.name,
    authorId: req.user.id,
    text: text.trim(),
    transactionId: transactionId || null,
  });
  publish(req.user.id, "comments");
  res.status(201).json(comment);
}

async function remove(req, res) {
  const comment = await Comment.findById(req.params.id);
  if (!comment) return res.status(404).json({ error: "Comment not found." });
  if (String(comment.authorId) !== req.user.id) {
    return res.status(403).json({ error: "You can only delete your own comments." });
  }
  await comment.deleteOne();
  publish(req.user.id, "comments");
  res.json({ ok: true });
}

module.exports = { list, create, remove, visibilityFilter };
