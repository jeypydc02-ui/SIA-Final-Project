const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fintrack_stark";

async function connectDB() {
  await mongoose.connect(MONGO_URI);
  console.log("[db] connected to " + MONGO_URI);
}

module.exports = { connectDB, mongoose };
