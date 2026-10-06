const { Schema, model } = require("mongoose");

const CommentSchema = new Schema({
  // Null for a personal note; set when the note is about a specific entry
  // (spec section 5, Comment / Feedback Module).
  transactionId: { type: Schema.Types.ObjectId, ref: "Transaction", default: null, index: true },
  author: { type: String, required: true },
  authorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  // Optional, like the title line of a note on a phone. Older notes have none.
  title: { type: String, trim: true, default: "", maxlength: [120, "A title cannot be longer than 120 characters."] },
  text: { type: String, required: true, trim: true, maxlength: [5000, "A note cannot be longer than 5000 characters."] },
  ts: { type: Date, default: Date.now },
  editedAt: { type: Date, default: null },
});

module.exports = model("Comment", CommentSchema);
