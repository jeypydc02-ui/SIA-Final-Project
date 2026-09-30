// Calendar dates are Philippine dates, matching the server (utils/dates.js).
// toISOString() gives the UTC date, which is still yesterday until 8 AM in
// Manila, so bills read "Due Today" a day late and new entries were dated
// wrong. The zone is fixed rather than taken from the device, so a phone set to
// another timezone still agrees with the server about what "today" is.
export const APP_TIMEZONE = "Asia/Manila";
const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });

export const todayISO = () => dayFormatter.format(new Date());
// The Philippine calendar date a timestamp fell on.
export const phDateOf = (value) => dayFormatter.format(new Date(value));
export const thisMonthISO = () => todayISO().slice(0, 7);

function isoToUTC(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
export const addDays = (n) => new Date(isoToUTC(todayISO()) + n * 86400000).toISOString().slice(0, 10);
export const peso = (n) => "₱" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Accepts either a calendar date (YYYY-MM-DD) or a full timestamp. A timestamp
// is shown as the Philippine date it fell on, not the UTC date in its prefix.
export const fmtDate = (value) => {
  const opts = { month: "short", day: "numeric", year: "numeric" };
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return new Date(isoToUTC(value)).toLocaleDateString("en-PH", { ...opts, timeZone: "UTC" });
  }
  return new Date(value).toLocaleDateString("en-PH", { ...opts, timeZone: APP_TIMEZONE });
};

export function billStatus(due, paid) {
  if (paid) return "Paid";
  const diff = Math.round((isoToUTC(due) - isoToUTC(todayISO())) / 86400000);
  if (diff < 0) return "Overdue";
  if (diff === 0) return "Due Today";
  return "Upcoming";
}
export function statusBadgeClass(s) {
  return { Paid: "ok", "Due Today": "warn", Overdue: "danger", Upcoming: "neutral" }[s] || "neutral";
}
export function txStatusBadge(s) {
  return { "Approved": "ok", "Pending Review": "warn", "Rejected": "danger", "Needs Revision": "danger", "Superseded": "neutral" }[s] || "neutral";
}
