const { Schema, model } = require("mongoose");

const TransactionSchema = new Schema({
  type: { type: String, enum: ["Income", "Expense"], required: true },
  category: { type: String, required: true, trim: true, maxlength: [40, "Category cannot be longer than 40 characters."] },
  amount: { type: Number, required: true, min: [0.01, "Amount must be greater than zero."], max: [1e12, "That amount is unrealistically large."] },
  date: { type: String, required: true },
  note: { type: String, default: "", trim: true, maxlength: [300, "Note cannot be longer than 300 characters."] },
  status: {
    type: String,
    enum: ["Pending Review", "Approved", "Rejected", "Needs Revision", "Superseded"],
    default: "Pending Review",
  },
  version: { type: Number, default: 1 },
  parentId: { type: Schema.Types.ObjectId, ref: "Transaction", default: null },
  autoApproved: { type: Boolean, default: false },
  submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  reviewComment: { type: String, default: "", trim: true, maxlength: [300, "Comment cannot be longer than 300 characters."] },
  createdAt: { type: Date, default: Date.now },
});

module.exports = model("Transaction", TransactionSchema);
