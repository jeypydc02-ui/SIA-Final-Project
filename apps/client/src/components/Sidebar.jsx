import { NavLink } from "react-router-dom";
import { NAV } from "../lib/nav.js";
import ThemeToggle from "./ThemeToggle.jsx";

export default function Sidebar({ session, logout, theme, setTheme, notifs = [], open = false, onNavigate }) {
  const unread = notifs.filter((n) => !n.read).length;

  // Number the items this role can actually see. Numbering them in nav.js
  // instead would leave visible gaps wherever a restricted screen is hidden.
  let position = 0;
  const numbered = NAV.map((g) => ({
    group: g.group,
    items: g.items
      .filter((it) => !it.roles || it.roles.includes(session.role))
      .map((it) => ({ ...it, ico: String(++position).padStart(2, "0") })),
  })).filter((g) => g.items.length > 0);

  return (
    <div className={"side" + (open ? " open" : "")}>
      <div className="brand">
        <div className="brand-logo">FS</div>
        <div className="brand-text">
          <div className="mark">FinTrack Stark</div>
          <div className="sub">Integration System</div>
        </div>
      </div>
      {numbered.map(g => (
        <div className="nav-group" key={g.group}>
          <div className="nav-label">{g.group}</div>
          {g.items.map(it => (
            <NavLink
              key={it.path}
              to={it.path}
              className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
              onClick={onNavigate}
            >
              <span className="nav-ico">{it.ico}</span>
              {it.label}
              {it.path === "/notifications" && unread > 0 && <span className="nav-badge">{unread}</span>}
            </NavLink>
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
