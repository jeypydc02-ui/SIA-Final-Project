import { useState } from "react";
import ThemeToggle from "../components/ThemeToggle.jsx";

const ROLE_ACCESS = {
  Admin: "Manage users and roles, view all audit logs and reports, and administer system settings.",
  Reviewer: "Review submitted entries — approve, reject, or request revision — and view the audit log.",
  User: "Submit and track your own bills, entries, budgets, and notes.",
};

export default function SettingsScreen({ session, updateProfile, changePassword, theme, setTheme }) {
  const [profile, setProfile] = useState({
    firstName: session.name.split(" ")[0] || "",
    lastName: session.name.split(" ").slice(1).join(" ") || "",
    email: session.email,
  });
  const [profileMsg, setProfileMsg] = useState(null); // {type, text}
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState(null);
  const [savingPw, setSavingPw] = useState(false);

  async function saveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    const err = await updateProfile(profile);
    setSavingProfile(false);
    setProfileMsg(err ? { type: "error", text: err } : { type: "ok", text: "Profile saved." });
  }

  async function savePassword(e) {
    e.preventDefault();
    setPwMsg(null);
    if (pw.newPassword !== pw.confirm) {
      return setPwMsg({ type: "error", text: "The new passwords do not match." });
    }
    if (pw.newPassword.length < 8) {
      return setPwMsg({ type: "error", text: "New password must be at least 8 characters." });
    }
    setSavingPw(true);
    const err = await changePassword(pw.currentPassword, pw.newPassword);
    setSavingPw(false);
    if (err) return setPwMsg({ type: "error", text: err });
    setPw({ currentPassword: "", newPassword: "", confirm: "" });
    setPwMsg({ type: "ok", text: "Password changed. Any other signed-in device was logged out." });
  }

  return (
    <div>
      <div className="pagehead">
        <div>
          <h2>Settings</h2>
          <div className="desc">Manage your account details, password, and appearance.</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Account Details</h3>
          <form onSubmit={saveProfile}>
            <div className="form-grid">
              <div className="form-row">
                <label className="field">First name</label>
                <input value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} required />
              </div>
              <div className="form-row">
                <label className="field">Last name</label>
                <input value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} required />
              </div>
            </div>
            <div className="form-row">
              <label className="field">Email</label>
              <input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} required />
            </div>
            {profileMsg && <div className={"form-msg " + profileMsg.type}>{profileMsg.text}</div>}
            <button className="btn" type="submit" disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </div>

        <div className="card">
          <h3>Change Password</h3>
          <form onSubmit={savePassword}>
            <div className="form-row">
              <label className="field">Current password</label>
              <input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
            </div>
            <div className="form-row">
              <label className="field">New password</label>
              <input type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required minLength={8} />
              <div className="hint">At least 8 characters.</div>
            </div>
            <div className="form-row">
              <label className="field">Confirm new password</label>
              <input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
            </div>
            {pwMsg && <div className={"form-msg " + pwMsg.type}>{pwMsg.text}</div>}
            <button className="btn" type="submit" disabled={savingPw}>
              {savingPw ? "Updating…" : "Update Password"}
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Appearance</h3>
          <div className="settings-row">
            <div>
              <div style={{ fontSize: 13 }}>Dark mode</div>
              <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>Remembered on this device.</div>
            </div>
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>
        </div>

        <div className="card">
          <h3>Your Access</h3>
          <div className="settings-row">
            <div style={{ fontSize: 13 }}>Current role</div>
            <span className="badge neutral">{session.role}</span>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "10px 0 0" }}>
            {ROLE_ACCESS[session.role]}
          </p>
          <p style={{ fontSize: 11.5, color: "var(--text-dim)", margin: "10px 0 0" }}>
            Roles are assigned by an administrator and cannot be changed here.
          </p>
        </div>
      </div>
    </div>
  );
}
