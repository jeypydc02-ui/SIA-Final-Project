import { useState, useEffect } from "react";
import { api } from "./api.js";
import { peso } from "./utils.js";

import LandingPage from "./components/LandingPage.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import Dashboard from "./components/Dashboard.jsx";
import { ProjectList, ProjectDetails } from "./components/BillCategories.jsx";
import BillsScreen from "./components/BillsScreen.jsx";
import PaymentHistory from "./components/PaymentHistory.jsx";
import SubmissionForm from "./components/SubmissionForm.jsx";
import VersionHistory from "./components/VersionHistory.jsx";
import ReviewApproval from "./components/ReviewApproval.jsx";
import CommentsScreen from "./components/CommentsScreen.jsx";
import NotificationsScreen from "./components/NotificationsScreen.jsx";
import AuditLogScreen from "./components/AuditLogScreen.jsx";
import ReportsScreen from "./components/ReportsScreen.jsx";
import UserManagement from "./components/UserManagement.jsx";

export default function App() {
  const [session, setSession] = useState(null); // {id,name,email,role,token}
  const [authView, setAuthView] = useState("landing"); // "landing" | "auth"
  const [authMode, setAuthMode] = useState("login"); // "login" | "register"
  const [screen, setScreen] = useState("dashboard");
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
      setScreen("dashboard");
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
      setScreen("dashboard");
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
    setAuthView("landing");
    setBills([]); setTx([]); setBudgets([]); setNotifs([]); setAuditLog([]); setUsers([]); setComments([]);
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
  async function addTx(t) {
    try {
      await api("/api/transactions", { method: "POST", body: t });
      fireToast(`${t.type} of ${peso(t.amount)} submitted for review.`);
      await refreshAll();
    } catch (err) { fireError(err); }
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

  return (
    <>
      {!session ? (
        authView === "landing" ? (
          <LandingPage
            theme={theme}
            setTheme={setTheme}
            onLogin={() => { setAuthMode("login"); setAuthView("auth"); }}
            onGetStarted={() => { setAuthMode("register"); setAuthView("auth"); }}
          />
        ) : (
          <LoginScreen
            key={authMode}
            initialMode={authMode}
            onLogin={login}
            onRegister={register}
            theme={theme}
            setTheme={setTheme}
            onBack={() => setAuthView("landing")}
          />
        )
      ) : (
        <div className="shell">
          <Sidebar screen={screen} setScreen={setScreen} session={session} logout={requestLogout} theme={theme} setTheme={setTheme} />
          <div className="main">
            <Topbar screen={screen} />
            <div className="content">
              {loadError && (
                <div className="card" style={{ marginBottom: 16, borderColor: "var(--danger)" }}>
                  <div style={{ color: "var(--danger)", fontSize: 13 }}>⚠ Could not reach the server: {loadError}</div>
                </div>
              )}
              <div className="screen-fade" key={screen}>
                {screen === "dashboard" && <Dashboard bills={bills} tx={tx} budgets={budgets} notifs={notifs} />}
                {screen === "projects" && <ProjectList bills={bills} />}
                {screen === "projectDetails" && <ProjectDetails bills={bills} />}
                {screen === "bills" && <BillsScreen bills={bills} addBill={addBill} markPaid={markPaid} />}
                {screen === "history" && <PaymentHistory bills={bills} />}
                {screen === "submission" && <SubmissionForm addTx={addTx} />}
                {screen === "versions" && <VersionHistory bills={bills} />}
                {screen === "review" && <ReviewApproval tx={tx} session={session} reviewTx={reviewTx} resubmitTx={resubmitTx} />}
                {screen === "comments" && <CommentsScreen comments={comments} addComment={addComment} />}
                {screen === "notifications" && <NotificationsScreen notifs={notifs} />}
                {screen === "audit" && <AuditLogScreen auditLog={auditLog} />}
                {screen === "reports" && <ReportsScreen tx={tx} bills={bills} budgets={budgets} />}
                {screen === "users" && <UserManagement users={users} session={session} />}
              </div>
            </div>
          </div>
        </div>
      )}
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
