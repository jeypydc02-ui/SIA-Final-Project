import { useState } from "react";
import { peso, fmtDate, addDays, billStatus, statusBadgeClass } from "../lib/utils.js";

export default function BillsScreen({ bills, addBill, markPaid, editBill, deleteBill }) {
  const [showAdd, setShowAdd] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [form, setForm] = useState({ name: "", category: "Utilities", amount: "", due: addDays(7) });
  const [editing, setEditing] = useState(null);

  function submitAdd(e) {
    e.preventDefault();
    if (!form.name || !form.amount) return;
    addBill({ name: form.name, category: form.category, amount: Number(form.amount), due: form.due });
    setShowAdd(false);
    setForm({ name: "", category: "Utilities", amount: "", due: addDays(7) });
  }
  function submitEdit(e) {
    e.preventDefault();
    editBill(editing._id, {
      name: editing.name,
      category: editing.category,
      amount: Number(editing.amount),
      due: editing.due,
    });
    setEditing(null);
  }
  function openPay(b) { setPayTarget(b); setPayAmount(String(b.amount)); }
  function confirmPay() {
    markPaid(payTarget._id, Number(payAmount) || payTarget.amount);
    setPayTarget(null);
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
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Add Bill</h3>
            <form onSubmit={submitAdd}>
              <div className="form-row"><label className="field">Bill name</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="form-grid">
                <div className="form-row"><label className="field">Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    <option>Utilities</option><option>Housing</option><option>Internet</option><option>Credit</option><option>Subscription</option><option>Other</option>
                  </select>
                </div>
                <div className="form-row"><label className="field">Amount (₱)</label><input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required /></div>
              </div>
              <div className="form-row"><label className="field">Due date</label><input type="date" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} /></div>
              <div className="actions">
                <button type="button" className="btn ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn" type="submit">Save Bill</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Edit Bill</h3>
            <form onSubmit={submitEdit}>
              <div className="form-row"><label className="field">Bill name</label><input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} required /></div>
              <div className="form-grid">
                <div className="form-row"><label className="field">Category</label>
                  <select value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })}>
                    <option>Utilities</option><option>Housing</option><option>Internet</option><option>Credit</option><option>Subscription</option><option>Other</option>
                  </select>
                </div>
                <div className="form-row"><label className="field">Amount (₱)</label><input type="number" min="1" value={editing.amount} onChange={e => setEditing({ ...editing, amount: e.target.value })} required /></div>
              </div>
              <div className="form-row"><label className="field">Due date</label><input type="date" value={editing.due} onChange={e => setEditing({ ...editing, due: e.target.value })} /></div>
              <div className="actions">
                <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
                <button className="btn" type="submit">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {payTarget && (
        <div className="modal-overlay" onClick={() => setPayTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Mark "{payTarget.name}" as Paid</h3>
            <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
              <span className="flow-badge">integration</span> &nbsp;This will log an approved expense entry, generate a notification, and write an audit log entry automatically.
            </p>
            <div className="form-row"><label className="field">Amount paid (₱)</label><input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} /></div>
            <div className="actions">
              <button className="btn ghost" onClick={() => setPayTarget(null)}>Cancel</button>
              <button className="btn" onClick={confirmPay}>Confirm Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
