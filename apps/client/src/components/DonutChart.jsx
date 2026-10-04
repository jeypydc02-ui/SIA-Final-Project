import { categoryTone } from "./CategoryIcon.jsx";

// Spending by category as a ring, Monefy-style. `slices` is [{label, value}];
// each slice takes the colour of its category's tone. Plain SVG circles with
// stroke-dasharray — no chart library.
export default function DonutChart({ slices, size = 168, thickness = 22, centerTop, centerBottom }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut" role="img"
      aria-label={slices.map((s) => `${s.label} ${Math.round((s.value / (total || 1)) * 100)}%`).join(", ") || "No spending yet"}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="donut-track" strokeWidth={thickness} />
      {total > 0 && slices.map((s) => {
        const len = (s.value / total) * c;
        const el = (
          <circle
            key={s.label}
            cx={size / 2} cy={size / 2} r={r} fill="none"
            className={"donut-slice stroke-" + categoryTone(s.label)}
            strokeWidth={thickness}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        offset += len;
        return el;
      })}
      <text x="50%" y="47%" textAnchor="middle" className="donut-top">{centerTop}</text>
      <text x="50%" y="60%" textAnchor="middle" className="donut-bottom">{centerBottom}</text>
    </svg>
  );
}
