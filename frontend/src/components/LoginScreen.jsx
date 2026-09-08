import { useState } from "react";
import ThemeToggle from "./ThemeToggle.jsx";

const FEATURE_PILLS = ["Bill Reminders", "Payment Tracking", "Review Workflow"];

export default function LoginScreen({ onLogin, onRegister, theme, setTheme, initialMode = "login", onBack }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("jp@fintrackstark.app");
  const [password, setPassword] = useState("demo123");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  function switchMode(next) {
    setMode(next);
    setErr("");
  }

  async function submitLogin(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const ok = await onLogin(email, password);
    setBusy(false);
    if (!ok) setErr("Invalid credentials, or the server is unreachable. Try a demo account below.");
  }

  async function submitRegister(e) {
    e.preventDefault();
    setErr("");
    if (!firstName.trim() || !lastName.trim() || !regEmail.trim() || !regPassword) { setErr("All fields are required."); return; }
    if (regPassword.length < 6) { setErr("Password must be at least 6 characters."); return; }
    if (regPassword !== regConfirm) { setErr("Passwords do not match."); return; }
    setBusy(true);
    const errMsg = await onRegister(firstName.trim(), lastName.trim(), regEmail.trim(), regPassword);
    setBusy(false);
    if (errMsg) setErr(errMsg);
  }

  return (
    <div className="auth-page">
      <div className="auth-side">
        <div className="login-logo">FS</div>
        <div className="auth-word">FinTrack Stark</div>
        <div className="auth-tag">Personal Finance &middot; Bill Reminder &middot; Payment Tracking</div>
        <div className="auth-desc">
          {mode === "login"
            ? "Sign in to manage your bills, track payments, and stay on top of your budget."
            : "Create your account to start tracking bills, payments, and budgets in one place."}
        </div>
        <div className="auth-pills">
          {FEATURE_PILLS.map(p => <span className="auth-pill" key={p}>{p}</span>)}
        </div>
      </div>

      <div className="auth-form-side">
        {onBack && (
          <div className="auth-back" onClick={onBack}>
            <span>←</span> Back to home
          </div>
        )}
        <div className="auth-theme-toggle"><ThemeToggle theme={theme} setTheme={setTheme} /></div>

        <div className="auth-form">
          <h2 className="auth-title">{mode === "login" ? "Welcome back" : "Create account"}</h2>
          <div className="auth-subtitle">
            {mode === "login" ? "Sign in to your FinTrack Stark account" : "Join FinTrack Stark today"}
          </div>

          {mode === "login" ? (
            <form onSubmit={submitLogin}>
              <div className="form-row">
                <label className="field">Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="field">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              {err && <div style={{ color: "var(--danger)", fontSize: 12, marginBottom: 12 }}>{err}</div>}
              <button className="btn" style={{ width: "100%" }} type="submit" disabled={busy}>{busy ? "Signing in…" : "Log In"}</button>
              <div className="auth-switch">Don't have an account? <a onClick={() => switchMode("register")}>Create one</a></div>
            </form>
          ) : (
            <form onSubmit={submitRegister}>
              <div className="form-grid">
                <div className="form-row"><label className="field">First Name</label><input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Juan" /></div>
                <div className="form-row"><label className="field">Last Name</label><input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Dela Cruz" /></div>
              </div>
              <div className="form-row">
                <label className="field">Email</label>
                <input value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="form-grid">
                <div className="form-row"><label className="field">Password</label><input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} /></div>
                <div className="form-row"><label className="field">Confirm Password</label><input type="password" value={regConfirm} onChange={e => setRegConfirm(e.target.value)} /></div>
              </div>
              {err && <div style={{ color: "var(--danger)", fontSize: 12, marginBottom: 12 }}>{err}</div>}
              <button className="btn" style={{ width: "100%" }} type="submit" disabled={busy}>{busy ? "Creating account…" : "Create Account"}</button>
              <div className="auth-legal">By creating an account, you agree to FinTrack Stark's Terms of Service and Privacy Policy.</div>
              <div className="auth-switch">Already have an account? <a onClick={() => switchMode("login")}>Sign in</a></div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
