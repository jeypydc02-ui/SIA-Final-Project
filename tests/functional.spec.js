const { test, expect } = require("@playwright/test");
const { api, accounts, signIn, gotoScreen, mailTo, codeIn, uniqueEmail } = require("./helpers");

// Functional test cases (spec section 16: minimum 8).
// Each case names the functional requirement it covers so the results drop
// straight into the traceability matrix (section 3.4).

test.describe("Functional", () => {
  test("FT-01 (FR-001) a registered user can sign in through the form", async ({ page }) => {
    const { user } = accounts();
    await page.goto("/");
    await page.getByRole("button", { name: "Log In" }).first().click();

    await page.locator(".auth-form input").first().fill(user.email);
    await page.locator(".auth-form input[type=password]").fill(user.password);
    await page.locator(".auth-form button[type=submit]").click();

    await expect(page.locator(".shell")).toBeVisible();
    await expect(page.locator(".side-foot")).toContainText("John Paul Dela Cruz");
    await expect(page.locator(".topbar h1")).toHaveText("Dashboard");
  });

  test("FT-02 (FR-002) a user can create a bill record", async ({ page }) => {
    await signIn(page, "user");
    await gotoScreen(page, "Bill Reminders");

    await page.getByRole("button", { name: "+ Add Bill" }).click();
    await page.locator(".modal input").first().fill("Globe Postpaid");
    await page.locator(".modal select").selectOption("Internet");
    await page.locator('.modal input[type=number]').fill("1299");
    await page.getByRole("button", { name: "Save Bill" }).click();

    await expect(page.locator("table")).toContainText("Globe Postpaid");
    await expect(page.locator("table")).toContainText("₱1,299.00");
  });

  test("FT-03 (FR-003) a user can record an income/expense entry", async ({ page }) => {
    await signIn(page, "user");
    await gotoScreen(page, "Log Income/Expense");

    await page.locator("select").first().selectOption("Expense");
    await page.locator('input[type=number]').fill("777");
    await page.locator('input[placeholder*="Groceries"]').fill("Functional test entry");
    await page.getByRole("button", { name: "Save Entry" }).click();

    await expect(page.locator(".toast")).toContainText("recorded");

    // It counts straight away: there is no approval step.
    await gotoScreen(page, "My Entries");
    const row = page.locator(".entry-row", { hasText: "Functional test entry" });
    await expect(row).toContainText("Recorded");
    await expect(row).toContainText("₱777.00");
  });

  test("FT-04 (FR-004) the system tracks entry versions", async ({ page }) => {
    const { user } = accounts();

    const created = await api("/api/transactions", {
      method: "POST", token: user.token,
      body: { type: "Expense", category: "Food", amount: 500, note: "version tracking v1" },
    });
    const v2 = await api(`/api/transactions/${created.data._id}`, {
      method: "PUT", token: user.token,
      body: { amount: 650, note: "version tracking v2" },
    });
    expect(v2.data.version).toBe(2);
    expect(v2.data.parentId).toBe(created.data._id);

    await signIn(page, "user");
    await gotoScreen(page, "Revision History");

    const row = page.locator("tr", { hasText: "version tracking v2" }).first();
    await expect(row).toContainText("v2");
    await row.click();

    const timeline = page.locator(".timeline");
    await expect(timeline).toContainText("v1");
    await expect(timeline).toContainText("v2");
    await expect(timeline).toContainText("Earlier version");
    await expect(timeline).toContainText("₱500.00 → ₱650.00");
  });

  test("FT-05 (FR-015) a user can correct and delete their own entries", async ({ page }) => {
    const { user } = accounts();
    await api("/api/transactions", {
      method: "POST", token: user.token,
      body: { type: "Expense", category: "Transport", amount: 333, note: "correct me" },
    });

    await signIn(page, "user");
    await gotoScreen(page, "My Entries");

    const row = page.locator(".entry-row", { hasText: "correct me" });
    await row.getByRole("button", { name: "Edit" }).click();
    await page.locator(".modal input[type=number]").fill("350");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.locator(".toast")).toContainText("Entry updated");

    const corrected = page.locator(".entry-row", { hasText: "correct me" });
    await expect(corrected).toContainText("₱350.00");
    await expect(corrected).toContainText("v2");

    await corrected.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete Entry" }).click();
    await expect(page.locator(".toast")).toContainText("Entry deleted");
    await expect(page.locator(".entry-row", { hasText: "correct me" })).toHaveCount(0);
  });

  test("FT-06 (FR-006) notes are stored per entry", async ({ page }) => {
    const { user } = accounts();
    const created = await api("/api/transactions", {
      method: "POST", token: user.token,
      body: { type: "Expense", category: "Food", amount: 210, note: "comment carrier" },
    });
    const note = await api("/api/comments", {
      method: "POST", token: user.token,
      body: { text: "Shared with my sister, she owes half.", transactionId: created.data._id },
    });
    expect(note.status).toBe(201);

    await signIn(page, "user");
    await gotoScreen(page, "Notes / Feedback");

    await page.locator(".tab", { hasText: "On Entries" }).click();
    const card = page.locator(".note-card", { hasText: "Shared with my sister, she owes half." });
    await expect(card).toBeVisible();
    // The note names the entry it belongs to rather than floating loose.
    await expect(card).toContainText("₱210.00");
  });

  test("FT-07 (FR-009) the dashboard summarises balance, bills and budgets", async ({ page }) => {
    await signIn(page, "user");

    const wallet = page.locator(".wallet");
    await expect(wallet.locator(".wallet-balance")).toContainText("₱");
    await expect(wallet.locator(".wallet-income")).toContainText("₱");
    await expect(wallet.locator(".wallet-expense")).toContainText("₱");
    await expect(wallet.locator("svg.donut")).toBeVisible();
    await expect(wallet.getByRole("button", { name: "Log an expense" })).toBeVisible();

    await expect(page.locator(".panel", { hasText: "Upcoming bills" })).toContainText("Condo Rent");
    await expect(page.locator(".panel", { hasText: "Budgets" }).locator(".budget-row", { hasText: "Food" })).toBeVisible();
  });

  test("FT-09 every screen has its own address", async ({ page }) => {
    await signIn(page, "user");
    // Signing in lands on a named page, not on a bare origin.
    await expect(page).toHaveURL(/\/dashboard$/);

    const screens = [
      ["Bill Categories", "/categories"],
      ["Log Income/Expense", "/submit"],
      ["Budgets", "/budgets"],
      ["Bill Reminders", "/bills"],
      ["Revision History", "/revisions"],
      ["My Entries", "/entries"],
      ["Notes / Feedback", "/notes"],
      ["Payment History", "/payments"],
      ["Notification Log", "/notifications"],
      ["Reports", "/reports"],
      ["Settings", "/settings"],
    ];

    for (const [label, path] of screens) {
      await gotoScreen(page, label);
      await expect(page, `${label} should live at ${path}`).toHaveURL(new RegExp(path.replace("/", "\\/") + "$"));
      // The breadcrumb agrees with the address bar.
      await expect(page.locator(".topbar .path")).toHaveText("fintrackstark" + path);
    }

    // Opening a category is an address too, so a single category can be shared.
    await gotoScreen(page, "Bill Categories");
    await page.locator(".card-link", { hasText: "Housing" }).click();
    await expect(page).toHaveURL(/\/categories\/Housing$/);
    await expect(page.locator(".pagehead h2")).toContainText("Housing");
  });

  test("FT-10 addresses survive a reload, and the browser's own buttons work", async ({ page }) => {
    await signIn(page, "user");

    // Deep link: typing an address goes straight there, not to the dashboard.
    await page.goto("/settings");
    await page.waitForSelector(".shell");
    await expect(page.locator(".pagehead h2")).toHaveText("Settings");

    // Reloading keeps you on the page you were reading. Before routing, a
    // refresh dropped you back at the landing page.
    await page.reload();
    await page.waitForSelector(".shell");
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.locator(".pagehead h2")).toHaveText("Settings");

    // Back and forward move through the screens visited.
    await gotoScreen(page, "Budgets");
    await expect(page).toHaveURL(/\/budgets$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/settings$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/budgets$/);

    // An address that does not exist is handled, not left blank.
    await page.goto("/nonsense");
    await page.waitForSelector(".shell");
    await expect(page.locator(".empty")).toContainText("does not exist");

    // A restricted address typed by hand is refused in the interface as well
    // as by the API (the sidebar never offers it to a User).
    await page.goto("/users");
    await page.waitForSelector(".shell");
    await expect(page.locator(".empty")).toContainText("Restricted");
    await expect(page.locator(".nav-item", { hasText: "User & Role Mgmt" })).toHaveCount(0);

    // An Admin opening the same address gets the page.
    const adminPage = await page.context().newPage();
    const { admin } = accounts();
    await adminPage.addInitScript((t) => window.sessionStorage.setItem("fts_token", t), admin.token);
    await adminPage.goto("/users");
    await adminPage.waitForSelector(".shell");
    await expect(adminPage.locator(".pagehead h2")).toContainText("User & Role Management");
    await adminPage.close();
  });

  test("FT-08 (FR-010) important actions are written to the audit log", async ({ page }) => {
    // A failed sign-in, so the Failed filter has something of its own to show.
    await api("/api/auth/login", { method: "POST", body: { email: accounts().other.email, password: "not-the-password" } });
    await signIn(page, "admin");
    await gotoScreen(page, "Audit Log");

    const table = page.locator("table");
    await expect(table).toContainText("Login");
    await expect(table).toContainText("System Admin");
    // Every row carries a timestamp, the actor, the action, whether it
    // worked, the detail, and the record it concerned.
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow.locator("td")).toHaveCount(6);
    await expect(page.locator("thead")).toContainText("Status");
    // Failed actions can be shown on their own.
    await page.locator(".tab", { hasText: "Failed" }).click();
    await expect(page.locator("tbody tr").first()).toContainText("Failed");
  });

  test("FT-11 (FR-001) signing up needs the code e-mailed to the address", async ({ page }) => {
    const email = uniqueEmail("ft11");
    await page.goto("/register");
    await page.locator(".auth-form input").nth(0).fill("Lara");
    await page.locator(".auth-form input").nth(1).fill("Reyes");
    await page.locator(".auth-form input").nth(2).fill(email);
    await page.locator(".auth-form input[type=password]").nth(0).fill("ft11pass123");
    await page.locator(".auth-form input[type=password]").nth(1).fill("ft11pass123");
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page.locator(".auth-title")).toHaveText("Check your e-mail");

    // A wrong code is refused and says how many tries are left.
    const code = codeIn(await mailTo(email));
    await page.locator("#otp").fill(code === "000000" ? "111111" : "000000");
    await page.getByRole("button", { name: "Verify and Create Account" }).click();
    await expect(page.locator(".auth-error")).toContainText("4 attempts left");

    await page.locator("#otp").fill(code);
    await page.getByRole("button", { name: "Verify and Create Account" }).click();
    await expect(page.locator(".shell")).toBeVisible();
    await expect(page.locator(".side-foot")).toContainText("Lara Reyes");
  });

  test("FT-12 (FR-010) a User sees their own activity, and only theirs", async ({ page }) => {
    const { user, other } = accounts();
    await api("/api/budgets", { method: "POST", token: other.token, body: { category: "Health", limit: 777 } });
    await api("/api/transactions", { method: "POST", token: user.token, body: { type: "Expense", category: "Food", amount: 432, date: new Date().toISOString().slice(0, 10), note: "FT-12 lunch" } });

    await signIn(page, "user");
    await gotoScreen(page, "My Activity");
    const feed = page.locator(".inbox").first();
    await expect(feed).toContainText("Expense Recorded");
    await expect(feed).toContainText("FT-12 lunch");
    await expect(page.locator(".pagehead")).toContainText("Only you can see this");
    // Another person's budget never appears here.
    await expect(page.locator("body")).not.toContainText("Health limit set to 777");
    // Filters narrow the list by kind.
    await page.locator(".tab", { hasText: "Bills & payments" }).click();
    await expect(page.locator("body")).not.toContainText("FT-12 lunch");
  });
});
