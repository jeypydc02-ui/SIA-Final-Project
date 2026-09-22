import { useLocation, useParams } from "react-router-dom";
import { TITLES } from "../lib/nav.js";

export default function Topbar() {
  const { pathname } = useLocation();
  const { name } = useParams();

  // Category Detail is the one screen whose title depends on the URL segment.
  const title = name
    ? `Category Detail — ${decodeURIComponent(name)}`
    : TITLES[pathname] || "FinTrack Stark";

  return (
    <div className="topbar">
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
