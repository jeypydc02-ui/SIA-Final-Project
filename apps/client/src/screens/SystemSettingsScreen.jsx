import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { fmtDate } from "../lib/utils.js";

// System settings (spec §12: the Admin "manages users, roles, settings, and
// audit logs"). Values are stored in the database, read by the API and by the
// separate reminder service, and every change is written to the audit log.
const FIELDS = [
  { key: "reminderLeadDays", label: "Bill reminder lead time", suffix: "days before the due date",
    help: "The reminder service starts alerting a bill's owner this many days before it is due (and again on the day, and when overdue)." },
  { key: "budgetWarningPercent", label: "Budget warning level", suffix: "% of a monthly budget",
    help: "Users are warned once when their spending in a category reaches this share of its budget. Going over 100% always warns." },
  { key: "sessionHours", label: "Session length", suffix: "hours",
    help: "How long a sign-in lasts before the password is asked for again. Applies to new sign-ins; sessions already open keep their time." },
];

export default function SystemSettingsScreen({ onSaved }) {
  const [data, setData] = useState(null); // { settings, defaults, limits }
  const [form, setForm] = useState({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const d = await api("/api/settings");
      setData(d);
      setForm(Object.fromEntries(FIELDS.map((f) => [f.key, String(d.settings[f.key])])));
    } catch (e) {
      setErr(e.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    const body = {};
    for (const f of FIELDS) {
      const { min, max } = data.limits[f.key];
      const n = Number(form[f.key]);
      if (!Number.isInteger(n) || n < min || n > max) {
        setErr(`${f.label} must be a whole number from ${min} to ${max}.`);
        return;
      }
      body[f.key] = n;
    }
    setErr("");
    setBusy(true);
    try {
      const d = await api("/api/settings", { method: "PUT", body });
      setData((prev) => ({ ...prev, settings: d.settings }));
      onSaved && onSaved("System settings saved.");
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  const changed = data && FIELDS.some((f) => String(data.settings[f.key]) !== form[f.key]);

  return (
    <div>
      <div className="pagehead">
        <div>
          <h2>System Settings</h2>
          <div className="desc">Settings that apply to every account. Changes take effect at once, including in the separate reminder service, and are recorded in the audit log.</div>
        </div>
      </div>
      {!data ? (
        <div className="card">{err ? <div className="form-msg error">{err}</div> : <div className="empty">Loading settings…</div>}</div>
      ) : (
        <form className="card settings-form" onSubmit={save}>
          {FIELDS.map((f) => {
            const { min, max } = data.limits[f.key];
            return (
              <div key={f.key} className="setting-row">
                <div className="setting-text">
                  <label className="setting-label" htmlFor={"set-" + f.key}>{f.label}</label>
                  <div className="hint">{f.help}</div>
                  <div className="hint">Allowed: {min}–{max}. Default: {data.defaults[f.key]}.</div>
                </div>
                <div className="setting-input">
                  <input id={"set-" + f.key} type="number" inputMode="numeric" min={min} max={max} step="1"
                    value={form[f.key]} onChange={(e) => { setForm({ ...form, [f.key]: e.target.value }); setErr(""); }} />
                  <span className="setting-suffix">{f.suffix}</span>
                </div>
              </div>
            );
          })}
          {err && <div className="form-msg error">{err}</div>}
          <div className="settings-foot">
            <span className="row-sub">
              {data.settings.updatedAt ? `Last changed by ${data.settings.updatedBy} on ${fmtDate(data.settings.updatedAt)}.` : "Using the default values."}
            </span>
            <button className="btn" type="submit" disabled={busy || !changed}>{busy ? "Saving…" : "Save Settings"}</button>
          </div>
        </form>
      )}
    </div>
  );
}
