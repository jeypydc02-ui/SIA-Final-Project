import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { peso, fmtDate, initials } from "../lib/utils.js";
import CategoryIcon from "../components/CategoryIcon.jsx";
import Icon from "../components/Icon.jsx";
import { ReceiptPreview, ReceiptStatusChip } from "../components/ReceiptView.jsx";

// Review and Approval page (spec section 14, screen 7). An Admin checks the
// receipt someone attached against the entry it is meant to prove, and
// verifies it, sends it back for a clearer copy, or rejects it. Oldest first:
// the receipt that has waited longest is decided next.

export function ago(value) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (mins < 60) return mins <= 1 ? "just now" : `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function ReceiptCard({ r, onReview }) {
  const e = r.entry;
  return (
    <article className="review-card">
      <header className="rc-head">
        <span className="avatar small">{initials(r.ownerName)}</span>
        <span className="rc-who">
          <strong>{r.ownerName}</strong>
          <span className="row-sub">
            {r.status === "For Review" ? `submitted ${ago(r.submittedAt)}` : `decided ${ago(r.reviewedAt)}`}
            {r.version > 1 ? ` · version ${r.version}` : ""}
          </span>
        </span>
        {r.status !== "For Review" && <ReceiptStatusChip receipt={r} prefix={false} />}
      </header>
      {e ? (
        <div className="rc-body">
          <CategoryIcon category={e.category} size={40} />
          <div className="rc-what">
            <div className="row-title">{e.type} · {e.category}</div>
            <div className="row-sub">{fmtDate(e.date)}{e.note ? ` · ${e.note}` : ""}</div>
          </div>
          <div className={"rc-amount " + (e.type === "Income" ? "pos" : "neg")}>{peso(e.amount)}</div>
        </div>
      ) : <div className="row-sub">The entry for this receipt no longer exists.</div>}
      <div className="row-sub rc-file">
        <Icon name="receipt" size={14} /> {r.kind === "file" ? r.fileName : `${r.provider} link`}
      </div>
      {r.reviewNote && r.status !== "For Review" && <div className="receipt-note">“{r.reviewNote}”</div>}
      <footer className="rc-actions">
        <button type="button" className={"btn small" + (r.status === "For Review" ? "" : " ghost")} onClick={() => onReview(r)}>
          {r.status === "For Review" ? "Review receipt" : "View receipt"}
        </button>
      </footer>
    </article>
  );
}

function ReviewDialog({ r, reviewReceipt, onClose }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");
  const open = r.status === "For Review";
  const e = r.entry;

  async function decide(action) {
    if (busy) return;
    if (action !== "verify" && !note.trim()) {
      setErr(action === "revision" ? "Say what needs to be fixed." : "Give a reason for rejecting it.");
      return;
    }
    setBusy(action);
    const ok = await reviewReceipt(r._id, action, note.trim());
    setBusy(null);
    if (ok) onClose();
  }

  return (
    <div className="modal-overlay" onClick={() => !busy && onClose()}>
      <div className="modal review-modal" role="dialog" aria-label="Review receipt" onClick={(ev) => ev.stopPropagation()}>
        <h3>{open ? "Review receipt" : "Receipt"} <span className="row-sub">v{r.version} from {r.ownerName}</span></h3>
        <div className="review-split">
          <div className="review-proof"><ReceiptPreview receipt={r} /></div>
          <div className="review-side">
            <div className="field">It should prove</div>
            {e ? (
              <dl className="review-facts">
                <dt>Type</dt><dd>{e.type}</dd>
                <dt>Category</dt><dd>{e.category}</dd>
                <dt>Amount</dt><dd><strong>{peso(e.amount)}</strong></dd>
                <dt>Date</dt><dd>{fmtDate(e.date)}</dd>
                {e.note && <><dt>Note</dt><dd>{e.note}</dd></>}
              </dl>
            ) : <div className="row-sub">The entry no longer exists.</div>}
            {open ? (
              <>
                <div className="form-row">
                  <label className="field" htmlFor="review-note">Note to {r.ownerName.split(" ")[0]} <span className="hint">(required to send back or reject)</span></label>
                  <textarea id="review-note" rows={3} maxLength={300} value={note} onChange={(ev) => { setNote(ev.target.value); setErr(""); }}
                    placeholder="e.g. The total on the receipt is ₱1,560, not ₱1,650" />
                </div>
                {err && <div className="form-msg error">{err}</div>}
                <div className="review-buttons">
                  <button type="button" className="btn" disabled={!!busy} onClick={() => decide("verify")}>{busy === "verify" ? "Saving…" : "Verify"}</button>
                  <button type="button" className="btn ghost" disabled={!!busy} onClick={() => decide("revision")}>{busy === "revision" ? "Saving…" : "Request revision"}</button>
                  <button type="button" className="btn danger" disabled={!!busy} onClick={() => decide("reject")}>{busy === "reject" ? "Saving…" : "Reject"}</button>
                </div>
              </>
            ) : (
              <div className="receipt-note">
                <ReceiptStatusChip receipt={r} prefix={false} /> by {r.reviewerName} · {fmtDate(r.reviewedAt)}
                {r.reviewNote && <div>“{r.reviewNote}”</div>}
              </div>
            )}
          </div>
        </div>
        <div className="actions"><button type="button" className="btn ghost" onClick={onClose} disabled={!!busy}>Close</button></div>
      </div>
    </div>
  );
}

export default function ReviewScreen({ reviewQueue, reviewReceipt }) {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "decided" ? "decided" : "waiting";
  const [reviewing, setReviewing] = useState(null);

  const waiting = reviewQueue.filter((r) => r.status === "For Review" && r.latest);
  const decided = reviewQueue.filter((r) => r.status !== "For Review" && r.reviewedAt)
    .sort((a, b) => new Date(b.reviewedAt) - new Date(a.reviewedAt));
  const rows = tab === "waiting" ? waiting : decided;
  // The open dialog follows live updates (another Admin may decide it).
  const current = reviewing && (reviewQueue.find((r) => r._id === reviewing._id) || reviewing);

  return (
    <div>
      <div className="pagehead">
        <div>
          <h2>Receipt Review</h2>
          <div className="desc">Check each receipt against the entry it proves, then verify it, ask for a clearer copy, or reject it. The owner is notified either way.</div>
        </div>
      </div>
      <div className="tabrow" style={{ marginBottom: 14 }}>
        <button type="button" className={"tab" + (tab === "waiting" ? " active" : "")} onClick={() => setParams({}, { replace: true })}>
          Waiting<span className="tab-count">{waiting.length}</span>
        </button>
        <button type="button" className={"tab" + (tab === "decided" ? " active" : "")} onClick={() => setParams({ tab: "decided" }, { replace: true })}>
          Decided by you<span className="tab-count">{decided.length}</span>
        </button>
      </div>
      <div className="review-cards">
        {rows.map((r) => <ReceiptCard key={r._id} r={r} onReview={setReviewing} />)}
        {rows.length === 0 && (
          <div className="panel empty-panel">
            <Icon name="check" size={28} />
            <div>{tab === "waiting" ? "All caught up. New receipts appear here as soon as they are submitted." : "You have not decided any receipts yet."}</div>
          </div>
        )}
      </div>
      {current && <ReviewDialog r={current} reviewReceipt={reviewReceipt} onClose={() => setReviewing(null)} />}
    </div>
  );
}
