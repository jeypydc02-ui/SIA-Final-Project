const { test, expect } = require("@playwright/test");
const { api, accounts, signIn, gotoScreen, registerUser } = require("./helpers");

// Regression cases for the defects found in the pre-launch audit. Each one
// reproduced a real failure before its fix; they stay so it cannot return.

async function needsRevision(user, reviewer, note) {
  const created = await api("/api/transactions", {
    method: "POST", token: user.token, body: { type: "Expense", category: "Food", amount: 500, note },
  });
  await api(`/api/transactions/${created.data._id}/review`, {
    method: "POST", token: reviewer.token, body: { action: "revise", comment: "fix it" },
  });
  return created.data._id;
}

test.describe("Pre-launch audit regressions", () => {
  test("RT-01 a refused resubmission leaves the entry resubmittable", async () => {
    const { user, reviewer } = accounts();
    const id = await needsRevision(user, reviewer, "resubmit guard");

    // An emptied amount field arrives as 0.
    const bad = await api(`/api/transactions/${id}/resubmit`, { method: "POST", token: user.token, body: { amount: 0 } });
    expect(bad.status).toBe(400);
    const badType = await api(`/api/transactions/${id}/resubmit`, { method: "POST", token: user.token, body: { type: "Nonsense" } });
    expect(badType.status).toBe(400);

    const list = await api("/api/transactions", { token: user.token });
    expect(list.data.find((t) => t._id === id).status).toBe("Needs Revision");
    expect(list.data.some((t) => t.parentId === id)).toBe(false);

    const good = await api(`/api/transactions/${id}/resubmit`, { method: "POST", token: user.token, body: { amount: 450 } });
    expect(good.status).toBe(201);
    expect(good.data.version).toBe(2);
  });

  test("RT-02 a refused payment leaves the bill unpaid and writes nothing", async () => {
    const { user } = accounts();
    const bill = await api("/api/bills", {
      method: "POST", token: user.token, body: { name: "Payment guard bill", category: "Utilities", amount: 100, due: "2026-12-01" },
    });
    for (const amount of [1e13, 0, -5, "Infinity", "abc"]) {
      const res = await api(`/api/bills/${bill.data._id}/pay`, { method: "POST", token: user.token, body: { amount } });
      expect(res.status, `amount ${amount}`).toBe(400);
    }
    const bills = await api("/api/bills", { token: user.token });
    const after = bills.data.find((b) => b._id === bill.data._id);
    expect(after.paid).toBe(false);
    expect(after.paidAmount).toBe(null);
    const txs = await api("/api/transactions", { token: user.token });
    expect(txs.data.some((t) => t.note === "Bill payment: Payment guard bill")).toBe(false);
  });

  test("RT-03 nobody reviews their own entry", async () => {
    const { reviewer, admin } = accounts();
    const own = await api("/api/transactions", {
      method: "POST", token: reviewer.token, body: { type: "Income", category: "Salary", amount: 999999, note: "self review probe" },
    });
    const self = await api(`/api/transactions/${own.data._id}/review`, { method: "POST", token: reviewer.token, body: { action: "approve" } });
    expect(self.status).toBe(403);

    // Another reviewer can.
    const other = await api(`/api/transactions/${own.data._id}/review`, { method: "POST", token: admin.token, body: { action: "approve" } });
    expect(other.status).toBe(200);
  });

  test("RT-04 dates and field types are validated, never a 500", async () => {
    const { user } = accounts();
    for (const date of ["not-a-date", "2026-02-30", "2026-1-5"]) {
      const res = await api("/api/transactions", { method: "POST", token: user.token, body: { type: "Expense", category: "Food", amount: 5, date } });
      expect(res.status, date).toBe(400);
    }
    const cases = [
      ["/api/auth/login", { email: "jp@fintrackstark.app", password: { a: 1 } }, null],
      ["/api/auth/login", { email: { $ne: null }, password: { $ne: null } }, null],
      ["/api/auth/register", { firstName: 5, lastName: "x", email: "type@x.test", password: "12345678" }, null],
      ["/api/comments", { text: ["a"] }, user.token],
      ["/api/bills", { name: ["x"], category: "Other", amount: 1, due: "2026-10-01" }, user.token],
    ];
    for (const [p, body, token] of cases) {
      const res = await api(p, { method: "POST", token, body });
      expect(res.status, `${p} ${JSON.stringify(body)}`).toBeGreaterThanOrEqual(400);
      expect(res.status, `${p} ${JSON.stringify(body)}`).toBeLessThan(500);
    }
    const pw = await api("/api/auth/me/password", { method: "PUT", token: user.token, body: { currentPassword: "demo123", newPassword: [1, 2, 3, 4, 5, 6, 7, 8] } });
    expect(pw.status).toBe(400);
  });

  test("RT-05 staff see only their own money; the queue is separate", async () => {
    const { user, reviewer, admin } = accounts();
    const userBills = await api("/api/bills", { token: user.token });
    expect(userBills.data.length).toBeGreaterThan(0);

    for (const staff of [reviewer, admin]) {
      const bills = await api("/api/bills", { token: staff.token });
      expect(bills.data.every((b) => b.createdBy === staff.user.id)).toBe(true);
      const own = await api("/api/transactions", { token: staff.token });
      expect(own.data.every((t) => t.submittedBy === staff.user.id)).toBe(true);
      const queue = await api("/api/transactions?scope=review", { token: staff.token });
      expect(queue.status).toBe(200);
      expect(queue.data.some((t) => t.submittedBy === user.user.id)).toBe(true);
    }
    expect((await api("/api/transactions?scope=review", { token: user.token })).status).toBe(403);
  });

  test("RT-06 an Admin password reset forces a new password", async () => {
    const { admin, user } = accounts();
    const person = await registerUser("forgetful");

    expect((await api(`/api/users/${person.user.id}/reset-password`, { method: "POST", token: user.token })).status).toBe(403);
    const reset = await api(`/api/users/${person.user.id}/reset-password`, { method: "POST", token: admin.token });
    expect(reset.status).toBe(200);
    const temp = reset.data.temporaryPassword;
    expect(temp).toHaveLength(12);

    // The old password and old sessions are dead.
    expect((await api("/api/bills", { token: person.token })).status).toBe(401);
    expect((await api("/api/auth/login", { method: "POST", body: { email: person.email, password: person.password } })).status).toBe(401);

    // The temporary password only opens the door to changing it.
    const login = await api("/api/auth/login", { method: "POST", body: { email: person.email, password: temp } });
    expect(login.data.user.mustChangePassword).toBe(true);
    expect((await api("/api/bills", { token: login.data.token })).status).toBe(403);
    const changed = await api("/api/auth/me/password", {
      method: "PUT", token: login.data.token, body: { currentPassword: temp, newPassword: "my-own-password" },
    });
    expect(changed.status).toBe(200);
    expect(changed.data.user.mustChangePassword).toBe(false);
    expect((await api("/api/bills", { token: changed.data.token })).status).toBe(200);
  });

  test("RT-07 security headers and JSON 404s", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.headers()["content-security-policy"]).toContain("script-src 'self'");
    expect(res.headers()["strict-transport-security"]).toBeTruthy();
    const missing = await api("/api/no-such-thing");
    expect(missing.status).toBe(404);
    expect(missing.data.error).toBeTruthy();
  });

  test("RT-08 the login form is not prefilled with an account", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator(".auth-form input").first()).toHaveValue("");
    await expect(page.locator(".auth-form input[type=password]")).toHaveValue("");
    await page.goto("/register");
    await page.locator(".auth-legal a", { hasText: "Privacy Policy" }).click();
    await expect(page.locator("h1")).toHaveText("Privacy Policy");
  });

  test("RT-09 a session that ends mid-use asks for the password and keeps the form", async ({ page }) => {
    const person = await registerUser("lapsed");
    await page.addInitScript((t) => window.sessionStorage.setItem("fts_token", t), person.token);
    await page.goto("/submit");
    await page.waitForSelector(".shell");

    // End the session from outside, as an expiry or a password change elsewhere would.
    await api("/api/auth/logout", { method: "POST", token: person.token });

    await page.locator("input[type=number]").fill("4321");
    await page.locator('input[placeholder*="Groceries"]').fill("typed before expiry");
    await page.getByRole("button", { name: "Submit for Review" }).click();

    const dialog = page.locator(".modal", { hasText: "Your session has ended" });
    await expect(dialog).toBeVisible();
    await dialog.locator("input[type=password]").fill(person.password);
    await dialog.getByRole("button", { name: "Continue" }).click();
    await expect(dialog).toHaveCount(0);

    // What was typed survived, and submitting now works.
    await expect(page.locator("input[type=number]")).toHaveValue("4321");
    await page.getByRole("button", { name: "Submit for Review" }).click();
    await expect(page.locator(".toast")).toContainText("submitted for review");
  });

  test("RT-10 a malformed address does not blank the app", async ({ page }) => {
    await signIn(page, "user");
    await page.goto("/categories/100%25");
    await page.waitForSelector(".shell");
    await expect(page.locator(".pagehead h2")).toContainText("100%");
  });

  test("RT-11 a failed save keeps the dialog open with what was typed", async ({ page, context }) => {
    await signIn(page, "user");
    await gotoScreen(page, "Bill Reminders");
    await page.getByRole("button", { name: "+ Add Bill" }).click();
    await page.locator(".modal input").first().fill("Typed while offline");
    await page.locator(".modal input[type=number]").fill("4321");
    await context.setOffline(true);
    await page.getByRole("button", { name: "Save Bill" }).click();
    await expect(page.locator(".toast")).toContainText("Could not reach the server");
    await expect(page.locator(".modal input").first()).toHaveValue("Typed while offline");
    await context.setOffline(false);
    await page.getByRole("button", { name: "Save Bill" }).click();
    await expect(page.locator(".modal")).toHaveCount(0);
    await expect(page.locator("table")).toContainText("Typed while offline");
  });

  test("RT-12 a reviewer's own pending entry has no approve buttons", async ({ page }) => {
    const { reviewer } = accounts();
    await api("/api/transactions", {
      method: "POST", token: reviewer.token, body: { type: "Expense", category: "Food", amount: 12, note: "reviewer own entry ui" },
    });
    await signIn(page, "reviewer");
    await gotoScreen(page, "Review & Approval");
    const row = page.locator(".card", { hasText: "Pending Review (" }).locator("tr", { hasText: "reviewer own entry ui" });
    await expect(row).toContainText("awaiting another reviewer");
    await expect(row.getByRole("button", { name: "Approve" })).toHaveCount(0);
  });
});
