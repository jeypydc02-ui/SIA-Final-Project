import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { api, SESSION_ENDED, PASSWORD_CHANGE_REQUIRED } from "./lib/api.js";
import { connectLive } from "./lib/live.js";
import { peso } from "./lib/utils.js";

// Frame and shared pieces
import Shell from "./components/Shell.jsx";
import Toast from "./components/Toast.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import ReauthDialog from "./components/ReauthDialog.jsx";
import InstallPrompt from "./components/InstallPrompt.jsx";
import { RequireAuth, RequireRole } from "./components/RouteGuards.jsx";

// Public pages
import LandingPage from "./screens/LandingPage.jsx";
import LoginScreen from "./screens/LoginScreen.jsx";
import { TermsPage, PrivacyPage } from "./screens/LegalPages.jsx";
import ForcePasswordChangeScreen from "./screens/ForcePasswordChangeScreen.jsx";

// Signed-in screens, in sidebar order
import DashboardScreen from "./screens/DashboardScreen.jsx";
import { CategoryList, CategoryDetailRoute } from "./screens/CategoriesScreen.jsx";
import LogEntryScreen from "./screens/LogEntryScreen.jsx";
import BudgetsScreen from "./screens/BudgetsScreen.jsx";
import BillsScreen from "./screens/BillsScreen.jsx";
import RevisionHistoryScreen from "./screens/RevisionHistoryScreen.jsx";
import EntriesScreen from "./screens/EntriesScreen.jsx";
import ReviewScreen from "./screens/ReviewScreen.jsx";
import SystemSettingsScreen from "./screens/SystemSettingsScreen.jsx";
import NotesScreen from "./screens/NotesScreen.jsx";
import PaymentHistoryScreen from "./screens/PaymentHistoryScreen.jsx";
import NotificationsScreen from "./screens/NotificationsScreen.jsx";
import AuditLogScreen from "./screens/AuditLogScreen.jsx";
import ReportsScreen from "./screens/ReportsScreen.jsx";
import UsersScreen from "./screens/UsersScreen.jsx";
import SettingsScreen from "./screens/SettingsScreen.jsx";
import NotFoundScreen from "./screens/NotFoundScreen.jsx";


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
  // The signed-in person's own income and expense entries.
  const [tx, setTx] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [comments, setComments] = useState([]);
  // Receipts the signed-in User attached to their entries, and — for an
  // Admin — the receipts waiting for review plus the ones they decided.
  const [receipts, setReceipts] = useState([]);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState("");
  // False until the first data load after signing in arrives. Until then the
  // screens would show empty lists and a ₱0.00 balance, which on a slow
  // connection reads as "my data is gone"; a loading message shows instead.
  const [dataReady, setDataReady] = useState(false);
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
    // Incoming notifications stay a little longer than "saved" confirmations.
    const t = setTimeout(() => setToast(null), toast.kind === "notice" ? 6000 : 3200);
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
        if (!sess.mustChangePassword) await refreshAll();
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

  // Notification ids already seen, to tell which ones just arrived; and when
  // the person last did something themselves, so their own action's
  // notification ("Bill added") is not announced back to them as news.
  const seenNotifs = useRef(null);
  const lastOwnAction = useRef(0);
  const refreshing = useRef(null);
  const refreshAgain = useRef(false);

  // Everything the screens show comes from one request (/api/sync). Calls that
  // arrive while one is in flight are folded into a single follow-up, so a
  // burst of live updates costs at most two requests.
  function refreshAll() {
    if (refreshing.current) {
      refreshAgain.current = true;
      return refreshing.current;
    }
    refreshing.current = (async () => {
      try {
        const data = await api("/api/sync");
        setBills(data.bills); setTx(data.transactions); setBudgets(data.budgets);
        setNotifs(data.notifications); setComments(data.comments);
        setAuditLog(data.auditLog); setUsers(data.users);
        setReceipts(data.receipts || []); setReviewQueue(data.reviewQueue || []);
        // A role or name changed elsewhere (by an Admin, or on another device).
        setSession((s) => (s ? { ...s, ...data.me } : s));
        announceNew(data.notifications);
        setLoadError("");
        setDataReady(true);
      } catch (err) {
        if (err.status !== 401) setLoadError(err.message);
      } finally {
        refreshing.current = null;
        if (refreshAgain.current) {
          refreshAgain.current = false;
          refreshAll();
        }
      }
    })();
    return refreshing.current;
  }

  function announceNew(list) {
    const ids = new Set(list.map((n) => n._id));
    const before = seenNotifs.current;
    seenNotifs.current = ids;
    if (!before) return; // first load: nothing is "new"
    const fresh = list.filter((n) => !n.read && !before.has(n._id));
    if (!fresh.length || Date.now() - lastOwnAction.current < 4000) return;
    setToast(fresh.length === 1
      ? { kind: "notice", type: fresh[0].type, text: fresh[0].message }
      : { kind: "notice", text: `${fresh.length} new notifications` });
  }

  // Every write goes through here. It resolves to true as soon as the server
  // has accepted the change, so the dialog closes at once; the fresh data
  // loads in the background. On failure the form keeps what was typed.
  async function perform(request, successMessage) {
    try {
      lastOwnAction.current = Date.now();
      await request();
      if (successMessage) fireToast(successMessage);
      refreshAll();
      return true;
    } catch (err) {
      fireError(err);
      return false;
    }
  }

  // Live updates while signed in: the server pushes "something changed" and
  // the screens reload by themselves. Coming back to the tab or regaining a
  // connection also refreshes, in case anything happened while away.
  useEffect(() => {
    if (!session || session.mustChangePassword) return undefined;
    let timer = null;
    const soon = () => { clearTimeout(timer); timer = setTimeout(refreshAll, 150); };
    const stop = connectLive(session.token, { onChange: soon, onReconnect: soon });
    const onVisible = () => { if (document.visibilityState === "visible") soon(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", soon);
    return () => {
      stop();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", soon);
    };
  }, [session && session.token, session && session.mustChangePassword]);

  // Unread count in the browser tab / installed app title, like a chat app.
  useEffect(() => {
    const unread = notifs.filter((n) => !n.read).length;
    document.title = unread ? `(${unread}) FinTrack Stark` : "FinTrack Stark";
  }, [notifs]);

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
        refreshAll();
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
      refreshAll();
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
      if (!sess.mustChangePassword) refreshAll();
      return null;
    } catch (err) {
      return err.message;
    }
  }
  function clearLocalSession() {
    sessionStorage.removeItem("fts_token");
    setSession(null);
    setSessionEnded(false);
    setBills([]); setTx([]); setBudgets([]); setNotifs([]); setAuditLog([]); setUsers([]); setComments([]);
    setReceipts([]); setReviewQueue([]);
    setDataReady(false);
    setLoadError("");
    seenNotifs.current = null;
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
  // Records the entry, then attaches its receipt if one was chosen. The entry
  // is saved first and on its own: if only the receipt fails, the entry still
  // stands (so the form is cleared and nothing is saved twice) and the person
  // is told to attach the receipt again from My Entries.
  async function addTx(t, receipt) {
    lastOwnAction.current = Date.now();
    let entry;
    try {
      entry = await api("/api/transactions", { method: "POST", body: t });
    } catch (err) {
      fireError(err);
      return false;
    }
    if (receipt) {
      try {
        await api("/api/receipts", { method: "POST", body: { ...receipt, transactionId: entry._id } });
        fireToast(`${t.type} of ${peso(t.amount)} recorded — receipt sent for review.`);
      } catch (err) {
        fireToast(`⚠ ${t.type} recorded, but the receipt was not attached: ${err.message} Attach it from My Entries.`);
      }
    } else {
      fireToast(`${t.type} of ${peso(t.amount)} recorded.`);
    }
    refreshAll();
    return true;
  }
  // ---- Receipts (Asset submission + Review and Approval) ----
  const submitReceipt = (entryId, receipt) => perform(
    () => api("/api/receipts", { method: "POST", body: { ...receipt, transactionId: entryId } }),
    "Receipt sent for review."
  );
  const reviewReceipt = (id, action, note) => perform(
    () => api("/api/receipts/" + id + "/review", { method: "POST", body: { action, note } }),
    { verify: "Receipt verified.", revision: "Sent back for revision.", reject: "Receipt rejected." }[action]
  );
  const editTx = (id, patch) => perform(
    () => api("/api/transactions/" + id, { method: "PUT", body: patch }),
    "Entry updated — the previous figures are kept in Revision History."
  );
  function deleteTx(entry) {
    askConfirm(`Delete this ${entry.type.toLowerCase()} of ${peso(entry.amount)}? It stops counting in your balance.`, async () => {
      setConfirmDialog(null);
      await perform(() => api("/api/transactions/" + entry._id, { method: "DELETE" }), "Entry deleted.");
    }, "Delete Entry");
  }
  // ---- Notes ----
  const addNote = (note) => perform(() => api("/api/comments", { method: "POST", body: note }), "Note saved.");
  const editNote = (id, note) => perform(() => api("/api/comments/" + id, { method: "PUT", body: note }), "Note updated.");
  function deleteNote(note) {
    askConfirm(`Delete the note "${note.title || note.text.split("\n")[0].slice(0, 40)}"?`, async () => {
      setConfirmDialog(null);
      await perform(() => api("/api/comments/" + note._id, { method: "DELETE" }), "Note deleted.");
    }, "Delete Note");
  }

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
      refreshAll();
      return null;
    } catch (err) { return err.message; }
  }
  async function changePassword(currentPassword, newPassword) {
    try {
      const data = await api("/api/auth/me/password", { method: "PUT", body: { currentPassword, newPassword } });
      // The server invalidates every other session and hands back a fresh token.
      const sess = startSession(data);
      fireToast("Password changed — other devices were signed out.");
      refreshAll();
      return null;
    } catch (err) { return err.message; }
  }

  // ---- Admin ----
  const setUserRole = (userId, role) => perform(
    () => api("/api/users/" + userId + "/role", { method: "PUT", body: { role } }),
    "Role updated."
  );
  function deleteUser(user) {
    askConfirm(`Delete the account for ${user.name}? Their bills, budgets, entries and notes are removed too. This cannot be undone.`, async () => {
      setConfirmDialog(null);
      await perform(() => api("/api/users/" + user._id, { method: "DELETE" }), "Account deleted.");
    }, "Delete Account");
  }
  // Resolves to the temporary password, or null if the reset failed.
  async function resetUserPassword(user) {
    try {
      const data = await api("/api/users/" + user._id + "/reset-password", { method: "POST" });
      refreshAll();
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
        <ForcePasswordChangeScreen session={session} changePassword={changePassword} logout={logout} theme={theme} />
        {toast && <Toast toast={toast} onOpen={() => { setToast(null); navigate("/notifications"); }} />}
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
              <Shell session={session} logout={requestLogout} theme={theme} setTheme={setTheme} notifs={notifs} loadError={loadError} dataReady={dataReady} onRetry={refreshAll}
                reviewWaiting={reviewQueue.filter((r) => r.status === "For Review" && r.latest).length} />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<DashboardScreen session={session} bills={bills} tx={tx} budgets={budgets} notifs={notifs} users={users} auditLog={auditLog} reviewQueue={reviewQueue} onNavigate={navigate} />} />
          {/* A User's own money. An Admin has no wallet (separation of duties). */}
          <Route element={<RequireRole session={session} roles={["User"]} />}>
          <Route path="/categories" element={<CategoryList bills={bills} onOpen={(name) => navigate("/categories/" + encodeURIComponent(name))} />} />
          <Route path="/categories/:name" element={<CategoryDetailRoute bills={bills} />} />
          <Route path="/submit" element={<LogEntryScreen addTx={addTx} />} />
          <Route path="/budgets" element={<BudgetsScreen budgets={budgets} tx={tx} addBudget={addBudget} editBudget={editBudget} deleteBudget={deleteBudget} />} />
          <Route path="/bills" element={<BillsScreen bills={bills} addBill={addBill} markPaid={markPaid} editBill={editBill} deleteBill={deleteBill} />} />
          <Route path="/revisions" element={<RevisionHistoryScreen tx={tx} />} />
          <Route path="/entries" element={<EntriesScreen tx={tx} editTx={editTx} deleteTx={deleteTx} receipts={receipts} submitReceipt={submitReceipt} onNavigate={navigate} />} />
          <Route path="/notes" element={<NotesScreen comments={comments} addNote={addNote} editNote={editNote} deleteNote={deleteNote} tx={tx} me={session?.id} />} />
          <Route path="/payments" element={<PaymentHistoryScreen bills={bills} />} />
          <Route path="/reports" element={<ReportsScreen tx={tx} bills={bills} budgets={budgets} />} />
          </Route>
          <Route path="/notifications" element={<NotificationsScreen notifs={notifs} markRead={markNotifRead} markAllRead={markAllNotifsRead} onNavigate={navigate} />} />
          <Route path="/settings" element={<SettingsScreen session={session} updateProfile={updateProfile} changePassword={changePassword} theme={theme} setTheme={setTheme} />} />

          <Route element={<RequireRole session={session} path="/review" />}>
            <Route path="/review" element={<ReviewScreen reviewQueue={reviewQueue} reviewReceipt={reviewReceipt} />} />
          </Route>
          <Route element={<RequireRole session={session} path="/audit" />}>
            <Route path="/audit" element={<AuditLogScreen auditLog={auditLog} />} />
          </Route>
          <Route element={<RequireRole session={session} path="/system" />}>
            <Route path="/system" element={<SystemSettingsScreen onSaved={fireToast} />} />
          </Route>
          <Route element={<RequireRole session={session} path="/users" />}>
            <Route path="/users" element={<UsersScreen users={users} session={session} setUserRole={setUserRole} deleteUser={deleteUser} resetUserPassword={resetUserPassword} />} />
          </Route>

          <Route path="*" element={<NotFoundScreen onHome={() => navigate("/dashboard")} />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <InstallPrompt />
      {toast && <Toast toast={toast} onOpen={() => { setToast(null); navigate("/notifications"); }} />}
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
