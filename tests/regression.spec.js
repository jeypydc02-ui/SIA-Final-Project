const { test, expect } = require("@playwright/test");
const { api, accounts, signIn, gotoScreen, registerUser } = require("./helpers");
const { todayISO, addDaysISO } = require("../apps/server/src/utils/dates");
const { execFile } = require("child_process");
const path = require("path");

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

  test("RT-13 each role's dashboard leads with its own work", async ({ page }) => {
    await signIn(page, "admin");
    await expect(page.locator(".console-status")).toContainText("Admin Console");
    await expect(page.locator(".kpi", { hasText: "Accounts" })).toBeVisible();
    await expect(page.locator(".panel", { hasText: "Activity feed" })).toBeVisible();
    await expect(page.locator(".wallet")).toHaveCount(0);
    // Their own money is one tab away, not mixed into the console.
    await page.locator(".segmented button", { hasText: "My Wallet" }).click();
    await expect(page).toHaveURL(/view=wallet/);
    await expect(page.locator(".wallet")).toContainText("Balance");

    const reviewerPage = await page.context().newPage();
    const { reviewer } = accounts();
    await reviewerPage.addInitScript((t) => window.sessionStorage.setItem("fts_token", t), reviewer.token);
    await reviewerPage.goto("/dashboard");
    await reviewerPage.waitForSelector(".shell");
    await expect(reviewerPage.locator(".desk-hero")).toContainText("Review Desk");
    await expect(reviewerPage.locator(".console-status")).toHaveCount(0);
    await expect(reviewerPage.locator(".segmented button", { hasText: "My Wallet" })).toBeVisible();
    await reviewerPage.close();

    const userPage = await page.context().newPage();
    const { user } = accounts();
    await userPage.addInitScript((t) => window.sessionStorage.setItem("fts_token", t), user.token);
    await userPage.goto("/dashboard");
    await userPage.waitForSelector(".shell");
    await expect(userPage.locator(".wallet")).toContainText("Balance");
    await expect(userPage.locator(".desk-hero")).toHaveCount(0);
    await expect(userPage.locator(".segmented")).toHaveCount(0);
    await userPage.close();
  });

  test("RT-14 phones get a bottom tab bar with quick add", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await signIn(page, "user");

    const nav = page.locator(".bottom-nav");
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "Bills" }).click();
    await expect(page).toHaveURL(/\/bills$/);

    await nav.getByRole("button", { name: "Add an entry" }).click();
    await page.locator(".quick-add-option", { hasText: "Income" }).click();
    await expect(page).toHaveURL(/\/submit\?type=Income$/);
    await expect(page.locator("select").first()).toHaveValue("Income");

    await nav.getByRole("button", { name: "Add an entry" }).click();
    await page.locator(".quick-add-option", { hasText: "Bill" }).click();
    await expect(page.locator(".modal h3", { hasText: "Add Bill" })).toBeVisible();

    // Close the Add Bill dialog by tapping outside it.
    await page.locator(".modal-overlay").click({ position: { x: 5, y: 5 } });
    await nav.getByRole("button", { name: "Open the full menu" }).click();
    await expect(page.locator(".side.open")).toBeVisible();

    // No sideways scrolling with the bar in place.
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await context.close();
  });

  test("RT-15 categories match the entry type everywhere", async () => {
    const { user } = accounts();
    const post = (p, body) => api(p, { method: "POST", token: user.token, body });
    expect((await post("/api/transactions", { type: "Income", category: "Food", amount: 5 })).status).toBe(400);
    expect((await post("/api/transactions", { type: "Expense", category: "Salary", amount: 5 })).status).toBe(400);
    expect((await post("/api/transactions", { type: "Income", category: "Allowance", amount: 5 })).status).toBe(201);
    expect((await post("/api/budgets", { category: "Salary", limit: 100 })).status).toBe(400);
    expect((await post("/api/bills", { name: "x", category: "Groceries", amount: 1, due: "2026-12-01" })).status).toBe(400);
    // A bill filed under Internet can now have a budget to count against.
    const person = await registerUser("internet");
    expect((await api("/api/budgets", { method: "POST", token: person.token, body: { category: "Internet", limit: 2000 } })).status).toBe(201);
  });

  test("RT-16 income and expenses cannot be dated in the future", async () => {
    const { user } = accounts();
    const tomorrow = addDaysISO(todayISO(), 1);
    const res = await api("/api/transactions", { method: "POST", token: user.token, body: { type: "Expense", category: "Food", amount: 5, date: tomorrow } });
    expect(res.status).toBe(400);
    expect(res.data.error).toContain("future");
    const ok = await api("/api/transactions", { method: "POST", token: user.token, body: { type: "Expense", category: "Food", amount: 5, date: todayISO() } });
    expect(ok.status).toBe(201);
  });

  test("RT-17 paying a monthly bill schedules next month's", async () => {
    const person = await registerUser("monthly");
    const bill = await api("/api/bills", {
      method: "POST", token: person.token,
      body: { name: "Rent on the 31st", category: "Housing", amount: 9000, due: "2027-01-31", repeat: "monthly" },
    });
    const paid = await api(`/api/bills/${bill.data._id}/pay`, { method: "POST", token: person.token, body: {} });
    expect(paid.status).toBe(200);
    expect(paid.data.nextBill.due).toBe("2027-02-28");
    const again = await api(`/api/bills/${paid.data.nextBill._id}/pay`, { method: "POST", token: person.token, body: {} });
    // Back to the 31st after the short month, not stuck on the 28th.
    expect(again.data.nextBill.due).toBe("2027-03-31");

    const once = await api("/api/bills", { method: "POST", token: person.token, body: { name: "One-off", category: "Other", amount: 50, due: "2027-01-10" } });
    const paidOnce = await api(`/api/bills/${once.data._id}/pay`, { method: "POST", token: person.token, body: {} });
    expect(paidOnce.data.nextBill).toBe(null);

    const bills = await api("/api/bills", { token: person.token });
    expect(bills.data.filter((b) => b.name === "Rent on the 31st")).toHaveLength(3);
  });

  test("RT-18 crossing 80% and 100% of a budget sends a warning", async () => {
    const person = await registerUser("budgeter");
    const { admin } = accounts();
    await api("/api/budgets", { method: "POST", token: person.token, body: { category: "Food", limit: 1000 } });
    const submitAndApprove = async (amount) => {
      const t = await api("/api/transactions", { method: "POST", token: person.token, body: { type: "Expense", category: "Food", amount } });
      await api(`/api/transactions/${t.data._id}/review`, { method: "POST", token: admin.token, body: { action: "approve" } });
    };
    const budgetNotes = async () => (await api("/api/notifications", { token: person.token })).data.filter((n) => n.type === "budget");

    await submitAndApprove(500);
    expect(await budgetNotes()).toHaveLength(0);
    await submitAndApprove(350); // 85%
    let notes = await budgetNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0].message).toContain("85%");
    await submitAndApprove(50); // 90%: no repeat warning
    expect(await budgetNotes()).toHaveLength(1);
    await submitAndApprove(200); // 110%
    notes = await budgetNotes();
    expect(notes).toHaveLength(2);
    expect(notes[0].message).toContain("over your Food budget");
  });

  test("RT-19 reviewers see who submitted each entry, and a resubmission can fix its category and date", async () => {
    const { user, reviewer } = accounts();
    const created = await api("/api/transactions", {
      method: "POST", token: user.token, body: { type: "Expense", category: "Food", amount: 300, note: "wrong category probe" },
    });
    const queue = await api("/api/transactions?scope=review", { token: reviewer.token });
    expect(queue.data.find((t) => t._id === created.data._id).submitterName).toBe(user.user.name);

    await api(`/api/transactions/${created.data._id}/review`, { method: "POST", token: reviewer.token, body: { action: "revise", comment: "This was transport." } });
    const yesterday = addDaysISO(todayISO(), -1);
    const v2 = await api(`/api/transactions/${created.data._id}/resubmit`, {
      method: "POST", token: user.token, body: { category: "Transport", date: yesterday, amount: 300 },
    });
    expect(v2.status).toBe(201);
    expect(v2.data.category).toBe("Transport");
    expect(v2.data.date).toBe(yesterday);
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

  test("RT-20 a reviewer can decide entries straight from the Review Desk", async ({ page }) => {
    // The desk shows the six oldest entries first, so clear what earlier tests
    // left waiting; this entry is then the next one up.
    const { admin } = accounts();
    const queue = await api("/api/transactions?scope=review", { token: admin.token });
    for (const t of queue.data.filter((x) => x.status === "Pending Review" && x.submittedBy !== admin.user.id)) {
      await api(`/api/transactions/${t._id}/review`, { method: "POST", token: admin.token, body: { action: "approve" } });
    }
    const person = await registerUser("deskflow");
    const created = await api("/api/transactions", {
      method: "POST", token: person.token, body: { type: "Expense", category: "Transport", amount: 4321.5, note: "desk inline approve" },
    });
    await signIn(page, "reviewer");
    const card = page.locator(".review-card", { hasText: "desk inline approve" });
    await expect(card).toContainText("Test Account");
    await card.getByRole("button", { name: "Approve" }).click();
    await expect(page.locator(".toast")).toContainText("Review recorded");
    await expect(page.locator(".review-card", { hasText: "desk inline approve" })).toHaveCount(0);
    const mine = await api("/api/transactions", { token: person.token });
    expect(mine.data.find((t) => t._id === created.data._id).status).toBe("Approved");
  });

  test("RT-21 the app is installable and opens offline", async ({ browser, request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/dashboard");
    expect(manifest.icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable")).toBe(true);
    for (const icon of manifest.icons) {
      expect((await request.get(icon.src)).status(), icon.src).toBe(200);
    }
    const sw = await request.get("/sw.js");
    expect(sw.status()).toBe(200);
    expect(sw.headers()["cache-control"]).toBe("no-cache");

    // Allow the worker for this test only (the suite blocks it by default).
    const context = await browser.newContext({ serviceWorkers: "allow" });
    const page = await context.newPage();
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); // now controlled by the worker
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    // With no connection the app shell still loads instead of the browser's error page.
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("#root")).toContainText("FinTrack Stark");
    await context.setOffline(false);

    // Personal data is never cached by the worker.
    const cached = await page.evaluate(async () => {
      const keys = await caches.keys();
      const urls = [];
      for (const k of keys) for (const r of await (await caches.open(k)).keys()) urls.push(new URL(r.url).pathname);
      return urls;
    });
    expect(cached.some((u) => u.startsWith("/api/"))).toBe(false);
    await context.close();
  });

  test("RT-22 the landing page explains the system and its links work", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator(".lp-nav");
    for (const [label, id] of [["Features", "features"], ["How it works", "how"], ["Roles", "roles"], ["Security", "security"], ["FAQ", "faq"]]) {
      await expect(nav.getByRole("link", { name: label })).toHaveAttribute("href", "#" + id);
      await expect(page.locator("section#" + id)).toBeVisible();
    }
    await nav.getByRole("link", { name: "FAQ" }).click();
    await expect(page).toHaveURL(/#faq$/);
    // Accordion: a closed answer opens on click.
    await page.getByRole("button", { name: "Does it move real money?" }).click();
    await expect(page.locator(".lp-faq-item.open")).toContainText("never connects to a bank");
    // The calls to action lead into the app.
    await page.locator(".lp-hero").getByRole("button", { name: "Create free account" }).click();
    await expect(page).toHaveURL(/\/register$/);
  });

  test("RT-23 bill reminders run inside the API, and never twice", async () => {
    // The API ran today's sweep itself, with no separate worker.
    const health = await api("/api/health");
    expect(health.data.reminders.lastSweep).toBe(todayISO());

    // Two sweeps at the same moment (the worker and the API, or two
    // workers) must still send a bill's alert exactly once.
    const person = await registerUser("twosweeps");
    await api("/api/bills", {
      method: "POST", token: person.token,
      body: { name: "Concurrent sweep bill", category: "Utilities", amount: 999, due: addDaysISO(todayISO(), -2) },
    });
    const sweep = () => new Promise((resolve, reject) =>
      execFile("node", [path.join(__dirname, "..", "services", "reminder", "index.js"), "--once"],
        { cwd: path.join(__dirname, "..") }, (err, out) => (err ? reject(err) : resolve(out))));
    await Promise.all([sweep(), sweep(), sweep()]);
    const notes = (await api("/api/notifications", { token: person.token })).data
      .filter((n) => n.type !== "bill" && n.message.includes("Concurrent sweep bill"));
    expect(notes).toHaveLength(1);
    expect(notes[0].type).toBe("overdue");
  });
});
