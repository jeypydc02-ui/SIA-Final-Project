import { useState, useEffect } from "react";
import {
  BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate, useParams,
} from "react-router-dom";
import { api } from "./lib/api.js";
import { peso } from "./lib/utils.js";
import { PATH_ROLES } from "./lib/nav.js";

import LandingPage from "./screens/LandingPage.jsx";
import LoginScreen from "./screens/LoginScreen.jsx";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import Dashboard from "./screens/Dashboard.jsx";
import { ProjectList, ProjectDetails } from "./screens/BillCategories.jsx";
import BillsScreen from "./screens/BillsScreen.jsx";
import PaymentHistory from "./screens/PaymentHistory.jsx";
import SubmissionForm from "./screens/SubmissionForm.jsx";
import VersionHistory from "./screens/VersionHistory.jsx";
import ReviewApproval from "./screens/ReviewApproval.jsx";
import CommentsScreen from "./screens/CommentsScreen.jsx";
import NotificationsScreen from "./screens/NotificationsScreen.jsx";
import AuditLogScreen from "./screens/AuditLogScreen.jsx";
import ReportsScreen from "./screens/ReportsScreen.jsx";
import BudgetsScreen from "./screens/BudgetsScreen.jsx";
import UserManagement from "./screens/UserManagement.jsx";
import SettingsScreen from "./screens/SettingsScreen.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <FinTrackStark />
    </BrowserRouter>
  );
}

function FinTrackStark() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null); // {id,name,email,role,token}
  const [restoring, setRestoring] = useState(true);
  const [users, setUsers] = useState([]);
  const [bills, setBills] = useState([]);
  const [tx, setTx] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [comments, setComments] = useState([]);
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(null); // {message, confirmLabel, onConfirm}
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("fts_theme");
    if (stored) return stored;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("fts_theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // Restore the session on a page refresh. The token survives in
  // sessionStorage, but only the server can say whether it is still valid,
  // so the app asks before deciding the visitor is logged out. The URL is
  // left alone, so a reload keeps you on the page you were reading.
  useEffect(() => {
    const token = sessionStorage.getItem("fts_token");
    if (!token) { setRestoring(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const data = await api("/api/auth/me");
        if (cancelled) return;
        const sess = { ...data.user, token };
        setSession(sess);
        await refreshAll(sess);
      } catch {
        sessionStorage.removeItem("fts_token");
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function fireToast(msg) { setToast(msg); }
  function fireError(err) { setToast("⚠ " + (err.message || "Something went wrong.")); }
  function askConfirm(message, onConfirm, confirmLabel) {
    setConfirmDialog({ message, confirmLabel, onConfirm });
  }

  async function refreshAll(activeSession) {
    const s = activeSession || session;
    try {
      const [billsData, txData, budgetsData, notifsData, commentsData] = await Promise.all([
        api("/api/bills"), api("/api/transactions"), api("/api/budgets"), api("/api/notifications"), api("/api/comments"),
      ]);
      setBills(billsData); setTx(txData); setBudgets(budgetsData); setNotifs(notifsData); setComments(commentsData);
      if (s && (s.role === "Admin" || s.role === "Reviewer")) {
        setAuditLog(await api("/api/audit-log"));
      }
      if (s && s.role === "Admin") {
        setUsers(await api("/api/users"));
      }
      setLoadError("");
    } catch (err) {
      setLoadError(err.message);
    }
  }

  async function login(email, password) {
    try {
      const data = await api("/api/auth/login", { method: "POST", body: { email, password } });
      const sess = { ...data.user, token: data.token };
      sessionStorage.setItem("fts_token", data.token);
      setSession(sess);
      navigate("/dashboard", { replace: true });
      await refreshAll(sess);
      fireToast(`Welcome back, ${sess.name.split(" ")[0]}!`);
      return true;
    } catch (err) {
      return false;
    }
  }
  async function register(firstName, lastName, email, password) {
    try {
      const data = await api("/api/auth/register", { method: "POST", body: { firstName, lastName, email, password } });
      const sess = { ...data.user, token: data.token };
      sessionStorage.setItem("fts_token", data.token);
      setSession(sess);
      navigate("/dashboard", { replace: true });
      await refreshAll(sess);
      fireToast(`Welcome, ${sess.name.split(" ")[0]}! Your account has been created.`);
      return null; // no error
    } catch (err) {
      return err.message;
    }
  }
  async function logout() {
    try { await api("/api/auth/logout", { method: "POST" }); } catch (e) { /* ignore */ }
    sessionStorage.removeItem("fts_token");
    setSession(null);
    setBills([]); setTx([]); setBudgets([]); setNotifs([]); setAuditLog([]); setUsers([]); setComments([]);
    navigate("/", { replace: true });
    fireToast("You have been logged out.");
  }
  function requestLogout() {
    askConfirm("Are you sure you want to log out this account?", () => {
      setConfirmDialog(null);
      logout();
    }, "Yes, Log Out");
  }

  // ---- Integration component: workflow automation + webhook simulation, backed by the API ----
  async function markPaid(billId, amount) {
    try {
      await api("/api/bills/" + billId + "/pay", { method: "POST", body: { amount } });
      fireToast("✓ Bill marked as paid — dashboard & logs updated.");
      await refreshAll();
    } catch (err) { fireError(err); }
  }
  async function addBill(b) {
    try {
      await api("/api/bills", { method: "POST", body: b });
      fireToast("Bill added — reminder scheduled.");
      await refreshAll();
    } catch (err) { fireError(err); }
  }
  async function editBill(id, patch) {
    try {
      await api("/api/bills/" + id, { method: "PUT", body: patch });
      fireToast("Bill updated.");
      await refreshAll();
    } catch (err) { fireError(err); }
  }
  function deleteBill(bill) {
    askConfirm(`Delete "${bill.name}"? This cannot be undone.`, async () => {
      setConfirmDialog(null);
      try {
        await api("/api/bills/" + bill._id, { method: "DELETE" });
        fireToast("Bill deleted.");
        await refreshAll();
      } catch (err) { fireError(err); }
    }, "Delete Bill");
  }
  async function addTx(t) {
    try {
      await api("/api/transactions", { method: "POST", body: t });
      fireToast(`${t.type} of ${peso(t.amount)} submitted for review.`);
      await refreshAll();
    } catch (err) { fireError(err); }
  }
  async function editTx(id, patch) {
    try {
      await api("/api/transactions/" + id, { method: "PUT", body: patch });
      fireToast("Entry updated.");
      await refreshAll();
    } catch (err) { fireError(err); }
  }
  function deleteTx(entry) {
    askConfirm(`Withdraw this ${entry.type.toLowerCase()} of ${peso(entry.amount)}?`, async () => {
      setConfirmDialog(null);
      try {
        await api("/api/transactions/" + entry._id, { method: "DELETE" });
        fireToast("Entry withdrawn.");
        await refreshAll();
      } catch (err) { fireError(err); }
    }, "Withdraw Entry");
  }
  async function reviewTx(id, action, comment) {
    try {
      await api("/api/transactions/" + id + "/review", { method: "POST", body: { action, comment } });
      fireToast("Review recorded.");
      await refreshAll();
    } catch (err) { fireError(err); }
  }
  async function resubmitTx(id, patch) {
    try {
      await api("/api/transactions/" + id + "/resubmit", { method: "POST", body: patch });
      fireToast("Resubmitted for review.");
      await refreshAll();
    } catch (err) { fireError(err); }
  }
  async function addComment(text) {
    try {
      await api("/api/comments", { method: "POST", body: { text } });
      fireToast("Note posted.");
      await refreshAll();
    } catch (err) { fireError(err); }
  }

  // ---- Budgets ----
  async function addBudget(b) {
    try {
      await api("/api/budgets", { method: "POST", body: b });
      fireToast(`Budget for ${b.category} set.`);
      await refreshAll();
    } catch (err) { fireError(err); }
  }
  async function editBudget(id, patch) {
    try {
      await api("/api/budgets/" + id, { method: "PUT", body: patch });
      fireToast("Budget updated.");
      await refreshAll();
    } catch (err) { fireError(err); }
  }
  function deleteBudget(budget) {
    askConfirm(`Remove the ${budget.category} budget?`, async () => {
      setConfirmDialog(null);
      try {
        await api("/api/budgets/" + budget._id, { method: "DELETE" });
        fireToast("Budget removed.");
        await refreshAll();
      } catch (err) { fireError(err); }
    }, "Remove Budget");
  }

  // ---- Notifications ----
  async function markNotifRead(id) {
    try {
      await api("/api/notifications/" + id + "/read", { method: "PUT" });
      await refreshAll();
    } catch (err) { fireError(err); }
  }
  async function markAllNotifsRead() {
    try {
      await api("/api/notifications/read-all", { method: "PUT" });
      fireToast("All notifications marked as read.");
      await refreshAll();
    } catch (err) { fireError(err); }
  }

  // ---- Account settings ----
  async function updateProfile(patch) {
    try {
      const data = await api("/api/auth/me", { method: "PUT", body: patch });
      setSession((s) => ({ ...s, ...data.user }));
      fireToast("Profile updated.");
      await refreshAll();
      return null;
    } catch (err) { return err.message; }
  }
  async function changePassword(currentPassword, newPassword) {
    try {
      const data = await api("/api/auth/me/password", { method: "PUT", body: { currentPassword, newPassword } });
      // The server invalidates every other session and hands back a fresh token.
      sessionStorage.setItem("fts_token", data.token);
      setSession((s) => ({ ...s, ...data.user, token: data.token }));
      fireToast("Password changed — other devices were signed out.");
      return null;
    } catch (err) { return err.message; }
  }

  // ---- Admin ----
  async function setUserRole(userId, role) {
    try {
      await api("/api/users/" + userId + "/role", { method: "PUT", body: { role } });
      fireToast("Role updated.");
      await refreshAll();
    } catch (err) { fireError(err); }
  }
  function deleteUser(user) {
    askConfirm(`Delete the account for ${user.name}? This cannot be undone.`, async () => {
      setConfirmDialog(null);
      try {
        await api("/api/users/" + user._id, { method: "DELETE" });
        fireToast("Account deleted.");
        await refreshAll();
      } catch (err) { fireError(err); }
    }, "Delete Account");
  }

  if (restoring) {
    return <div className="boot"><div className="boot-mark">FS</div><div className="boot-text">Restoring your session…</div></div>;
  }

  // Signed-out visitors get the public pages; everything else lives behind
  // RequireAuth, which sends them to the landing page and remembers nothing.
  return (
    <>
      <Routes>
        <Route
          path="/"
          element={session ? <Navigate to="/dashboard" replace /> : (
            <LandingPage
              theme={theme}
              setTheme={setTheme}
              onLogin={() => navigate("/login")}
              onGetStarted={() => navigate("/register")}
            />
          )}
        />
        <Route
          path="/login"
          element={session ? <Navigate to="/dashboard" replace /> : (
            <LoginScreen
              key="login"
              initialMode="login"
              onLogin={login}
              onRegister={register}
              onSwitchMode={(m) => navigate(m === "login" ? "/login" : "/register")}
              theme={theme}
              setTheme={setTheme}
              onBack={() => navigate("/")}
            />
          )}
        />
        <Route
          path="/register"
          element={session ? <Navigate to="/dashboard" replace /> : (
            <LoginScreen
              key="register"
              initialMode="register"
              onLogin={login}
              onRegister={register}
              onSwitchMode={(m) => navigate(m === "login" ? "/login" : "/register")}
              theme={theme}
              setTheme={setTheme}
              onBack={() => navigate("/")}
            />
          )}
        />

        <Route
          element={
            <RequireAuth session={session}>
              <Shell session={session} logout={requestLogout} theme={theme} setTheme={setTheme} notifs={notifs} loadError={loadError} />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<Dashboard bills={bills} tx={tx} budgets={budgets} notifs={notifs} onOpenBudgets={() => navigate("/budgets")} />} />
          <Route path="/categories" element={<ProjectList bills={bills} onOpen={(name) => navigate("/categories/" + encodeURIComponent(name))} />} />
          <Route path="/categories/:name" element={<CategoryDetailRoute bills={bills} />} />
          <Route path="/submit" element={<SubmissionForm addTx={addTx} />} />
          <Route path="/budgets" element={<BudgetsScreen budgets={budgets} tx={tx} addBudget={addBudget} editBudget={editBudget} deleteBudget={deleteBudget} />} />
          <Route path="/bills" element={<BillsScreen bills={bills} addBill={addBill} markPaid={markPaid} editBill={editBill} deleteBill={deleteBill} />} />
          <Route path="/revisions" element={<VersionHistory tx={tx} />} />
          <Route path="/review" element={<ReviewApproval tx={tx} session={session} reviewTx={reviewTx} resubmitTx={resubmitTx} editTx={editTx} deleteTx={deleteTx} />} />
          <Route path="/notes" element={<CommentsScreen comments={comments} addComment={addComment} tx={tx} />} />
          <Route path="/payments" element={<PaymentHistory bills={bills} />} />
          <Route path="/notifications" element={<NotificationsScreen notifs={notifs} markRead={markNotifRead} markAllRead={markAllNotifsRead} />} />
          <Route path="/reports" element={<ReportsScreen tx={tx} bills={bills} budgets={budgets} />} />
          <Route path="/settings" element={<SettingsScreen session={session} updateProfile={updateProfile} changePassword={changePassword} theme={theme} setTheme={setTheme} />} />

          <Route element={<RequireRole session={session} path="/audit" />}>
            <Route path="/audit" element={<AuditLogScreen auditLog={auditLog} />} />
          </Route>
          <Route element={<RequireRole session={session} path="/users" />}>
            <Route path="/users" element={<UserManagement users={users} session={session} setUserRole={setUserRole} deleteUser={deleteUser} />} />
          </Route>

          <Route path="*" element={<NotFound onHome={() => navigate("/dashboard")} />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {toast && <div className="toast">{toast}</div>}
      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </>
  );
}

// The signed-in frame: sidebar, top bar, and whichever screen the URL names.
function Shell({ session, logout, theme, setTheme, notifs, loadError }) {
  return (
    <div className="shell">
      <Sidebar session={session} logout={logout} theme={theme} setTheme={setTheme} notifs={notifs} />
      <div className="main">
        <Topbar />
        <div className="content">
          {loadError && (
            <div className="card" style={{ marginBottom: 16, borderColor: "var(--danger)" }}>
              <div style={{ color: "var(--danger)", fontSize: 13 }}>⚠ Could not reach the server: {loadError}</div>
            </div>
          )}
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function RequireAuth({ session, children }) {
  if (!session) return <Navigate to="/" replace />;
  return children;
}

// Server-side RBAC is the real control (every route checks the token's role);
// this stops a restricted URL from rendering an empty screen if it is typed in
// or arrives as a stale bookmark.
function RequireRole({ session, path }) {
  const allowed = PATH_ROLES[path];
  if (allowed && !allowed.includes(session.role)) {
    return <Restricted allowed={allowed} role={session.role} />;
  }
  return <Outlet />;
}

function Restricted({ allowed, role }) {
  return (
    <div className="card">
      <div className="empty">
        <div className="big">—</div>
        Restricted — this page is for {allowed.join(" and ")} accounts. You are signed in as {role}.
      </div>
    </div>
  );
}

function NotFound({ onHome }) {
  return (
    <div className="card">
      <div className="empty">
        <div className="big">404</div>
        That page does not exist.{" "}
        <button className="linkbtn" onClick={onHome}>Go to the dashboard</button>
      </div>
    </div>
  );
}

// Reads the category out of the URL, so /categories/Housing is a real address
// that can be bookmarked and shared.
function CategoryDetailRoute({ bills }) {
  const { name } = useParams();
  const navigate = useNavigate();
  return (
    <ProjectDetails
      bills={bills}
      category={decodeURIComponent(name)}
      onBack={() => navigate("/categories")}
      onPick={(next) => navigate("/categories/" + encodeURIComponent(next))}
    />
  );
}
