import { NavLink } from "react-router-dom";
import Icon from "./Icon.jsx";

// Phone navigation in the style of GCash, YNAB and Monefy: the four places
// people go most, one tap away at the bottom of the screen, with adding an
// entry in the middle. Everything else stays in the full menu behind "More".
// Only shown below the drawer breakpoint (see .bottom-nav in index.css).

function Tab({ to, icon, label, badge }) {
  return (
    <NavLink to={to} end className={({ isActive }) => "bn-tab" + (isActive ? " active" : "")}>
      <span className="bn-icon">
        <Icon name={icon} size={22} />
        {badge > 0 && <span className="bn-badge">{badge > 99 ? "99+" : badge}</span>}
      </span>
      <span className="bn-label">{label}</span>
    </NavLink>
  );
}

export default function BottomNav({ unread, onAdd, onMore, menuOpen }) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      <Tab to="/dashboard" icon="home" label="Home" />
      <Tab to="/bills" icon="receipt" label="Bills" />
      <button type="button" className="bn-add" onClick={onAdd} aria-label="Add an entry">
        <Icon name="plus" size={24} strokeWidth={2.2} />
      </button>
      <Tab to="/notifications" icon="bell" label="Inbox" badge={unread} />
      <button type="button" className={"bn-tab" + (menuOpen ? " active" : "")} onClick={onMore} aria-label="Open the full menu">
        <span className="bn-icon"><Icon name="menu" size={22} /></span>
        <span className="bn-label">More</span>
      </button>
    </nav>
  );
}
