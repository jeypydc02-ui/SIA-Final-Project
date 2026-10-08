import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import PasswordInput from "../components/PasswordInput.jsx";
import { AuthFrame, FormError } from "./LoginScreen.jsx";
import { api } from "../lib/api.js";

// Forgot password: the person types their e-mail and gets a one-time link.
// The answer is the same whether or not an account exists, so this page
// cannot be used to find out who has an account.
export function ForgotPasswordScreen({ theme, setTheme }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (!email.trim()) { setErr("Enter the e-mail address of your account."); return; }
    setBusy(true);
    try {
      const data = await api("/api/auth/forgot", { method: "POST", body: { email: email.trim() } });
      setSent(data.message);
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      blurb="Locked out? We will e-mail you a link to choose a new password."
      title="Forgot password" subtitle={sent ? "Check your e-mail" : "Enter the e-mail address you sign in with"}
      theme={theme} setTheme={setTheme} onBack={() => navigate("/login")} backLabel="Back to sign in"
    >
      {sent ? (
        <div>
          <div className="auth-note">{sent}</div>
          <div className="auth-note">The link works once and expires in 30 minutes. Check your spam folder if it does not arrive.</div>
          <button type="button" className="btn" style={{ width: "100%", marginTop: 8 }} onClick={() => navigate("/login")}>Back to Sign In</button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="form-row">
            <label className="field">Email</label>
            <input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
          </div>
          <FormError text={err} />
          <button className="btn" style={{ width: "100%" }} type="submit" disabled={busy}>{busy ? "Sending…" : "Send Reset Link"}</button>
          <div className="auth-switch">Remembered it? <a onClick={() => navigate("/login")}>Sign in</a></div>
        </form>
      )}
    </AuthFrame>
  );
}

// Reached from the e-mailed link (/reset-password?token=…). Setting the new
// password signs the account out everywhere; the person then signs in.
export function ResetPasswordScreen({ theme, setTheme }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setErr("Passwords do not match."); return; }
    setBusy(true);
    try {
      await api("/api/auth/reset", { method: "POST", body: { token, password } });
      setDone(true);
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  }

  let body;
  if (!token) {
    body = (
      <div>
        <div className="auth-note">This page opens from the link in the reset e-mail. That link is missing or incomplete.</div>
        <button type="button" className="btn" style={{ width: "100%", marginTop: 8 }} onClick={() => navigate("/forgot-password")}>Ask for a New Link</button>
      </div>
    );
  } else if (done) {
    body = (
      <div>
        <div className="auth-note">Your password has been changed, and every device that was signed in has been signed out.</div>
        <button type="button" className="btn" style={{ width: "100%", marginTop: 8 }} onClick={() => navigate("/login")}>Sign In</button>
      </div>
    );
  } else {
    body = (
      <form onSubmit={submit}>
        <div className="form-row"><label className="field">New Password</label><PasswordInput autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></div>
        <div className="form-row"><label className="field">Confirm New Password</label><PasswordInput autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
        <FormError text={err} />
        {err && /expired|already used/.test(err) && (
          <div className="auth-switch" style={{ marginTop: 0, marginBottom: 12 }}><Link to="/forgot-password">Ask for a new link</Link></div>
        )}
        <button className="btn" style={{ width: "100%" }} type="submit" disabled={busy}>{busy ? "Saving…" : "Set New Password"}</button>
      </form>
    );
  }

  return (
    <AuthFrame
      blurb="Choose a new password for your FinTrack Stark account."
      title={done ? "Password changed" : "Set a new password"} subtitle={done ? "You can sign in with it now" : "At least 8 characters"}
      theme={theme} setTheme={setTheme} onBack={() => navigate("/login")} backLabel="Back to sign in"
    >
      {body}
    </AuthFrame>
  );
}
