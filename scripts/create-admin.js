const { connectDB, mongoose } = require("../apps/server/src/config/db");
const User = require("../apps/server/src/models/User");
const { hashPassword } = require("../apps/server/src/services/passwords");
const { passwordProblem } = require("../apps/server/src/utils/validate");
const { logAction } = require("../apps/server/src/services/audit");

// Creates the Admin on a fresh production database, where the demo seed (with
// its published passwords) must never run. The system has exactly one Admin;
// everyone else signs up through the app as a User, and roles are never
// changed from the app.
//
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a long passphrase' \
//   ADMIN_FIRST_NAME=Juan ADMIN_LAST_NAME='Dela Cruz' npm run create-admin
//
// Taken from the environment rather than the command line so the password does
// not end up in shell history.

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || "";
  const firstName = (process.env.ADMIN_FIRST_NAME || "System").trim();
  const lastName = (process.env.ADMIN_LAST_NAME || "Admin").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("set ADMIN_EMAIL to a valid email address");
  }
  const problem = passwordProblem(password, "ADMIN_PASSWORD");
  if (problem) throw new Error(problem);
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters for an Admin account");
  }

  await connectDB();
  try {
    const existingAdmin = await User.findOne({ role: "Admin" });
    if (existingAdmin) {
      throw new Error(`this system already has its Admin (${existingAdmin.email}); there is only one`);
    }
    if (await User.findOne({ email })) {
      throw new Error(`an account with ${email} already exists`);
    }
    const user = await User.create({
      firstName, lastName, name: `${firstName} ${lastName}`.trim(),
      email, passwordHash: await hashPassword(password), role: "Admin",
    });
    await logAction("System", "Account Created", `${user.name} (${email}) created as Admin from the command line.`);
    console.log(`[create-admin] Admin created: ${user.name} <${email}>`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  if (!err.handled) console.error("[create-admin] " + err.message);
  process.exit(1);
});
