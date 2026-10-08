const { defineConfig } = require("@playwright/test");

// The suite wipes and reseeds its database on every run, so it must never be
// pointed at real data. It always uses its own database, and anything spawned
// from here (the API, the seed, the reminder worker) inherits that address.
process.env.MONGO_URI = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/fintrack_stark_test";

// Drives the Chrome already installed on the machine rather than downloading a
// bundled browser — the lab network times out on that download, and testing
// against the browser the demo will actually run in is closer to reality.
module.exports = defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup.js",
  // One worker: the suite shares a single MongoDB instance, so tests that
  // create and review entries must not interleave.
  workers: 1,
  fullyParallel: false,
  timeout: 30000,
  expect: { timeout: 7000 },
  reporter: [["list"], ["html", { outputFolder: "tests/report", open: "never" }]],
  use: {
    baseURL: "http://localhost:4000",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    // The app's service worker would cache pages between tests; each test
    // must see the server's real responses. The PWA test opts back in.
    serviceWorkers: "block",
  },
  projects: [
    { name: "chrome", use: { channel: "chrome", viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: "node apps/server/server.js",
    url: "http://localhost:4000/api/health",
    reuseExistingServer: false,
    timeout: 30000,
    env: {
      // The suite signs in far more often than a person would.
      RATE_LIMIT_LOGIN_MAX: "200",
      RATE_LIMIT_REGISTER_MAX: "200",
      RATE_LIMIT_MAIL_MAX: "200",
      // Sign-up codes and reset links are kept in memory and read back
      // through /api/dev/outbox instead of being e-mailed.
      DEV_MAILBOX: "1",
      GMAIL_USER: "",
      GMAIL_APP_PASSWORD: "",
      BREVO_API_KEY: "",
      APP_URL: "",
    },
  },
});
