const Bill = require("../models/Bill");
const User = require("../models/User");
const PaymentRequest = require("../models/PaymentRequest");
const { logAction, logFailure } = require("../services/audit");
const { notify } = require("../services/notifications");
const { publish, publishToRole } = require("../services/events");
const { sendMail, layout } = require("../services/mailer");
const gateway = require("../services/mockGateway");
const { settleBill } = require("../services/paymentSettlement");
const { ACTIVE_STATUSES, listFor } = require("../services/paymentRequests");
const { isNonEmptyString, isString, parseAmount } = require("../utils/validate");

const GATEWAY = "Payment Gateway (Simulated)";
const money = (n) => "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DECISIONS = { approve: "Approved", reject: "Rejected", revise: "Revision" };
const DECISION_LABEL = { Approved: "Approved", Rejected: "Rejected", Revision: "Revision Requested" };

// E-mails the requester. Never awaited by the caller and never allowed to fail
// the workflow: if the mail service is down, the decision still stands and the
// failure is written to the audit log.
async function emailRequester(userId, ref, { subject, heading, intro }) {
  try {
    const user = await User.findById(userId).select("email").lean();
    if (!user) return;
    await sendMail({
      to: user.email,
      subject,
      text: intro,
      html: layout({ heading, intro, outro: "Open FinTrack Stark to see the full details of your request." }),
    });
    await logAction("System", "Notification E-mail Sent", `${subject} (request ${String(ref).slice(-8)}).`, { ref });
  } catch (err) {
    console.error("[mail] payment e-mail not sent:", err.message);
    await logAction("System", "E-mail Failed", err.message, { status: "Failed", ref }).catch(() => {});
  }
}

async function notifyApprovers(message, ref) {
  const approvers = await User.find({ role: "Approver", active: { $ne: false } }).select("_id").lean();
  await Promise.all(approvers.map((a) => notify("approval", message, a._id)));
  publishToRole("Approver", "approvals");
  return approvers.length;
}

// GET /api/payment-requests — what this person may see (see services/paymentRequests.js).
async function list(req, res) {
  res.json(await listFor(req.user));
}

// POST /api/payment-requests { billId, amount?, note? } — a User asks to pay a bill.
async function create(req, res) {
  const { billId, amount, note } = req.body || {};
  if (!isNonEmptyString(billId)) return res.status(400).json({ error: "Choose the bill to pay." });
  if (note !== undefined && note !== null && !isString(note)) return res.status(400).json({ error: "The note must be text." });

  const bill = await Bill.findById(billId);
  if (!bill) return res.status(404).json({ error: "Bill not found." });
  if (String(bill.createdBy) !== req.user.id) return res.status(403).json({ error: "You can only request payment for your own bills." });
  if (bill.paid) return res.status(400).json({ error: "This bill is already marked as paid." });

  const finalAmount = parseAmount(amount ?? bill.amount);
  if (finalAmount === null) return res.status(400).json({ error: "Enter a payment amount between 0.01 and 1,000,000,000,000." });

  const open = await PaymentRequest.findOne({ bill: bill._id, status: { $in: ACTIVE_STATUSES } }).lean();
  if (open) return res.status(400).json({ error: `This bill already has a payment request (${open.status}).` });

  const approverCount = await User.countDocuments({ role: "Approver", active: { $ne: false } });
  if (!approverCount) return res.status(409).json({ error: "No approver account is set up yet. Ask the Admin to assign one." });

  const request = await PaymentRequest.create({
    bill: bill._id,
    requester: req.user.id,
    requesterName: req.user.name,
    billName: bill.name,
    category: bill.category,
    amount: finalAmount,
    due: bill.due,
    note: note || "",
    history: [{ action: "Submitted", by: req.user.name, byId: req.user.id, remarks: (note || "").trim() }],
  });

  await logAction(req.user, "Payment Requested", `${bill.name} — payment of ${money(finalAmount)} sent for approval.`, { ref: request._id, scope: "user" });
  await notifyApprovers(`${req.user.name} asked for approval to pay "${bill.name}" (${money(finalAmount)}).`, request._id);
  publish(req.user.id, "bills");
  res.status(201).json(request);
}

// PUT /api/payment-requests/:id/resubmit { amount?, note? } — after "Request Revision".
async function resubmit(req, res) {
  const { amount, note } = req.body || {};
  if (note !== undefined && note !== null && !isString(note)) return res.status(400).json({ error: "The note must be text." });

  const current = await PaymentRequest.findById(req.params.id);
  if (!current) return res.status(404).json({ error: "Request not found." });
  if (String(current.requester) !== req.user.id) return res.status(403).json({ error: "You can only change your own requests." });
  if (current.status !== "Revision") return res.status(400).json({ error: "Only a request marked for revision can be sent again." });

  const finalAmount = parseAmount(amount ?? current.amount);
  if (finalAmount === null) return res.status(400).json({ error: "Enter a payment amount between 0.01 and 1,000,000,000,000." });
  const bill = await Bill.findById(current.bill);
  if (!bill || bill.paid) return res.status(400).json({ error: "This bill can no longer be paid." });

  const updated = await PaymentRequest.findOneAndUpdate(
    { _id: current._id, status: "Revision" },
    {
      $set: { status: "Pending", amount: finalAmount, note: note !== undefined && note !== null ? String(note).trim().slice(0, 300) : current.note },
      $push: { history: { action: "Resubmitted", by: req.user.name, byId: req.user.id, remarks: (note || "").trim() } },
    },
    { new: true, runValidators: true }
  );
  if (!updated) return res.status(400).json({ error: "Only a request marked for revision can be sent again." });

  await logAction(req.user, "Payment Requested", `${updated.billName} — revised request of ${money(finalAmount)} sent for approval again.`, { ref: updated._id, scope: "user" });
  await notifyApprovers(`${req.user.name} revised and resubmitted the request for "${updated.billName}" (${money(finalAmount)}).`, updated._id);
  publish(req.user.id, "bills");
  res.json(updated);
}

// PATCH /api/payment-requests/:id/decision { decision: "approve"|"reject"|"revise", remarks }
// The Approver's decision. The frontend never decides anything: this endpoint
// checks the role (route middleware), checks the request is still Pending, and
// only then saves the decision and starts the automated steps.
async function decide(req, res) {
  const { decision, remarks } = req.body || {};
  if (!Object.prototype.hasOwnProperty.call(DECISIONS, decision)) {
    return res.status(400).json({ error: "Decision must be approve, reject or revise." });
  }
  if (remarks !== undefined && remarks !== null && !isString(remarks)) {
    return res.status(400).json({ error: "Remarks must be text." });
  }
  const next = DECISIONS[decision];
  const label = DECISION_LABEL[next];
  const note = (remarks || "").trim();
  if (next !== "Approved" && !note) return res.status(400).json({ error: "Write a reason so the requester knows what to do next." });
  if (note.length > 300) return res.status(400).json({ error: "Remarks cannot be longer than 300 characters." });

  const current = await PaymentRequest.findById(req.params.id);
  if (!current) return res.status(404).json({ error: "Request not found." });
  if (String(current.requester) === req.user.id) return res.status(403).json({ error: "You cannot review your own request." });
  if (current.status !== "Pending") return res.status(409).json({ error: `This request is already ${current.status.toLowerCase()}.` });

  const bill = await Bill.findById(current.bill).lean();
  if (!bill || bill.paid) return res.status(400).json({ error: "The bill for this request can no longer be paid." });

  // Claim the request atomically: if two Approvers click at once, only one
  // wins, so a request is never decided (or paid) twice.
  const claimed = await PaymentRequest.findOneAndUpdate(
    { _id: current._id, status: "Pending" },
    {
      $set: { status: next, reviewer: req.user.id, reviewerName: req.user.name, remarks: note, reviewedAt: new Date() },
      $push: { history: { action: label, by: req.user.name, byId: req.user.id, remarks: note } },
    },
    { new: true }
  );
  if (!claimed) return res.status(409).json({ error: "Another approver has just reviewed this request." });

  // The Admin's log never shows amounts or bill names (what people spend is private).
  await logAction(
    req.user,
    `Payment ${next === "Revision" ? "Revision Requested" : next}`,
    `Request ${String(claimed._id).slice(-8)} ${label.toLowerCase()} by ${req.user.name}.` + (note ? ` Remarks: ${note}` : ""),
    { ref: claimed._id, scope: "system" }
  );

  if (next === "Approved") {
    await notify("payment-approved", `Your payment request for "${claimed.billName}" was approved by ${req.user.name}. Waiting for the payment gateway to confirm.`, claimed.requester);
    // The automated trigger: send the payload to the (simulated) gateway.
    // The reference is saved first, so the webhook can always find the request.
    const payload = gateway.buildPayload(claimed);
    await PaymentRequest.updateOne(
      { _id: claimed._id },
      {
        $set: { gatewayRef: payload.reference, gatewayStatus: "sent" },
        $push: { history: { action: "Payload sent to gateway (simulated)", by: GATEWAY, remarks: `Reference ${payload.reference}` } },
      }
    );
    gateway.submitCharge(payload, { fail: gateway.shouldFail(claimed) });
    await logAction(GATEWAY, "Gateway Payload Sent", `Request ${String(claimed._id).slice(-8)}: payload ${payload.reference} accepted; waiting for the callback.`, { ref: claimed._id });
    emailRequester(claimed.requester, claimed._id, {
      subject: "Your bill payment request was approved",
      heading: "Payment request approved",
      intro: `${req.user.name} approved your request to pay "${claimed.billName}" (${money(claimed.amount)}). It has been sent to the payment gateway (simulated); you will be notified once it is confirmed.`,
    });
  } else {
    const rejected = next === "Rejected";
    await notify(
      rejected ? "payment-rejected" : "payment-revision",
      rejected
        ? `Your payment request for "${claimed.billName}" was rejected by ${req.user.name}: ${note}`
        : `${req.user.name} asked you to revise your payment request for "${claimed.billName}": ${note}`,
      claimed.requester
    );
    emailRequester(claimed.requester, claimed._id, {
      subject: rejected ? "Your bill payment request was rejected" : "Your bill payment request needs changes",
      heading: rejected ? "Payment request rejected" : "Revision requested",
      intro: `${req.user.name} ${rejected ? "rejected" : "asked for changes to"} your request to pay "${claimed.billName}". Reason: ${note}`,
    });
  }

  publish(claimed.requester, "bills");
  publishToRole("Approver", "approvals");
  res.json(await PaymentRequest.findById(claimed._id).lean());
}

// POST /api/mock-gateway/webhook — where the simulated gateway reports the result.
// Not behind a login (a real gateway has no session); the signature is the proof
// it came from the gateway. Repeated callbacks are harmless: only a request that
// is still Approved can change.
async function webhook(req, res) {
  const { reference, requestId, status, amount, signature } = req.body || {};
  const valid = isNonEmptyString(reference) && isNonEmptyString(requestId) &&
    (status === "success" || status === "failed") &&
    gateway.verify({ reference, requestId, status, amount }, signature);
  if (!valid) {
    await logFailure(GATEWAY, "Gateway Callback Rejected", "Missing fields or invalid signature.", typeof requestId === "string" ? requestId : "", "system");
    return res.status(403).json({ error: "Invalid gateway callback." });
  }

  const paid = status === "success";
  const claimed = await PaymentRequest.findOneAndUpdate(
    { _id: requestId, gatewayRef: reference, status: "Approved" },
    {
      $set: { status: paid ? "Paid" : "Failed", gatewayStatus: status },
      $push: { history: { action: paid ? "Gateway confirmed payment" : "Gateway reported a failure", by: GATEWAY, remarks: `Reference ${reference}` } },
    },
    { new: true }
  );
  if (!claimed) return res.json({ ok: true, ignored: true });

  const approver = { id: claimed.reviewer, name: claimed.reviewerName };
  const owner = { id: claimed.requester, name: claimed.requesterName };
  let outcome = paid;

  if (paid) {
    const settled = await settleBill(claimed.bill, claimed.amount, owner, approver, reference);
    if (!settled) {
      // The bill was paid or removed in the meantime: nothing was recorded.
      outcome = false;
      await PaymentRequest.updateOne(
        { _id: claimed._id },
        { $set: { status: "Failed" }, $push: { history: { action: "Bill could not be settled", by: "System", remarks: "The bill was already paid or no longer exists." } } }
      );
    }
  }

  await logAction(
    GATEWAY,
    "Gateway Callback",
    `Request ${String(claimed._id).slice(-8)}: gateway reported ${status}.` + (outcome ? " Bill settled, expense recorded, requester notified." : " Bill left unpaid."),
    { ref: claimed._id, status: outcome ? "Success" : "Failed" }
  );

  if (outcome) {
    emailRequester(claimed.requester, claimed._id, {
      subject: "Your bill payment was confirmed",
      heading: "Payment confirmed",
      intro: `The payment gateway (simulated) confirmed your payment for "${claimed.billName}" (${money(claimed.amount)}). The bill is now marked as Paid.`,
    });
  } else {
    await notify("payment-failed", `The payment gateway could not complete the payment for "${claimed.billName}". The bill is still unpaid — you can send a new request.`, claimed.requester);
    emailRequester(claimed.requester, claimed._id, {
      subject: "Your bill payment did not go through",
      heading: "Payment failed",
      intro: `The payment gateway (simulated) could not complete the payment for "${claimed.billName}". The bill is still unpaid; you can send a new request.`,
    });
  }

  publish(claimed.requester, "bills");
  publishToRole("Approver", "approvals");
  res.json({ ok: true });
}

module.exports = { list, create, resubmit, decide, webhook };