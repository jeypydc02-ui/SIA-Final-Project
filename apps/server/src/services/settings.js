const Setting = require("../models/Setting");

// Defaults apply until an Admin changes a value. REMINDER_LEAD_DAYS still
// works as the default for deployments that set it before settings existed.
const DEFAULTS = {
  reminderLeadDays: Number(process.env.REMINDER_LEAD_DAYS) || 3,
  budgetWarningPercent: 80,
  sessionHours: 8,
};

// What each setting accepts. Kept here, next to the defaults, so the API's
// validation and the screen's hints come from one place.
const LIMITS = {
  reminderLeadDays: { min: 1, max: 14, label: "Reminder lead time", unit: "days" },
  budgetWarningPercent: { min: 50, max: 95, label: "Budget warning level", unit: "%" },
  sessionHours: { min: 1, max: 24, label: "Session length", unit: "hours" },
};

// Read on every reminder sweep, budget check and sign-in. A short cache keeps
// that to one database read every few seconds; a change made through the API
// clears it at once, and other processes (the reminder worker) see it within
// the cache time.
const CACHE_MS = 5000;
let cached = null;
let cachedAt = 0;

async function getSettings() {
  if (cached && Date.now() - cachedAt < CACHE_MS) return cached;
  const doc = await Setting.findById("system").lean();
  cached = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    if (doc && typeof doc[key] === "number") cached[key] = doc[key];
  }
  cached.updatedBy = (doc && doc.updatedBy) || "";
  cached.updatedAt = (doc && doc.updatedAt) || null;
  cachedAt = Date.now();
  return cached;
}

function clearSettingsCache() {
  cached = null;
}

module.exports = { DEFAULTS, LIMITS, getSettings, clearSettingsCache };
