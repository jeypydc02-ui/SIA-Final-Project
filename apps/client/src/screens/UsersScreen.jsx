import { useState } from "react";

const RBAC = [
  { role: "Admin", access: "The one account that administers the system (created on the server, never from the app): manages user accounts, deactivates and reactivates them, changes the system settings, and reads the security log (sign-ins, sign-ups, account changes). Never sees a User's money or their own activity. Keeps no wallet of their own." },
  { role: "User", access: "Records own bills, payments, income and expenses; sees only their own wallet, reports, history, budgets, notes and activity." },
];

export default function UsersScreen({ users, session, setUserActive, deleteUser }) {
  const [statusTarget, setStatusTarget] = useState(null); // user whose status is about to change
  const [busy, setBusy] = useState(false);

  if (session.role !== "Admin") {
    return <div className="card"><div className="empty">Restricted — Admin role required to view this page.</div></div>;
  }

  async function confirmStatus() {
    if (busy) return;
    setBusy(true);
    const ok = await setUserActive(statusTarget, statusTarget.active === false);
    setBusy(false);
    if (ok) setStatusTarget(null);
  }

  const deactivating = statusTarget && statusTarget.active !== false;

  return (
    <div>
      <div className="pagehead">
        <div>
          <h2>User &amp; Role Management</h2>
          <div className="desc">Admin-only. Deactivate, reactivate or remove User accounts, and review role-based access.</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Registered Users ({users.length})</h3>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Role</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => {
                const isSelf = String(u._id) === String(session.id);
                const isActive = u.active !== false;
                const isAdmin = u.role === "Admin";
                return (
                  <tr key={u._id} className={isActive ? "" : "row-inactive"}>
                    <td>{u.name}{isSelf && <span className="badge neutral" style={{ marginLeft: 8 }}>you</span>}</td>
                    <td style={{ color: "var(--text-dim)" }}>{u.email}</td>
                    <td><span className={"badge " + (isActive ? "ok" : "danger")}>{isActive ? "Active" : "Deactivated"}</span></td>
                    <td><span className="badge neutral">{u.role}</span></td>
                    <td style={{ display: "flex", gap: 6 }}>
                      {!isSelf && !isAdmin && (
                        <button className="btn small ghost" onClick={() => setStatusTarget(u)}>{isActive ? "Deactivate" : "Reactivate"}</button>
                      )}
                      {!isSelf && !isAdmin && (
                        <button className="btn small danger" onClick={() => deleteUser(u)}>Delete</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && <tr><td colSpan="5"><div className="empty">No users loaded.</div></td></tr>}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-dim)", margin: "12px 0 0" }}>
          The system has one Admin, and roles are not changed from the app: everyone who signs up is a User.
          The Admin account cannot be deactivated or deleted, so the system is never left without an administrator.
          People who forget their password reset it themselves from the sign-in page; it is e-mailed to them.
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

      {statusTarget && (
        <div className="modal-overlay" onClick={() => !busy && setStatusTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{deactivating ? "Deactivate Account" : "Reactivate Account"}</h3>
            <p style={{ fontSize: 13 }}>
              {deactivating ? "Deactivate" : "Reactivate"} the account of <strong>{statusTarget.name}</strong> ({statusTarget.email})?
            </p>
            <p style={{ fontSize: 12, color: "var(--text-dim)" }}>
              {deactivating
                ? "They are signed out everywhere at once and cannot sign in or reset their password until the account is reactivated. Nothing is deleted: their bills, entries and notes stay as they are."
                : "They can sign in again with their existing password, and everything they had is still there."}
            </p>
            <div className="actions">
              <button className="btn ghost" onClick={() => setStatusTarget(null)} disabled={busy}>Cancel</button>
              <button className={"btn" + (deactivating ? " danger" : "")} onClick={confirmStatus} disabled={busy}>
                {busy ? "Saving…" : deactivating ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
