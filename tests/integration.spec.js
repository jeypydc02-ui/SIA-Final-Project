const { test, expect } = require("@playwright/test");
const { execFileSync } = require("child_process");
const path = require("path");
const { api, accounts, signIn, gotoScreen, registerUser } = require("./helpers");

// Runs the reminder worker exactly as the deployment does, as a separate
// process against the same database.
function runReminderSweep() {
  return execFileSync("node", [path.join(__dirname, "..", "services", "reminder", "index.js"), "--once"], {
    cwd: path.join(__dirname, ".."),
    encoding: "utf8",
  });
}

// Integration test cases (spec section 16: minimum 5).
// These cover the integration component itself (section 6): the workflow
// automation and webhook-style cascade that fires when a bill is paid, and
// the messaging simulation that routes events to the right recipient.

test.describe("Integration", () => {
  test("IT-01 paying a bill cascades into an expense, a notification, and an audit entry", async ({ page }) => {
    const { user, admin } = accounts();

    const before = await api("/api/transactions", { token: user.token });
    const bill = await api("/api/bills", {
      method: "POST", token: user.token,
      body: { name: "Cascade Test Bill", category: "Utilities", amount: 1234, due: "2026-12-31" },
    });

    await signIn(page, "user");
    await gotoScreen(page, "Bill Reminders");

    const row = page.locator("tr", { hasText: "Cascade Test Bill" });
    await row.getByRole("button", { name: "Mark Paid" }).click();
    await page.getByRole("button", { name: "Confirm Payment" }).click();
    await expect(page.locator(".toast")).toContainText("marked as paid");

    // 1. the bill itself moved to Paid
    await expect(page.locator("tr", { hasText: "Cascade Test Bill" })).toContainText("Paid");

    // 2. an auto-approved expense transaction was created by the workflow
    const after = await api("/api/transactions", { token: user.token });
    expect(after.data.length).toBe(before.data.length + 1);
    const generated = after.data.find((t) => t.note === "Bill payment: Cascade Test Bill");
    expect(generated).toBeTruthy();
    expect(generated.status).toBe("Approved");
    expect(generated.autoApproved).toBe(true);
    expect(generated.amount).toBe(1234);

    // 3. a notification was raised for the payer
    const notifs = await api("/api/notifications", { token: user.token });
    expect(notifs.data.some((n) => n.type === "payment" && n.message.includes("Cascade Test Bill"))).toBe(true);

    // 4. the action was recorded in the audit trail
    const audit = await api("/api/audit-log", { token: admin.token });
    expect(audit.data.some((l) => l.action === "Payment Recorded" && l.detail.includes("Cascade Test Bill"))).toBe(true);
  });

  test("IT-02 a new submission is routed to reviewers, not to everyone", async () => {
    const { user, reviewer, admin } = accounts();

    await api("/api/transactions", {
      method: "POST", token: user.token,
      body: { type: "Income", category: "Freelance", amount: 4321, note: "routing check" },
    });

    const reviewerInbox = await api("/api/notifications", { token: reviewer.token });
    const adminInbox = await api("/api/notifications", { token: admin.token });
    const submitterInbox = await api("/api/notifications", { token: user.token });

    expect(reviewerInbox.data.some((n) => n.type === "submission" && n.message.includes("4321"))).toBe(true);
    expect(adminInbox.data.some((n) => n.type === "submission" && n.message.includes("4321"))).toBe(true);
    // The submitter is not told about their own submission.
    expect(submitterInbox.data.some((n) => n.type === "submission" && n.message.includes("4321"))).toBe(false);
  });

  test("IT-03 a review outcome is delivered only to the submitter", async () => {
    const { user, reviewer } = accounts();

    const created = await api("/api/transactions", {
      method: "POST", token: user.token,
      body: { type: "Expense", category: "Food", amount: 8888, note: "outcome routing" },
    });
    await api(`/api/transactions/${created.data._id}/review`, {
      method: "POST", token: reviewer.token,
      body: { action: "approve", comment: "Looks right." },
    });

    const submitterInbox = await api("/api/notifications", { token: user.token });
    const reviewerInbox = await api("/api/notifications", { token: reviewer.token });

    expect(submitterInbox.data.some((n) => n.type === "approved" && n.message.includes("8888"))).toBe(true);
    expect(reviewerInbox.data.some((n) => n.type === "approved" && n.message.includes("8888"))).toBe(false);
  });

  test("IT-04 an approved entry flows through to the dashboard totals", async ({ page }) => {
    const { user, reviewer } = accounts();

    await signIn(page, "user");
    const balanceBefore = await page.locator(".card.stat", { hasText: "Balance" }).locator(".value").innerText();

    const created = await api("/api/transactions", {
      method: "POST", token: user.token,
      body: { type: "Income", category: "Salary", amount: 10000, note: "dashboard flow" },
    });

    // Still pending: it must not count yet.
    await page.reload();
    await page.waitForSelector(".shell");
    const balancePending = await page.locator(".card.stat", { hasText: "Balance" }).locator(".value").innerText();
    expect(balancePending).toBe(balanceBefore);

    await api(`/api/transactions/${created.data._id}/review`, {
      method: "POST", token: reviewer.token, body: { action: "approve" },
    });

    await page.reload();
    await page.waitForSelector(".shell");
    const balanceAfter = await page.locator(".card.stat", { hasText: "Balance" }).locator(".value").innerText();
    expect(balanceAfter).not.toBe(balanceBefore);
  });

  test("IT-05 approved expenses are counted against the matching budget", async ({ page }) => {
    const { user, reviewer } = accounts();

    const created = await api("/api/transactions", {
      method: "POST", token: user.token,
      body: { type: "Expense", category: "Transport", amount: 900, note: "budget flow" },
    });
    await api(`/api/transactions/${created.data._id}/review`, {
      method: "POST", token: reviewer.token, body: { action: "approve" },
    });

    // Derive the expected figures from the data rather than hardcoding them,
    // so the assertion tests the invariant and not the current seed.
    const peso = (n) => "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const allTx = await api("/api/transactions", { token: user.token });
    const expectedSpent = allTx.data
      .filter((t) => t.status === "Approved" && t.type === "Expense" && t.category === "Transport")
      .reduce((s, t) => s + t.amount, 0);
    const budgets = await api("/api/budgets", { token: user.token });
    const transportBudget = budgets.data.find((b) => b.category === "Transport");

    expect(expectedSpent).toBeGreaterThanOrEqual(900); // the entry just approved is in there

    await signIn(page, "user");
    await gotoScreen(page, "Budgets");

    const card = page.locator(".card", { hasText: "Transport" }).first();
    await expect(card).toContainText(peso(expectedSpent));
    await expect(card).toContainText("of " + peso(transportBudget.limit));

    // The Reports screen must agree with the Budgets screen.
    await gotoScreen(page, "Reports");
    const budgetRow = page.locator("tr", { hasText: "Transport" });
    await expect(budgetRow).toContainText(peso(transportBudget.limit));
    await expect(budgetRow).toContainText(peso(expectedSpent));
  });

  test("IT-06 the reminder service raises overdue alerts on its own schedule", async ({ page }) => {
    const owner = await registerUser("billowner");
    const bystander = await registerUser("bystander");

    // Two bills for the owner: one overdue, one comfortably in the future.
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const nextYear = "2027-12-31";
    await api("/api/bills", {
      method: "POST", token: owner.token,
      body: { name: "Scheduled Sweep Overdue", category: "Utilities", amount: 1500, due: yesterday },
    });
    await api("/api/bills", {
      method: "POST", token: owner.token,
      body: { name: "Scheduled Sweep Far Off", category: "Credit", amount: 2000, due: nextYear },
    });

    // Adding a bill already acknowledges it, so only notifications that did
    // not exist before the sweep count as the sweep's work.
    const before = await api("/api/notifications", { token: owner.token });
    const seen = new Set(before.data.map((n) => n._id));

    // Nobody is using the app — the worker runs against the clock.
    const output = runReminderSweep();
    expect(output).toContain("raised");

    const after = await api("/api/notifications", { token: owner.token });
    const raised = after.data.filter((n) => !seen.has(n._id));

    // The overdue bill produced an alert; the one due next year did not.
    expect(raised.length).toBe(1);
    expect(raised[0].type).toBe("overdue");
    expect(raised[0].message).toContain("Scheduled Sweep Overdue");
    expect(raised.some((n) => n.message.includes("Scheduled Sweep Far Off"))).toBe(false);

    // The alert is addressed: it reaches the bill's owner and nobody else.
    const bystanderInbox = await api("/api/notifications", { token: bystander.token });
    expect(bystanderInbox.data.some((n) => n.message.includes("Scheduled Sweep"))).toBe(false);

    // Running again the same day must not duplicate the alert.
    const secondOutput = runReminderSweep();
    expect(secondOutput).toContain("none need a new alert");
    const afterSecond = await api("/api/notifications", { token: owner.token });
    expect(afterSecond.data.filter((n) => !seen.has(n._id)).length).toBe(1);

    // The sweep itself is in the audit trail, attributed to the service.
    const { admin } = accounts();
    const audit = await api("/api/audit-log", { token: admin.token });
    expect(audit.data.some((l) => l.user === "Reminder Service" && l.action === "Reminder Sweep")).toBe(true);

    // And the owner sees it in the interface without doing anything.
    await page.addInitScript((t) => window.sessionStorage.setItem("fts_token", t), owner.token);
    await page.goto("/");
    await page.waitForSelector(".shell");
    await gotoScreen(page, "Notification Log");
    await expect(page.locator(".card")).toContainText("Scheduled Sweep Overdue");
    await expect(page.locator(".card")).toContainText("overdue by 1 day");
  });
});
