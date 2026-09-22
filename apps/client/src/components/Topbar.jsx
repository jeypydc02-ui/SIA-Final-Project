import { useLocation, useParams } from "react-router-dom";
import { TITLES } from "../lib/nav.js";

export default function Topbar({ onOpenMenu }) {
  const { pathname } = useLocation();
  const { name } = useParams();

  // Category Detail is the one screen whose title depends on the URL segment.
  const title = name
    ? `Category Detail — ${decodeURIComponent(name)}`
    : TITLES[pathname] || "FinTrack Stark";

  return (
    <div className="topbar">
      {/* Only rendered as a control on narrow screens, where the sidebar is a
          drawer; CSS hides it once the sidebar is permanently visible. */}
      <button className="menu-btn" onClick={onOpenMenu} aria-label="Open menu">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <div>
        <h1>{title}</h1>
        {/* Mirrors the address bar, so the breadcrumb and the URL always agree. */}
        <div className="path">fintrackstark{pathname}</div>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
        {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
      </div>
    </div>
  );
}
