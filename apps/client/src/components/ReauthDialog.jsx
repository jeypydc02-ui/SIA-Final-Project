import { useState } from "react";
import PasswordInput from "./PasswordInput.jsx";

// Shown over whatever screen was open when the server ended the session.
export default function ReauthDialog({ email, onSubmit, onLogout }) {
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
            <PasswordInput id="reauth-password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
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
