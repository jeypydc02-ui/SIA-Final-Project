import { useState, useEffect, Component } from "react";
import {
  BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate, useParams, useLocation,
} from "react-router-dom";
import { api, SESSION_ENDED, PASSWORD_CHANGE_REQUIRED } from "./lib/api.js";
import { peso } from "./lib/utils.js";
import { PATH_ROLES } from "./lib/nav.js";

import LandingPage from "./screens/LandingPage.jsx";
import LoginScreen from "./screens/LoginScreen.jsx";
import { TermsPage, PrivacyPage } from "./screens/LegalPages.jsx";
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

const isStaff = (s) => !!s && (s.role === "Admin" || s.role === "Reviewer");

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <FinTrackStark />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

function FinTrackStark() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null); // {id,name,email,role,token,mustChangePassword}
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState("");
  const [sessionEnded, setSessionEnded] = useState(false);
  const [users, setUsers] = useState([]);
  const [bills, setBills] = useState([]);
  // `tx` is always the signed-in person's own entries — what the dashboard,
  // budgets and reports add up. `queue` is the review queue across everyone,
  // loaded only for Reviewers and Admins.
  const [tx, setTx] = useState([]);
  const [queue, setQueue] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [comments, setComments] = useState([]);
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(null); // {message, confirmLabel, onConfirm}
  const [theme, setTheme] = useState(() => {
    const stored = readStorage("fts_theme");
    if (stored) return stored;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("fts_theme", theme); } catch (e) { /* private mode */ }
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // The server says the session is over (8-hour expiry, or the password was
  // changed on another device). Rather than leave every button failing with
  // "Not authenticated", ask for the password again over the current screen,
  // so nothing typed into an open form is lost.
  useEffect(() => {
    const onEnded = () => setSessionEnded(true);
    const onMustChange = () => setSession((s) => (s ? { ...s, mustChangePassword: true } : s));
    window.addEventListener(SESSION_ENDED, onEnded);
    window.addEventListener(PASSWORD_CHANGE_REQUIRED, onMustChange);
    return () => {
      window.removeEventListener(SESSION_ENDED, onEnded);
      window.removeEventListener(PASSWORD_CHANGE_REQUIRED, onMustChange);
    };
  }, []);

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
        // quiet: an expired token found at startup is not a session ending
        // mid-use; the visitor simply is not signed in.
        const data = await api("/api/auth/me", { quiet: true });
        if (cancelled) return;
        const sess = { ...data.user, token };
        setSession(sess);
        if (!sess.mustChangePassword) await refreshAll(sess);
      } catch (err) {
        if (cancelled) return;
        // Only a rejection from the server means the session is over. If the
        // server simply could not be reached, keep the token and say so —
        // throwing people back to the landing page over a dropped connection
        // loses their place and looks like the app logged them out.
        if (err.offline) {
          setRestoreError("Could not reach the server. Your session is still saved — reload once it is back.");
        } else {
          sessionStorage.removeItem("fts_token");
        }
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function fireToast(msg) { setToast(msg); }
  function fireError(err) {
    // A lapsed session already has its own dialog; a toast on top would only
    // repeat "Not authenticated" behind it.
    if (err.status === 401) return;
    setToast("⚠ " + (err.message || "Something went wrong."));
  }
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
      if (isStaff(s)) {
        const [queueData, auditData] = await Promise.all([
          api("/api/transactions?scope=review"), api("/api/audit-log"),
        ]);
        setQueue(queueData); setAuditLog(auditData);
      } else {
        setQueue(txData);
      }
      if (s && s.role === "Admin") {
        setUsers(await api("/api/users"));
      }
      setLoadError("");
    } catch (err) {
      if (err.status !== 401) setLoadError(err.message);
    }
  }

  // Every write goes through here. It resolves to true only once the server
  // has accepted the change, so a form can keep what the person typed — and
  // stay open — when the request fails, instead of clearing it optimistically.
  async function perform(request, successMessage) {
    try {
      await request();
      if (successMessage) fireToast(successMessage);
      await refreshAll();
      return true;
    } catch (err) {
      fireError(err);
      return false;
    }
  }

  function startSession(data) {
    const sess = { ...data.user, token: data.token };
    sessionStorage.setItem("fts_token", data.token);
    setSession(sess);
    return sess;
  }

  // Returns null on success, or a message the form shows.
  async function login(email, password) {
    try {
      const data = await api("/api/auth/login", { method: "POST", body: { email, password } });
      const sess = startSession(data);
      navigate("/dashboard", { replace: true });
      if (!sess.mustChangePassword) {
        await refreshAll(sess);
        fireToast(`Welcome back, ${sess.name.split(" ")[0]}!`);
      }
      return null;
    } catch (err) {
      return err.message;
    }
  }
  async function register(firstName, lastName, email, password) {
    try {
      const data = await api("/api/auth/register", { method: "POST", body: { firstName, lastName, email, password } });
      const sess = startSession(data);
      navigate("/dashboard", { replace: true });
      await refreshAll(sess);
      fireToast(`Welcome, ${sess.name.split(" ")[0]}! Your account has been created.`);
      return null; // no error
    } catch (err) {
      return err.message;
    }
  }
  // Signing back in after the session lapsed: same account, same screen.
  async function reauthenticate(password) {
    try {
      const data = await api("/api/auth/login", { method: "POST", body: { email: session.email, password } });
      const sess = startSession(data);
      setSessionEnded(false);
      if (!sess.mustChangePassword) await refreshAll(sess);
      return null;
    } catch (err) {
      return err.message;
    }
  }
  function clearLocalSession() {
    sessionStorage.removeItem("fts_token");
    setSession(null);
    setSessionEnded(false);
    setBills([]); setTx([]); setQueue([]); setBudgets([]); setNotifs([]); setAuditLog([]); setUsers([]); setComments([]);
  }
  async function logout() {
    try { await api("/api/auth/logout", { method: "POST", quiet: true }); } catch (e) { /* ignore */ }
    clearLocalSession();
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
  const markPaid = (billId, amount) => perform(
    () => api("/api/bills/" + billId + "/pay", { method: "POST", body: { amount } }),
    "✓ Bill marked as paid — dashboard & logs updated."
  );
  const addBill = (b) => perform(() => api("/api/bills", { method: "POST", body: b }), "Bill added — reminder scheduled.");
  const editBill = (id, patch) => perform(() => api("/api/bills/" + id, { method: "PUT", body: patch }), "Bill updated.");
  function deleteBill(bill) {
    askConfirm(`Delete "${bill.name}"? This cannot be undone.`, async () => {
      setConfirmDialog(null);
      await perform(() => api("/api/bills/" + bill._id, { method: "DELETE" }), "Bill deleted.");
    }, "Delete Bill");
  }
  const addTx = (t) => perform(
    () => api("/api/transactions", { method: "POST", body: t }),
    `${t.type} of ${peso(t.amount)} submitted for review.`
  );
  const editTx = (id, patch) => perform(() => api("/api/transactions/" + id, { method: "PUT", body: patch }), "Entry updated.");
  function deleteTx(entry) {
    askConfirm(`Withdraw this ${entry.type.toLowerCase()} of ${peso(entry.amount)}?`, async () => {
      setConfirmDialog(null);
      await perform(() => api("/api/transactions/" + entry._id, { method: "DELETE" }), "Entry withdrawn.");
    }, "Withdraw Entry");
  }
  const reviewTx = (id, action, comment) => perform(
    () => api("/api/transactions/" + id + "/review", { method: "POST", body: { action, comment } }),
    "Review recorded."
  );
  const resubmitTx = (id, patch) => perform(
    () => api("/api/transactions/" + id + "/resubmit", { method: "POST", body: patch }),
    "Resubmitted for review."
  );
  const addComment = (text) => perform(() => api("/api/comments", { method: "POST", body: { text } }), "Note posted.");

  // ---- Budgets ----
  const addBudget = (b) => perform(() => api("/api/budgets", { method: "POST", body: b }), `Budget for ${b.category} set.`);
  const editBudget = (id, patch) => perform(() => api("/api/budgets/" + id, { method: "PUT", body: patch }), "Budget updated.");
  function deleteBudget(budget) {
    askConfirm(`Remove the ${budget.category} budget?`, async () => {
      setConfirmDialog(null);
      await perform(() => api("/api/budgets/" + budget._id, { method: "DELETE" }), "Budget removed.");
    }, "Remove Budget");
  }

  // ---- Notifications ----
  const markNotifRead = (id) => perform(() => api("/api/notifications/" + id + "/read", { method: "PUT" }));
  const markAllNotifsRead = () => perform(() => api("/api/notifications/read-all", { method: "PUT" }), "All notifications marked as read.");

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
      const sess = startSession(data);
      fireToast("Password changed — other devices were signed out.");
      await refreshAll(sess);
      return null;
    } catch (err) { return err.message; }
  }

  // ---- Admin ----
  const setUserRole = (userId, role) => perform(
    () => api("/api/users/" + userId + "/role", { method: "PUT", body: { role } }),
    "Role updated."
  );
  function deleteUser(user) {
    askConfirm(`Delete the account for ${user.name}? Their bills, budgets, notes and pending entries are removed too. This cannot be undone.`, async () => {
      setConfirmDialog(null);
      await perform(() => api("/api/users/" + user._id, { method: "DELETE" }), "Account deleted.");
    }, "Delete Account");
  }
  // Resolves to the temporary password, or null if the reset failed.
  async function resetUserPassword(user) {
    try {
      const data = await api("/api/users/" + user._id + "/reset-password", { method: "POST" });
      await refreshAll();
      return data.temporaryPassword;
    } catch (err) {
      fireError(err);
      return null;
    }
  }

  if (restoring) {
    return <div className="boot"><div className="boot-mark">FS</div><div className="boot-text">Restoring your session…</div></div>;
  }

  // The server was unreachable during restore. The token is still held, so a
  // reload once the API is back picks the session up where it left off.
  if (restoreError && !session) {
    return (
      <div className="boot">
        <div className="boot-mark">FS</div>
        <div className="boot-text">{restoreError}</div>
        <button className="btn" onClick={() => window.location.reload()}>Try again</button>
      </div>
    );
  }

  // An Admin reset this account's password. The temporary one must be replaced
  // before anything else; the server refuses every other request until then.
  if (session && session.mustChangePassword) {
    return (
      <>
        <ForcePasswordChange session={session} changePassword={changePassword} logout={logout} theme={theme} />
        {toast && <div className="toast">{toast}</div>}
      </>
    );
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
        {/* Public whether signed in or not: the sign-up form links to them. */}
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

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
          <Route path="/revisions" element={<VersionHistory tx={queue} />} />
          <Route path="/review" element={<ReviewApproval tx={tx} queue={queue} session={session} reviewTx={reviewTx} resubmitTx={resubmitTx} editTx={editTx} deleteTx={deleteTx} />} />
          <Route path="/notes" element={<CommentsScreen comments={comments} addComment={addComment} tx={queue} />} />
          <Route path="/payments" element={<PaymentHistory bills={bills} />} />
          <Route path="/notifications" element={<NotificationsScreen notifs={notifs} markRead={markNotifRead} markAllRead={markAllNotifsRead} />} />
          <Route path="/reports" element={<ReportsScreen tx={tx} bills={bills} budgets={budgets} />} />
          <Route path="/settings" element={<SettingsScreen session={session} updateProfile={updateProfile} changePassword={changePassword} theme={theme} setTheme={setTheme} />} />

          <Route element={<RequireRole session={session} path="/audit" />}>
            <Route path="/audit" element={<AuditLogScreen auditLog={auditLog} />} />
          </Route>
          <Route element={<RequireRole session={session} path="/users" />}>
            <Route path="/users" element={<UserManagement users={users} session={session} setUserRole={setUserRole} deleteUser={deleteUser} resetUserPassword={resetUserPassword} />} />
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
      {session && sessionEnded && (
        <ReauthDialog
          email={session.email}
          onSubmit={reauthenticate}
          onLogout={() => { clearLocalSession(); navigate("/login", { replace: true }); }}
        />
      )}
    </>
  );
}

function readStorage(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

// Shown over whatever screen was open when the server ended the session.
function ReauthDialog({ email, onSubmit, onLogout }) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setErr("");
    const message = await onSubmit(password);
    setBusy(false);
    if (message) setErr(message);
  }

  return (
    <div className="modal-overlay">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="reauth-title">
        <h3 id="reauth-title">Your session has ended</h3>
        <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
          For your security you were signed out. Enter your password to continue where you left off — anything you were typing is kept.
        </p>
        <form onSubmit={submit}>
          <div className="form-row"><label className="field">Email</label><input value={email} disabled /></div>
          <div className="form-row">
            <label className="field" htmlFor="reauth-password">Password</label>
            <input id="reauth-password" type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {err && <div className="form-msg error">{err}</div>}
          <div className="actions">
            <button type="button" className="btn ghost" onClick={onLogout}>Log out instead</button>
            <button className="btn" type="submit" disabled={busy || !password}>{busy ? "Signing in…" : "Continue"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ForcePasswordChange({ session, changePassword, logout }) {
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (pw.next.length < 8) return setErr("New password must be at least 8 characters.");
    if (pw.next !== pw.confirm) return setErr("The new passwords do not match.");
    if (pw.next === pw.current) return setErr("Choose a password different from the temporary one.");
    setBusy(true);
    const message = await changePassword(pw.current, pw.next);
    setBusy(false);
    if (message) setErr(message);
  }

  return (
    <div className="boot">
      <div className="card" style={{ maxWidth: 420, width: "100%", textAlign: "left" }}>
        <h3>Choose a new password</h3>
        <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
          {session.name}, an administrator reset your password. Replace the temporary password with one only you know to continue.
        </p>
        <form onSubmit={submit}>
          <div className="form-row"><label className="field">Temporary password</label><input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required /></div>
          <div className="form-row"><label className="field">New password</label><input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required minLength={8} /><div className="hint">At least 8 characters.</div></div>
          <div className="form-row"><label className="field">Confirm new password</label><input type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required /></div>
          {err && <div className="form-msg error">{err}</div>}
          <div className="actions">
            <button type="button" className="btn ghost" onClick={logout}>Log out</button>
            <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Set Password"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// The signed-in frame: sidebar, top bar, and whichever screen the URL names.
// On a narrow screen the sidebar becomes a drawer, because a fixed 220px menu
// swallows more than half a phone's width and squeezes the content off-screen.
function Shell({ session, logout, theme, setTheme, notifs, loadError }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the drawer whenever the route changes, including on Back.
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  return (
    <div className="shell">
      <Sidebar
        session={session} logout={logout} theme={theme} setTheme={setTheme} notifs={notifs}
        open={menuOpen} onNavigate={() => setMenuOpen(false)}
      />
      {menuOpen && <div className="side-backdrop" onClick={() => setMenuOpen(false)} />}
      <div className="main">
        <Topbar onOpenMenu={() => setMenuOpen(true)} />
        <div className="content">
          {loadError && (
            <div className="card" style={{ marginBottom: 16, borderColor: "var(--danger)" }}>
              <div style={{ color: "var(--danger)", fontSize: 13 }}>⚠ Could not load your latest data: {loadError}</div>
            </div>
          )}
          {/* Keyed on the address, so a screen that crashed does not stay
              broken after navigating somewhere else. */}
          <ErrorBoundary key={pathname} inline>
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

// Without this, any rendering error blanked the whole app to a white page.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("[ui] screen failed to render:", error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const body = (
      <div className="empty">
        <div className="big">!</div>
        Something went wrong showing this page.{" "}
        <button className="linkbtn" onClick={() => window.location.assign("/dashboard")}>Go to the dashboard</button>
      </div>
    );
    return this.props.inline ? <div className="card">{body}</div> : <div className="boot">{body}</div>;
  }
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
// that can be bookmarked and shared. useParams has already decoded it; decoding
// a second time turned a "%" in the name into a crash.
function CategoryDetailRoute({ bills }) {
  const { name } = useParams();
  const navigate = useNavigate();
  return (
    <ProjectDetails
      bills={bills}
      category={name}
      onBack={() => navigate("/categories")}
      onPick={(next) => navigate("/categories/" + encodeURIComponent(next))}
    />
  );
}
