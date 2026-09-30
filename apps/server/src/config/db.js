const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fintrack_stark";

// Mongoose waits 30 seconds before admitting it cannot reach the database, and
// then prints a stack trace. Five seconds and a sentence is far more useful:
// the usual cause is simply that the MongoDB service is not running, and
// nobody should spend half a minute staring at a silent terminal to find out.
const SERVER_SELECTION_TIMEOUT_MS = Number(process.env.MONGO_TIMEOUT_MS) || 5000;

// The address as it is safe to print: a hosted database's URI carries the
// password, and these lines end up in terminal scrollback and hosting logs.
function redact(uri) {
  return uri.replace(/\/\/([^:/@]+):([^@]*)@/, "//$1:***@");
}

const isLocal = (uri) => /^mongodb:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(uri);

// What to try next depends on where the database is.
function hint(uri, err) {
  if (isLocal(uri)) {
    return [
      "Most likely the database is not running. On Windows:",
      "  net start MongoDB           (run the terminal as Administrator)",
      "Or check the service in services.msc, then start the app again.",
      "A different address can be given with MONGO_URI.",
    ];
  }
  const msg = String(err && err.message);
  if (/querySrv|ENOTFOUND|ESERVFAIL|ECONNREFUSED.*_mongodb\._tcp/.test(msg)) {
    return [
      "The mongodb+srv:// address could not be looked up. Some networks and DNS",
      "servers refuse the lookup it needs. Either switch this computer's DNS to",
      "8.8.8.8 or 1.1.1.1, or use the standard connection string instead: in Atlas,",
      "Connect -> Drivers -> turn on \"Legacy URI String\", and put it in MONGO_URI.",
    ];
  }
  if (/auth|Authentication/i.test(msg)) {
    return [
      "The database rejected the username or password in MONGO_URI. Check the",
      "database user in Atlas (Database & Network Access -> Database Users).",
    ];
  }
  return [
    "Check that MONGO_URI is correct, and that the Atlas IP Access List allows",
    "this machine (0.0.0.0/0 for hosting platforms without a fixed IP).",
  ];
}

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
    });
  } catch (err) {
    console.error("\n[db] Could not connect to MongoDB at " + redact(MONGO_URI));
    console.error("[db] " + err.message + "\n");
    for (const line of hint(MONGO_URI, err)) console.error("     " + line);
    console.error("");
    const wrapped = new Error("MongoDB is unreachable at " + redact(MONGO_URI));
    wrapped.handled = true;
    throw wrapped;
  }
  console.log("[db] connected to " + redact(MONGO_URI));
}

module.exports = { connectDB, mongoose };
