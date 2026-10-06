import Icon from "../../components/Icon.jsx";
import { ReceiptCard, ago } from "../ReviewScreen.jsx";

// A Reviewer's dashboard is a work queue: how many receipts are waiting, how
// long the oldest has waited, what they have decided, and the next few.
export default function ReviewerDesk({ reviewQueue = [], onNavigate }) {
  const waiting = reviewQueue.filter((r) => r.status === "For Review" && r.latest);
  const decided = reviewQueue.filter((r) => r.status !== "For Review" && r.reviewedAt);
  const count = (s) => decided.filter((r) => r.status === s).length;
  const oldest = waiting[0];

  return (
    <div className="desk">
      <section className="desk-hero">
        <div>
          <div className="desk-kicker">Review Desk</div>
          <div className="desk-count">{waiting.length}</div>
          <div className="desk-sub">
            {waiting.length === 0 ? "Nothing waiting — every receipt has been checked." : `receipt${waiting.length === 1 ? "" : "s"} waiting for review · oldest ${ago(oldest.submittedAt)}`}
          </div>
        </div>
        <button type="button" className="btn" onClick={() => onNavigate("/review")}>Open Receipt Review</button>
      </section>

      <div className="desk-stats">
        <div className="stat-pill"><span className="stat-num">{decided.length}</span>decided by you</div>
        <div className="stat-pill ok"><span className="stat-num">{count("Verified")}</span>verified</div>
        <div className="stat-pill warn"><span className="stat-num">{count("Needs Revision")}</span>sent back</div>
        <div className="stat-pill danger"><span className="stat-num">{count("Rejected")}</span>rejected</div>
      </div>

      <div className="panel-head" style={{ marginTop: 18 }}>
        <h3 className="section-h">Up next</h3>
      </div>
      <div className="review-cards">
        {waiting.slice(0, 4).map((r) => <ReceiptCard key={r._id} r={r} onReview={() => onNavigate("/review")} />)}
        {waiting.length === 0 && (
          <div className="panel empty-panel">
            <Icon name="check" size={28} />
            <div>All caught up. New receipts will appear here.</div>
          </div>
        )}
      </div>
      {waiting.length > 4 && (
        <button type="button" className="linkbtn" style={{ marginTop: 10 }} onClick={() => onNavigate("/review")}>
          {waiting.length - 4} more in Receipt Review →
        </button>
      )}
    </div>
  );
}
