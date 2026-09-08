import { LABELS } from "../nav.js";

export default function Topbar({ screen }) {
  return (
    <div className="topbar">
      <div>
        <h1>{LABELS[screen]}</h1>
        <div className="path">fintrackstark / {screen}</div>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
        {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
      </div>
    </div>
  );
}
