const path = require("path");
const fs = require("fs");
const express = require("express");
const compression = require("compression");
const { connectDB, mongoose } = require("./src/config/db");
const { securityHeaders } = require("./src/middleware/securityHeaders");
const { startInProcessReminders, reminderCheck, reminderStatus } = require("./src/services/reminderScheduler");

const authRoutes = require("./src/routes/auth");
const billRoutes = require("./src/routes/bills");
const transactionRoutes = require("./src/routes/transactions");
const budgetRoutes = require("./src/routes/budgets");
const notificationRoutes = require("./src/routes/notifications");
const auditLogRoutes = require("./src/routes/auditLog");
const userRoutes = require("./src/routes/users");
const commentRoutes = require("./src/routes/comments");
const eventRoutes = require("./src/routes/events");
const activityRoutes = require("./src/routes/activity");
const devRoutes = require("./src/routes/dev");
const { failureLog } = require("./src/middleware/failureLog");
const { wrap } = require("./src/middleware/asyncHandler");
const { requireAuth } = require("./src/middleware/auth");
const syncController = wrap(require("./src/controllers/syncController"));
const { runMigrations } = require("./src/config/migrations");

const PORT = process.env.PORT || 4000;

async function main() {
  await connectDB();
  await runMigrations();

  const app = express();
  // req.ip is what the rate limiter counts. Trusting X-Forwarded-For when no
  // proxy sits in front lets any client invent a new address per request and
  // walk straight past the limit, so it is off unless the deployment says a
  // reverse proxy is there: TRUST_PROXY=1 for one hop (nginx, Render, Railway,
  // Heroku and similar), or any value Express accepts for "trust proxy".
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  }
  // Do not advertise the framework and version to anyone scanning the host.
  app.disable("x-powered-by");
  app.use(securityHeaders);
  // List responses are repetitive JSON and shrink roughly tenfold, which is
  // the difference that matters on a slow mobile connection.
  // The live-update stream is excluded: compression buffers output, and an
  // event stream must reach the browser the moment each message is written.
  app.use(compression({ filter: (req, res) => req.path !== "/api/events" && compression.filter(req, res) }));
  // A cap on body size: nothing this API accepts is anywhere near 100kb, and
  // an unbounded parser is a free denial-of-service.
  app.use(express.json({ limit: "100kb" }));
  // Refused or failed changes are written to the audit log as Failed lines.
  app.use("/api", failureLog);

  // Daily bill reminders from inside the API (see reminderScheduler.js), for
  // hosting with no separate worker. REMINDERS_IN_API=0 turns it off.
  const remindersInApi = process.env.REMINDERS_IN_API !== "0";
  if (remindersInApi) {
    startInProcessReminders();
    app.use(reminderCheck);
  }

  // Unauthenticated liveness probe: used by the test runner to know the API is
  // up, and by the deployment evidence to show the service responding.
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      service: "fintrack-stark-api",
      db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      // The PH date of the last reminder sweep run by this API process.
      reminders: remindersInApi ? reminderStatus() : "off",
      time: new Date().toISOString(),
    });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/bills", billRoutes);
  app.use("/api/transactions", transactionRoutes);
  app.use("/api/budgets", budgetRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/audit-log", auditLogRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/comments", commentRoutes);
  app.use("/api/events", eventRoutes);
  app.use("/api/activity", activityRoutes);
  // Development-only outbox for the automated tests (DEV_MAILBOX=1, never in
  // production); the route refuses otherwise.
  app.use("/api/dev", devRoutes);
  app.get("/api/sync", requireAuth, syncController.sync);

  // An unknown API address answers in JSON like every other API error, rather
  // than with Express's HTML page or, worse, the SPA's index.html.
  app.use("/api", (req, res) => {
    res.status(404).json({ error: "No such API endpoint." });
  });

  // During development the React app runs separately via Vite (npm run dev
  // inside frontend/, http://localhost:5173, proxying /api here). This
  // server only serves the built frontend when a production build exists,
  // so `npm start` alone still gives a single-URL demo after `npm run build`.
  const distDir = path.join(__dirname, "..", "client", "dist");
  if (fs.existsSync(distDir)) {
    // Built JS/CSS carry a content hash in their names, so browsers may keep
    // them for a year. Everything else (the page, sw.js, the manifest) must
    // be checked on every load, or an installed app would keep running an
    // old version after a deploy.
    app.use(express.static(distDir, {
      setHeaders(res, filePath) {
        res.setHeader("Cache-Control", /[\\/]assets[\\/]/.test(filePath)
          ? "public, max-age=31536000, immutable"
          : "no-cache");
      },
    }));
    app.get(/^(?!\/api).*/, (req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(distDir, "index.html"));
    });
  } else {
    app.get("/", (req, res) => {
      res.type("text/plain").send(
        "FinTrack Stark API is running.\n" +
        "Frontend dev server: run `npm run dev` inside frontend/ and open http://localhost:5173\n" +
        "(No production build found at frontend/dist yet — run `npm run build` inside frontend/ to enable single-server mode.)"
      );
    });
  }

  // Central error handler: keep failures as clean JSON, never leak stack traces.
  // Bad input reaching the database layer is the caller's fault, not a server
  // fault, so it comes back as 4xx with a usable message (spec section 7.5).
  app.use((err, req, res, next) => {
    console.error(`[error] ${req.method} ${req.originalUrl}:`, err.message);

    if (err.name === "CastError") {
      return res.status(400).json({ error: "That record id is not valid." });
    }
    if (err.name === "ValidationError") {
      const first = Object.values(err.errors || {})[0];
      // A value of the wrong type (an object where text belongs) carries the
      // database's own wording, which means nothing to the person reading it.
      if (!first || first.name === "CastError") {
        return res.status(400).json({ error: first ? `The ${first.path} field has an invalid value.` : "Some fields are invalid." });
      }
      return res.status(400).json({ error: first.message });
    }
    if (err.code === 11000) {
      return res.status(409).json({ error: "That record already exists." });
    }
    if (err.type === "entity.too.large") {
      return res.status(413).json({ error: "That request is too large." });
    }
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "The request body is not valid JSON." });
    }

    res.status(500).json({ error: "Unexpected server error." });
  });

  app.listen(PORT, () => {
    console.log(`[server] FinTrack Stark running at http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  // `handled` means the cause was already reported in readable form.
  if (!err.handled) console.error("[server] failed to start:", err);
  process.exit(1);
});
