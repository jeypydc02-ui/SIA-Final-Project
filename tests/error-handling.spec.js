const { test, expect } = require("@playwright/test");
const { api, accounts, signIn, gotoScreen, registerUser, mailTo, codeIn, linkIn, uniqueEmail } = require("./helpers");

// Error-handling test cases (spec section 16: minimum 5), covering what
// section 7.5 asks for: missing, invalid, duplicate, and failed data.

test.describe("Error handling", () => {
  test("ET-01 missing required fields are rejected with a usable message", async () => {
    const { user } = accounts();

    const noName = await api("/api/bills", { method: "POST", token: user.token, body: { category: "Utilities", amount: 100, due: "2026-12-01" } });
    expect(noName.status).toBe(400);
    expect(noName.data.error).toContain("required");

    const noType = await api("/api/transactions", { method: "POST", token: user.token, body: { category: "Food", amount: 50 } });
    expect(noType.status).toBe(400);
    expect(noType.data.error).toContain("Income or Expense");
  });

  test("ET-02 invalid amounts are rejected at the boundary", async () => {
    const { user } = accounts();
    const base = { name: "Bad Amount", category: "Utilities", due: "2026-12-01" };

    const negative = await api("/api/bills", { method: "POST", token: user.token, body: { ...base, amount: -100 } });
    expect(negative.status).toBe(400);

    const zero = await api("/api/bills", { method: "POST", token: user.token, body: { ...base, amount: 0 } });
    expect(zero.status).toBe(400);

    const text = await api("/api/bills", { method: "POST", token: user.token, body: { ...base, amount: "abc" } });
    expect(text.status).toBe(400);
  });

  test("ET-03 duplicate data is refused and the reason is explained", async ({ page }) => {
    const { user } = accounts();

    // "Food" is already budgeted for this account by the seed.
    const dupe = await api("/api/budgets", { method: "POST", token: user.token, body: { category: "Food", limit: 1000 } });
    expect(dupe.status).toBe(409);
    expect(dupe.data.error).toContain("already have a budget");

    // And the message reaches the user rather than failing silently.
    await signIn(page, "user");
    await gotoScreen(page, "Budgets");
    await expect(page.locator(".card", { hasText: "Food" }).first()).toBeVisible();
  });

  test("ET-04 a malformed record id returns 400, not a crash or a hang", async () => {
    const { user } = accounts();

    const badVersion = await api("/api/transactions/not-a-real-id/versions", { token: user.token });
    expect(badVersion.status).toBe(400);
    expect(badVersion.data.error).toContain("not valid");

    const badBill = await api("/api/bills/12345/pay", { method: "POST", token: user.token, body: { amount: 10 } });
    expect(badBill.status).toBe(400);

    // A well-formed id that does not exist is a 404, not a 400.
    const missing = await api("/api/bills/507f1f77bcf86cd799439011", { method: "PUT", token: user.token, body: { amount: 10 } });
    expect(missing.status).toBe(404);
  });

  test("ET-05 an invalid workflow transition is refused", async () => {
    const { user } = accounts();

    // A bill cannot be paid twice.
    const bill = await api("/api/bills", {
      method: "POST", token: user.token,
      body: { name: "Double Pay Guard", category: "Credit", amount: 500, due: "2026-12-01" },
    });
    const first = await api(`/api/bills/${bill.data._id}/pay`, { method: "POST", token: user.token, body: { amount: 500 } });
    expect(first.status).toBe(200);
    const second = await api(`/api/bills/${bill.data._id}/pay`, { method: "POST", token: user.token, body: { amount: 500 } });
    expect(second.status).toBe(400);
    expect(second.data.error).toContain("already marked as paid");

    // The expense that payment created follows its bill: it cannot be edited
    // or deleted on its own.
    const fromBill = first.data.transaction._id;
    expect((await api(`/api/transactions/${fromBill}`, { method: "PUT", token: user.token, body: { amount: 1 } })).status).toBe(400);
    expect((await api(`/api/transactions/${fromBill}`, { method: "DELETE", token: user.token })).status).toBe(400);

    // An earlier version cannot be edited, and a deleted entry cannot be
    // deleted again.
    const tx = await api("/api/transactions", {
      method: "POST", token: user.token,
      body: { type: "Expense", category: "Food", amount: 120, note: "transition guard" },
    });
    const v2 = await api(`/api/transactions/${tx.data._id}`, { method: "PUT", token: user.token, body: { amount: 130 } });
    expect(v2.status).toBe(200);
    const editOld = await api(`/api/transactions/${tx.data._id}`, { method: "PUT", token: user.token, body: { amount: 140 } });
    expect(editOld.status).toBe(400);
    expect(editOld.data.error).toContain("can no longer be changed");
    expect((await api(`/api/transactions/${v2.data._id}`, { method: "DELETE", token: user.token })).status).toBe(200);
    expect((await api(`/api/transactions/${v2.data._id}`, { method: "DELETE", token: user.token })).status).toBe(400);
  });

  test("ET-06 a wrong, spent or expired sign-up code is refused, and no account is made", async () => {
    const email = uniqueEmail("et06");
    const start = (body = {}) => api("/api/auth/register", { method: "POST", body: { firstName: "Code", lastName: "Tester", email, password: "et06pass123", ...body } });
    const verify = (code, to = email) => api("/api/auth/register/verify", { method: "POST", body: { email: to, code } });

    // Missing or malformed details are refused before any e-mail is sent.
    expect((await start({ email: "not-an-email" })).status).toBe(400);
    expect((await start({ password: "short" })).status).toBe(400);
    // An address that already has an account cannot be signed up again.
    const taken = await api("/api/auth/register", { method: "POST", body: { firstName: "A", lastName: "B", email: accounts().user.email, password: "et06pass123" } });
    expect(taken.status).toBe(409);

    expect((await start()).status).toBe(200);
    const code = codeIn(await mailTo(email));
    const wrong = code === "000000" ? "111111" : "000000";
    expect((await verify("12ab")).status).toBe(400);
    const miss = await verify(wrong);
    expect(miss.status).toBe(400);
    expect(miss.data.error).toMatch(/4 attempts left/);
    // A new code at once is refused; one a minute at most.
    const soon = await api("/api/auth/register/resend", { method: "POST", body: { email } });
    expect(soon.status).toBe(429);
    // After five wrong tries even the right code no longer works.
    for (let i = 0; i < 4; i++) await verify(wrong);
    const locked = await verify(code);
    expect(locked.status).toBe(429);
    expect(locked.data.error).toMatch(/new one/);
    // Nothing was created along the way.
    expect((await api("/api/auth/login", { method: "POST", body: { email, password: "et06pass123" } })).status).toBe(401);

    // An expired code is refused even when it is right.
    const mongoose = require("mongoose");
    const PendingRegistration = require("../apps/server/src/models/PendingRegistration");
    expect((await start()).status).toBe(200);
    const fresh = codeIn(await mailTo(email));
    await mongoose.connect(process.env.MONGO_URI);
    try {
      await PendingRegistration.updateOne({ email }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    } finally {
      await mongoose.disconnect();
    }
    expect((await verify(fresh)).status).toBe(410);
    // And a code for an address that never started signing up goes nowhere.
    expect((await verify(fresh, uniqueEmail("never"))).status).toBe(410);
  });

  test("ET-07 a reset link works once, and bad links or weak passwords are refused", async () => {
    const person = await registerUser("et07");
    const reset = (body) => api("/api/auth/reset", { method: "POST", body });
    // The same answer whether or not an account exists: the form cannot be
    // used to find out who has one.
    const known = await api("/api/auth/forgot", { method: "POST", body: { email: person.email } });
    const unknown = await api("/api/auth/forgot", { method: "POST", body: { email: uniqueEmail("nobody") } });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(unknown.data.message).toBe(known.data.message);
    expect((await api("/api/auth/forgot", { method: "POST", body: { email: "nonsense" } })).status).toBe(400);

    const token = new URL(linkIn(await mailTo(person.email))).searchParams.get("token");
    expect((await reset({ token: "f".repeat(64), password: "et07newpass1" })).status).toBe(400);
    expect((await reset({ token })).status).toBe(400);
    const weak = await reset({ token, password: "short" });
    expect(weak.status).toBe(400);
    // A refused attempt does not spend the link.
    expect((await reset({ token, password: "et07newpass1" })).status).toBe(200);
    const twice = await reset({ token, password: "et07other22" });
    expect(twice.status).toBe(400);
    expect(twice.data.error).toMatch(/expired or was already used/);
    expect((await api("/api/auth/login", { method: "POST", body: { email: person.email, password: "et07newpass1" } })).status).toBe(200);
  });
});
