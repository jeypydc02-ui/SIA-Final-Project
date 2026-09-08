import { fmtDate, billStatus, statusBadgeClass } from "../utils.js";

export default function VersionHistory({ bills }) {
  const history = bills.flatMap(b => {
    const events = [{ label: "Created", status: "Upcoming" }];
    if (b.paid) events.push({ label: "Marked Paid on " + fmtDate(b.paidOn), status: "Paid" });
    else events.push({ label: "Current status", status: billStatus(b.due, b.paid) });
    return events.map((e, i) => ({ ...e, bill: b.name, id: b._id + "-" + i }));
  });
  return (
    <div>
      <div className="pagehead"><div><h2>Bill Status History</h2><div className="desc">Version/status trail per bill — Upcoming → Due Today → Overdue → Paid.</div></div></div>
      <div className="card">
        <table>
          <thead><tr><th>Bill</th><th>Event</th><th>Status</th></tr></thead>
          <tbody>
            {history.map(h => (
              <tr key={h.id}><td>{h.bill}</td><td>{h.label}</td><td><span className={"badge " + statusBadgeClass(h.status)}>{h.status}</span></td></tr>
            ))}
            {history.length === 0 && <tr><td colSpan="3"><div className="empty">No bill history yet.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
