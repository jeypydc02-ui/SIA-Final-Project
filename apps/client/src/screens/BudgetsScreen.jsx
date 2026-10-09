import { useState } from "react";
import { peso, thisMonthISO } from "../lib/utils.js";
import { EXPENSE_CATEGORIES } from "../lib/categories.js";
import { OVERALL, splitBudgets, monthSpending, spentFor, perDay, monthYearLabel } from "../lib/budgets.js";
import MonthPicker from "../components/MonthPicker.jsx";

// Every expense category can have a budget, including the ones bills are
// filed under, so paying the internet bill counts against an Internet budget.
const SUGGESTED = EXPENSE_CATEGORIES;

const titleOf = (category) => (category === OVERALL ? "Overall Monthly" : category);

// One budget's figures for the month on screen: spent of limit, a bar, what
// is left (or how far over), and — for the month in progress — how much can
// still be spent each day.
function BudgetFigures({ budget, spent, month }) {
  // Guard the division: a limit can never be zero server-side, but a stale
  // record should still render rather than print Infinity.
  const pct = budget.limit > 0 ? Math.min(100, Math.round((spent / budget.limit) * 100)) : 0;
  const over = spent > budget.limit;
  const daily = perDay(budget.limit, spent, month);
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
      {daily && (
        <div className="per-day">
          {daily.amount > 0
            ? <><strong>{peso(daily.amount)}</strong> a day {daily.days === 1 ? "for the rest of today" : `for the next ${daily.days} days`}</>
            : "Nothing left to spend this month"}
        </div>
      )}
    </>
  );
}

export default function BudgetsScreen({ budgets, tx, addBudget, editBudget, deleteBudget }) {
  const current = thisMonthISO();
  const [month, setMonth] = useState(current);
  const [adding, setAdding] = useState(null); // {category, limit}
  const [editing, setEditing] = useState(null); // {_id, category, limit}
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

  async function submitEdit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const ok = await editBudget(editing._id, { limit: Number(editing.limit) });
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
            <div>
              <h3 style={{ margin: 0 }}>Overall monthly budget</h3>
              <div className="hint" style={{ margin: "4px 0 0" }}>All your expenses together, every category.</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn small ghost" onClick={() => setEditing({ ...overall, limit: String(overall.limit) })}>Edit</button>
              <button className="btn small danger" onClick={() => deleteBudget(overall)}>Remove</button>
            </div>
          </div>
          <BudgetFigures budget={overall} spent={spending.total} month={month} />
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
                  <button className="btn small ghost" onClick={() => setEditing({ ...b, limit: String(b.limit) })}>Edit</button>
                  <button className="btn small danger" onClick={() => deleteBudget(b)}>Remove</button>
                </div>
              </div>
              <BudgetFigures budget={b} spent={spentFor(b, spending)} month={month} />
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
            <h3>Edit {titleOf(editing.category)} Budget</h3>
            <form onSubmit={submitEdit}>
              <div className="form-row">
                <label className="field">Monthly limit (₱)</label>
                <input type="number" min="1" value={editing.limit} onChange={(e) => setEditing({ ...editing, limit: e.target.value })} required />
              </div>
              <div className="actions">
                <button type="button" className="btn ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
                <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
