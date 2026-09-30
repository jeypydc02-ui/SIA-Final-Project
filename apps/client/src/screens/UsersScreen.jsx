import { useState } from "react";

const ROLES = ["Admin", "Reviewer", "User"];

const RBAC = [
  { role: "Admin", access: "Full access: manage users and roles, view all audit logs, all reports, system settings." },
  { role: "Reviewer", access: "Reviews submitted entries (approve/reject/request revision), views audit log; cannot manage users." },
  { role: "User", access: "Submits own bills and transactions for review; views own reports, history, budgets, and notes only." },
];

export default function UsersScreen({ users, session, setUserRole, deleteUser, resetUserPassword }) {
  const [pending, setPending] = useState(null); // {user, role}
  const [resetTarget, setResetTarget] = useState(null); // user awaiting confirmation
  const [issued, setIssued] = useState(null); // {user, password} shown once
  const [busy, setBusy] = useState(false);

  if (session.role !== "Admin") {
    return <div className="card"><div className="empty">Restricted — Admin role required to view this page.</div></div>;
  }

  const adminCount = users.filter((u) => u.role === "Admin").length;

  async function confirmChange() {
    if (busy) return;
    setBusy(true);
    const ok = await setUserRole(pending.user._id, pending.role);
    setBusy(false);
    if (ok) setPending(null);
  }

  async function confirmReset() {
    if (busy) return;
    setBusy(true);
    const password = await resetUserPassword(resetTarget);
    setBusy(false);
    if (password) {
      setIssued({ user: resetTarget, password });
      setResetTarget(null);
    }
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
                  <td style={{ display: "flex", gap: 6 }}>
                    {!isSelf && (
                      <button className="btn small ghost" onClick={() => setResetTarget(u)}>Reset Password</button>
                    )}
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
              <button className="btn ghost" onClick={() => setPending(null)} disabled={busy}>Cancel</button>
              <button className="btn" onClick={confirmChange} disabled={busy}>{busy ? "Saving…" : "Confirm Change"}</button>
            </div>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="modal-overlay" onClick={() => !busy && setResetTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reset Password</h3>
            <p style={{ fontSize: 13 }}>
              Issue a temporary password for <strong>{resetTarget.name}</strong> ({resetTarget.email})?
            </p>
            <p style={{ fontSize: 12, color: "var(--text-dim)" }}>
              Their current password stops working and every device they are signed in on is logged out.
              They must choose a new password the next time they sign in. Only do this after confirming
              the request really came from them.
            </p>
            <div className="actions">
              <button className="btn ghost" onClick={() => setResetTarget(null)} disabled={busy}>Cancel</button>
              <button className="btn danger" onClick={confirmReset} disabled={busy}>{busy ? "Resetting…" : "Reset Password"}</button>
            </div>
          </div>
        </div>
      )}

      {issued && (
        <div className="modal-overlay">
          <div className="modal" role="dialog" aria-modal="true">
            <h3>Temporary password for {issued.user.name}</h3>
            <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
              Give this to {issued.user.name} privately. It is shown only once and is not stored anywhere you can view it again.
            </p>
            <div className="temp-password">{issued.password}</div>
            <div className="actions">
              <button className="btn" onClick={() => setIssued(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
