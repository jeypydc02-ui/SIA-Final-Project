const { Schema, model } = require("mongoose");

const BudgetSchema = new Schema({
  // A budget belongs to one person. Category is unique per user, not globally,
  // so two people can each have their own "Food" limit.
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  category: { type: String, required: true, trim: true, maxlength: [40, "Category cannot be longer than 40 characters."] },
  limit: { type: Number, required: true, min: [1, "Limit must be at least 1."], max: [1e12, "That limit is unrealistically large."] },
  // The last change to the limit, so the screen can say "reduced by ₱100
  // (was ₱500)". Empty until the limit is changed for the first time.
  previousLimit: { type: Number, default: null },
  limitChangedAt: { type: Date, default: null },
});

BudgetSchema.index({ user: 1, category: 1 }, { unique: true });

module.exports = model("Budget", BudgetSchema);
