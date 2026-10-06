import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import BottomNav from "./BottomNav.jsx";
import QuickAdd from "./QuickAdd.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";

// The signed-in frame: sidebar, top bar, and whichever screen the URL names.
// On a narrow screen the sidebar becomes a drawer, because a fixed 220px menu
// swallows more than half a phone's width and squeezes the content off-screen;
// a bottom tab bar then takes over everyday navigation, opening the drawer
// from its "More" tab.
export default function Shell({ session, logout, theme, setTheme, notifs, loadError, dataReady = true, onRetry, reviewWaiting = 0 }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Close the drawer and the add sheet whenever the route changes, including on Back.
  useEffect(() => { setMenuOpen(false); setAdding(false); }, [pathname]);

  const unread = notifs.filter((n) => !n.read).length;

  return (
    <div className="shell">
      <Sidebar
        session={session} logout={logout} theme={theme} setTheme={setTheme} notifs={notifs} reviewWaiting={reviewWaiting}
        open={menuOpen} onNavigate={() => setMenuOpen(false)}
      />
      {menuOpen && <div className="side-backdrop" onClick={() => setMenuOpen(false)} />}
      <BottomNav
        unread={unread} menuOpen={menuOpen}
        onAdd={() => setAdding(true)} onMore={() => setMenuOpen((open) => !open)}
      />
      {adding && <QuickAdd onPick={(to) => { setAdding(false); navigate(to); }} onClose={() => setAdding(false)} />}
      <div className="main">
        <Topbar onAdd={() => setAdding(true)} />
        <div className="content">
          {loadError && (
            <div className="card load-error" role="alert">
              <span>⚠ Could not load your latest data: {loadError}</span>
              {onRetry && <button type="button" className="btn small ghost" onClick={onRetry}>Try again</button>}
            </div>
          )}
          {!dataReady ? (
            !loadError && (
              <div className="loading-block" role="status">
                <span className="loading-bar" />
                Loading your data…
              </div>
            )
          ) : (
            /* Keyed on the address, so a screen that crashed does not stay
               broken after navigating somewhere else. */
            <ErrorBoundary key={pathname} inline>
              <Outlet />
            </ErrorBoundary>
          )}
        </div>
      </div>
    </div>
  );
}
