const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const AUTH_FILE = path.join(__dirname, ".auth.json");
const BASE = "http://localhost:4000";

// Runs once before the suite:
//   1. resets the database to the known demo fixture, so every run starts from
//      the same data and results are reproducible (spec section 9.1);
//   2. signs in as each seeded role once and caches the tokens, so the tests
//      themselves never have to log in through the form except where signing
//      in is the thing under test.
module.exports = async () => {
  execFileSync("node", [path.join(__dirname, "..", "scripts", "seed.js"), "--reset"], {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
  });

  // The webServer is already up by the time globalSetup runs.
  const accounts = {
    user: { email: "jp@fintrackstark.app", password: "demo123" },
    reviewer: { email: "reviewer@fintrackstark.app", password: "reviewer123" },
    admin: { email: "admin@fintrackstark.app", password: "admin123" },
  };

  const tokens = {};
  for (const [role, creds] of Object.entries(accounts)) {
    const res = await fetch(BASE + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creds),
    });
    if (!res.ok) throw new Error(`global-setup: could not sign in as ${role} (${res.status})`);
    const data = await res.json();
    tokens[role] = { token: data.token, user: data.user, ...creds };
  }

  fs.writeFileSync(AUTH_FILE, JSON.stringify(tokens, null, 2));
};
