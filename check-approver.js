
const bcrypt = require("bcryptjs");
const { connectDB, mongoose } = require("./apps/server/src/config/db");
const User = require("./apps/server/src/models/User");

async function main() {
  try {
    await connectDB();

    const email = "approver@fintrackstark.app";
    const existing = await User.findOne({ email });

    if (existing) {
      console.log("Account already exists:", existing.email);
      console.log("Role:", existing.role);
      return;
    }

    const user = await User.create({
      firstName: "Demo",
      lastName: "Approver",
      name: "Demo Approver",
      email,
      passwordHash: await bcrypt.hash("approver123", 10),
      role: "Approver",
      active: true,
    });

    console.log("Created:", user.email);
    console.log("Role:", user.role);
    console.log("Password: approver123");
  } catch (error) {
    console.error("Error:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
    