import { useState } from "react";
import PasswordInput from "../components/PasswordInput.jsx";
import { Link } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle.jsx";

const FEATURE_PILLS = ["Bill Reminders", "Payment Tracking", "Monthly Budgets"];

// The two-column frame every signed-out form shares: sign in, sign up, and
// the forgot / reset password pages.
export function AuthFrame({ blurb, title, subtitle, theme, setTheme, onBack, backLabel = "Back to home", children }) {
  return (
    <div className="auth-page">
      <div className="auth-side">
        <div className="login-logo">FS</div>
        <div className="auth-word">FinTrack Stark</div>
        <div className="auth-tag">Personal Finance &middot; Bill Reminder &middot; Payment Tracking</div>
        <div className="auth-desc">{blurb}</div>
        <div className="auth-pills">
          {FEATURE_PILLS.map(p => <span className="auth-pill" key={p}>{p}</span>)}
        </div>
      </div>

      <div className="auth-form-side">
        {onBack && (
          <div className="auth-back" onClick={onBack}>
            <span>←</span> {backLabel}
          </div>
        )}
        <div className="auth-theme-toggle"><ThemeToggle theme={theme} setTheme={setTheme} /></div>

        <div className="auth-form">
          <h2 className="auth-title">{title}</h2>
          <div className="auth-subtitle">{subtitle}</div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function FormError({ text }) {
  return text ? <div className="auth-error" role="alert">{text}</div> : null;
}

export default function LoginScreen({ onLogin, onRegisterStart, onRegisterVerify, onRegisterResend, theme, setTheme, initialMode = "login", onBack, onSwitchMode }) {
  const mode = initialMode;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  // Set once the code has been e-mailed: the address it went to.
  const [codeSentTo, setCodeSentTo] = useState("");
  const [code, setCode] = useState("");
  const [info, setInfo] = useState("");
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
    // The server's own message: wrong password, too many attempts, a
    // deactivated account and an unreachable server each need a different
    // response from the person.
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
    const result = await onRegisterStart(firstName.trim(), lastName.trim(), regEmail.trim(), regPassword);
    setBusy(false);
    if (result.error) { setErr(result.error); return; }
    setCode("");
    setInfo(`We sent a 6-digit code to ${result.email}. It expires in ${result.expiresInMinutes} minutes.`);
    setCodeSentTo(result.email);
  }

  async function submitCode(e) {
    e.preventDefault();
    setErr("");
    if (!/^\d{6}$/.test(code.trim())) { setErr("Enter the 6-digit code from the e-mail."); return; }
    setBusy(true);
    const errMsg = await onRegisterVerify(codeSentTo, code.trim());
    setBusy(false);
    if (errMsg) setErr(errMsg);
  }

  async function resend() {
    setErr("");
    setBusy(true);
    const errMsg = await onRegisterResend(codeSentTo);
    setBusy(false);
    if (errMsg) setErr(errMsg);
    else { setCode(""); setInfo(`A new code was sent to ${codeSentTo}. The old one no longer works.`); }
  }

  function changeEmail() {
    setErr(""); setInfo(""); setCode(""); setCodeSentTo("");
  }

  if (mode === "register" && codeSentTo) {
    return (
      <AuthFrame
        blurb="One last step: confirm that this e-mail address is yours."
        title="Check your e-mail" subtitle={info}
        theme={theme} setTheme={setTheme} onBack={changeEmail} backLabel="Change e-mail"
      >
        <form onSubmit={submitCode}>
          <div className="form-row">
            <label className="field" htmlFor="otp">Verification code</label>
            <input id="otp" className="otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" autoFocus />
          </div>
          <FormError text={err} />
          <button className="btn" style={{ width: "100%" }} type="submit" disabled={busy}>{busy ? "Checking…" : "Verify and Create Account"}</button>
          <div className="auth-switch">
            Didn't get it? Check your spam folder, or <a onClick={busy ? undefined : resend}>send a new code</a>.
          </div>
        </form>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      blurb={mode === "login"
        ? "Sign in to manage your bills, track payments, and stay on top of your budget."
        : "Create your account to start tracking bills, payments, and budgets in one place."}
      title={mode === "login" ? "Welcome back" : "Create account"}
      subtitle={mode === "login" ? "Sign in to your FinTrack Stark account" : "Join FinTrack Stark today"}
      theme={theme} setTheme={setTheme} onBack={onBack}
    >
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
            <Link to="/forgot-password" className="linkbtn">Forgot your password?</Link>
          </div>
          <FormError text={err} />
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
          <FormError text={err} />
          <button className="btn" style={{ width: "100%" }} type="submit" disabled={busy}>{busy ? "Sending code…" : "Create Account"}</button>
          <div className="auth-legal">We will e-mail you a code to confirm the address. By creating an account, you agree to FinTrack Stark's <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>.</div>
          <div className="auth-switch">Already have an account? <a onClick={() => switchMode("login")}>Sign in</a></div>
        </form>
      )}
    </AuthFrame>
  );
}
