import { useState } from "react";
import PasswordInput from "../components/PasswordInput.jsx";
import { Link } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle.jsx";

const FEATURE_PILLS = ["Bill Reminders", "Payment Tracking", "Monthly Budgets"];

export default function LoginScreen({ onLogin, onRegister, theme, setTheme, initialMode = "login", onBack, onSwitchMode }) {
  const mode = initialMode;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Signing in and registering are separate addresses (/login and /register),
  // so switching between them is a navigation, not local state.
  function switchMode(next) {
    setErr("");
    onSwitchMode(next);
  }

  async function submitLogin(e) {
    e.preventDefault();
    setErr("");
    if (!email.trim() || !password) { setErr("Enter your email and password."); return; }
    setBusy(true);
    // The server's own message: wrong password, too many attempts, and an
    // unreachable server each need a different response from the person.
    const errMsg = await onLogin(email.trim(), password);
    setBusy(false);
    if (errMsg) setErr(errMsg);
  }

  async function submitRegister(e) {
    e.preventDefault();
    setErr("");
    if (!firstName.trim() || !lastName.trim() || !regEmail.trim() || !regPassword) { setErr("All fields are required."); return; }
    if (regPassword.length < 8) { setErr("Password must be at least 8 characters."); return; }
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
                <input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="form-row">
                <label className="field">Password</label>
                <PasswordInput autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <div style={{ margin: "-4px 0 12px", fontSize: 12 }}>
                <button type="button" className="linkbtn" onClick={() => setShowForgot((v) => !v)}>Forgot your password?</button>
                {showForgot && (
                  <div className="hint" style={{ marginTop: 6 }}>
                    Ask your FinTrack Stark administrator to reset it. They will give you a temporary password, and you will choose a new one the next time you sign in.
                  </div>
                )}
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
                <input type="email" autoComplete="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="form-grid">
                <div className="form-row"><label className="field">Password</label><PasswordInput autoComplete="new-password" value={regPassword} onChange={e => setRegPassword(e.target.value)} /></div>
                <div className="form-row"><label className="field">Confirm Password</label><PasswordInput autoComplete="new-password" value={regConfirm} onChange={e => setRegConfirm(e.target.value)} /></div>
              </div>
              {err && <div style={{ color: "var(--danger)", fontSize: 12, marginBottom: 12 }}>{err}</div>}
              <button className="btn" style={{ width: "100%" }} type="submit" disabled={busy}>{busy ? "Creating account…" : "Create Account"}</button>
              <div className="auth-legal">By creating an account, you agree to FinTrack Stark's <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>.</div>
              <div className="auth-switch">Already have an account? <a onClick={() => switchMode("login")}>Sign in</a></div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
