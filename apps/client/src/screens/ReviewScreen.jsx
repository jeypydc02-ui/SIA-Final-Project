import { useState } from "react";
import { peso, fmtDate, txStatusBadge } from "../lib/utils.js";
import { fitCategory } from "../lib/categories.js";
import EntryFields, { entryProblem } from "../components/EntryFields.jsx";

const ACTION_LABEL = { approve: "Approve", reject: "Reject", revise: "Request Revision on" };

// `tx` is the signed-in person's own entries; `queue` is every submission a
// Reviewer or Admin can act on (for a User it is the same as `tx`).
export default function ReviewScreen({ tx, queue, session, reviewTx, resubmitTx, editTx, deleteTx }) {
  const isReviewer = session.role === "Reviewer" || session.role === "Admin";
  const [target, setTarget] = useState(null); // {t, action}
  const [comment, setComment] = useState("");
  // Editing a pending entry and resubmitting one sent back for revision use
  // the same form: {mode: "edit" | "resubmit", entry, value}.
  const [draft, setDraft] = useState(null);
  const [formErr, setFormErr] = useState("");
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

  function openDraft(mode, t) {
    setFormErr("");
    setDraft({
      mode,
      entry: t,
      value: { type: t.type, category: fitCategory(t.type, t.category), amount: String(t.amount), date: t.date, note: t.note || "" },
    });
  }
  async function confirmDraft(e) {
    e.preventDefault();
    if (busy) return;
    const problem = entryProblem(draft.value);
    if (problem) { setFormErr(problem); return; }
    const body = { ...draft.value, amount: Number(draft.value.amount) };
    setBusy(true);
    const ok = draft.mode === "edit" ? await editTx(draft.entry._id, body) : await resubmitTx(draft.entry._id, body);
    setBusy(false);
    if (ok) setDraft(null);
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
              <thead><tr><th>Submitted by</th><th>Type</th><th>Category</th><th>Amount</th><th>Date</th><th>Note</th><th></th></tr></thead>
              <tbody>
                {pending.map(t => (
                  <tr key={t._id}>
                    <td>{isOwn(t) ? "You" : t.submitterName}</td>
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
          <thead><tr>{isReviewer && <th>Submitted by</th>}<th>Type</th><th>Category</th><th>Amount</th><th>Note</th><th>Status</th><th>Reviewer Note</th><th></th></tr></thead>
          <tbody>
            {rows.map(t => (
              <tr key={t._id}>
                {isReviewer && <td>{isOwn(t) ? "You" : t.submitterName}</td>}
                <td>{t.type}</td><td>{t.category}</td><td>{peso(t.amount)}</td>
                <td style={{ color: "var(--text-dim)" }}>{t.note || "—"}</td>
                <td><span className={"badge " + txStatusBadge(t.status)}>{t.status}{t.version > 1 ? " · v" + t.version : ""}</span></td>
                <td style={{ color: "var(--text-dim)" }}>{t.reviewComment || "—"}</td>
                <td style={{ display: "flex", gap: 6 }}>
                  {/* Whoever submitted the entry resubmits it, whatever their role. */}
                  {isOwn(t) && t.status === "Needs Revision" && <button className="btn small ghost" onClick={() => openDraft("resubmit", t)}>Resubmit</button>}
                  {isOwn(t) && t.status === "Pending Review" && (
                    <>
                      <button className="btn small ghost" onClick={() => openDraft("edit", t)}>Edit</button>
                      <button className="btn small danger" onClick={() => deleteTx(t)}>Withdraw</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={isReviewer ? 8 : 7}><div className="empty">No submissions yet.</div></td></tr>}
          </tbody>
        </table>
      </div>

      {target && (
        <div className="modal-overlay" onClick={() => !busy && setTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{ACTION_LABEL[target.action]} Entry</h3>
            <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
              {target.t.submitterName ? `${target.t.submitterName} · ` : ""}{target.t.type} · {target.t.category} — {peso(target.t.amount)}
            </p>
            <div className="form-row"><label className="field">Comment (optional)</label><input value={comment} maxLength={300} onChange={e => setComment(e.target.value)} placeholder="Reason or note for the submitter" /></div>
            <div className="actions">
              <button className="btn ghost" onClick={() => setTarget(null)} disabled={busy}>Cancel</button>
              <button className="btn" onClick={confirmAction} disabled={busy}>{busy ? "Saving…" : "Confirm"}</button>
            </div>
          </div>
        </div>
      )}

      {draft && (
        <div className="modal-overlay" onClick={() => !busy && setDraft(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{draft.mode === "edit" ? "Edit Entry" : "Resubmit Entry"}</h3>
            <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
              {draft.mode === "edit"
                ? "Only entries still waiting for review can be edited."
                : <>Reviewer note: {draft.entry.reviewComment || "—"}</>}
            </p>
            <form onSubmit={confirmDraft}>
              <EntryFields value={draft.value} onChange={(value) => { setDraft({ ...draft, value }); setFormErr(""); }} />
              {formErr && <div className="form-msg error">{formErr}</div>}
              <div className="actions">
                <button type="button" className="btn ghost" onClick={() => setDraft(null)} disabled={busy}>Cancel</button>
                <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : draft.mode === "edit" ? "Save Changes" : "Resubmit"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
