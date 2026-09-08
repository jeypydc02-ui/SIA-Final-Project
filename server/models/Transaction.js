const { Schema, model } = require("mongoose");

const TransactionSchema = new Schema({
  type: { type: String, enum: ["Income", "Expense"], required: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: String, required: true },
  note: { type: String, default: "" },
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
  reviewComment: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = model("Transaction", TransactionSchema);
