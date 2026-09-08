const RBAC = [
  { role: "Admin", access: "Full access: manage users, view all audit logs, all reports, system settings." },
  { role: "Reviewer", access: "Reviews submitted entries (approve/reject/request revision), views audit log; cannot manage users." },
  { role: "User", access: "Submits own bills and transactions for review; views own reports, history, and notes only." },
];

export default function UserManagement({ users, session }) {
  if (session.role !== "Admin") {
    return <div className="card"><div className="empty">Restricted — Admin role required to view this page.</div></div>;
  }
  return (
    <div>
      <div className="pagehead"><div><h2>User &amp; Role Management</h2><div className="desc">Admin-only. Manage accounts and review role-based access.</div></div></div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Registered Users</h3>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u._id}><td>{u.name}</td><td>{u.email}</td><td><span className="badge neutral">{u.role}</span></td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h3>Role-Based Access Control Matrix</h3>
        <table>
          <thead><tr><th>Role</th><th>Access</th></tr></thead>
          <tbody>
            {RBAC.map(r => (<tr key={r.role}><td>{r.role}</td><td style={{ color: "var(--text-dim)" }}>{r.access}</td></tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
