const { test, expect } = require("@playwright/test");
const { entryWithReceipt } = require("./receipt-helpers");
const { api, accounts, signIn, registerUser } = require("./helpers");

// Security / access-control test cases (spec section 16: minimum 3),
// evidencing section 8.1 (RBAC matrix) and 8.2 (least privilege and
// separation of duties).

test.describe("Security and access control", () => {
  test("ST-01 (NFR-001) protected endpoints refuse unauthenticated callers", async () => {
    const paths = ["/api/bills", "/api/transactions", "/api/budgets", "/api/notifications", "/api/comments", "/api/users", "/api/audit-log"];

    for (const p of paths) {
      const res = await api(p);
      expect(res.status, `${p} without a token`).toBe(401);
    }

    // An expired or forged token is refused the same way.
    const forged = await api("/api/bills", { token: "a".repeat(64) });
    expect(forged.status).toBe(401);

    // The health probe is deliberately public.
    const health = await api("/api/health");
    expect(health.status).toBe(200);
  });

  test("ST-02 (NFR-002) a user cannot reach another user's records", async () => {
    const { user } = accounts();
    const intruder = await registerUser("intruder");

    // Arrange: the seeded user owns a bill and a budget.
    const bill = await api("/api/bills", {
      method: "POST", token: user.token,
      body: { name: "Private Bill", category: "Housing", amount: 9000, due: "2026-12-20" },
    });
    const budgets = await api("/api/budgets", { token: user.token });
    const victimBudget = budgets.data[0];

    // Read isolation: the intruder's collections do not contain them.
    const theirBills = await api("/api/bills", { token: intruder.token });
    expect(theirBills.data.some((b) => b._id === bill.data._id)).toBe(false);

    const theirBudgets = await api("/api/budgets", { token: intruder.token });
    expect(theirBudgets.data.length).toBe(0);

    const theirNotifs = await api("/api/notifications", { token: intruder.token });
    expect(theirNotifs.data.length).toBe(0);

    // Write isolation: naming the id directly does not help either.
    expect((await api(`/api/bills/${bill.data._id}/pay`, { method: "POST", token: intruder.token, body: { amount: 9000 } })).status).toBe(403);
    expect((await api(`/api/bills/${bill.data._id}`, { method: "PUT", token: intruder.token, body: { amount: 1 } })).status).toBe(403);
    expect((await api(`/api/bills/${bill.data._id}`, { method: "DELETE", token: intruder.token })).status).toBe(403);
    expect((await api(`/api/budgets/${victimBudget._id}`, { method: "PUT", token: intruder.token, body: { limit: 1 } })).status).toBe(403);
  });

  test("ST-03 (section 8.2) privileges cannot be escalated from a lower role", async ({ page }) => {
    const { user, other, admin } = accounts();

    // A User may not change someone else's entry.
    const entry = await api("/api/transactions", {
      method: "POST", token: user.token,
      body: { type: "Expense", category: "Food", amount: 250, note: "escalation probe" },
    });
    expect((await api(`/api/transactions/${entry.data._id}`, {
      method: "PUT", token: other.token, body: { amount: 1 },
    })).status).toBe(403);
    expect((await api(`/api/transactions/${entry.data._id}`, {
      method: "DELETE", token: other.token,
    })).status).toBe(403);

    // A User may not administer accounts or read the audit trail.
    expect((await api("/api/users", { token: user.token })).status).toBe(403);
    expect((await api("/api/audit-log", { token: user.token })).status).toBe(403);
    expect((await api(`/api/users/${user.user.id}/role`, {
      method: "PUT", token: user.token, body: { role: "Admin" },
    })).status).toBe(403);

    // Only Admin, Reviewer and User exist; anything else is refused.
    expect((await api(`/api/users/${other.user.id}/role`, {
      method: "PUT", token: admin.token, body: { role: "Superuser" },
    })).status).toBe(400);

    // Registration never grants elevated rights, whatever the caller asks for.
    const sneaky = await api("/api/auth/register", {
      method: "POST",
      body: { firstName: "Sneaky", lastName: "Signup", email: `sneaky${Date.now()}@example.test`, password: "testpass123", role: "Admin" },
    });
    expect(sneaky.data.user.role).toBe("User");

    // Separation of duties: an Admin cannot change their own role, and the
    // last Admin cannot be demoted.
    expect((await api(`/api/users/${admin.user.id}/role`, {
      method: "PUT", token: admin.token, body: { role: "User" },
    })).status).toBe(400);

    // The restricted screens are also absent from the interface, not merely
    // refused by the API.
    await signIn(page, "user");
    await expect(page.locator(".nav-item", { hasText: "User & Role Mgmt" })).toHaveCount(0);
    await expect(page.locator(".nav-item", { hasText: "Audit Log" })).toHaveCount(0);
  });

  test("ST-04 (NFR-002, section 8.2) receipts are seen only by their owner and Reviewers, and nobody reviews their own", async () => {
    const { user, other, admin, reviewer } = accounts();
    const { receipt } = await entryWithReceipt(user.token);
    expect(receipt.status).toBe(201);
    const id = receipt.data._id;

    // The file: owner and Reviewer yes; another User and the Admin no.
    expect((await fetch(`http://localhost:4000/api/receipts/${id}/file`, { headers: { Authorization: "Bearer " + user.token } })).status).toBe(200);
    expect((await fetch(`http://localhost:4000/api/receipts/${id}/file`, { headers: { Authorization: "Bearer " + reviewer.token } })).status).toBe(200);
    expect((await api(`/api/receipts/${id}/file`, { token: other.token })).status).toBe(403);
    expect((await api(`/api/receipts/${id}/file`, { token: admin.token })).status).toBe(403);

    // Deciding: only a Reviewer — not the owner, not another User, not the Admin.
    for (const who of [user, other, admin]) {
      expect((await api(`/api/receipts/${id}/review`, { method: "POST", token: who.token, body: { action: "verify" } })).status).toBe(403);
      expect((await api("/api/receipts/review", { token: who.token })).status).toBe(403);
    }
    // A Reviewer's own receipt cannot be reviewed by that Reviewer.
    const own = await entryWithReceipt(reviewer.token);
    expect((await api(`/api/receipts/${own.receipt.data._id}/review`, { method: "POST", token: reviewer.token, body: { action: "verify" } })).status).toBe(403);
    // Nobody attaches a receipt to someone else's entry.
    const theirs = await api("/api/transactions", { method: "POST", token: other.token, body: { type: "Expense", category: "Food", amount: 5 } });
    expect((await api("/api/receipts", { method: "POST", token: user.token, body: { kind: "link", url: "https://drive.google.com/x", transactionId: theirs.data._id } })).status).toBe(403);
  });
});
