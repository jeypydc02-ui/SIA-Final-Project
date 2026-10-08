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
async function signIn(page, role = "user", path = "/dashboard") {
  const { token } = accounts()[role];
  await page.addInitScript((t) => {
    window.sessionStorage.setItem("fts_token", t);
  }, token);
  // Land on the destination directly. Going to "/" and letting the router
  // redirect leaves a window in which the sidebar is rendered but about to be
  // replaced, so a click dispatched in that moment is lost.
  await page.goto(path);
  await page.waitForSelector(".shell", { timeout: 10000 });
  await page.waitForURL(new RegExp(path.replace(/\//g, "\\/") + "$"), { timeout: 10000 });
  return token;
}

// Clicks a sidebar entry and waits for the address to actually change, so a
// following assertion cannot run against the screen we were leaving.
async function gotoScreen(page, label) {
  const link = page.locator(".nav-item", { hasText: label }).first();
  const target = await link.getAttribute("href");
  await link.click();
  if (target) await page.waitForURL(new RegExp(target.replace(/\//g, "\\/") + "$"), { timeout: 10000 });
  return target;
}

// The last e-mail the server "sent" to an address. The test server runs with
// DEV_MAILBOX=1, so mail is kept in memory instead of being delivered.
async function mailTo(email) {
  const res = await api("/api/dev/outbox?to=" + encodeURIComponent(email));
  if (res.status !== 200) throw new Error("no e-mail for " + email);
  return res.data;
}
const codeIn = (mail) => mail.text.match(/\b(\d{6})\b/)[1];
const linkIn = (mail) => mail.text.match(/https?:\/\/\S+\/reset-password\?token=[a-f0-9]+/)[0];

const uniqueEmail = (prefix = "test") => `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}@example.test`;

// Registers a throwaway account (details, then the e-mailed code) so a test
// can prove one user cannot see another user's records.
async function registerUser(prefix = "test", password = "testpass123") {
  const email = uniqueEmail(prefix);
  const start = await api("/api/auth/register", {
    method: "POST",
    body: { firstName: "Test", lastName: "Account", email, password },
  });
  if (start.status !== 200) throw new Error("registerUser failed: " + JSON.stringify(start.data));
  const code = codeIn(await mailTo(email));
  const res = await api("/api/auth/register/verify", { method: "POST", body: { email, code } });
  if (res.status !== 201) throw new Error("registerUser verify failed: " + JSON.stringify(res.data));
  return { email, password, token: res.data.token, user: res.data.user };
}

module.exports = { BASE, api, accounts, signIn, gotoScreen, registerUser, mailTo, codeIn, linkIn, uniqueEmail };
