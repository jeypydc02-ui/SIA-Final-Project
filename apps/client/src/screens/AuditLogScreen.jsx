import { useState } from "react";

// Audit trail and integration log (spec sections 8.4, 7.6 and 15), holding
// security and system events only: when, who, what, whether it worked, and
// the record it concerned. "Failed" shows only refused or failed actions,
// with the error message the person saw.
export default function AuditLogScreen({ auditLog }) {
  const [filter, setFilter] = useState("all");
  const status = (l) => l.status || "Success";
  const failedCount = auditLog.filter((l) => status(l) === "Failed").length;
  const rows = auditLog.filter((l) => filter === "all" || status(l) === filter);

  return (
    <div>
      <div className="pagehead"><div><h2>Audit Log</h2><div className="desc">Security and system events — sign-ups, sign-ins and sign-outs, failed logins, password resets, role and account changes, and settings — with failed and refused actions marked, and the id of the record each one concerned. What Users do with their own money is not shown here; each User sees that on their own My Activity page.</div></div></div>
      <div className="tabrow" style={{ marginBottom: 14 }}>
        {[["all", "All", auditLog.length], ["Success", "Success", auditLog.length - failedCount], ["Failed", "Failed", failedCount]].map(([id, label, n]) => (
          <button key={id} type="button" className={"tab" + (filter === id ? " active" : "")} onClick={() => setFilter(id)}>
            {label}<span className="tab-count">{n}</span>
          </button>
        ))}
      </div>
      <div className="card table-scroll">
        <table>
          <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Status</th><th>Detail</th><th>Reference</th></tr></thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l._id}>
                <td style={{ fontSize: 11.5, color: "var(--text-dim)", whiteSpace: "nowrap" }}>{new Date(l.ts).toLocaleString()}</td>
                <td>{l.user}</td>
                <td><span className="badge neutral">{l.action}</span></td>
                <td><span className={"badge " + (status(l) === "Failed" ? "danger" : "ok")}>{status(l)}</span></td>
                <td style={{ color: "var(--text-dim)" }}>{l.detail}</td>
                <td className="ref-cell" title={l.ref || ""}>{l.ref ? l.ref.slice(-8) : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="6"><div className="empty">{filter === "Failed" ? "No failed actions recorded." : "No audit entries yet."}</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
