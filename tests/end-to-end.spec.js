const { test, expect } = require("@playwright/test");
const { api, accounts, registerUser, mailTo, codeIn, linkIn, uniqueEmail } = require("./helpers");

// End-to-end scenarios (spec section 16: minimum 1).
//
// One continuous journey through the browser, no API shortcuts for the steps
// a person would perform: register (with the e-mailed code) -> set a budget
// -> record an expense (it counts at once) -> correct it, which keeps the
// first figure as v1 -> the corrected figure reaches the dashboard, budget
// and reports -> the person's own steps are on their My Activity page, and
// only the sign-up reaches the Admin's security log.

test("E2E-01 a new account records, corrects and reports an expense", async ({ browser }) => {
  const email = uniqueEmail("e2e");
  const password = "e2epass123";

  const memberContext = await browser.newContext();
  const member = await memberContext.newPage();

  // --- 1. Register from the landing page, confirming the e-mail address ---
  await member.goto("/");
  await member.getByRole("button", { name: "Get Started" }).first().click();

  await member.locator(".auth-form input").nth(0).fill("Ella");
  await member.locator(".auth-form input").nth(1).fill("Santos");
  await member.locator(".auth-form input").nth(2).fill(email);
  await member.locator('.auth-form input[type=password]').nth(0).fill(password);
  await member.locator('.auth-form input[type=password]').nth(1).fill(password);
  await member.getByRole("button", { name: "Create Account" }).click();

  await expect(member.locator(".auth-title")).toHaveText("Check your e-mail");
  await expect(member.locator(".auth-subtitle")).toContainText(email);
  // No account exists until the code is entered.
  expect((await api("/api/auth/login", { method: "POST", body: { email, password } })).status).toBe(401);

  await member.locator("#otp").fill(codeIn(await mailTo(email)));
  await member.getByRole("button", { name: "Verify and Create Account" }).click();

  await expect(member.locator(".shell")).toBeVisible();
  await expect(member.locator(".side-foot")).toContainText("Ella Santos");
  // A brand-new account is a plain User.
  await expect(member.locator(".side-user-role")).toHaveText("User");

  // --- 2. A new account starts empty, and can set its own budget ---
  await member.locator(".nav-item", { hasText: "Budgets" }).click();
  await expect(member.getByRole("button", { name: "+ Add Budget" })).toBeVisible();
  await expect(member.locator(".empty", { hasText: "No budgets yet" })).toBeVisible();

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

  // --- 8. The journey is on the person's own My Activity page ---
  await member.locator(".nav-item", { hasText: "My Activity" }).click();
  const feed = member.locator(".inbox");
  await expect(feed).toContainText("Budget Created");
  await expect(feed).toContainText("Expense Recorded");
  await expect(feed).toContainText("v2 replaces v1");

  // --- 9. The Admin's log has the sign-up, and none of the money ---
  const { admin } = accounts();
  const audit = await api("/api/audit-log", { token: admin.token });
  const theirs = audit.data.filter((l) => l.user === "Ella Santos");
  expect(theirs.some((l) => l.action === "Account Created")).toBe(true);
  expect(theirs.some((l) => /Budget|Expense|Transaction/.test(l.action))).toBe(false);

  await memberContext.close();
});

// A forgotten password, start to finish, on two devices: one is still signed
// in; on the other the person asks for a reset, opens the e-mailed link and
// chooses a new password. The first device is asked to sign in again at once,
// the old password stops working, and the link cannot be used twice.
test("E2E-02 a forgotten password is reset from the e-mailed link", async ({ browser }) => {
  const person = await registerUser("reset", "oldpass123");

  const phoneCtx = await browser.newContext();
  const phone = await phoneCtx.newPage();
  await phone.addInitScript((t) => window.sessionStorage.setItem("fts_token", t), person.token);
  await phone.goto("/dashboard");
  await expect(phone.locator(".shell")).toBeVisible();

  const laptopCtx = await browser.newContext();
  const laptop = await laptopCtx.newPage();
  await laptop.goto("/login");
  await laptop.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(laptop).toHaveURL(/\/forgot-password$/);
  await laptop.locator(".auth-form input[type=email]").fill(person.email);
  await laptop.getByRole("button", { name: "Send Reset Link" }).click();
  await expect(laptop.locator(".auth-note").first()).toContainText("a link to set a new password is on its way");

  // The link from the e-mail, opened in the browser.
  const link = linkIn(await mailTo(person.email));
  await laptop.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await laptop.locator(".auth-form input[type=password]").nth(0).fill("newpass456");
  await laptop.locator(".auth-form input[type=password]").nth(1).fill("newpass456");
  await laptop.getByRole("button", { name: "Set New Password" }).click();
  await expect(laptop.locator(".auth-title")).toHaveText("Password changed");

  // The device that was still signed in asks for the password straight away.
  await expect(phone.locator("#reauth-title")).toBeVisible();

  // Only the new password works now, and the link is spent.
  const login = (password) => api("/api/auth/login", { method: "POST", body: { email: person.email, password } });
  expect((await login("oldpass123")).status).toBe(401);
  expect((await login("newpass456")).status).toBe(200);
  const token = new URL(link).searchParams.get("token");
  const again = await api("/api/auth/reset", { method: "POST", body: { token, password: "another789" } });
  expect(again.status).toBe(400);

  // Signing in through the form with the new password.
  await laptop.getByRole("button", { name: "Sign In" }).click();
  await laptop.locator(".auth-form input[type=email]").fill(person.email);
  await laptop.locator(".auth-form input[type=password]").fill("newpass456");
  await laptop.locator(".auth-form button[type=submit]").click();
  await expect(laptop.locator(".shell")).toBeVisible();

  await phoneCtx.close();
  await laptopCtx.close();
});
