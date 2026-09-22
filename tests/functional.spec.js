const { test, expect } = require("@playwright/test");
const { api, accounts, signIn, gotoScreen } = require("./helpers");

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

  test("FT-03 (FR-003) a user can submit an income/expense entry for review", async ({ page }) => {
    await signIn(page, "user");
    await gotoScreen(page, "Log Income/Expense");

    await page.locator("select").first().selectOption("Expense");
    await page.locator('input[type=number]').fill("777");
    await page.locator('input[placeholder*="Groceries"]').fill("Functional test entry");
    await page.getByRole("button", { name: "Submit for Review" }).click();

    await expect(page.locator(".toast")).toContainText("submitted for review");

    await gotoScreen(page, "Review & Approval");
    await expect(page.locator("table")).toContainText("Functional test entry");
    await expect(page.locator("table")).toContainText("Pending Review");
  });

  test("FT-04 (FR-004) the system tracks entry versions", async ({ page }) => {
    const { user, reviewer } = accounts();

    const created = await api("/api/transactions", {
      method: "POST", token: user.token,
      body: { type: "Expense", category: "Food", amount: 500, note: "version tracking v1" },
    });
    await api(`/api/transactions/${created.data._id}/review`, {
      method: "POST", token: reviewer.token,
      body: { action: "revise", comment: "Please correct the amount." },
    });
    await api(`/api/transactions/${created.data._id}/resubmit`, {
      method: "POST", token: user.token,
      body: { amount: 650, note: "version tracking v2" },
    });

    await signIn(page, "user");
    await gotoScreen(page, "Revision History");

    const row = page.locator("tr", { hasText: "version tracking v2" }).first();
    await expect(row).toContainText("v2");
    await row.click();

    const timeline = page.locator(".timeline");
    await expect(timeline).toContainText("v1");
    await expect(timeline).toContainText("v2");
    await expect(timeline).toContainText("Superseded");
    await expect(timeline).toContainText("₱500.00 → ₱650.00");
  });

  test("FT-05 (FR-005) a reviewer can approve, reject, or request revision", async ({ page }) => {
    const { user } = accounts();
    await api("/api/transactions", {
      method: "POST", token: user.token,
      body: { type: "Expense", category: "Transport", amount: 333, note: "approve me" },
    });

    await signIn(page, "reviewer");
    await gotoScreen(page, "Review & Approval");

    const queue = page.locator(".card", { hasText: "Pending Review (" });
    const row = queue.locator("tr", { hasText: "approve me" });
    await expect(row).toBeVisible();

    // All three review outcomes are offered.
    await expect(row.getByRole("button", { name: "Approve" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Revise" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Reject" })).toBeVisible();

    await row.getByRole("button", { name: "Approve" }).click();
    await page.locator(".modal input").fill("Checked against the receipt.");
    await page.getByRole("button", { name: "Confirm" }).click();

    await expect(page.locator(".toast")).toContainText("Review recorded");
    await expect(page.locator(".card", { hasText: "All Submissions" }).locator("tr", { hasText: "approve me" }))
      .toContainText("Approved");
  });

  test("FT-06 (FR-006) comments and feedback are stored per entry", async ({ page }) => {
    const { user, reviewer } = accounts();
    const created = await api("/api/transactions", {
      method: "POST", token: user.token,
      body: { type: "Expense", category: "Food", amount: 210, note: "comment carrier" },
    });
    await api(`/api/transactions/${created.data._id}/review`, {
      method: "POST", token: reviewer.token,
      body: { action: "reject", comment: "Duplicate of an earlier entry." },
    });

    await signIn(page, "user");
    await gotoScreen(page, "Notes / Feedback");

    await page.locator(".tab", { hasText: "Review Feedback" }).click();
    await expect(page.locator(".card").last()).toContainText("Duplicate of an earlier entry.");
    // The comment names the entry it belongs to rather than floating loose.
    await expect(page.locator(".card").last()).toContainText("₱210.00");
  });

  test("FT-07 (FR-009) the dashboard summarises balance, bills and budgets", async ({ page }) => {
    await signIn(page, "user");

    const stats = page.locator(".card.stat");
    await expect(stats.filter({ hasText: "Balance" })).toBeVisible();
    await expect(stats.filter({ hasText: "Total Income" })).toContainText("₱");
    await expect(stats.filter({ hasText: "Total Expenses" })).toContainText("₱");
    await expect(stats.filter({ hasText: "Bills Pending" })).toBeVisible();

    await expect(page.locator(".card", { hasText: "Upcoming & Overdue Bills" })).toContainText("Condo Rent");
    await expect(page.locator(".card", { hasText: "Food Budget" })).toBeVisible();
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
      ["Review & Approval", "/review"],
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
    await signIn(page, "admin");
    await gotoScreen(page, "Audit Log");

    const table = page.locator("table");
    await expect(table).toContainText("Login");
    await expect(table).toContainText("System Admin");
    // Every row carries a timestamp, the actor, and the action.
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow.locator("td")).toHaveCount(4);
  });
});
