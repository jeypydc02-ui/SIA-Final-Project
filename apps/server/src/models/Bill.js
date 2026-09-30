const { Schema, model } = require("mongoose");
const { isRealDate } = require("../utils/dates");

// Field limits live on the schema so the API, the seed and any future client
// all obey the same rule. Without a cap, a 50,000-character bill name is
// accepted and then destroys every table it appears in.
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
