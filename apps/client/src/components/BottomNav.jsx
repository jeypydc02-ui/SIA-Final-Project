import { NavLink } from "react-router-dom";

// Phone navigation in the style of GCash, YNAB and Monefy: the four places
// people go most, one tap away at the bottom of the screen, with adding an
// entry in the middle. Everything else stays in the full menu behind "More".
// Only shown below the drawer breakpoint (see .bottom-nav in index.css).

function Icon({ name }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  switch (name) {
    case "home":
      return <svg {...common}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-5h4v5" /></svg>;
    case "bills":
      return <svg {...common}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></svg>;
    case "review":
      return <svg {...common}><path d="M9 11l2.5 2.5L16 9" /><rect x="4" y="3.5" width="16" height="17" rx="2" /></svg>;
    case "inbox":
      return <svg {...common}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0" /></svg>;
    case "more":
      return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
    case "plus":
      return <svg {...common} width={24} height={24} strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>;
    default:
      return null;
  }
}

function Tab({ to, icon, label, badge }) {
  return (
    <NavLink to={to} className={({ isActive }) => "bn-tab" + (isActive ? " active" : "")}>
      <span className="bn-icon">
        <Icon name={icon} />
        {badge > 0 && <span className="bn-badge">{badge > 99 ? "99+" : badge}</span>}
      </span>
      <span className="bn-label">{label}</span>
    </NavLink>
  );
}

export default function BottomNav({ session, unread, pendingReviews, onAdd, onMore, menuOpen }) {
  const staff = session.role === "Admin" || session.role === "Reviewer";
  return (
    <nav className="bottom-nav" aria-label="Main">
      <Tab to="/dashboard" icon="home" label="Home" />
      {/* A reviewer's daily job is the queue; a user's is their bills. */}
      {staff
        ? <Tab to="/review" icon="review" label="Review" badge={pendingReviews} />
        : <Tab to="/bills" icon="bills" label="Bills" />}
      <button type="button" className="bn-add" onClick={onAdd} aria-label="Add an entry">
        <Icon name="plus" />
      </button>
      <Tab to="/notifications" icon="inbox" label="Inbox" badge={unread} />
      <button type="button" className={"bn-tab" + (menuOpen ? " active" : "")} onClick={onMore} aria-label="Open the full menu">
        <span className="bn-icon"><Icon name="more" /></span>
        <span className="bn-label">More</span>
      </button>
    </nav>
  );
}
