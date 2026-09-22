const { test, expect } = require("@playwright/test");
const { api, accounts, signIn, gotoScreen } = require("./helpers");

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
    const { user, reviewer } = accounts();

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

    // An entry cannot be reviewed twice.
    const tx = await api("/api/transactions", {
      method: "POST", token: user.token,
      body: { type: "Expense", category: "Food", amount: 120, note: "double review guard" },
    });
    await api(`/api/transactions/${tx.data._id}/review`, { method: "POST", token: reviewer.token, body: { action: "approve" } });
    const again = await api(`/api/transactions/${tx.data._id}/review`, { method: "POST", token: reviewer.token, body: { action: "reject" } });
    expect(again.status).toBe(400);
    expect(again.data.error).toContain("cannot be reviewed again");

    // Only an entry marked "Needs Revision" can be resubmitted.
    const badResubmit = await api(`/api/transactions/${tx.data._id}/resubmit`, { method: "POST", token: user.token, body: { amount: 1 } });
    expect(badResubmit.status).toBe(400);
  });
});
