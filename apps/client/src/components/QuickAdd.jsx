import { useEffect } from "react";

// The "+" in the bottom bar (and the Add button in the top bar on a wide
// screen): the three things people record, without hunting through the menu.
const OPTIONS = [
  { key: "expense", label: "Expense", hint: "Money you spent", to: "/submit?type=Expense", tone: "danger" },
  { key: "income", label: "Income", hint: "Money you received", to: "/submit?type=Income", tone: "ok" },
  { key: "bill", label: "Bill", hint: "A bill to be reminded about", to: "/bills?add=1", tone: "neutral" },
];

export default function QuickAdd({ onPick, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay sheet-overlay" onClick={onClose}>
      <div className="modal sheet" role="dialog" aria-modal="true" aria-labelledby="quick-add-title" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden="true" />
        <h3 id="quick-add-title">What do you want to add?</h3>
        <div className="quick-add-grid">
          {OPTIONS.map((o) => (
            <button key={o.key} type="button" className="quick-add-option" onClick={() => onPick(o.to)}>
              <span className={"quick-add-mark " + o.tone} aria-hidden="true">{o.key === "expense" ? "−" : "+"}</span>
              <span className="quick-add-text">
                <span className="quick-add-label">{o.label}</span>
                <span className="quick-add-hint">{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
