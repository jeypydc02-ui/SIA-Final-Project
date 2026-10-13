const crypto = require("crypto");

// A SIMULATED payment gateway for the academic demo. It behaves like a real one
// in the ways that matter for integration:
//   1. the system sends it a payload (reference, amount, currency …);
//   2. it answers "accepted" at once, but the RESULT comes later;
//   3. the result arrives as a signed webhook call to our own API.
// No money moves. Set GATEWAY_WEBHOOK_SECRET in production-like deployments.
const SECRET = process.env.GATEWAY_WEBHOOK_SECRET || "fintrack-stark-simulated-gateway";
const DELAY_MS = Number(process.env.MOCK_GATEWAY_DELAY_MS) || 2000;

// Signs the fields that matter, so a webhook call cannot be forged by anyone
// who does not know the secret.
function sign({ reference, requestId, status, amount }) {
  const text = [reference, requestId, status, Number(amount).toFixed(2)].join(".");
  return crypto.createHmac("sha256", SECRET).update(text).digest("hex");
}

function verify(fields, signature) {
  if (typeof signature !== "string") return false;
  const expected = sign(fields);
  return signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function buildPayload(request) {
  return {
    reference: "SIM-" + crypto.randomBytes(5).toString("hex").toUpperCase(),
    requestId: String(request._id),
    amount: request.amount,
    currency: "PHP",
    description: `Bill payment: ${request.billName}`,
    simulated: true,
  };
}

// For demos: a note containing #fail (or MOCK_GATEWAY_FAIL=1) makes the
// gateway report a failure, to show that "approved" is not the same as "paid".
function shouldFail(request) {
  return process.env.MOCK_GATEWAY_FAIL === "1" || /#fail\b/i.test(request.note || "");
}

// "Sends" the payload. Returns immediately; the outcome is delivered later by
// calling this server's webhook, the way a real gateway would.
function submitCharge(payload, { fail = false } = {}) {
  const port = process.env.PORT || 4000;
  setTimeout(async () => {
    const result = {
      reference: payload.reference,
      requestId: payload.requestId,
      status: fail ? "failed" : "success",
      amount: payload.amount,
    };
    try {
      await fetch(`http://127.0.0.1:${port}/api/mock-gateway/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...result, signature: sign(result) }),
      });
    } catch (err) {
      console.error("[mock-gateway] could not deliver the webhook:", err.message);
    }
  }, DELAY_MS);
  return { accepted: true, reference: payload.reference };
}

module.exports = { buildPayload, submitCharge, shouldFail, verify };