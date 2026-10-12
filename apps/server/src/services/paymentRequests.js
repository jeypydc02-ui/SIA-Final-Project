const PaymentRequest = require("../models/PaymentRequest");

// A bill with a request in one of these states is "in progress": it cannot be
// edited, deleted or requested again until the request is closed.
const ACTIVE_STATUSES = ["Pending", "Revision", "Approved"];

// What each role may see:
//   User     -> their own requests
//   Approver -> everything waiting for review, plus what they reviewed
//   Admin    -> nothing (the Admin runs the system, not the money)
async function listFor(user) {
  if (user.role === "User") {
    return PaymentRequest.find({ requester: user.id }).sort({ createdAt: -1 }).limit(200).lean();
  }
  if (user.role === "Approver") {
    return PaymentRequest.find({ $or: [{ status: "Pending" }, { reviewer: user.id }] }).sort({ createdAt: -1 }).limit(300).lean();
  }
  return [];
}

module.exports = { ACTIVE_STATUSES, listFor };