import { useState } from "react";
import { peso, thisMonthISO, fmtDate } from "../lib/utils.js";
import { EXPENSE_CATEGORIES } from "../lib/categories.js";
import { OVERALL, splitBudgets, monthSpending, spentFor, monthYearLabel } from "../lib/budgets.js";
import MonthPicker from "../components/MonthPicker.jsx";

// Every expense category can have a budget, including the ones bills are
// filed under, so paying the internet bill counts against an Internet budget.
const SUGGESTED = EXPENSE_CATEGORIES;

const titleOf = (category) => (category === OVERALL ? "Overall Monthly" : category);

// Changing a limit: take some off, add some on, or type the new figure.
const MODES = [["decrease", "Decrease"], ["increase", "Increase"], ["set", "Set new limit"]];
function newLimitOf(current, mode, amount) {
  const n = Number(amount);
  if (!(n > 0)) return null;
  if (mode === "decrease") return Math.round((current - n) * 100) / 100;
  if (mode === "increase") return Math.round((current + n) * 100) / 100;
  return n;
}

// "Reduced by ₱100.00 · was ₱500.00 · Oct 9, 2026" — the last change to the limit.
function LimitChange({ budget }) {
  if (budget.previousLimit == null || budget.previousLimit === budget.limit) return null;
  const diff = budget.limit - budget.previousLimit;
  return (
    <div className={"budget-change " + (diff < 0 ? "down" : "up")}>
      <span className="tag">{diff < 0 ? "Reduced" : "Raised"} by {peso(Math.abs(diff))}</span>
      <span>was {peso(budget.previousLimit)}{budget.limitChangedAt ? ` · ${fmtDate(budget.limitChangedAt)}` : ""}</span>
    </div>
  );
}

// One budget's figures for the month on screen: spent of limit, a bar, what
// is left (or how far over), and the last change to the limit.
function BudgetFigures({ budget, spent }) {
  // Guard the division: a limit can never be zero server-side, but a stale
  // record should still render rather than print Infinity.
  const pct = budget.limit > 0 ? Math.min(100, Math.round((spent / budget.limit) * 100)) : 0;
  const over = spent > budget.limit;
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, margin: "12px 0 6px" }}>
        <span style={{ fontWeight: 600, color: over ? "var(--danger)" : "var(--text)" }}>{peso(spent)}</span>
        <span style={{ color: "var(--text-dim)" }}>of {peso(budget.limit)}</span>
      </div>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: pct + "%", background: over ? "var(--danger)" : pct >= 75 ? "var(--warn)" : "var(--primary)" }}
        />
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 8 }}>
        {over ? `Over by ${peso(spent - budget.limit)}` : `${peso(budget.limit - spent)} remaining`}
      </div>
      <LimitChange budget={budget} />
    </>
  );
}

export default function BudgetsScreen({ budgets, tx, addBudget, editBudget, deleteBudget }) {
  const current = thisMonthISO();
  const [month, setMonth] = useState(current);
  const [adding, setAdding] = useState(null); // {category, limit}
  const [editing, setEditing] = useState(null); // {budget, mode, amount}
  const [busy, setBusy] = useState(false);

  // A budget is a monthly limit, so only the chosen month's recorded
  // expenses count against it.
  const spending = monthSpending(tx, month);
  const { overall, categories } = splitBudgets(budgets);

  const used = new Set(categories.map((b) => b.category));
  const available = SUGGESTED.filter((c) => !used.has(c));

  // Dialogs close only after the server accepts the change, so a failure
  // keeps what was typed.
  async function submitAdd(e) {
    e.preventDefault();
    if (busy || !adding.category || !(Number(adding.limit) > 0)) return;
    setBusy(true);
    const ok = await addBudget({ category: adding.category, limit: Number(adding.limit) });
    setBusy(false);
    if (ok) setAdding(null);
  }

  const startEdit = (budget) => setEditing({ budget, mode: "decrease", amount: "" });
  const nextLimit = editing && newLimitOf(editing.budget.limit, editing.mode, editing.amount);
  const editProblem = !editing || nextLimit === null ? "Enter an amount greater than zero."
    : nextLimit < 1 ? `You can take off at most ${peso(editing.budget.limit - 1)}; a budget cannot go below ₱1.00.`
    : nextLimit === editing.budget.limit ? "That is the limit it already has." : "";

  async function submitEdit(e) {
    e.preventDefault();
    if (busy || editProblem) return;
    setBusy(true);
    const { budget } = editing;
    const diff = nextLimit - budget.limit;
    const message = `${titleOf(budget.category)} budget ${diff < 0 ? "reduced" : "raised"} by ${peso(Math.abs(diff))} — now ${peso(nextLimit)}.`;
    const ok = await editBudget(budget._id, { limit: nextLimit }, message);
    setBusy(false);
    if (ok) setEditing(null);
  }

  const totalLimit = categories.reduce((s, b) => s + b.limit, 0);
  const totalSpent = categories.reduce((s, b) => s + spentFor(b, spending), 0);

  return (
    <div>
      <div className="pagehead">
        <div>
          <h2>Budgets</h2>
          <div className="desc">Set a monthly limit for all your spending, and per category. The month's recorded expenses are counted against them.</div>
        </div>
        <button className="btn" onClick={() => setAdding({ category: available[0] || "Other", limit: "" })}>
          + Add Budget
        </button>
      </div>

      <div className="budget-month">
        <MonthPicker month={month} onChange={setMonth} />
        {month !== current && (
          <div className="hint">What you spent in {monthYearLabel(month)}, against your current limits.</div>
        )}
      </div>

      {overall ? (
        <div className="card overall-budget">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h3 style={{ margin: 0 }}>Overall monthly budget</h3>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn small ghost" onClick={() => startEdit(overall)}>Edit</button>
              <button className="btn small danger" onClick={() => deleteBudget(overall)}>Remove</button>
            </div>
          </div>
          <BudgetFigures budget={overall} spent={spending.total} />
        </div>
      ) : (
        <div className="card overall-budget unset">
          <div>
            <h3 style={{ margin: 0 }}>Overall monthly budget</h3>
            <div className="hint" style={{ margin: "4px 0 0" }}>
              One limit for all your spending this month{spending.total > 0 ? ` (${peso(spending.total)} spent in ${monthYearLabel(month)} so far)` : ""}.
            </div>
          </div>
          <button className="btn small" onClick={() => setAdding({ category: OVERALL, limit: "" })}>Set overall budget</button>
        </div>
      )}

      {categories.length > 0 && (
        <div className="grid grid-3" style={{ marginBottom: 16 }}>
          <div className="card stat"><h3>Categories</h3><div className="value">{categories.length}</div><div className="label">with a limit set</div></div>
          <div className="card stat"><h3>Category Budgets</h3><div className="value">{peso(totalLimit)}</div><div className="label">added together</div></div>
          <div className="card stat">
            <h3>Spent in Them</h3>
            <div className="value" style={{ color: totalSpent > totalLimit ? "var(--danger)" : "var(--text)" }}>{peso(totalSpent)}</div>
            <div className="label">{totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0}% used in {monthYearLabel(month)}</div>
          </div>
        </div>
      )}

      {categories.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="big">—</div>
            No budgets yet. Add one to start tracking your spending against a limit.
          </div>
        </div>
      ) : (
        <div className="grid grid-2">
          {categories.map((b) => (
            <div className="card" key={b._id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <h3 style={{ margin: 0 }}>{b.category}</h3>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn small ghost" onClick={() => startEdit(b)}>Edit</button>
                  <button className="btn small danger" onClick={() => deleteBudget(b)}>Remove</button>
                </div>
              </div>
              <BudgetFigures budget={b} spent={spentFor(b, spending)} />
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="modal-overlay" onClick={() => setAdding(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{adding.category === OVERALL ? "Set Overall Monthly Budget" : "Add Budget"}</h3>
            <form onSubmit={submitAdd}>
              {adding.category === OVERALL ? (
                <p className="hint">One limit for everything you spend in a month, whatever the category.</p>
              ) : (
                <div className="form-row">
                  <label className="field">Category</label>
                  <select value={adding.category} onChange={(e) => setAdding({ ...adding, category: e.target.value })}>
                    {(available.length ? available : SUGGESTED).map((c) => <option key={c}>{c}</option>)}
                  </select>
                  {available.length === 0 && <div className="hint">Every suggested category already has a budget.</div>}
                </div>
              )}
              <div className="form-row">
                <label className="field">Monthly limit (₱)</label>
                <input type="number" min="1" value={adding.limit} onChange={(e) => setAdding({ ...adding, limit: e.target.value })} required />
              </div>
              <div className="actions">
                <button type="button" className="btn ghost" onClick={() => setAdding(null)} disabled={busy}>Cancel</button>
                <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Save Budget"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Change {titleOf(editing.budget.category)} Budget</h3>
            <p className="hint" style={{ marginTop: 0 }}>Current limit: <strong>{peso(editing.budget.limit)}</strong></p>
            <form onSubmit={submitEdit}>
              <div className="tabrow" role="group" aria-label="How to change it" style={{ marginBottom: 12 }}>
                {MODES.map(([key, label]) => (
                  <button key={key} type="button" className={"tab" + (editing.mode === key ? " active" : "")} aria-pressed={editing.mode === key}
                    onClick={() => setEditing({ ...editing, mode: key })}>{label}</button>
                ))}
              </div>
              <div className="form-row">
                <label className="field" htmlFor="budget-change-amount">
                  {editing.mode === "decrease" ? "Take off (₱)" : editing.mode === "increase" ? "Add (₱)" : "New monthly limit (₱)"}
                </label>
                <input id="budget-change-amount" type="number" min="0.01" step="0.01" autoFocus value={editing.amount}
                  onChange={(e) => setEditing({ ...editing, amount: e.target.value })} />
              </div>
              {editing.amount !== "" && (
                <div className={"change-preview" + (editProblem ? " bad" : "")}>
                  {editProblem || <>{peso(editing.budget.limit)} → <strong>{peso(nextLimit)}</strong></>}
                </div>
              )}
              <div className="actions">
                <button type="button" className="btn ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
                <button className="btn" type="submit" disabled={busy || !!editProblem}>{busy ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
