const { test, expect } = require("@playwright/test");
const { api, accounts } = require("./helpers");
const { PNG } = require("./receipt-helpers");

// End-to-end scenario (spec section 16: minimum 1).
//
// One continuous journey through the browser, no API shortcuts for the steps
// a person would perform: register -> set a budget -> record an expense (it
// counts at once) -> correct it, which keeps the first figure as v1 -> the
// corrected figure reaches the dashboard, budget and reports -> the whole
// thing is visible in the audit trail.

test("E2E-01 a new account records, corrects and reports an expense", async ({ browser }) => {
  const email = `e2e${Date.now()}@example.test`;
  const password = "e2epass123";

  const memberContext = await browser.newContext();
  const member = await memberContext.newPage();

  // --- 1. Register from the landing page ---
  await member.goto("/");
  await member.getByRole("button", { name: "Get Started" }).first().click();

  await member.locator(".auth-form input").nth(0).fill("Ella");
  await member.locator(".auth-form input").nth(1).fill("Santos");
  await member.locator(".auth-form input").nth(2).fill(email);
  await member.locator('.auth-form input[type=password]').nth(0).fill(password);
  await member.locator('.auth-form input[type=password]').nth(1).fill(password);
  await member.getByRole("button", { name: "Create Account" }).click();

  await expect(member.locator(".shell")).toBeVisible();
  await expect(member.locator(".side-foot")).toContainText("Ella Santos");
  // A brand-new account is a plain User.
  await expect(member.locator(".side-user-role")).toHaveText("User");

  // --- 2. A new account starts empty, and can set its own budget ---
  await member.locator(".nav-item", { hasText: "Budgets" }).click();
  await expect(member.locator(".empty")).toContainText("No budgets yet");

  await member.getByRole("button", { name: "+ Add Budget" }).click();
  await member.locator(".modal select").selectOption("Food");
  await member.locator('.modal input[type=number]').fill("3000");
  await member.getByRole("button", { name: "Save Budget" }).click();
  await expect(member.locator(".card", { hasText: "Food" }).first()).toContainText("of ₱3,000.00");

  // --- 3. Record an expense: it counts straight away ---
  await member.locator(".nav-item", { hasText: "Log Income/Expense" }).click();
  await member.locator("select").first().selectOption("Expense");
  await member.locator("select").nth(1).selectOption("Food");
  await member.locator('input[type=number]').fill("1200");
  await member.locator('input[placeholder*="Groceries"]').fill("E2E weekly groceries");
  await member.getByRole("button", { name: "Save Entry" }).click();
  await expect(member.locator(".toast")).toContainText("recorded");

  await member.locator(".nav-item", { hasText: "Dashboard" }).click();
  await expect(member.locator(".wallet-expense .amt")).toHaveText("₱1,200.00");

  // --- 4. Correct the amount from My Entries ---
  await member.locator(".nav-item", { hasText: "My Entries" }).click();
  const row = member.locator(".entry-row", { hasText: "E2E weekly groceries" });
  await expect(row).toContainText("Recorded");
  await row.getByRole("button", { name: "Edit" }).click();
  await member.locator('.modal input[type=number]').fill("900");
  await member.locator(".modal input").last().fill("E2E groceries, corrected");
  await member.getByRole("button", { name: "Save Changes" }).click();
  await expect(member.locator(".toast")).toContainText("Entry updated");
  await expect(member.locator(".entry-row", { hasText: "E2E groceries, corrected" })).toContainText("v2");

  // --- 5. The first figure is kept as v1 in Revision History ---
  await member.locator(".nav-item", { hasText: "Revision History" }).click();
  const chainRow = member.locator("tr", { hasText: "E2E groceries, corrected" }).first();
  await expect(chainRow).toContainText("v2");
  await chainRow.click();
  await expect(member.locator(".timeline")).toContainText("₱1,200.00 → ₱900.00");
  await expect(member.locator(".timeline")).toContainText("Earlier version");

  // --- 6. The corrected figure reaches the dashboard, budget and reports ---
  await member.locator(".nav-item", { hasText: "Dashboard" }).click();
  await expect(member.locator(".wallet-expense .amt")).toHaveText("₱900.00");

  await member.locator(".nav-item", { hasText: "Budgets" }).click();
  await expect(member.locator(".card", { hasText: "Food" }).first()).toContainText("₱900.00");
  await expect(member.locator(".card", { hasText: "Food" }).first()).toContainText("₱2,100.00 remaining");

  await member.locator(".nav-item", { hasText: "Reports" }).click();
  await expect(member.locator(".card", { hasText: "Expenses by Category" })).toContainText("₱900.00");
  await expect(member.locator("tr", { hasText: "Food" })).toContainText("Within Budget");

  // --- 7. The session survives a refresh ---
  await member.reload();
  await expect(member.locator(".shell")).toBeVisible();
  await expect(member.locator(".side-foot")).toContainText("Ella Santos");

  // --- 8. The whole journey is in the audit trail ---
  const { admin } = accounts();
  const audit = await api("/api/audit-log", { token: admin.token });
  const mine = audit.data.filter((l) => l.user === "Ella Santos");
  expect(mine.some((l) => l.action === "Account Created")).toBe(true);
  expect(mine.some((l) => l.action === "Budget Created")).toBe(true);
  expect(mine.some((l) => l.action === "Expense Recorded")).toBe(true);
  expect(mine.some((l) => l.action === "Transaction Edited" && l.detail.includes("v2 replaces v1"))).toBe(true);

  await memberContext.close();
});

// Spec section 9.5: one complete workflow from submission to final approval.
// Two browsers, as two people: the member submits an expense with a receipt
// photo; the Reviewer sends it back; the member retakes it as v2; the
// Reviewer verifies it. Each side sees the other's action without reloading.
test("E2E-02 a receipt goes from submission to final approval", async ({ browser }) => {
  test.setTimeout(60000);
  const { user, reviewer } = accounts();
  const plant = async (token, path) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript((t) => window.sessionStorage.setItem("fts_token", t), token);
    await page.goto(path);
    await page.waitForSelector(".shell");
    return page;
  };
  const member = await plant(user.token, "/submit");
  const desk = await plant(reviewer.token, "/review");

  // 1. Submission, with a receipt photo.
  await member.locator("input[type=number]").first().fill("2345");
  await member.getByText("Attach a receipt").click();
  await member.locator("#log-receipt-file").setInputFiles({ name: "hardware.png", mimeType: "image/png", buffer: PNG });
  await member.getByRole("button", { name: "Save Entry" }).click();
  await expect(member.locator(".toast")).toContainText("receipt sent for review");

  // 2. It reaches the Reviewer live; they ask for a clearer copy.
  const card = desk.locator(".review-card", { hasText: "₱2,345.00" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Review receipt" }).click();
  await desk.locator("#review-note").fill("Photo is blurry — please retake it");
  await desk.getByRole("button", { name: "Request revision" }).click();
  await expect(desk.locator(".toast")).toContainText("Sent back for revision");

  // 3. The member is told, and attaches v2 from My Entries.
  await member.goto("/entries");
  const row = member.locator(".entry-row", { hasText: "2,345" }).first();
  await expect(row.locator(".receipt-chip")).toHaveText("Receipt v1 · Needs revision");
  await row.locator(".receipt-chip").click();
  await expect(member.locator(".receipt-modal")).toContainText("Photo is blurry");
  await member.locator(".receipt-modal input[type=file]").setInputFiles({ name: "hardware-retake.png", mimeType: "image/png", buffer: PNG });
  await member.getByRole("button", { name: "Submit for Review" }).click();
  await expect(row.locator(".receipt-chip")).toHaveText("Receipt v2 · For review");

  // 4. Final approval.
  const v2card = desk.locator(".review-card", { hasText: "₱2,345.00" });
  await expect(v2card).toContainText("version 2");
  await v2card.getByRole("button", { name: "Review receipt" }).click();
  await desk.locator(".review-modal").getByRole("button", { name: "Verify" }).click();
  await expect(desk.locator(".toast")).toContainText("Receipt verified");

  // The member sees it verified without reloading, and is notified.
  await expect(row.locator(".receipt-chip")).toHaveText("Receipt v2 · Verified");
  const inbox = await api("/api/notifications", { token: user.token });
  expect(inbox.data.some((n) => n.type === "receipt-verified" && n.message.includes("2,345"))).toBe(true);
});
