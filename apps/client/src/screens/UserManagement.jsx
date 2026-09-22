import { useState } from "react";

const ROLES = ["Admin", "Reviewer", "User"];

const RBAC = [
  { role: "Admin", access: "Full access: manage users and roles, view all audit logs, all reports, system settings." },
  { role: "Reviewer", access: "Reviews submitted entries (approve/reject/request revision), views audit log; cannot manage users." },
  { role: "User", access: "Submits own bills and transactions for review; views own reports, history, budgets, and notes only." },
];

export default function UserManagement({ users, session, setUserRole, deleteUser }) {
  const [pending, setPending] = useState(null); // {user, role}

  if (session.role !== "Admin") {
    return <div className="card"><div className="empty">Restricted — Admin role required to view this page.</div></div>;
  }

  const adminCount = users.filter((u) => u.role === "Admin").length;

  function confirmChange() {
    setUserRole(pending.user._id, pending.role);
    setPending(null);
  }

  return (
    <div>
      <div className="pagehead">
        <div>
          <h2>User &amp; Role Management</h2>
          <div className="desc">Admin-only. Assign roles and review role-based access.</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Registered Users ({users.length})</h3>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Change Role</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => {
              const isSelf = String(u._id) === String(session.id);
              const isLastAdmin = u.role === "Admin" && adminCount <= 1;
              return (
                <tr key={u._id}>
                  <td>{u.name}{isSelf && <span className="badge neutral" style={{ marginLeft: 8 }}>you</span>}</td>
                  <td style={{ color: "var(--text-dim)" }}>{u.email}</td>
                  <td><span className="badge neutral">{u.role}</span></td>
                  <td>
                    <select
                      value={u.role}
                      disabled={isSelf || isLastAdmin}
                      onChange={(e) => setPending({ user: u, role: e.target.value })}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>
                    {!isSelf && !isLastAdmin && (
                      <button className="btn small danger" onClick={() => deleteUser(u)}>Delete</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && <tr><td colSpan="5"><div className="empty">No users loaded.</div></td></tr>}
          </tbody>
        </table>
        <p style={{ fontSize: 11.5, color: "var(--text-dim)", margin: "12px 0 0" }}>
          You cannot change or delete your own account, and the last remaining Admin is protected —
          separation of duties means the system can never be left without an administrator.
        </p>
      </div>

      <div className="card">
        <h3>Role-Based Access Control Matrix</h3>
        <table>
          <thead><tr><th>Role</th><th>Access</th></tr></thead>
          <tbody>
            {RBAC.map((r) => (<tr key={r.role}><td>{r.role}</td><td style={{ color: "var(--text-dim)" }}>{r.access}</td></tr>))}
          </tbody>
        </table>
      </div>

      {pending && (
        <div className="modal-overlay" onClick={() => setPending(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Change Role</h3>
            <p style={{ fontSize: 13 }}>
              Change <strong>{pending.user.name}</strong> from <strong>{pending.user.role}</strong> to <strong>{pending.role}</strong>?
            </p>
            <p style={{ fontSize: 12, color: "var(--text-dim)" }}>
              This takes effect immediately, including on any session they currently have open.
            </p>
            <div className="actions">
              <button className="btn ghost" onClick={() => setPending(null)}>Cancel</button>
              <button className="btn" onClick={confirmChange}>Confirm Change</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
