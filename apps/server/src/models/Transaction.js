const { Schema, model } = require("mongoose");
const { isRealDate, todayISO } = require("../utils/dates");

const TransactionSchema = new Schema({
  type: { type: String, enum: ["Income", "Expense"], required: true },
  category: { type: String, required: true, trim: true, maxlength: [40, "Category cannot be longer than 40 characters."] },
  amount: { type: Number, required: true, min: [0.01, "Amount must be greater than zero."], max: [1e12, "That amount is unrealistically large."] },
  // Validated like a bill's due date: reports group entries by month, and a
  // free-text date such as "not-a-date" or 2026-02-30 breaks every one of them.
  date: {
    type: String, required: true,
    validate: [
      { validator: isRealDate, message: "Date must be a real calendar date (YYYY-MM-DD)." },
      // Money that has not moved yet is not income or an expense. A future
      // date also landed in a month whose budget had not started.
      { validator: (v) => !isRealDate(v) || v <= todayISO(), message: "Date cannot be in the future." },
    ],
  },
  note: { type: String, default: "", trim: true, maxlength: [300, "Note cannot be longer than 300 characters."] },
  status: {
    type: String,
    // "Approved" is the current, counted version; see transactionController.js.
    enum: ["Approved", "Superseded", "Deleted", "Pending Review", "Rejected", "Needs Revision"],
    default: "Approved",
  },
  version: { type: Number, default: 1 },
  parentId: { type: Schema.Types.ObjectId, ref: "Transaction", default: null, index: true },
  autoApproved: { type: Boolean, default: false },
  submittedBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  reviewComment: { type: String, default: "", trim: true, maxlength: [300, "Comment cannot be longer than 300 characters."] },
  createdAt: { type: Date, default: Date.now },
});

// Lists filter on status and show newest first.
TransactionSchema.index({ status: 1, createdAt: -1 });

module.exports = model("Transaction", TransactionSchema);
