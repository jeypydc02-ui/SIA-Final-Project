const { Schema, model } = require("mongoose");

const BillSchema = new Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  due: { type: String, required: true },
  paid: { type: Boolean, default: false },
  paidOn: { type: String, default: null },
  paidAmount: { type: Number, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
});

module.exports = model("Bill", BillSchema);
