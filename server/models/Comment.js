const { Schema, model } = require("mongoose");

const CommentSchema = new Schema({
  transactionId: { type: Schema.Types.ObjectId, ref: "Transaction", default: null },
  author: { type: String, required: true },
  text: { type: String, required: true },
  ts: { type: Date, default: Date.now },
});

module.exports = model("Comment", CommentSchema);
