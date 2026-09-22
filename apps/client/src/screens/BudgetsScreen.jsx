import { useState } from "react";
import { peso } from "../lib/utils.js";

const SUGGESTED = ["Food", "Transport", "Utilities", "Subscription", "Housing", "Credit", "Other"];

export default function BudgetsScreen({ budgets, tx, addBudget, editBudget, deleteBudget }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ category: "Food", limit: "" });
  const [editing, setEditing] = useState(null); // {_id, category, limit}

  const approved = tx.filter((t) => t.status === "Approved" && t.type === "Expense");
  const spentBy = {};
  approved.forEach((t) => { spentBy[t.category] = (spentBy[t.category] || 0) + t.amount; });

  const used = new Set(budgets.map((b) => b.category));
  const available = SUGGESTED.filter((c) => !used.has(c));

  function submitAdd(e) {
    e.preventDefault();
    if (!form.category || !form.limit) return;
    addBudget({ category: form.category, limit: Number(form.limit) });
    setShowAdd(false);
    setForm({ category: available[0] || "Other", limit: "" });
  }

  function submitEdit(e) {
    e.preventDefault();
    editBudget(editing._id, { limit: Number(editing.limit) });
    setEditing(null);
  }

  const totalLimit = budgets.reduce((s, b) => s + b.limit, 0);
  const totalSpent = budgets.reduce((s, b) => s + (spentBy[b.category] || 0), 0);

  return (
    <div>
      <div className="pagehead">
        <div>
          <h2>Budgets</h2>
          <div className="desc">Set a monthly limit per category. Approved expenses are counted against it.</div>
        </div>
        <button className="btn" onClick={() => { setForm({ category: available[0] || "Other", limit: "" }); setShowAdd(true); }}>
          + Add Budget
        </button>
      </div>

      {budgets.length > 0 && (
        <div className="grid grid-3" style={{ marginBottom: 16 }}>
          <div className="card stat"><h3>Categories</h3><div className="value">{budgets.length}</div><div className="label">with a limit set</div></div>
          <div className="card stat"><h3>Total Budget</h3><div className="value">{peso(totalLimit)}</div><div className="label">across all categories</div></div>
          <div className="card stat">
            <h3>Total Spent</h3>
            <div className="value" style={{ color: totalSpent > totalLimit ? "var(--danger)" : "var(--text)" }}>{peso(totalSpent)}</div>
            <div className="label">{totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0}% of budget used</div>
          </div>
        </div>
      )}

      {budgets.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="big">—</div>
            No budgets yet. Add one to start tracking your spending against a limit.
          </div>
        </div>
      ) : (
        <div className="grid grid-2">
          {budgets.map((b) => {
            const spent = spentBy[b.category] || 0;
            // Guard the division: a limit can never be zero server-side, but a
            // stale record should still render rather than print Infinity.
            const pct = b.limit > 0 ? Math.min(100, Math.round((spent / b.limit) * 100)) : 0;
            const over = spent > b.limit;
            return (
              <div className="card" key={b._id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <h3 style={{ margin: 0 }}>{b.category}</h3>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn small ghost" onClick={() => setEditing({ ...b, limit: String(b.limit) })}>Edit</button>
                    <button className="btn small danger" onClick={() => deleteBudget(b)}>Remove</button>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, margin: "12px 0 6px" }}>
                  <span style={{ fontWeight: 600, color: over ? "var(--danger)" : "var(--text)" }}>{peso(spent)}</span>
                  <span style={{ color: "var(--text-dim)" }}>of {peso(b.limit)}</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: pct + "%", background: over ? "var(--danger)" : pct >= 75 ? "var(--warn)" : "var(--primary)" }}
                  />
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 8 }}>
                  {over
                    ? `Over by ${peso(spent - b.limit)}`
                    : `${peso(b.limit - spent)} remaining`}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Budget</h3>
            <form onSubmit={submitAdd}>
              <div className="form-row">
                <label className="field">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {(available.length ? available : SUGGESTED).map((c) => <option key={c}>{c}</option>)}
                </select>
                {available.length === 0 && <div className="hint">Every suggested category already has a budget.</div>}
              </div>
              <div className="form-row">
                <label className="field">Monthly limit (₱)</label>
                <input type="number" min="1" value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} required />
              </div>
              <div className="actions">
                <button type="button" className="btn ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn" type="submit">Save Budget</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit {editing.category} Budget</h3>
            <form onSubmit={submitEdit}>
              <div className="form-row">
                <label className="field">Monthly limit (₱)</label>
                <input type="number" min="1" value={editing.limit} onChange={(e) => setEditing({ ...editing, limit: e.target.value })} required />
              </div>
              <div className="actions">
                <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
                <button className="btn" type="submit">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
