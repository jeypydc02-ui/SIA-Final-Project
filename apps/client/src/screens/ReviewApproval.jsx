import { useState } from "react";
import { peso, fmtDate, txStatusBadge } from "../lib/utils.js";

const ACTION_LABEL = { approve: "Approve", reject: "Reject", revise: "Request Revision on" };

// `tx` is the signed-in person's own entries; `queue` is every submission a
// Reviewer or Admin can act on (for a User it is the same as `tx`).
export default function ReviewApproval({ tx, queue, session, reviewTx, resubmitTx, editTx, deleteTx }) {
  const isReviewer = session.role === "Reviewer" || session.role === "Admin";
  const [target, setTarget] = useState(null); // {t, action}
  const [comment, setComment] = useState("");
  const [resubmitTarget, setResubmitTarget] = useState(null);
  const [form, setForm] = useState({ amount: "", note: "" });
  const [formErr, setFormErr] = useState("");
  const [editTarget, setEditTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const rows = isReviewer ? queue : tx;
  const pending = queue.filter(t => t.status === "Pending Review");
  const isOwn = (t) => String(t.submittedBy) === String(session.id);

  function openAction(t, action) { setTarget({ t, action }); setComment(""); }
  async function confirmAction() {
    if (busy) return;
    setBusy(true);
    const ok = await reviewTx(target.t._id, target.action, comment.trim());
    setBusy(false);
    if (ok) setTarget(null);
  }
  function openResubmit(t) { setResubmitTarget(t); setForm({ amount: String(t.amount), note: t.note || "" }); setFormErr(""); }
  async function confirmResubmit() {
    if (busy) return;
    // An emptied amount field used to be sent as 0.
    const amount = Number(form.amount);
    if (!(amount > 0)) { setFormErr("Enter an amount greater than zero."); return; }
    setBusy(true);
    const ok = await resubmitTx(resubmitTarget._id, { amount, note: form.note });
    setBusy(false);
    if (ok) setResubmitTarget(null);
  }
  async function confirmEdit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const ok = await editTx(editTarget._id, {
      category: editTarget.category,
      amount: Number(editTarget.amount),
      note: editTarget.note,
    });
    setBusy(false);
    if (ok) setEditTarget(null);
  }

  return (
    <div>
      <div className="pagehead">
        <div>
          <h2>Review &amp; Approval</h2>
          <div className="desc">{isReviewer ? "Approve, reject, or request revision on submitted income/expense entries. Your own entries are decided by another reviewer." : "Track the review status of your submitted entries."}</div>
        </div>
      </div>

      {isReviewer && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Pending Review ({pending.length})</h3>
          {pending.length === 0 ? <div className="empty">Nothing waiting for review.</div> : (
            <table>
              <thead><tr><th>Type</th><th>Category</th><th>Amount</th><th>Date</th><th>Note</th><th></th></tr></thead>
              <tbody>
                {pending.map(t => (
                  <tr key={t._id}>
                    <td>{t.type}</td><td>{t.category}</td><td>{peso(t.amount)}</td><td>{fmtDate(t.date)}</td>
                    <td style={{ color: "var(--text-dim)" }}>{t.note || "—"}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      {/* Separation of duties: nobody decides their own entry. */}
                      {isOwn(t) ? <span className="own-entry">Your entry — awaiting another reviewer</span> : (
                        <>
                          <button className="btn small" onClick={() => openAction(t, "approve")}>Approve</button>
                          <button className="btn small ghost" onClick={() => openAction(t, "revise")}>Revise</button>
                          <button className="btn small danger" onClick={() => openAction(t, "reject")}>Reject</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="card">
        <h3>{isReviewer ? "All Submissions" : "My Submissions"}</h3>
        <table>
          <thead><tr><th>Type</th><th>Category</th><th>Amount</th><th>Note</th><th>Status</th><th>Reviewer Note</th><th></th></tr></thead>
          <tbody>
            {rows.map(t => (
              <tr key={t._id}>
                <td>{t.type}</td><td>{t.category}</td><td>{peso(t.amount)}</td>
                <td style={{ color: "var(--text-dim)" }}>{t.note || "—"}</td>
                <td><span className={"badge " + txStatusBadge(t.status)}>{t.status}{t.version > 1 ? " · v" + t.version : ""}</span></td>
                <td style={{ color: "var(--text-dim)" }}>{t.reviewComment || "—"}</td>
                <td style={{ display: "flex", gap: 6 }}>
                  {/* Whoever submitted the entry resubmits it, whatever their role. */}
                  {isOwn(t) && t.status === "Needs Revision" && <button className="btn small ghost" onClick={() => openResubmit(t)}>Resubmit</button>}
                  {isOwn(t) && t.status === "Pending Review" && (
                    <>
                      <button className="btn small ghost" onClick={() => setEditTarget({ ...t, amount: String(t.amount) })}>Edit</button>
                      <button className="btn small danger" onClick={() => deleteTx(t)}>Withdraw</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="7"><div className="empty">No submissions yet.</div></td></tr>}
          </tbody>
        </table>
      </div>

      {target && (
        <div className="modal-overlay" onClick={() => !busy && setTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{ACTION_LABEL[target.action]} Entry</h3>
            <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>{target.t.category} — {peso(target.t.amount)}</p>
            <div className="form-row"><label className="field">Comment (optional)</label><input value={comment} maxLength={300} onChange={e => setComment(e.target.value)} placeholder="Reason or note for the submitter" /></div>
            <div className="actions">
              <button className="btn ghost" onClick={() => setTarget(null)} disabled={busy}>Cancel</button>
              <button className="btn" onClick={confirmAction} disabled={busy}>{busy ? "Saving…" : "Confirm"}</button>
            </div>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="modal-overlay" onClick={() => !busy && setEditTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Edit Entry</h3>
            <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
              Only entries still waiting for review can be edited.
            </p>
            <form onSubmit={confirmEdit}>
              <div className="form-row"><label className="field">Category</label>
                <select value={editTarget.category} onChange={e => setEditTarget({ ...editTarget, category: e.target.value })}>
                  <option>Food</option><option>Transport</option><option>Utilities</option><option>Subscription</option><option>Salary</option><option>Freelance</option><option>Other</option>
                </select>
              </div>
              <div className="form-row"><label className="field">Amount (₱)</label><input type="number" min="0.01" step="0.01" max="1000000000000" value={editTarget.amount} onChange={e => setEditTarget({ ...editTarget, amount: e.target.value })} required /></div>
              <div className="form-row"><label className="field">Note</label><input value={editTarget.note || ""} maxLength={300} onChange={e => setEditTarget({ ...editTarget, note: e.target.value })} /></div>
              <div className="actions">
                <button type="button" className="btn ghost" onClick={() => setEditTarget(null)} disabled={busy}>Cancel</button>
                <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resubmitTarget && (
        <div className="modal-overlay" onClick={() => !busy && setResubmitTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Resubmit Entry</h3>
            <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>Reviewer note: {resubmitTarget.reviewComment || "—"}</p>
            <div className="form-row"><label className="field">Amount (₱)</label><input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => { setForm({ ...form, amount: e.target.value }); setFormErr(""); }} /></div>
            <div className="form-row"><label className="field">Note</label><input value={form.note} maxLength={300} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
            {formErr && <div className="form-msg error">{formErr}</div>}
            <div className="actions">
              <button className="btn ghost" onClick={() => setResubmitTarget(null)} disabled={busy}>Cancel</button>
              <button className="btn" onClick={confirmResubmit} disabled={busy}>{busy ? "Saving…" : "Resubmit"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
