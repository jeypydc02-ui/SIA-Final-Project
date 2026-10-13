const { test, expect } = require("@playwright/test");
const { api, accounts, registerUser, waitForPayment } = require("./helpers");

const newBill = (token, name, amount = 800) =>
  api("/api/bills", { method: "POST", token, body: { name, category: "Utilities", amount, due: "2026-12-15" } });
const ask = (token, billId, extra = {}) =>
  api("/api/payment-requests", { method: "POST", token, body: { billId, ...extra } });
const decide = (token, id, decision, remarks) =>
  api(`/api/payment-requests/${id}/decision`, { method: "PATCH", token, body: { decision, remarks } });
const myRequest = async (token, id) => (await api("/api/payment-requests", { token })).data.find((r) => r._id === id);

test.describe("Review and approval workflow", () => {
  test("AP-01 approval sends the payment to the gateway; the bill is Paid only when it confirms", async () => {
    const { user, approver } = accounts();
    const bill = await newBill(user.token, "AP-01 bill");
    const made = await ask(user.token, bill.data._id, { note: "paid at the center" });
    expect(made.status).toBe(201);
    expect(made.data.status).toBe("Pending");

    const queue = await api("/api/payment-requests", { token: approver.token });
    expect(queue.data.some((r) => r._id === made.data._id)).toBe(true);
    const unpaid = await api("/api/bills", { token: user.token });
    expect(unpaid.data.find((b) => b._id === bill.data._id).paid).toBe(false);

    const ok = await decide(approver.token, made.data._id, "approve");
    expect(ok.status).toBe(200);
    expect(["Approved", "Paid"]).toContain(ok.data.status);   // the webhook may already have arrived

    const done = await waitForPayment(bill.data._id, user.token);
    expect(done.bill.paid).toBe(true);
    const final = await myRequest(user.token, made.data._id);
    expect(final.status).toBe("Paid");
    expect(final.gatewayStatus).toBe("success");
    expect(final.reviewerName).toBe(approver.user.name);
    expect(final.history.map((h) => h.action)).toEqual(
      expect.arrayContaining(["Submitted", "Approved", "Gateway confirmed payment"])
    );
  });

  test("AP-02 a rejection needs a reason, leaves the bill unpaid and closes the request", async () => {
    const { user, approver } = accounts();
    const bill = await newBill(user.token, "AP-02 bill");
    const made = await ask(user.token, bill.data._id);
    expect((await decide(approver.token, made.data._id, "reject")).status).toBe(400);
    expect((await decide(approver.token, made.data._id, "reject", "Wrong amount")).status).toBe(200);

    const closed = await myRequest(user.token, made.data._id);
    expect(closed.status).toBe("Rejected");
    expect(closed.remarks).toBe("Wrong amount");
    const bills = await api("/api/bills", { token: user.token });
    expect(bills.data.find((b) => b._id === bill.data._id).paid).toBe(false);
    // a closed request does not block a new one
    expect((await ask(user.token, bill.data._id)).status).toBe(201);
  });

  test("AP-03 a revision is resubmitted by the User, and goes back to the Approver", async () => {
    const { user, approver } = accounts();
    const bill = await newBill(user.token, "AP-03 bill");
    const made = await ask(user.token, bill.data._id);
    expect((await decide(approver.token, made.data._id, "revise", "Check the amount")).status).toBe(200);
    expect((await ask(user.token, bill.data._id)).status).toBe(400);   // still in revision

    const again = await api(`/api/payment-requests/${made.data._id}/resubmit`, {
      method: "PUT", token: user.token, body: { amount: 750, note: "corrected" },
    });
    expect(again.status).toBe(200);
    expect(again.data.status).toBe("Pending");
    expect(again.data.amount).toBe(750);
  });

  test("AP-04 only an Approver decides; an Admin and other Users are refused", async () => {
    const { user, admin, approver } = accounts();
    const bill = await newBill(user.token, "AP-04 bill");
    const made = await ask(user.token, bill.data._id);

    expect((await decide(user.token, made.data._id, "approve")).status).toBe(403);
    expect((await decide(admin.token, made.data._id, "approve")).status).toBe(403);
    expect((await api("/api/payment-requests", { token: admin.token })).status).toBe(403);
    expect((await api("/api/bills", { token: approver.token })).status).toBe(403);   // an Approver has no wallet

    const stranger = await registerUser("ap04");
    expect((await ask(stranger.token, bill.data._id)).status).toBe(403);
    expect((await api("/api/payment-requests", { token: stranger.token })).data).toHaveLength(0);
    expect((await myRequest(user.token, made.data._id)).status).toBe("Pending");
  });

  test("AP-05 'approved' is not 'paid': a gateway failure leaves the bill unpaid", async () => {
    const { user, approver } = accounts();
    const bill = await newBill(user.token, "AP-05 bill");
    const made = await ask(user.token, bill.data._id, { note: "demo #fail" });
    expect((await decide(approver.token, made.data._id, "approve")).status).toBe(200);

    let status = "Approved";
    for (let i = 0; i < 60 && status === "Approved"; i++) {
      await new Promise((r) => setTimeout(r, 100));
      status = (await myRequest(user.token, made.data._id)).status;
    }
    expect(status).toBe("Failed");
    const bills = await api("/api/bills", { token: user.token });
    expect(bills.data.find((b) => b._id === bill.data._id).paid).toBe(false);
    expect((await ask(user.token, bill.data._id)).status).toBe(201);   // can try again
  });

  test("AP-06 a gateway callback with a bad signature is refused", async () => {
    const { user } = accounts();
    const bill = await newBill(user.token, "AP-06 bill");
    const made = await ask(user.token, bill.data._id);
    const forged = await api("/api/mock-gateway/webhook", {
      method: "POST",
      body: { reference: "SIM-FAKE", requestId: made.data._id, status: "success", amount: 800, signature: "00".repeat(32) },
    });
    expect(forged.status).toBe(403);
    const bills = await api("/api/bills", { token: user.token });
    expect(bills.data.find((b) => b._id === bill.data._id).paid).toBe(false);
    expect((await myRequest(user.token, made.data._id)).status).toBe("Pending");
  });

  test("AP-07 the Admin can make a User an Approver, and back", async () => {
    const { admin } = accounts();
    const person = await registerUser("ap07");
    const url = `/api/users/${person.user.id}/role`;
    expect((await api(url, { method: "PUT", token: admin.token, body: { role: "Approver" } })).status).toBe(200);
    expect((await api("/api/bills", { token: person.token })).status).toBe(403);
    expect((await api("/api/payment-requests", { token: person.token })).status).toBe(200);
    expect((await api(url, { method: "PUT", token: admin.token, body: { role: "User" } })).status).toBe(200);
    expect((await api("/api/bills", { token: person.token })).status).toBe(200);
  });
});