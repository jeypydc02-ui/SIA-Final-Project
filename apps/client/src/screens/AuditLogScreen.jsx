export default function AuditLogScreen({ auditLog }) {
  return (
    <div>
      <div className="pagehead"><div><h2>Audit Log</h2><div className="desc">Immutable record of key actions — logins, bill changes, payments, submissions, and reviews.</div></div></div>
      <div className="card">
        <table>
          <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Detail</th></tr></thead>
          <tbody>
            {auditLog.map(l => (
              <tr key={l._id}><td style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{new Date(l.ts).toLocaleString()}</td><td>{l.user}</td><td><span className="badge neutral">{l.action}</span></td><td style={{ color: "var(--text-dim)" }}>{l.detail}</td></tr>
            ))}
            {auditLog.length === 0 && <tr><td colSpan="4"><div className="empty">No audit entries yet.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
