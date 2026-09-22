const path = require("path");
const fs = require("fs");
const express = require("express");
const { connectDB, mongoose } = require("./src/config/db");
const { securityHeaders } = require("./src/middleware/securityHeaders");

const authRoutes = require("./src/routes/auth");
const billRoutes = require("./src/routes/bills");
const transactionRoutes = require("./src/routes/transactions");
const budgetRoutes = require("./src/routes/budgets");
const notificationRoutes = require("./src/routes/notifications");
const auditLogRoutes = require("./src/routes/auditLog");
const userRoutes = require("./src/routes/users");
const commentRoutes = require("./src/routes/comments");

const PORT = process.env.PORT || 4000;

async function main() {
  await connectDB();

  const app = express();
  // Trust the Vite dev proxy / any reverse proxy so req.ip is the real client
  // address rather than the proxy's — the rate limiter keys on it.
  app.set("trust proxy", 1);
  // Do not advertise the framework and version to anyone scanning the host.
  app.disable("x-powered-by");
  app.use(securityHeaders);
  // A cap on body size: nothing this API accepts is anywhere near 100kb, and
  // an unbounded parser is a free denial-of-service.
  app.use(express.json({ limit: "100kb" }));

  // Unauthenticated liveness probe: used by the test runner to know the API is
  // up, and by the deployment evidence to show the service responding.
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      service: "fintrack-stark-api",
      db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
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

  // During development the React app runs separately via Vite (npm run dev
  // inside frontend/, http://localhost:5173, proxying /api here). This
  // server only serves the built frontend when a production build exists,
  // so `npm start` alone still gives a single-URL demo after `npm run build`.
  const distDir = path.join(__dirname, "..", "client", "dist");
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^(?!\/api).*/, (req, res) => {
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
      return res.status(400).json({ error: first ? first.message : "Some fields are invalid." });
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
  console.error("[server] failed to start:", err);
  process.exit(1);
});
