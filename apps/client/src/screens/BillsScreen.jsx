  import { useState, useEffect } from "react";
  import { useSearchParams } from "react-router-dom";
  import { peso, fmtDate, addDays, billStatus, statusBadgeClass, requestBadge, requestLabel, isActiveRequest } from "../lib/utils.js";
  import { BILL_CATEGORIES } from "../lib/categories.js";

  const blankBill = () => ({ name: "", category: "Utilities", amount: "", due: addDays(7), repeat: "none" });

  // Rent, electricity and internet come back every month. A monthly bill
  // schedules its next occurrence when it is paid.
  function RepeatField({ value, onChange }) {
    return (
      <label className="check-row">
        <input type="checkbox" checked={value === "monthly"} onChange={(e) => onChange(e.target.checked ? "monthly" : "none")} />
        <span>Repeats every month<span className="hint" style={{ display: "block", margin: 0 }}>Paying it adds next month's bill automatically.</span></span>
      </label>
    );
  }

  export default function BillsScreen({ bills, requests = [], addBill, requestPayment, resubmitRequest, editBill, deleteBill }) {
    const [showAdd, setShowAdd] = useState(false);
    const [payTarget, setPayTarget] = useState(null);
    const [payAmount, setPayAmount] = useState("");
    const [payErr, setPayErr] = useState("");
    const [payNote, setPayNote] = useState("");
    // The newest payment request of a bill (the server sends them newest first).
    const requestOf = (billId) => requests.find((r) => String(r.bill) === String(billId));
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
      const ok = await addBill({ name: form.name.trim(), category: form.category, amount: Number(form.amount), due: form.due, repeat: form.repeat });
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
        repeat: editing.repeat || "none",
      });
      setBusy(false);
      if (ok) setEditing(null);
    }
    function openPay(b) {
      const r = requestOf(b._id);
      // A request sent back for revision is resubmitted, not made again.
      setPayTarget({ ...b, revising: r && r.status === "Revision" ? r : null });
      setPayAmount(String(r && r.status === "Revision" ? r.amount : b.amount));
      setPayNote(r && r.status === "Revision" ? (r.note || "") : "");
      setPayErr("");
    }

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
          const ok = payTarget.revising
        ? await resubmitRequest(payTarget.revising._id, amount, payNote.trim())
        : await requestPayment(payTarget._id, amount, payNote.trim());

      setBusy(false);
      if (ok) setPayTarget(null);
    }

    return (
      <div>
        <div className="pagehead">
          <div><h2>Bill Reminders</h2><div className="desc">Status auto-updates daily: Upcoming → Due Today → Overdue → Paid. To pay a bill, send a payment request; an approver must approve it first.</div></div>
          <button className="btn" onClick={() => setShowAdd(true)}>+ Add Bill</button>
        </div>
        <div className="card">
          <table>
            <thead><tr><th>Bill</th><th>Category</th><th>Due Date</th><th>Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {bills.map(b => {
                const s = billStatus(b.due, b.paid);
                const req = requestOf(b._id);
                const active = isActiveRequest(req);
                return (
                  <tr key={b._id}>
                    <td>{b.name}{b.repeat === "monthly" && <span className="badge neutral" style={{ marginLeft: 6 }}>Monthly</span>}</td><td>{b.category}</td><td>{fmtDate(b.due)}</td><td>{peso(b.amount)}</td>
                    <td>
                      <span className={"badge " + statusBadgeClass(s)}>{s}</span>
                      {!b.paid && req && (
                        <div style={{ marginTop: 4 }}>
                          <span className={"badge " + requestBadge(req.status)}>{requestLabel(req.status)}</span>
                          {(req.status === "Rejected" || req.status === "Revision") && req.remarks && (
                            <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 2 }}>{req.reviewerName}: “{req.remarks}”</div>
                          )}
                          {req.status === "Failed" && (
                            <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 2 }}>The simulated gateway reported a failure. You can send a new request.</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ display: "flex", gap: 6 }}>
                      {!b.paid && (!req || !active) && <button className="btn small ghost" onClick={() => openPay(b)}>Request Payment</button>}
                      {!b.paid && req && req.status === "Revision" && <button className="btn small ghost" onClick={() => openPay(b)}>Revise &amp; Resubmit</button>}
                      {!b.paid && !active && <button className="btn small ghost" onClick={() => setEditing({ ...b, amount: String(b.amount) })}>Edit</button>}
                      {!b.paid && !active && <button className="btn small danger" onClick={() => deleteBill(b)}>Delete</button>}
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
                      {BILL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-row"><label className="field">Amount (₱)</label><input type="number" min="0.01" step="0.01" max="1000000000000" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required /></div>
                </div>
                <div className="form-row"><label className="field">Due date</label><input type="date" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} required /></div>
                <RepeatField value={form.repeat} onChange={(repeat) => setForm({ ...form, repeat })} />
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
                      {BILL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-row"><label className="field">Amount (₱)</label><input type="number" min="0.01" step="0.01" max="1000000000000" value={editing.amount} onChange={e => setEditing({ ...editing, amount: e.target.value })} required /></div>
                </div>
                <div className="form-row"><label className="field">Due date</label><input type="date" value={editing.due} onChange={e => setEditing({ ...editing, due: e.target.value })} required /></div>
                <RepeatField value={editing.repeat} onChange={(repeat) => setEditing({ ...editing, repeat })} />
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
              <h3>{payTarget.revising ? "Revise" : "Request payment for"} "{payTarget.name}"</h3>
                <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
                  <span className="flow-badge">approval workflow</span> &nbsp;An approver reviews this first. Once approved, the payment is sent to the payment gateway (<strong>simulated</strong> — no real money moves). The bill is marked Paid only when the gateway confirms; then an expense entry, a notification and an audit log entry are created automatically.
                    {payTarget.repeat === "monthly" && " Next month's bill will be added for you."}
                      </p>
                    {payTarget.revising && payTarget.revising.remarks && (
                    <p style={{ fontSize: 12.5 }}><strong>{payTarget.revising.reviewerName} asked:</strong> “{payTarget.revising.remarks}”</p>
                  )}


            <div className="form-row">
             <label className="field">Amount to pay (₱)</label>
            <input type="number" min="0.01" step="0.01" value={payAmount} onChange={e => { setPayAmount(e.target.value); setPayErr(""); }} />
             {payErr && <div className="form-msg error" style={{ marginTop: 8 }}>{payErr}</div>}
            </div>
              <div className="form-row">
                <label className="field">Note for the approver (optional)</label>
                  <textarea rows="2" maxLength={300} value={payNote} onChange={e => setPayNote(e.target.value)} />
              </div>

              <div className="actions">
                <button className="btn ghost" onClick={() => setPayTarget(null)} disabled={busy}>Cancel</button>
                <button className="btn" onClick={confirmPay} disabled={busy}>{busy ? "Sending…" : payTarget.revising ? "Resubmit for Approval" : "Send for Approval"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
