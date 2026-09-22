const { Schema, model } = require("mongoose");

const BillSchema = new Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  due: { type: String, required: true },
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
