const { Schema, model } = require("mongoose");

// A receipt or proof of payment attached to an income or expense entry — the
// Asset / File Submission module (spec section 5). Either an uploaded file
// (image or PDF, kept in the database) or a link to a file kept elsewhere,
// such as Google Drive (External Storage Integration Simulation, section 6).
//
// Receipts are versioned: a replacement after "Needs Revision" is v2 of the
// same receipt, and the earlier version is kept for the history. Only the
// latest version of a chain is ever reviewed.
const STATUSES = ["For Review", "Verified", "Rejected", "Needs Revision", "Replaced", "Withdrawn"];

const ReceiptSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  ownerName: { type: String, required: true },
  // The entry it is proof for. Kept pointing at the entry's current version:
  // editing the entry moves its receipts along (see transactionController).
  entryId: { type: Schema.Types.ObjectId, ref: "Transaction", required: true, index: true },

  version: { type: Number, default: 1 },
  parentId: { type: Schema.Types.ObjectId, ref: "Receipt", default: null },
  latest: { type: Boolean, default: true },

  kind: { type: String, enum: ["file", "link"], required: true },
  // kind = "file"
  fileName: { type: String, trim: true, maxlength: 120, default: "" },
  mimeType: { type: String, default: "" },
  size: { type: Number, default: 0 },
  // Not loaded unless asked for (select: false), so lists never carry files.
  data: { type: Buffer, select: false },
  // kind = "link"
  url: { type: String, trim: true, maxlength: 500, default: "" },
  provider: { type: String, default: "" },

  status: { type: String, enum: STATUSES, default: "For Review", index: true },
  submittedAt: { type: Date, default: Date.now },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  reviewerName: { type: String, default: "" },
  reviewedAt: { type: Date, default: null },
  reviewNote: { type: String, trim: true, maxlength: 300, default: "" },
});

ReceiptSchema.index({ latest: 1, status: 1, submittedAt: 1 });

module.exports = model("Receipt", ReceiptSchema);
module.exports.RECEIPT_STATUSES = STATUSES;
