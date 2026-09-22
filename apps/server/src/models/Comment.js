const { Schema, model } = require("mongoose");

const CommentSchema = new Schema({
  // Null for a personal note; set when the comment is review feedback on a
  // specific entry (spec section 5, Comment / Feedback Module).
  transactionId: { type: Schema.Types.ObjectId, ref: "Transaction", default: null, index: true },
  author: { type: String, required: true },
  authorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  text: { type: String, required: true, trim: true, maxlength: [1000, "A note cannot be longer than 1000 characters."] },
  ts: { type: Date, default: Date.now },
});

module.exports = model("Comment", CommentSchema);
