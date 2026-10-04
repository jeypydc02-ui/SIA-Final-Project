import { useState } from "react";
import { peso, fmtDate, initials } from "../../lib/utils.js";
import Icon from "../../components/Icon.jsx";
import CategoryIcon from "../../components/CategoryIcon.jsx";

// A reviewer's dashboard is a work queue, not a wallet: how much is waiting,
// and the entries themselves, decidable right here. Oldest first, because the
// entry that has waited longest should be decided next.

function ago(value) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (mins < 60) return mins <= 1 ? "just now" : `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function ReviewerDesk({ session, queue, reviewTx, onNavigate }) {
  const [deciding, setDeciding] = useState(null); // {t, action}
  const [comment, setComment] = useState("");
  const [busyId, setBusyId] = useState(null);

  const mine = (t) => String(t.submittedBy) === String(session.id);
  const waiting = queue
    .filter((t) => t.status === "Pending Review" && !mine(t))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const myWaiting = queue.filter((t) => t.status === "Pending Review" && mine(t)).length;
  const decided = queue.filter((t) => String(t.reviewedBy) === String(session.id) && !mine(t) && ["Approved", "Rejected", "Needs Revision"].includes(t.status));
  const count = (s) => decided.filter((t) => t.status === s).length;
  const oldest = waiting[0];

  async function approve(t) {
    setBusyId(t._id);
    await reviewTx(t._id, "approve", "");
    setBusyId(null);
  }
  async function confirmDecision() {
    const { t, action } = deciding;
    setBusyId(t._id);
    const ok = await reviewTx(t._id, action, comment.trim());
    setBusyId(null);
    if (ok) setDeciding(null);
  }

  return (
    <div className="desk">
      <section className="desk-hero">
        <div>
          <div className="desk-kicker">Review Desk</div>
          <div className="desk-count">{waiting.length}</div>
          <div className="desk-sub">
            {waiting.length === 0 ? "Nothing waiting — the queue is clear." : `entr${waiting.length === 1 ? "y" : "ies"} waiting for your decision · oldest ${ago(oldest.createdAt)}`}
          </div>
        </div>
        <button type="button" className="btn" onClick={() => onNavigate("/review")}>Open full queue</button>
      </section>

      <div className="desk-stats">
        <div className="stat-pill"><span className="stat-num">{decided.length}</span>reviewed by you</div>
        <div className="stat-pill ok"><span className="stat-num">{count("Approved")}</span>approved</div>
        <div className="stat-pill warn"><span className="stat-num">{count("Needs Revision")}</span>sent back</div>
        <div className="stat-pill danger"><span className="stat-num">{count("Rejected")}</span>rejected</div>
        <div className="stat-pill"><span className="stat-num">{myWaiting}</span>of yours awaiting another reviewer</div>
      </div>

      <div className="panel-head" style={{ marginTop: 18 }}>
        <h3 className="section-h">Up next</h3>
      </div>
      <div className="review-cards">
        {waiting.slice(0, 6).map((t) => (
          <article key={t._id} className="review-card">
            <header className="rc-head">
              <span className="avatar small">{initials(t.submitterName)}</span>
              <span className="rc-who">
                <strong>{t.submitterName}</strong>
                <span className="row-sub">submitted {ago(t.createdAt)}{t.version > 1 ? ` · revision v${t.version}` : ""}</span>
              </span>
            </header>
            <div className="rc-body">
              <CategoryIcon category={t.category} size={40} />
              <div className="rc-what">
                <div className="row-title">{t.type} · {t.category}</div>
                <div className="row-sub">{fmtDate(t.date)}{t.note ? ` · ${t.note}` : ""}</div>
              </div>
              <div className={"rc-amount " + (t.type === "Income" ? "pos" : "neg")}>{peso(t.amount)}</div>
            </div>
            <footer className="rc-actions">
              <button type="button" className="btn small" disabled={busyId === t._id} onClick={() => approve(t)}>Approve</button>
              <button type="button" className="btn small ghost" disabled={busyId === t._id} onClick={() => { setDeciding({ t, action: "revise" }); setComment(""); }}>Revise</button>
              <button type="button" className="btn small danger" disabled={busyId === t._id} onClick={() => { setDeciding({ t, action: "reject" }); setComment(""); }}>Reject</button>
            </footer>
          </article>
        ))}
        {waiting.length === 0 && (
          <div className="panel empty-panel">
            <Icon name="check" size={28} />
            <div>All caught up. New submissions will appear here.</div>
          </div>
        )}
      </div>
      {waiting.length > 6 && (
        <button type="button" className="linkbtn" style={{ marginTop: 10 }} onClick={() => onNavigate("/review")}>
          {waiting.length - 6} more in the full queue →
        </button>
      )}

      {deciding && (
        <div className="modal-overlay" onClick={() => !busyId && setDeciding(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{deciding.action === "revise" ? "Send back for revision" : "Reject entry"}</h3>
            <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
              {deciding.t.submitterName} · {deciding.t.type} · {deciding.t.category} — {peso(deciding.t.amount)}
            </p>
            <div className="form-row">
              <label className="field">{deciding.action === "revise" ? "What should they fix?" : "Reason (optional)"}</label>
              <input value={comment} maxLength={300} autoFocus onChange={(e) => setComment(e.target.value)} placeholder={deciding.action === "revise" ? "e.g. The amount does not match the receipt" : "e.g. Duplicate of an earlier entry"} />
            </div>
            <div className="actions">
              <button className="btn ghost" onClick={() => setDeciding(null)} disabled={!!busyId}>Cancel</button>
              <button className={"btn" + (deciding.action === "reject" ? " danger" : "")} onClick={confirmDecision} disabled={!!busyId}>
                {busyId ? "Saving…" : deciding.action === "revise" ? "Send back" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
