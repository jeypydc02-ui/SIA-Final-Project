const { Schema, model } = require("mongoose");

// Field limits live on the schema so the API, the seed and any future client
// all obey the same rule. Without a cap, a 50,000-character bill name is
// accepted and then destroys every table it appears in.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Compared in UTC on purpose. Building the date from a local-time string and
// then reading it back through toISOString() shifts it by the timezone offset,
// which in UTC+8 rejects every valid date. Working in UTC throughout keeps the
// check about the calendar rather than about where the server is sitting.
function isRealDate(v) {
  if (typeof v !== "string" || !ISO_DATE.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Catches 2026-02-30 and 2026-13-01, which JavaScript would otherwise roll
  // over into a different, valid-looking date.
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const BillSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: [120, "Bill name cannot be longer than 120 characters."] },
  category: { type: String, required: true, trim: true, maxlength: [40, "Category cannot be longer than 40 characters."] },
  amount: { type: Number, required: true, min: [0.01, "Amount must be greater than zero."], max: [1e12, "That amount is unrealistically large."] },
  due: {
    type: String, required: true,
    validate: { validator: isRealDate, message: "Due date must be a real calendar date (YYYY-MM-DD)." },
  },
  paid: { type: Boolean, default: false },
  paidOn: { type: String, default: null },
  paidAmount: { type: Number, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
  // Date (YYYY-MM-DD) the reminder service last raised an alert for this bill.
  // Makes the scheduled sweep idempotent: restarting the worker, or running it
  // twice in a day, does not produce duplicate reminders.
  lastRemindedOn: { type: String, default: null },
});

module.exports = model("Bill", BillSchema);
