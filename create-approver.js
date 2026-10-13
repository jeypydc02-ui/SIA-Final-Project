
const bcrypt = require("bcryptjs");
const { connectDB, mongoose } = require("./apps/server/src/config/db");
const User = require("./apps/server/src/models/User");

async function main() {
  try {
    await connectDB();

    const email = "approver@fintrackstark.app";
    const existing = await User.findOne({ email });

    if (existing) {
      console.log("Approver account already exists. No changes made.");
      return;
    }

    await User.create({
      firstName: "Demo",
      lastName: "Approver",
      name: "Demo Approver",
      email,
      passwordHash: await bcrypt.hash("approver123", 10),
      role: "Approver",
      active: true,
    });

    console.log("Approver account created successfully.");
    console.log("Email:", email);
    console.log("Password: approver123");
    console.log("Role: Approver");
  } catch (error) {
    console.error("Failed to create Approver:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
