// Hardcoded system constants — reminder lead time, budget warning level, and
// session length. These were previously configurable through a System Settings
// admin screen; the screen was removed to keep the admin surface minimal.
const SETTINGS = {
  reminderLeadDays: 3,
  budgetWarningPercent: 80,
  sessionHours: 8,
};

module.exports = SETTINGS;
