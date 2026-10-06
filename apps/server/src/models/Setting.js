const { Schema, model } = require("mongoose");

// System settings the Admin manages (spec §12: "Admin — manages users, roles,
// settings, and audit logs"). One document, id "system". Both the API and the
// separate reminder worker read it from the shared database, so a change
// reaches every process without a redeploy.
const SettingSchema = new Schema({
  _id: { type: String, default: "system" },
  // How many days before a due date the reminder service starts alerting.
  reminderLeadDays: { type: Number, min: 1, max: 14 },
  // The percentage of a monthly budget at which a warning is sent (the second
  // warning, at 100%, is fixed: going over is always worth knowing).
  budgetWarningPercent: { type: Number, min: 50, max: 95 },
  // How long a sign-in lasts before the password is asked for again.
  sessionHours: { type: Number, min: 1, max: 24 },
  updatedBy: { type: String, default: "" },
  updatedAt: { type: Date, default: null },
}, { versionKey: false });

module.exports = model("Setting", SettingSchema);
