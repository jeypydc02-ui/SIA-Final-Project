import { useLocation, useParams } from "react-router-dom";
import { TITLES } from "../lib/nav.js";

// On a phone the menu and the add button live in the bottom bar instead
// (BottomNav), and CSS hides this bar's right-hand side.
export default function Topbar({ onAdd }) {
  const { pathname } = useLocation();
  const { name } = useParams();

  // Category Detail is the one screen whose title depends on the URL segment.
  // useParams has already decoded it; decoding again crashed on a "%".
  const title = name
    ? `Category Detail — ${name}`
    : TITLES[pathname] || "FinTrack Stark";

  return (
    <div className="topbar">
      <div>
        <h1>{title}</h1>
        {/* Mirrors the address bar, so the breadcrumb and the URL always agree. */}
        <div className="path">fintrackstark{pathname}</div>
      </div>
      <div className="topbar-right">
        <span className="topbar-date">
          {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </span>
        {onAdd && <button type="button" className="btn small" onClick={onAdd}>+ Add</button>}
      </div>
    </div>
  );
}
