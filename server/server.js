const path = require("path");
const fs = require("fs");
const express = require("express");
const { connectDB } = require("./db");

const authRoutes = require("./routes/auth");
const billRoutes = require("./routes/bills");
const transactionRoutes = require("./routes/transactions");
const budgetRoutes = require("./routes/budgets");
const notificationRoutes = require("./routes/notifications");
const auditLogRoutes = require("./routes/auditLog");
const userRoutes = require("./routes/users");
const commentRoutes = require("./routes/comments");

const PORT = process.env.PORT || 4000;

async function main() {
  await connectDB();

  const app = express();
  app.use(express.json());

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
  const distDir = path.join(__dirname, "..", "frontend", "dist");
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
  app.use((err, req, res, next) => {
    console.error(err);
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
