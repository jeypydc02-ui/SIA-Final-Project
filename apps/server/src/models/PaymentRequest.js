const { Schema, model } = require("mongoose");

// One line of a request's story: submitted, approved, sent to the gateway…
// Kept inside the request so Review History needs no second collection.
const HistorySchema = new Schema({
  action: { type: String, required: true },
  by: { type: String, required: true },
  byId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  remarks: { type: String, default: "" },
  at: { type: Date, default: Date.now },
}, { _id: false });

// A User's request to pay one of their bills. An Approver reviews it; only an
// approved request is sent to the (simulated) payment gateway, and the bill is
// marked Paid only when the gateway's callback says the payment succeeded.
//
//   Pending  -> waiting for an Approver
//   Revision -> the Approver asked for changes; the User resubmits
//   Rejected -> closed by the Approver
//   Approved -> approved, payload sent, waiting for the gateway's answer
//   Paid     -> gateway confirmed; bill settled
//   Failed   -> gateway reported a failure; bill still unpaid
const PaymentRequestSchema = new Schema({
  bill: { type: Schema.Types.ObjectId, ref: "Bill", required: true, index: true },
  requester: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  requesterName: { type: String, required: true },
  // Copied from the bill when the request is made: this is what the Approver
  // reviews, and it does not change if the bill is edited afterwards.
  billName: { type: String, required: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true, min: [0.01, "Amount must be greater than zero."], max: [1e12, "That amount is unrealistically large."] },
  due: { type: String, required: true },
  note: { type: String, default: "", trim: true, maxlength: [300, "Note cannot be longer than 300 characters."] },
  status: { type: String, enum: ["Pending", "Revision", "Rejected", "Approved", "Paid", "Failed"], default: "Pending", index: true },
  reviewer: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  reviewerName: { type: String, default: "" },
  remarks: { type: String, default: "" },
  reviewedAt: { type: Date, default: null },
  gatewayRef: { type: String, default: "" },
  gatewayStatus: { type: String, enum: ["none", "sent", "success", "failed"], default: "none" },
  history: { type: [HistorySchema], default: [] },
}, { timestamps: true });

module.exports = model("PaymentRequest", PaymentRequestSchema);