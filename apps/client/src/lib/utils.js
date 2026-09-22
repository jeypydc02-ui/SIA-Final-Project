export const todayISO = () => new Date().toISOString().slice(0, 10);
export const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export const peso = (n) => "₱" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtDate = (iso) => new Date(String(iso).slice(0, 10) + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

export function billStatus(due, paid) {
  if (paid) return "Paid";
  const d = new Date(due + "T00:00:00"), t = new Date(todayISO() + "T00:00:00");
  const diff = Math.round((d - t) / 86400000);
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
