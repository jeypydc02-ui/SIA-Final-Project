import { useState } from "react";

// Shown instead of the app when an Admin has reset this account's password.
// The temporary one must be replaced before anything else; the server refuses
// every other request until then.
export default function ForcePasswordChangeScreen({ session, changePassword, logout }) {
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
