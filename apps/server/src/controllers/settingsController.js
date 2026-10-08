const Setting = require("../models/Setting");
const { DEFAULTS, LIMITS, getSettings, clearSettingsCache } = require("../services/settings");
const { logAction } = require("../services/audit");
const { publishToAdmins } = require("../services/events");

// GET /api/settings — the current system settings, their defaults and limits.
async function get(req, res) {
  const settings = await getSettings();
  res.json({ settings, defaults: DEFAULTS, limits: LIMITS });
}

// PUT /api/settings — change one or more settings. Every value is a whole
// number within its limits; anything else is refused and nothing is saved.
async function update(req, res) {
  const body = req.body || {};
  const changes = {};
  for (const [key, limit] of Object.entries(LIMITS)) {
    if (body[key] === undefined) continue;
    const v = body[key];
    if (typeof v !== "number" || !Number.isInteger(v) || v < limit.min || v > limit.max) {
      return res.status(400).json({ error: `${limit.label} must be a whole number from ${limit.min} to ${limit.max} ${limit.unit}.` });
    }
    changes[key] = v;
  }
  if (!Object.keys(changes).length) {
    return res.status(400).json({ error: "Nothing to change." });
  }

  const before = await getSettings();
  const changed = Object.keys(changes).filter((k) => before[k] !== changes[k]);
  await Setting.findByIdAndUpdate(
    "system",
    { $set: { ...changes, updatedBy: req.user.name, updatedAt: new Date() } },
    { upsert: true, new: true, runValidators: true }
  );
  clearSettingsCache();

  if (changed.length) {
    const detail = changed.map((k) => `${LIMITS[k].label}: ${before[k]} → ${changes[k]} ${LIMITS[k].unit}`).join("; ");
    await logAction(req.user, "Settings Changed", detail + ".", { ref: "system" });
    publishToAdmins("settings");
  }
  res.json({ settings: await getSettings() });
}

module.exports = { get, update };
