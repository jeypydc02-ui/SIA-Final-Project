import Icon from "../../components/Icon.jsx";
import { peso, fmtDate } from "../../lib/utils.js";

// An Approver reviews; they keep no wallet. Their home is the review queue.
export default function ApproverHome({ session, requests, onNavigate }) {
  const pending = requests.filter((r) => r.status === "Pending");
  const mine = requests.filter((r) => r.status !== "Pending");
  const waiting = mine.filter((r) => r.status === "Approved").length;
  const paid = mine.filter((r) => r.status === "Paid").length;

  return (
    <div className="console">
      <section className="console-status">
        <div className="console-title">
          <Icon name="check" size={20} />
          <div>
            <div className="console-name">Approver</div>
            <div className="console-sub">Welcome, {session.name.split(" ")[0]}. Payment requests wait here for your decision.</div>
          </div>
        </div>
      </section>

      <div className="kpis">
        <button type="button" className="kpi kpi-link" onClick={() => onNavigate("/approvals")}>
          <div className="kpi-label">Waiting for review</div>
          <div className="kpi-value">{pending.length}</div>
          <div className="kpi-foot">{pending.length ? "Open the queue" : "Nothing pending"}</div>
        </button>
        <div className="kpi">
          <div className="kpi-label">Reviewed by you</div>
          <div className="kpi-value">{mine.length}</div>
          <div className="kpi-foot">approved, rejected or sent back</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Awaiting gateway</div>
          <div className="kpi-value">{waiting}</div>
          <div className="kpi-foot">approved, not yet confirmed</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Confirmed paid</div>
          <div className="kpi-value">{paid}</div>
          <div className="kpi-foot">gateway confirmed</div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head"><h3>Latest requests</h3><button className="linkbtn" onClick={() => onNavigate("/approvals")}>Open queue</button></div>
        {pending.slice(0, 5).map((r) => (
          <button key={r._id} type="button" className="row" onClick={() => onNavigate("/approvals")}>
            <span className="row-main">
              <span className="row-title">{r.billName} — {peso(r.amount)}</span>
              <span className="row-sub">{r.requesterName} · due {fmtDate(r.due)}</span>
            </span>
            <span className="chip warn">Review</span>
          </button>
        ))}
        {pending.length === 0 && <div className="empty">No requests are waiting.</div>}
      </section>
    </div>
  );
}