const { test, expect } = require("@playwright/test");
const { api, accounts } = require("./helpers");

// End-to-end scenario (spec section 16: minimum 1, and section 9.5:
// "one complete workflow from submission to final approval").
//
// One continuous journey through the browser, no API shortcuts for the steps
// a person would perform: register -> submit -> reviewer requests revision ->
// resubmit as v2 -> reviewer approves -> the figure reaches the dashboard and
// reports, and the whole thing is visible in the audit trail.

test("E2E-01 a new account's entry travels from submission to approval", async ({ browser }) => {
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
  await expect(member.locator(".role-pill")).toContainText("User");

  // --- 2. A new account starts empty, and can set its own budget ---
  await member.locator(".nav-item", { hasText: "Budgets" }).click();
  await expect(member.locator(".empty")).toContainText("No budgets yet");

  await member.getByRole("button", { name: "+ Add Budget" }).click();
  await member.locator(".modal select").selectOption("Food");
  await member.locator('.modal input[type=number]').fill("3000");
  await member.getByRole("button", { name: "Save Budget" }).click();
  await expect(member.locator(".card", { hasText: "Food" }).first()).toContainText("of ₱3,000.00");

  // --- 3. Submit an expense for review ---
  await member.locator(".nav-item", { hasText: "Log Income/Expense" }).click();
  await member.locator("select").first().selectOption("Expense");
  await member.locator("select").nth(1).selectOption("Food");
  await member.locator('input[type=number]').fill("1200");
  await member.locator('input[placeholder*="Groceries"]').fill("E2E weekly groceries");
  await member.getByRole("button", { name: "Submit for Review" }).click();
  await expect(member.locator(".toast")).toContainText("submitted for review");

  // Nothing counts yet: the entry is pending.
  await member.locator(".nav-item", { hasText: "Dashboard" }).click();
  await expect(member.locator(".card.stat", { hasText: "Total Expenses" }).locator(".value")).toHaveText("₱0.00");

  // --- 4. The reviewer sees it and asks for a revision ---
  const reviewerContext = await browser.newContext();
  const reviewerPage = await reviewerContext.newPage();
  const { reviewer } = accounts();
  await reviewerPage.addInitScript((t) => window.sessionStorage.setItem("fts_token", t), reviewer.token);
  await reviewerPage.goto("/");
  await reviewerPage.waitForSelector(".shell");

  await reviewerPage.locator(".nav-item", { hasText: "Notification Log" }).click();
  await expect(reviewerPage.locator(".card")).toContainText("Ella Santos submitted an expense");

  await reviewerPage.locator(".nav-item", { hasText: "Review & Approval" }).click();
  const queueRow = reviewerPage.locator("tr", { hasText: "E2E weekly groceries" }).first();
  await queueRow.getByRole("button", { name: "Revise" }).click();
  await reviewerPage.locator(".modal input").fill("Please split the household items out.");
  await reviewerPage.getByRole("button", { name: "Confirm" }).click();
  await expect(reviewerPage.locator(".toast")).toContainText("Review recorded");

  // --- 5. The member is told, and resubmits a corrected version ---
  await member.reload();
  await member.waitForSelector(".shell");
  await expect(member.locator(".nav-badge")).toBeVisible();

  await member.locator(".nav-item", { hasText: "Review & Approval" }).click();
  const myRow = member.locator("tr", { hasText: "E2E weekly groceries" }).first();
  await expect(myRow).toContainText("Needs Revision");
  await expect(myRow).toContainText("Please split the household items out.");

  await myRow.getByRole("button", { name: "Resubmit" }).click();
  await member.locator('.modal input[type=number]').fill("900");
  await member.locator(".modal input").last().fill("E2E groceries, corrected");
  await member.getByRole("button", { name: "Resubmit" }).last().click();
  await expect(member.locator(".toast")).toContainText("Resubmitted");

  // --- 6. The revision trail is recorded, not synthesised ---
  await member.locator(".nav-item", { hasText: "Revision History" }).click();
  const chainRow = member.locator("tr", { hasText: "E2E groceries, corrected" }).first();
  await expect(chainRow).toContainText("v2");
  await chainRow.click();
  await expect(member.locator(".timeline")).toContainText("₱1,200.00 → ₱900.00");
  await expect(member.locator(".timeline")).toContainText("Superseded");

  // --- 7. The reviewer approves the corrected version ---
  await reviewerPage.reload();
  await reviewerPage.waitForSelector(".shell");
  await reviewerPage.locator(".nav-item", { hasText: "Review & Approval" }).click();
  const v2Row = reviewerPage.locator(".card", { hasText: "Pending Review (" }).locator("tr", { hasText: "E2E groceries, corrected" });
  await v2Row.getByRole("button", { name: "Approve" }).click();
  await reviewerPage.locator(".modal input").fill("Approved after revision.");
  await reviewerPage.getByRole("button", { name: "Confirm" }).click();
  await expect(reviewerPage.locator(".toast")).toContainText("Review recorded");

  // --- 8. The approved figure now reaches the dashboard, budget and reports ---
  await member.locator(".nav-item", { hasText: "Dashboard" }).click();
  await member.reload();
  await member.waitForSelector(".shell");
  await expect(member.locator(".card.stat", { hasText: "Total Expenses" }).locator(".value")).toHaveText("₱900.00");

  await member.locator(".nav-item", { hasText: "Budgets" }).click();
  await expect(member.locator(".card", { hasText: "Food" }).first()).toContainText("₱900.00");
  await expect(member.locator(".card", { hasText: "Food" }).first()).toContainText("₱2,100.00 remaining");

  await member.locator(".nav-item", { hasText: "Reports" }).click();
  await expect(member.locator(".card", { hasText: "Expenses by Category" })).toContainText("₱900.00");
  await expect(member.locator("tr", { hasText: "Food" })).toContainText("Within Budget");

  // --- 9. The session survives a refresh ---
  await member.reload();
  await expect(member.locator(".shell")).toBeVisible();
  await expect(member.locator(".side-foot")).toContainText("Ella Santos");

  // --- 10. The whole journey is in the audit trail ---
  const { admin } = accounts();
  const audit = await api("/api/audit-log", { token: admin.token });
  const mine = audit.data.filter((l) => l.user === "Ella Santos" || l.detail.includes("E2E"));
  expect(mine.some((l) => l.action === "Account Created")).toBe(true);
  expect(mine.some((l) => l.action === "Expense Submitted")).toBe(true);
  expect(mine.some((l) => l.action === "Transaction Resubmitted")).toBe(true);
  expect(audit.data.some((l) => l.action === "Transaction Needs Revision")).toBe(true);
  expect(audit.data.some((l) => l.action === "Transaction Approved")).toBe(true);

  await memberContext.close();
  await reviewerContext.close();
});
