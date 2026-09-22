const { defineConfig } = require("@playwright/test");

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
    },
  },
});
