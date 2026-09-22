const { Schema, model } = require("mongoose");

const BudgetSchema = new Schema({
  // A budget belongs to one person. Category is unique per user, not globally,
  // so two people can each have their own "Food" limit.
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  category: { type: String, required: true, trim: true, maxlength: [40, "Category cannot be longer than 40 characters."] },
  limit: { type: Number, required: true, min: [1, "Limit must be at least 1."], max: [1e12, "That limit is unrealistically large."] },
});

BudgetSchema.index({ user: 1, category: 1 }, { unique: true });

module.exports = model("Budget", BudgetSchema);
