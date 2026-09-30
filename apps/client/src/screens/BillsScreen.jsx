import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { peso, fmtDate, addDays, billStatus, statusBadgeClass } from "../lib/utils.js";

const blankBill = () => ({ name: "", category: "Utilities", amount: "", due: addDays(7) });

export default function BillsScreen({ bills, addBill, markPaid, editBill, deleteBill }) {
  const [showAdd, setShowAdd] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payErr, setPayErr] = useState("");
  const [form, setForm] = useState(blankBill);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [params, setParams] = useSearchParams();

  // ?add=1 comes from the quick-add sheet: open the Add Bill dialog, then drop
  // the flag so Back or a reload does not keep reopening it.
  useEffect(() => {
    if (params.get("add") === "1") {
      setShowAdd(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  // Each dialog closes only once the server has accepted the change. If the
  // request fails (offline, a validation error), it stays open with what was
  // typed, and the toast says why.
  async function submitAdd(e) {
    e.preventDefault();
    if (busy || !form.name.trim() || !(Number(form.amount) > 0)) return;
    setBusy(true);
    const ok = await addBill({ name: form.name.trim(), category: form.category, amount: Number(form.amount), due: form.due });
    setBusy(false);
    if (ok) {
      setShowAdd(false);
      setForm(blankBill());
    }
  }
  async function submitEdit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const ok = await editBill(editing._id, {
      name: editing.name.trim(),
      category: editing.category,
      amount: Number(editing.amount),
      due: editing.due,
    });
    setBusy(false);
    if (ok) setEditing(null);
  }
  function openPay(b) { setPayTarget(b); setPayAmount(String(b.amount)); setPayErr(""); }
  async function confirmPay() {
    if (busy) return;
    // An emptied or zero field used to fall back silently to the full bill
    // amount; ask for a real figure instead.
    const amount = Number(payAmount);
    if (!(amount > 0) || amount > 1e12) {
      setPayErr("Enter the amount you paid (greater than zero).");
      return;
    }
    setBusy(true);
    const ok = await markPaid(payTarget._id, amount);
    setBusy(false);
    if (ok) setPayTarget(null);
  }

  return (
    <div>
      <div className="pagehead">
        <div><h2>Bill Reminders</h2><div className="desc">Status auto-updates daily: Upcoming → Due Today → Overdue → Paid.</div></div>
        <button className="btn" onClick={() => setShowAdd(true)}>+ Add Bill</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Bill</th><th>Category</th><th>Due Date</th><th>Amount</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {bills.map(b => {
              const s = billStatus(b.due, b.paid);
              return (
                <tr key={b._id}>
                  <td>{b.name}</td><td>{b.category}</td><td>{fmtDate(b.due)}</td><td>{peso(b.amount)}</td>
                  <td><span className={"badge " + statusBadgeClass(s)}>{s}</span></td>
                  <td style={{ display: "flex", gap: 6 }}>
                    {!b.paid && <button className="btn small ghost" onClick={() => openPay(b)}>Mark Paid</button>}
                    {!b.paid && <button className="btn small ghost" onClick={() => setEditing({ ...b, amount: String(b.amount) })}>Edit</button>}
                    {!b.paid && <button className="btn small danger" onClick={() => deleteBill(b)}>Delete</button>}
                  </td>
                </tr>
              );
            })}
            {bills.length === 0 && <tr><td colSpan="6"><div className="empty">No bills yet.</div></td></tr>}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => !busy && setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Add Bill</h3>
            <form onSubmit={submitAdd}>
              <div className="form-row"><label className="field">Bill name</label><input value={form.name} maxLength={120} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="form-grid">
                <div className="form-row"><label className="field">Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    <option>Utilities</option><option>Housing</option><option>Internet</option><option>Credit</option><option>Subscription</option><option>Other</option>
                  </select>
                </div>
                <div className="form-row"><label className="field">Amount (₱)</label><input type="number" min="0.01" step="0.01" max="1000000000000" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required /></div>
              </div>
              <div className="form-row"><label className="field">Due date</label><input type="date" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} required /></div>
              <div className="actions">
                <button type="button" className="btn ghost" onClick={() => setShowAdd(false)} disabled={busy}>Cancel</button>
                <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Save Bill"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => !busy && setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Edit Bill</h3>
            <form onSubmit={submitEdit}>
              <div className="form-row"><label className="field">Bill name</label><input value={editing.name} maxLength={120} onChange={e => setEditing({ ...editing, name: e.target.value })} required /></div>
              <div className="form-grid">
                <div className="form-row"><label className="field">Category</label>
                  <select value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })}>
                    <option>Utilities</option><option>Housing</option><option>Internet</option><option>Credit</option><option>Subscription</option><option>Other</option>
                  </select>
                </div>
                <div className="form-row"><label className="field">Amount (₱)</label><input type="number" min="0.01" step="0.01" max="1000000000000" value={editing.amount} onChange={e => setEditing({ ...editing, amount: e.target.value })} required /></div>
              </div>
              <div className="form-row"><label className="field">Due date</label><input type="date" value={editing.due} onChange={e => setEditing({ ...editing, due: e.target.value })} required /></div>
              <div className="actions">
                <button type="button" className="btn ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
                <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {payTarget && (
        <div className="modal-overlay" onClick={() => !busy && setPayTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Mark "{payTarget.name}" as Paid</h3>
            <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
              <span className="flow-badge">integration</span> &nbsp;This will log an approved expense entry, generate a notification, and write an audit log entry automatically.
            </p>
            <div className="form-row">
              <label className="field">Amount paid (₱)</label>
              <input type="number" min="0.01" step="0.01" value={payAmount} onChange={e => { setPayAmount(e.target.value); setPayErr(""); }} />
              {payErr && <div className="form-msg error" style={{ marginTop: 8 }}>{payErr}</div>}
            </div>
            <div className="actions">
              <button className="btn ghost" onClick={() => setPayTarget(null)} disabled={busy}>Cancel</button>
              <button className="btn" onClick={confirmPay} disabled={busy}>{busy ? "Recording…" : "Confirm Payment"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
