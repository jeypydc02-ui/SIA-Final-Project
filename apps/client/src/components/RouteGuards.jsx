import { Navigate, Outlet } from "react-router-dom";
import { PATH_ROLES } from "../lib/nav.js";

// Signed-out visitors are sent to the landing page.
export function RequireAuth({ session, children }) {
  if (!session) return <Navigate to="/" replace />;
  return children;
}

// Server-side RBAC is the real control (every route checks the token's role);
// this stops a restricted URL from rendering an empty screen if it is typed in
// or arrives as a stale bookmark.
export function RequireRole({ session, path, roles }) {
  const allowed = roles || PATH_ROLES[path];
  if (allowed && !allowed.includes(session.role)) {
    return (
      <div className="card">
        <div className="empty">
          <div className="big">—</div>
          {session.role === "Admin" && allowed.includes("User")
            ? "Admin accounts administer the system and review receipts; they do not keep a wallet of their own."
            : `Restricted — this page is for ${allowed.join(" and ")} accounts. You are signed in as ${session.role}.`}
        </div>
      </div>
    );
  }
  return <Outlet />;
}
