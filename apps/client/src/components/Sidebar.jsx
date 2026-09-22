import { NAV } from "../lib/nav.js";
import ThemeToggle from "./ThemeToggle.jsx";

export default function Sidebar({ screen, setScreen, session, logout, theme, setTheme, notifs = [] }) {
  const unread = notifs.filter((n) => !n.read).length;

  return (
    <div className="side">
      <div className="brand">
        <div className="brand-logo">FS</div>
        <div className="brand-text">
          <div className="mark">FinTrack Stark</div>
          <div className="sub">Integration System</div>
        </div>
      </div>
      {NAV.map(g => (
        <div className="nav-group" key={g.group}>
          <div className="nav-label">{g.group}</div>
          {g.items.filter(it => !it.roles || it.roles.includes(session.role)).map(it => (
            <div key={it.id} className={"nav-item" + (screen === it.id ? " active" : "")} onClick={() => setScreen(it.id)}>
              <span className="nav-ico">{it.ico}</span>
              {it.label}
              {it.id === "notifications" && unread > 0 && <span className="nav-badge">{unread}</span>}
            </div>
          ))}
        </div>
      ))}
      <div className="side-foot">
        <div className="theme-row">
          <span>Dark mode</span>
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text)" }}>{session.name}</div>
        <div className="role-pill" onClick={logout}>{session.role} · Log out</div>
      </div>
    </div>
  );
}
