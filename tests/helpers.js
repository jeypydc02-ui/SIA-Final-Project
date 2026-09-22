const fs = require("fs");
const path = require("path");

const BASE = "http://localhost:4000";
const AUTH_FILE = path.join(__dirname, ".auth.json");

function accounts() {
  return JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));
}

// Calls the API directly. Used to arrange state for a UI test, and as the
// subject of the access-control tests.
async function api(pathname, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  const res = await fetch(BASE + pathname, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  return { status: res.status, data };
}

// Opens the app already signed in, by planting the token the way a real
// session would have left it. This exercises the session-restore path rather
// than replaying the login form for every test.
async function signIn(page, role = "user") {
  const { token } = accounts()[role];
  await page.addInitScript((t) => {
    window.sessionStorage.setItem("fts_token", t);
  }, token);
  await page.goto("/");
  await page.waitForSelector(".shell", { timeout: 10000 });
  return token;
}

async function gotoScreen(page, label) {
  await page.locator(".nav-item", { hasText: label }).first().click();
}

// Registers a throwaway account so a test can prove one user cannot see
// another user's records.
async function registerUser(prefix = "test") {
  const email = `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}@example.test`;
  const res = await api("/api/auth/register", {
    method: "POST",
    body: { firstName: "Test", lastName: "Account", email, password: "testpass123" },
  });
  if (res.status !== 201) throw new Error("registerUser failed: " + JSON.stringify(res.data));
  return { email, password: "testpass123", token: res.data.token, user: res.data.user };
}

module.exports = { BASE, api, accounts, signIn, gotoScreen, registerUser };
