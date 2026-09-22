import { useState } from "react";
import { todayISO } from "../lib/utils.js";

export default function SubmissionForm({ addTx }) {
  const [form, setForm] = useState({ type: "Expense", category: "Food", amount: "", date: todayISO(), note: "" });
  function submit(e) {
    e.preventDefault();
    if (!form.amount) return;
    addTx({ ...form, amount: Number(form.amount) });
    setForm({ type: "Expense", category: "Food", amount: "", date: todayISO(), note: "" });
  }
  return (
    <div>
      <div className="pagehead"><div><h2>Log Income / Expense</h2><div className="desc">Manual entry — goes to Review &amp; Approval, then feeds the Dashboard and Reports once approved.</div></div></div>
      <div className="card" style={{ maxWidth: 520 }}>
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="form-row"><label className="field">Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option>Expense</option><option>Income</option>
              </select>
            </div>
            <div className="form-row"><label className="field">Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option>Food</option><option>Transport</option><option>Utilities</option><option>Subscription</option><option>Salary</option><option>Freelance</option><option>Other</option>
              </select>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row"><label className="field">Amount (₱)</label><input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required /></div>
            <div className="form-row"><label className="field">Date</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          </div>
          <div className="form-row"><label className="field">Note</label><input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="e.g. Groceries at SM" /></div>
          <button className="btn" type="submit">Submit for Review</button>
        </form>
      </div>
    </div>
  );
}
