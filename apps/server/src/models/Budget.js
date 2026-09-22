const { Schema, model } = require("mongoose");

const BudgetSchema = new Schema({
  category: { type: String, required: true, unique: true },
  limit: { type: Number, required: true },
});

module.exports = model("Budget", BudgetSchema);
