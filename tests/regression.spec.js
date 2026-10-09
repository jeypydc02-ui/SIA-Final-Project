const { test, expect } = require("@playwright/test");
const { api, accounts, signIn, gotoScreen, registerUser } = require("./helpers");
const { todayISO, addDaysISO } = require("../apps/server/src/utils/dates");
const { execFile } = require("child_process");
const path = require("path");

// Regression cases for the defects found in the pre-launch audit. Each one
// reproduced a real failure before its fix; they stay so it cannot return.

test.describe("Pre-launch audit regressions", () => {
  test("RT-01 a refused edit leaves the entry exactly as it was", async () => {
    const { user } = accounts();
    const created = await api("/api/transactions", {
      method: "POST", token: user.token, body: { type: "Expense", category: "Food", amount: 500, note: "edit guard" },
    });
    const id = created.data._id;

    // An emptied amount field arrives as 0; a made-up type; a wrong category.
    for (const body of [{ amount: 0 }, { type: "Nonsense" }, { category: "Salary" }, { date: "2099-01-01" }]) {
      const res = await api(`/api/transactions/${id}`, { method: "PUT", token: user.token, body });
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    const list = await api("/api/transactions", { token: user.token });
    expect(list.data.find((t) => t._id === id).status).toBe("Approved");
    expect(list.data.some((t) => t.parentId === id)).toBe(false);

    const good = await api(`/api/transactions/${id}`, { method: "PUT", token: user.token, body: { amount: 450 } });
    expect(good.status).toBe(200);
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

  test("RT-03 entries count at once, with no review step", async () => {
    const { user } = accounts();
    const created = await api("/api/transactions", {
      method: "POST", token: user.token, body: { type: "Income", category: "Salary", amount: 1234, note: "no approval needed" },
    });
    expect(created.status).toBe(201);
    expect(created.data.status).toBe("Approved"); // stored name for a counted entry
    // The old review endpoints (entries, then receipts) no longer exist.
    expect((await api(`/api/transactions/${created.data._id}/review`, { method: "POST", token: user.token, body: { action: "approve" } })).status).toBe(404);
    expect((await api(`/api/transactions/${created.data._id}/resubmit`, { method: "POST", token: user.token, body: {} })).status).toBe(404);
    expect((await api("/api/receipts", { token: user.token })).status).toBe(404);
    expect((await api("/api/receipts", { method: "POST", token: user.token, body: { kind: "link", url: "https://drive.google.com/x", transactionId: created.data._id } })).status).toBe(404);
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

  test("RT-05 an Admin keeps no wallet: finance records are for Users", async () => {
    const { user, admin } = accounts();
    expect((await api("/api/bills", { token: user.token })).status).toBe(200);
    // Every personal-finance endpoint refuses an Admin, reading or writing.
    for (const [method, path, body] of [
      ["GET", "/api/bills"], ["POST", "/api/bills", { name: "x", category: "Utilities", amount: 5, due: "2026-12-01" }],
      ["GET", "/api/transactions"], ["POST", "/api/transactions", { type: "Expense", category: "Food", amount: 5 }],
      ["GET", "/api/budgets"], ["POST", "/api/budgets", { category: "Food", limit: 5 }],
      ["GET", "/api/comments"], ["POST", "/api/comments", { text: "x" }],
      ["GET", "/api/activity"],
    ]) {
      expect((await api(path, { method, token: admin.token, body })).status, `${method} ${path}`).toBe(403);
    }
    // The one-request load gives an Admin the system lists, not a wallet.
    const sync = (await api("/api/sync", { token: admin.token })).data;
    for (const key of ["bills", "transactions", "budgets", "comments", "activity"]) expect(sync[key], key).toEqual([]);
    expect(sync.users.length).toBeGreaterThan(0);
  });

  test("RT-06 Admins no longer issue temporary passwords; people reset their own by e-mail", async ({ page }) => {
    const { admin } = accounts();
    const person = await registerUser("forgetful");
    expect((await api(`/api/users/${person.user.id}/reset-password`, { method: "POST", token: admin.token })).status).toBe(404);
    // No forced-change flag on the account or the session any more.
    const me = await api("/api/auth/me", { token: person.token });
    expect(me.data.user).not.toHaveProperty("mustChangePassword");
    // The Users screen offers no reset, and the sign-in page links to the
    // self-service page instead of "ask your administrator".
    await signIn(page, "admin", "/users");
    await expect(page.getByRole("button", { name: "Reset Password" })).toHaveCount(0);
    await expect(page.locator("tr", { hasText: person.email })).toContainText("Active");
    const visitor = await page.context().browser().newPage();
    await visitor.goto("/login");
    await expect(visitor.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute("href", "/forgot-password");
    await expect(visitor.locator("body")).not.toContainText("temporary password");
    await visitor.close();
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
    await page.getByRole("button", { name: "Save Entry" }).click();

    const dialog = page.locator(".modal", { hasText: "Your session has ended" });
    await expect(dialog).toBeVisible();
    await dialog.locator("input[type=password]").fill(person.password);
    await dialog.getByRole("button", { name: "Continue" }).click();
    await expect(dialog).toHaveCount(0);

    // What was typed survived, and submitting now works.
    await expect(page.locator("input[type=number]")).toHaveValue("4321");
    await page.getByRole("button", { name: "Save Entry" }).click();
    await expect(page.locator(".toast")).toContainText("recorded");
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
    await expect(page.locator(".panel", { hasText: "Recent events" })).toBeVisible();
    await expect(page.locator(".wallet")).toHaveCount(0);
    // The console is about accounts and security, and there is no wallet at
    // all: no finance screens in the menu, and no review queue any more.
    await expect(page.locator(".kpi", { hasText: "Deactivated" })).toBeVisible();
    await expect(page.locator(".panel", { hasText: "Security events this week" })).toContainText("Sign-ins");
    await expect(page.locator(".panel", { hasText: "Security events this week" })).not.toContainText("Income & expenses");
    await expect(page.locator(".nav-item", { hasText: "Receipt Review" })).toHaveCount(0);
    await expect(page.locator(".nav-item", { hasText: "My Activity" })).toHaveCount(0);
    await expect(page.locator(".nav-item", { hasText: "Bill Reminders" })).toHaveCount(0);
    await page.goto("/bills");
    await expect(page.locator(".content")).toContainText("keep a wallet of their own");

    const userPage = await page.context().newPage();
    const { user } = accounts();
    await userPage.addInitScript((t) => window.sessionStorage.setItem("fts_token", t), user.token);
    await userPage.goto("/dashboard");
    await userPage.waitForSelector(".shell");
    await expect(userPage.locator(".wallet")).toContainText("Balance");
    await expect(userPage.locator(".console-status")).toHaveCount(0);
    await expect(userPage.locator(".nav-item", { hasText: "My Activity" })).toBeVisible();
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
    await api("/api/budgets", { method: "POST", token: person.token, body: { category: "Food", limit: 1000 } });
    const submitAndApprove = (amount) =>
      api("/api/transactions", { method: "POST", token: person.token, body: { type: "Expense", category: "Food", amount } });
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

  test("RT-19 an edit can fix the type, category and date of an entry", async () => {
    const { user } = accounts();
    const created = await api("/api/transactions", {
      method: "POST", token: user.token, body: { type: "Expense", category: "Food", amount: 300, note: "wrong category probe" },
    });
    const yesterday = addDaysISO(todayISO(), -1);
    const v2 = await api(`/api/transactions/${created.data._id}`, {
      method: "PUT", token: user.token, body: { category: "Transport", date: yesterday },
    });
    expect(v2.status).toBe(200);
    expect(v2.data.category).toBe("Transport");
    expect(v2.data.date).toBe(yesterday);
    const v3 = await api(`/api/transactions/${v2.data._id}`, {
      method: "PUT", token: user.token, body: { type: "Income", category: "Freelance" },
    });
    expect(v3.data.type).toBe("Income");
    expect(v3.data.version).toBe(3);
    const chain = await api(`/api/transactions/${v3.data._id}/versions`, { token: user.token });
    expect(chain.data.map((t) => t.status)).toEqual(["Superseded", "Superseded", "Approved"]);
  });

  test("RT-12 My Activity is a User's page; the Admin is told why it is not theirs", async ({ page }) => {
    await signIn(page, "admin");
    await page.goto("/activity");
    await expect(page.locator(".content")).toContainText("keep a wallet of their own");
    await expect(page.locator(".inbox")).toHaveCount(0);
    // The retired review page is simply not found.
    await page.goto("/review");
    await expect(page.locator(".content")).not.toContainText("Receipt");
  });

  test("RT-20 one request brings everything a screen needs, and only your own", async () => {
    const { user, admin } = accounts();
    const mine = await api("/api/sync", { token: user.token });
    expect(mine.status).toBe(200);
    expect(mine.data.me.email).toBe(user.email);
    for (const key of ["bills", "transactions", "budgets", "notifications", "comments"]) {
      expect(Array.isArray(mine.data[key]), key).toBe(true);
    }
    expect(mine.data.transactions.every((t) => t.submittedBy === user.user.id)).toBe(true);
    expect(mine.data.activity.length).toBeGreaterThan(0);
    expect(mine.data.activity.every((l) => l.actorId === user.user.id)).toBe(true);
    expect(mine.data.bills.every((b) => b.createdBy === user.user.id)).toBe(true);
    // Admin-only lists are empty for a User …
    expect(mine.data.auditLog).toEqual([]);
    expect(mine.data.users).toEqual([]);
    // … and present for an Admin.
    const theirs = await api("/api/sync", { token: admin.token });
    expect(theirs.data.auditLog.length).toBeGreaterThan(0);
    expect(theirs.data.users.length).toBeGreaterThan(0);
    expect((await api("/api/sync")).status).toBe(401);
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

  test("RT-24 data from older versions is converted on start-up", async () => {
    // Runs the same migration the API runs when it starts, against the test
    // database, on rows shaped like the old workflow left them.
    const mongoose = require("mongoose");
    const Transaction = require("../apps/server/src/models/Transaction");
    const User = require("../apps/server/src/models/User");
    const { runMigrations } = require("../apps/server/src/config/migrations");
    const { user } = accounts();
    await mongoose.connect(process.env.MONGO_URI);
    try {
      const pending = await Transaction.collection.insertOne({
        type: "Expense", category: "Food", amount: 77, date: todayISO(), note: "left pending by the old workflow",
        status: "Pending Review", version: 1, submittedBy: new mongoose.Types.ObjectId(user.user.id), createdAt: new Date(),
      });
      // The Reviewer role was folded into Admin: an old Reviewer becomes a User
      // (not an Admin, so nobody gains account-management rights by accident).
      const reviewer = await User.collection.insertOne({
        firstName: "Old", lastName: "Reviewer", name: "Old Reviewer", email: `oldreviewer${Date.now()}@example.test`,
        passwordHash: "x", role: "Reviewer",
      });
      const Notification = require("../apps/server/src/models/Notification");
      const queueAlert = await Notification.collection.insertOne({
        user: new mongoose.Types.ObjectId(user.user.id), type: "submission", read: false, ts: new Date(),
        message: "Someone submitted an income of 300 for review.",
      });
      // An account and session from the days of Admin-issued temporary
      // passwords, and audit lines written before the log was split.
      const Session = require("../apps/server/src/models/Session");
      const AuditLog = require("../apps/server/src/models/AuditLog");
      const forced = await User.collection.insertOne({
        firstName: "Old", lastName: "Temp", name: "Old Temp", email: `oldtemp${Date.now()}@example.test`,
        passwordHash: "x", role: "User", mustChangePassword: true,
      });
      await Session.collection.insertOne({ tokenHash: `rt24-${Date.now()}`, user: forced.insertedId, role: "User", mustChangePassword: true, expiresAt: new Date(Date.now() + 60000) });
      const oldLines = await AuditLog.collection.insertMany([
        { user: "Old Temp", action: "Login", detail: "old", ts: new Date(), status: "Success" },
        { user: "Old Temp", action: "Expense Recorded", detail: "old", ts: new Date(), status: "Success" },
        { user: "Old Temp", action: "Password Changed", detail: "old", ts: new Date(), status: "Success" },
        { user: "Old Temp", action: "Failed: POST bills", detail: "old", ts: new Date(), status: "Failed" },
      ]);
      const receiptAlert = await Notification.collection.insertOne({
        user: new mongoose.Types.ObjectId(user.user.id), type: "receipt", read: false, ts: new Date(),
        message: "A receipt is waiting for review.",
      });
      await runMigrations(() => {});
      expect((await Transaction.collection.findOne({ _id: pending.insertedId })).status).toBe("Approved");
      expect(await Notification.collection.findOne({ _id: receiptAlert.insertedId })).toBeNull();
      expect(await User.collection.findOne({ _id: forced.insertedId })).not.toHaveProperty("mustChangePassword");
      expect(await Session.collection.findOne({ user: forced.insertedId })).not.toHaveProperty("mustChangePassword");
      const scopes = (await AuditLog.collection.find({ _id: { $in: Object.values(oldLines.insertedIds) } }).toArray()).map((l) => `${l.action}=${l.scope}`);
      expect(scopes.sort()).toEqual(["Expense Recorded=user", "Failed: POST bills=system", "Login=system", "Password Changed=both"]);
      await User.collection.deleteOne({ _id: forced.insertedId });
      await Session.collection.deleteMany({ user: forced.insertedId });
      // An alert asking someone to review a queue that no longer exists is removed.
      expect(await Notification.collection.findOne({ _id: queueAlert.insertedId })).toBeNull();
      expect((await User.collection.findOne({ _id: reviewer.insertedId })).role).toBe("User");
      // Running it again changes nothing.
      await runMigrations(() => {});
      expect((await Transaction.collection.findOne({ _id: pending.insertedId })).status).toBe("Approved");
      await User.collection.deleteOne({ _id: reviewer.insertedId });
    } finally {
      await mongoose.disconnect();
    }
  });

  test("RT-25 password fields can be shown and hidden", async ({ page }) => {
    await page.goto("/login");
    const field = page.locator(".auth-form .password-field");
    const input = field.locator("input");
    await input.fill("my secret 123");
    await expect(input).toHaveAttribute("type", "password");
    await field.getByRole("button", { name: "Show password" }).click();
    await expect(input).toHaveAttribute("type", "text");
    await expect(input).toHaveValue("my secret 123");
    await field.getByRole("button", { name: "Hide password" }).click();
    await expect(input).toHaveAttribute("type", "password");
  });

  test("RT-26 your own action is confirmed once, not announced back as news", async ({ page }) => {
    await signIn(page, "user");
    await gotoScreen(page, "Bill Reminders");
    await page.getByRole("button", { name: "+ Add Bill" }).click();
    await page.locator(".modal input").first().fill("My own new bill");
    await page.locator(".modal input[type=number]").fill("150");
    await page.getByRole("button", { name: "Save Bill" }).click();
    await expect(page.locator(".toast")).toContainText("Bill added");
    // The live update that follows refreshes the list, but does not pop up
    // "New notification" for something the person just did themselves.
    await expect(page.locator("table")).toContainText("My own new bill");
    await page.waitForTimeout(1500);
    await expect(page.locator(".toast.notice")).toHaveCount(0);
  });

  test("RT-27 notes have a title and open in full, like notes on a phone", async ({ page }) => {
    await signIn(page, "user");
    await gotoScreen(page, "Notes / Feedback");
    await page.getByRole("button", { name: "+ New Note" }).click();
    await page.getByLabel("Title").fill("Grocery plan");
    const body = "Line one: rice and eggs\nLine two: vegetables\nLine three: coffee\nLine four: soap\nLine five: the last line";
    await page.getByLabel("Note", { exact: true }).fill(body);
    await page.getByRole("button", { name: "Save Note" }).click();
    await expect(page.locator(".toast")).toContainText("Note saved");

    // The list shows the title and a short preview, not the whole note.
    const card = page.locator(".note-card", { hasText: "Grocery plan" });
    await expect(card.locator(".note-title")).toHaveText("Grocery plan");
    // Tapping it opens the whole note.
    await card.click();
    const view = page.locator(".note-view");
    await expect(view.locator(".note-view-title")).toHaveText("Grocery plan");
    await expect(view.locator(".note-view-text")).toContainText("Line one: rice and eggs");
    await expect(view.locator(".note-view-text")).toContainText("Line five: the last line");

    // Edit it in place.
    await view.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Title").fill("Grocery plan (Sat)");
    await page.getByRole("button", { name: "Save Note" }).click();
    await expect(page.locator(".note-view .note-view-title")).toHaveText("Grocery plan (Sat)");
    await expect(page.locator(".note-view")).toContainText("edited");

    // Search finds it; delete removes it.
    await page.getByRole("button", { name: "Back to notes" }).click();
    await page.getByLabel("Search notes").fill("vegetables");
    await expect(page.locator(".note-card")).toHaveCount(1);
    await page.locator(".note-card").click();
    await page.locator(".note-view").getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete Note" }).click();
    await expect(page.locator(".toast")).toContainText("Note deleted");
    await expect(page.locator(".note-card", { hasText: "Grocery plan" })).toHaveCount(0);
  });

  test("RT-28 a note can only be changed by the person who wrote it", async () => {
    const { user, other } = accounts();
    const note = await api("/api/comments", { method: "POST", token: user.token, body: { title: "Mine", text: "private" } });
    expect(note.status).toBe(201);
    expect(note.data.title).toBe("Mine");
    expect((await api(`/api/comments/${note.data._id}`, { method: "PUT", token: other.token, body: { text: "hijacked" } })).status).toBe(403);
    expect((await api(`/api/comments/${note.data._id}`, { method: "PUT", token: user.token, body: { text: "  " } })).status).toBe(400);
    expect((await api(`/api/comments/${note.data._id}`, { method: "PUT", token: user.token, body: { title: ["x"], text: "ok" } })).status).toBe(400);
    const edited = await api(`/api/comments/${note.data._id}`, { method: "PUT", token: user.token, body: { title: "Mine v2", text: "still private" } });
    expect(edited.status).toBe(200);
    expect(edited.data.editedAt).toBeTruthy();
    const theirs = await api("/api/comments", { token: other.token });
    expect(theirs.data.some((c) => c._id === note.data._id)).toBe(false);
  });

  test("RT-29 the Notification Log reads like a message list", async ({ page }) => {
    const { user } = accounts();
    await api("/api/bills", {
      method: "POST", token: user.token,
      body: { name: "Inbox Layout Bill", category: "Utilities", amount: 99, due: "2026-12-22" },
    });
    await signIn(page, "user");
    await page.goto("/notifications");
    const item = page.locator(".inbox-item", { hasText: "Inbox Layout Bill" });
    // A plain sender line, not a bracketed type code.
    await expect(item.locator(".inbox-title")).toHaveText("Bill added");
    await expect(page.locator(".inbox")).not.toContainText("[bill]");
    await expect(item).toHaveClass(/unread/);
    // Tapping it marks it read and opens what it is about.
    await item.click();
    await expect(page).toHaveURL(/\/bills$/);
    const inbox = await api("/api/notifications", { token: user.token });
    expect(inbox.data.find((n) => n.message.includes("Inbox Layout Bill")).read).toBe(true);
  });

  test("RT-30 amounts must be real numbers, and fields of the wrong type are refused in plain words", async () => {
    const { user } = accounts();
    const cases = [
      ["/api/transactions", { type: "Expense", category: "Food", amount: true }],
      ["/api/transactions", { type: "Expense", category: "Food", amount: [5] }],
      ["/api/transactions", { type: "Expense", category: "Food", amount: 5, note: { a: 1 } }],
      ["/api/transactions", { type: "Expense", category: "Food", amount: 5, date: { $gt: "" } }],
      ["/api/bills", { name: "x", category: "Utilities", amount: true, due: "2026-12-01" }],
      ["/api/budgets", { category: "Transport", limit: true }],
    ];
    for (const [path, body] of cases) {
      const res = await api(path, { method: "POST", token: user.token, body });
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.data.error, JSON.stringify(body)).not.toMatch(/Cast to|ObjectId|\$gt/);
    }
    const profile = await api("/api/auth/me", { method: "PUT", token: user.token, body: { firstName: { a: 1 } } });
    expect(profile.status).toBe(400);
    // Numbers typed as text still work.
    const ok = await api("/api/transactions", { method: "POST", token: user.token, body: { type: "Expense", category: "Food", amount: "12.50" } });
    expect(ok.status).toBe(201);
    expect(ok.data.amount).toBe(12.5);
  });

  test("RT-31 an Admin cannot read another person's entries through their history", async () => {
    const { user, admin } = accounts();
    const entry = await api("/api/transactions", { method: "POST", token: user.token, body: { type: "Income", category: "Salary", amount: 77 } });
    expect((await api(`/api/transactions/${entry.data._id}/versions`, { token: admin.token })).status).toBe(403);
    expect((await api(`/api/transactions/${entry.data._id}/versions`, { token: user.token })).status).toBe(200);
  });

  test("RT-32 a slow first load shows a loading message, not an empty account", async ({ page }) => {
    // Signing in through the form: a page reload instead waits on its own
    // "Restoring your session…" screen until the data is there.
    const { user } = accounts();
    await page.route("**/api/sync", async (route) => { await new Promise((r) => setTimeout(r, 2500)); await route.continue(); });
    await page.goto("/login");
    await page.locator(".auth-form input").first().fill(user.email);
    await page.locator(".auth-form input[type=password]").fill(user.password);
    await page.locator(".auth-form button[type=submit]").click();
    await expect(page.locator(".loading-block")).toBeVisible();
    await expect(page.locator(".wallet-balance")).toHaveCount(0);
    await expect(page.locator(".wallet-balance")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".loading-block")).toHaveCount(0);
  });

  test("RT-33 the public pages fit small phones without sideways scrolling", async ({ page }) => {
    for (const width of [320, 360]) {
      await page.setViewportSize({ width, height: 760 });
      for (const route of ["/", "/login", "/register"]) {
        await page.goto(route);
        await page.waitForTimeout(300);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${route} at ${width}px`).toBe(0);
      }
      await page.goto("/");
      await expect(page.locator(".lp-burger")).toBeVisible();
    }
  });

  test("RT-34 a restore changes nothing unless it is confirmed", async () => {
    const { user } = accounts();
    const before = (await api("/api/transactions", { token: user.token })).data.length;
    const sample = path.join(__dirname, "..", "docs", "appendices", "sample-database-backup.json");
    const result = await new Promise((resolve) => {
      execFile("node", [path.join(__dirname, "..", "scripts", "restore.js"), sample], { cwd: path.join(__dirname, "..") },
        (err, stdout, stderr) => resolve({ code: err ? err.code : 0, out: stdout + stderr }));
    });
    expect(result.code).not.toBe(0);
    expect(result.out).toContain("Nothing was changed");
    expect(result.out).toContain("fintrack_stark_test");
    // Still signed in, with the same data.
    expect((await api("/api/transactions", { token: user.token })).data.length).toBe(before);
  });

  test("RT-35 one account cannot hold unlimited live connections open", async () => {
    const u = await registerUser("streams");
    const controllers = [];
    const statuses = [];
    for (let i = 0; i < 11; i++) {
      const c = new AbortController();
      controllers.push(c);
      const res = await fetch("http://localhost:4000/api/events", { headers: { Authorization: "Bearer " + u.token }, signal: c.signal });
      statuses.push(res.status);
    }
    controllers.forEach((c) => c.abort());
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  test("RT-36 the Admin manages system settings; changes are validated and audited", async ({ page }) => {
    const { user, admin } = accounts();
    const DEFAULTS = { reminderLeadDays: 3, budgetWarningPercent: 80, sessionHours: 8 };
    try {
      // Only the Admin can read or change them.
      expect((await api("/api/settings", { token: user.token })).status).toBe(403);
      expect((await api("/api/settings", { method: "PUT", token: user.token, body: { sessionHours: 4 } })).status).toBe(403);
      const current = await api("/api/settings", { token: admin.token });
      expect(current.status).toBe(200);
      expect(current.data.settings).toMatchObject(DEFAULTS);

      // Out of range, not whole numbers, wrong types, or nothing at all: refused.
      for (const body of [{ reminderLeadDays: 0 }, { reminderLeadDays: 15 }, { budgetWarningPercent: 40 }, { budgetWarningPercent: 99 },
        { sessionHours: 0 }, { sessionHours: 25 }, { sessionHours: 2.5 }, { reminderLeadDays: "5" }, {}]) {
        expect((await api("/api/settings", { method: "PUT", token: admin.token, body })).status, JSON.stringify(body)).toBe(400);
      }

      // Through the screen: change the reminder lead time and save.
      await signIn(page, "admin", "/system");
      await expect(page.locator(".nav-item", { hasText: "System Settings" })).toBeVisible();
      await page.locator("#set-reminderLeadDays").fill("5");
      await page.getByRole("button", { name: "Save Settings" }).click();
      await expect(page.locator(".toast")).toContainText("System settings saved");
      await expect(page.locator(".settings-foot")).toContainText("Last changed by System Admin");

      const after = await api("/api/settings", { token: admin.token });
      expect(after.data.settings.reminderLeadDays).toBe(5);
      const audit = await api("/api/audit-log", { token: admin.token });
      const line = audit.data.find((l) => l.action === "Settings Changed");
      expect(line.detail).toContain("Reminder lead time: 3 → 5 days");
      expect(line.ref).toBe("system");
    } finally {
      await api("/api/settings", { method: "PUT", token: admin.token, body: DEFAULTS });
    }
  });

  test("RT-37 the settings take effect: reminder lead time, budget warning level, session length", async () => {
    const { admin } = accounts();
    const { execFileSync } = require("child_process");
    const DEFAULTS = { reminderLeadDays: 3, budgetWarningPercent: 80, sessionHours: 8 };
    try {
      await api("/api/settings", { method: "PUT", token: admin.token, body: { reminderLeadDays: 7, budgetWarningPercent: 50, sessionHours: 2 } });

      // A bill due in 6 days: outside the default 3-day window, inside 7. The
      // separate reminder worker reads the setting from the shared database.
      const owner = await registerUser("settingsowner");
      await api("/api/bills", { method: "POST", token: owner.token, body: { name: "Six Days Away", category: "Utilities", amount: 300, due: addDaysISO(todayISO(), 6) } });
      execFileSync("node", [path.join(__dirname, "..", "services", "reminder", "index.js"), "--once"], { cwd: path.join(__dirname, ".."), encoding: "utf8" });
      const inbox = (await api("/api/notifications", { token: owner.token })).data;
      expect(inbox.some((n) => n.type === "reminder" && n.message.includes("Six Days Away") && n.message.includes("due in 6 days"))).toBe(true);

      // Budget warning at 50%: spending 60% of the budget warns at once.
      await api("/api/budgets", { method: "POST", token: owner.token, body: { category: "Food", limit: 1000 } });
      await api("/api/transactions", { method: "POST", token: owner.token, body: { type: "Expense", category: "Food", amount: 600 } });
      const warned = (await api("/api/notifications", { token: owner.token })).data.filter((n) => n.type === "budget");
      expect(warned.length).toBe(1);
      expect(warned[0].message).toContain("60%");

      // Session length: a new sign-in lasts 2 hours, not 8.
      const mongoose = require("mongoose");
      const Session = require("../apps/server/src/models/Session");
      const crypto = require("crypto");
      const login = await api("/api/auth/login", { method: "POST", body: { email: owner.email, password: "testpass123" } });
      await mongoose.connect(process.env.MONGO_URI);
      try {
        const s = await Session.findOne({ tokenHash: crypto.createHash("sha256").update(login.data.token).digest("hex") }).lean();
        const hours = (new Date(s.expiresAt).getTime() - Date.now()) / 3600000;
        expect(hours).toBeGreaterThan(1.9);
        expect(hours).toBeLessThanOrEqual(2);
      } finally {
        await mongoose.disconnect();
      }
    } finally {
      await api("/api/settings", { method: "PUT", token: admin.token, body: DEFAULTS });
    }
  });

  test("RT-38 an overall monthly budget, reducing a budget, and earlier months", async ({ page }) => {
    const person = await registerUser("rt38");
    const post = (path, body) => api(path, { method: "POST", token: person.token, body });
    const today = todayISO();
    const lastMonth = addDaysISO(today.slice(0, 8) + "01", -1);

    // One overall limit per person, next to the per-category ones.
    expect((await post("/api/budgets", { category: "Overall", limit: 2000 })).status).toBe(201);
    const twice = await post("/api/budgets", { category: "Overall", limit: 500 });
    expect(twice.status).toBe(409);
    expect(twice.data.error).toMatch(/overall monthly budget/);
    expect((await post("/api/budgets", { category: "Food", limit: 5000 })).status).toBe(201);

    await post("/api/transactions", { type: "Expense", category: "Food", amount: 600, date: today, note: "rt38 groceries" });
    await post("/api/transactions", { type: "Expense", category: "Transport", amount: 250, date: today });
    await post("/api/transactions", { type: "Expense", category: "Transport", amount: 400, date: lastMonth });
    // Going over the overall limit warns, whichever category did it.
    await post("/api/transactions", { type: "Expense", category: "Other", amount: 1200, date: today });
    const inbox = (await api("/api/notifications", { token: person.token })).data;
    expect(inbox.some((n) => n.type === "budget" && n.message.includes("over your overall monthly budget"))).toBe(true);

    await page.addInitScript((t) => window.sessionStorage.setItem("fts_token", t), person.token);
    await page.goto("/budgets");
    await page.waitForSelector(".shell");
    const overall = page.locator(".overall-budget");
    await expect(overall).toContainText("₱2,050.00");
    await expect(overall).toContainText("Over by ₱50.00");

    // Reducing a budget: ₱5,000 less ₱100 is ₱4,900, and the card says so.
    const food = page.locator(".grid-2 .card", { hasText: "Food" });
    await food.getByRole("button", { name: "Edit" }).click();
    const dialog = page.locator(".modal");
    await expect(dialog.getByRole("button", { name: "Decrease" })).toHaveAttribute("aria-pressed", "true");
    // Taking off more than the budget has is refused before it is sent.
    await page.locator("#budget-change-amount").fill("6000");
    await expect(dialog.locator(".change-preview")).toContainText("cannot go below");
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
    await page.locator("#budget-change-amount").fill("100");
    await expect(dialog.locator(".change-preview")).toHaveText("₱5,000.00 → ₱4,900.00");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.locator(".toast")).toContainText("Food budget reduced by ₱100.00 — now ₱4,900.00");
    await expect(food).toContainText("of ₱4,900.00");
    await expect(food.locator(".budget-change")).toContainText("Reduced by ₱100.00");
    await expect(food.locator(".budget-change")).toContainText("was ₱5,000.00");
    // Raising it again works the same way.
    await food.getByRole("button", { name: "Edit" }).click();
    await dialog.getByRole("button", { name: "Increase" }).click();
    await page.locator("#budget-change-amount").fill("600");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(food).toContainText("of ₱5,500.00");
    await expect(food.locator(".budget-change")).toContainText("Raised by ₱600.00");
    const feed = (await api("/api/activity", { token: person.token })).data;
    expect(feed.some((l) => l.action === "Budget Updated" && l.detail.includes("5000 -> 4900 (reduced by 100)"))).toBe(true);

    // Last month: only last month's spending.
    await page.getByRole("button", { name: "Previous month" }).first().click();
    await expect(overall).toContainText("₱400.00");
    await expect(page.locator(".budget-month")).toContainText("against your current limits");

    // Reports agree, for both months.
    await page.goto("/reports");
    const row = page.locator("tr", { hasText: "Overall (all expenses)" });
    await expect(row).toContainText("₱2,050.00");
    await expect(row).toContainText("Over Budget");
    await page.getByRole("button", { name: "Previous month" }).click();
    await expect(row).toContainText("₱400.00");
    await expect(row).toContainText("Within Budget");
  });
});
