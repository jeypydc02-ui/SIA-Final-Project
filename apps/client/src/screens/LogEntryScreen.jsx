import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { todayISO } from "../lib/utils.js";

const blank = (type = "Expense") => ({ type, category: type === "Income" ? "Salary" : "Food", amount: "", date: todayISO(), note: "" });

// ?type=Income or ?type=Expense, as sent by the quick-add sheet.
const typeFrom = (params) => (params.get("type") === "Income" ? "Income" : "Expense");

export default function LogEntryScreen({ addTx }) {
  const [params] = useSearchParams();
  const [form, setForm] = useState(() => blank(typeFrom(params)));
  // Picking the other type from quick add while already on this screen.
  useEffect(() => {
    const type = typeFrom(params);
    setForm((f) => (f.type === type ? f : { ...f, type, category: blank(type).category }));
  }, [params]);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (busy || !(Number(form.amount) > 0)) return;
    // The button stays disabled until the server answers, so a slow connection
    // cannot turn one entry into two, and the form is only cleared once the
    // entry is actually saved — a failed request keeps what was typed.
    setBusy(true);
    const ok = await addTx({ ...form, amount: Number(form.amount) });
    setBusy(false);
    if (ok) setForm(blank(form.type));
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
            <div className="form-row"><label className="field">Amount (₱)</label><input type="number" min="0.01" step="0.01" max="1000000000000" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required /></div>
            <div className="form-row"><label className="field">Date</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required /></div>
          </div>
          <div className="form-row"><label className="field">Note</label><input value={form.note} maxLength={300} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="e.g. Groceries at SM" /></div>
          <button className="btn" type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit for Review"}</button>
        </form>
      </div>
    </div>
  );
}
