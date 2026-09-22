import { LABELS } from "../lib/nav.js";

// A readable breadcrumb. The screen keys are internal identifiers, so they are
// turned into words rather than printed raw ("projectDetails" was leaking into
// the interface as-is).
function slug(screen) {
  return String(screen)
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

export default function Topbar({ screen }) {
  return (
    <div className="topbar">
      <div>
        <h1>{LABELS[screen] || "FinTrack Stark"}</h1>
        <div className="path">fintrackstark / {slug(screen)}</div>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
        {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
      </div>
    </div>
  );
}
