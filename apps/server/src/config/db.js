const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fintrack_stark";

// Mongoose waits 30 seconds before admitting it cannot reach the database, and
// then prints a stack trace. Five seconds and a sentence is far more useful:
// the usual cause is simply that the MongoDB service is not running, and
// nobody should spend half a minute staring at a silent terminal to find out.
const SERVER_SELECTION_TIMEOUT_MS = Number(process.env.MONGO_TIMEOUT_MS) || 5000;

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
    });
  } catch (err) {
    console.error("\n[db] Could not connect to MongoDB at " + MONGO_URI);
    console.error("[db] " + err.message + "\n");
    console.error("     Most likely the database is not running. On Windows:");
    console.error("       net start MongoDB           (run the terminal as Administrator)");
    console.error("     Or check the service in services.msc, then start the app again.");
    console.error("     A different address can be given with MONGO_URI.\n");
    const wrapped = new Error("MongoDB is unreachable at " + MONGO_URI);
    wrapped.handled = true;
    throw wrapped;
  }
  console.log("[db] connected to " + MONGO_URI);
}

module.exports = { connectDB, mongoose };
