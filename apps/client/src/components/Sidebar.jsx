import { NavLink } from "react-router-dom";
import { NAV } from "../lib/nav.js";
import ThemeToggle from "./ThemeToggle.jsx";
import Icon from "./Icon.jsx";
import { initials } from "../lib/utils.js";

export default function Sidebar({ session, logout, theme, setTheme, notifs = [], open = false, onNavigate }) {
  const unread = notifs.filter((n) => !n.read).length;

  // Only the screens this role can open; groups left empty are dropped.
  const groups = NAV.map((g) => ({
    group: g.group,
    items: g.items.filter((it) => !it.roles || it.roles.includes(session.role)),
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
      {groups.map(g => (
        <div className="nav-group" key={g.group}>
          <div className="nav-label">{g.group}</div>
          {g.items.map(it => (
            <NavLink
              key={it.path}
              to={it.path}
              className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
              onClick={onNavigate}
            >
              <span className="nav-ico"><Icon name={it.icon} size={18} /></span>
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
        <div className="side-user">
          <span className="avatar">{initials(session.name)}</span>
          <div className="side-user-text">
            <div className="side-user-name">{session.name}</div>
            <div className="side-user-role">{session.role}</div>
          </div>
        </div>
        <button type="button" className="role-pill" onClick={logout}>Log out</button>
      </div>
    </div>
  );
}
