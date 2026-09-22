import { useState } from "react";
import { peso, fmtDate, txStatusBadge } from "../lib/utils.js";

const ACTION_LABEL = { approve: "Approve", reject: "Reject", revise: "Request Revision on" };

export default function ReviewApproval({ tx, session, reviewTx, resubmitTx }) {
  const isReviewer = session.role === "Reviewer" || session.role === "Admin";
  const [target, setTarget] = useState(null); // {t, action}
  const [comment, setComment] = useState("");
  const [resubmitTarget, setResubmitTarget] = useState(null);
  const [form, setForm] = useState({ amount: "", note: "" });

  const pending = tx.filter(t => t.status === "Pending Review");

  function openAction(t, action) { setTarget({ t, action }); setComment(""); }
  function confirmAction() {
    reviewTx(target.t._id, target.action, comment);
    setTarget(null);
  }
  function openResubmit(t) { setResubmitTarget(t); setForm({ amount: String(t.amount), note: t.note || "" }); }
  function confirmResubmit() {
    resubmitTx(resubmitTarget._id, { amount: Number(form.amount), note: form.note });
    setResubmitTarget(null);
  }

  return (
    <div>
      <div className="pagehead">
        <div>
          <h2>Review &amp; Approval</h2>
          <div className="desc">{isReviewer ? "Approve, reject, or request revision on submitted income/expense entries." : "Track the review status of your submitted entries."}</div>
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
                      <button className="btn small" onClick={() => openAction(t, "approve")}>Approve</button>
                      <button className="btn small ghost" onClick={() => openAction(t, "revise")}>Revise</button>
                      <button className="btn small danger" onClick={() => openAction(t, "reject")}>Reject</button>
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
          <thead><tr><th>Type</th><th>Category</th><th>Amount</th><th>Status</th><th>Reviewer Note</th><th></th></tr></thead>
          <tbody>
            {tx.map(t => (
              <tr key={t._id}>
                <td>{t.type}</td><td>{t.category}</td><td>{peso(t.amount)}</td>
                <td><span className={"badge " + txStatusBadge(t.status)}>{t.status}{t.version > 1 ? " · v" + t.version : ""}</span></td>
                <td style={{ color: "var(--text-dim)" }}>{t.reviewComment || "—"}</td>
                <td>{!isReviewer && t.status === "Needs Revision" && <button className="btn small ghost" onClick={() => openResubmit(t)}>Resubmit</button>}</td>
              </tr>
            ))}
            {tx.length === 0 && <tr><td colSpan="6"><div className="empty">No submissions yet.</div></td></tr>}
          </tbody>
        </table>
      </div>

      {target && (
        <div className="modal-overlay" onClick={() => setTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{ACTION_LABEL[target.action]} Entry</h3>
            <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>{target.t.category} — {peso(target.t.amount)}</p>
            <div className="form-row"><label className="field">Comment (optional)</label><input value={comment} onChange={e => setComment(e.target.value)} placeholder="Reason or note for the submitter" /></div>
            <div className="actions">
              <button className="btn ghost" onClick={() => setTarget(null)}>Cancel</button>
              <button className="btn" onClick={confirmAction}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {resubmitTarget && (
        <div className="modal-overlay" onClick={() => setResubmitTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Resubmit Entry</h3>
            <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>Reviewer note: {resubmitTarget.reviewComment || "—"}</p>
            <div className="form-row"><label className="field">Amount (₱)</label><input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="form-row"><label className="field">Note</label><input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
            <div className="actions">
              <button className="btn ghost" onClick={() => setResubmitTarget(null)}>Cancel</button>
              <button className="btn" onClick={confirmResubmit}>Resubmit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
