import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import BottomNav from "./BottomNav.jsx";
import QuickAdd from "./QuickAdd.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import InstallBanner from "./InstallBanner.jsx";

// The signed-in frame: sidebar, top bar, and whichever screen the URL names.
// On a narrow screen the sidebar becomes a drawer, because a fixed 220px menu
// swallows more than half a phone's width and squeezes the content off-screen;
// a bottom tab bar then takes over everyday navigation, opening the drawer
// from its "More" tab.
export default function Shell({ session, logout, theme, setTheme, notifs, queue, loadError }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Close the drawer and the add sheet whenever the route changes, including on Back.
  useEffect(() => { setMenuOpen(false); setAdding(false); }, [pathname]);

  const unread = notifs.filter((n) => !n.read).length;
  const pendingReviews = queue.filter(
    (t) => t.status === "Pending Review" && String(t.submittedBy) !== String(session.id)
  ).length;

  return (
    <div className="shell">
      <Sidebar
        session={session} logout={logout} theme={theme} setTheme={setTheme} notifs={notifs}
        open={menuOpen} onNavigate={() => setMenuOpen(false)}
      />
      {menuOpen && <div className="side-backdrop" onClick={() => setMenuOpen(false)} />}
      <BottomNav
        session={session} unread={unread} pendingReviews={pendingReviews} menuOpen={menuOpen}
        onAdd={() => setAdding(true)} onMore={() => setMenuOpen((open) => !open)}
      />
      {adding && <QuickAdd onPick={(to) => { setAdding(false); navigate(to); }} onClose={() => setAdding(false)} />}
      <div className="main">
        <Topbar onAdd={() => setAdding(true)} />
        <div className="content">
          <InstallBanner />
          {loadError && (
            <div className="card" style={{ marginBottom: 16, borderColor: "var(--danger)" }}>
              <div style={{ color: "var(--danger)", fontSize: 13 }}>⚠ Could not load your latest data: {loadError}</div>
            </div>
          )}
          {/* Keyed on the address, so a screen that crashed does not stay
              broken after navigating somewhere else. */}
          <ErrorBoundary key={pathname} inline>
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
