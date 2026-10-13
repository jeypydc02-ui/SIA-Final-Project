import { useState } from "react";
import { peso, fmtDate, requestBadge, requestLabel } from "../lib/utils.js";

// The Approver's workspace: the queue of requests waiting for a decision, and
// the history of what they reviewed. The Approver sees only what is needed to
// decide (bill, amount, due date, who asked), never the requester's wallet.
export default function ApprovalsScreen({ requests, decide }) {
  const [tab, setTab] = useState("pending");
  const [open, setOpen] = useState(null);      // the request being reviewed
  const [remarks, setRemarks] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const pending = requests.filter((r) => r.status === "Pending");
  const reviewed = requests.filter((r) => r.status !== "Pending");
  const rows = tab === "pending" ? pending : reviewed;

  function openReview(r) { setOpen(r); setRemarks(""); setErr(""); }

  async function submit(decision) {
    if (busy) return;
    // A reason is required when the request is not approved.
    if (decision !== "approve" && !remarks.trim()) {
      setErr("Write a reason so the requester knows what to do next.");
      return;
    }
    setBusy(true);
    const ok = await decide(open._id, decision, remarks.trim());
    setBusy(false);
    if (ok) setOpen(null);
  }

  return (
    <div>
      <div className="pagehead">
        <div>
          <h2>Payment Approvals</h2>
          <div className="desc">Review bill payment requests. Approving sends the payment to the simulated gateway; the bill is marked Paid only when the gateway confirms.</div>
        </div>
      </div>

      <div className="tabrow" style={{ marginBottom: 14 }}>
        {[["pending", "Pending", pending.length], ["history", "Review History", reviewed.length]].map(([id, label, n]) => (
          <button key={id} type="button" className={"tab" + (tab === id ? " active" : "")} onClick={() => setTab(id)}>
            {label}<span className="tab-count">{n}</span>
          </button>
        ))}
      </div>

      <div className="card table-scroll">
        {tab === "pending" ? (
          <table>
            <thead><tr><th>Requested by</th><th>Bill</th><th>Category</th><th>Due</th><th>Amount</th><th>Submitted</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td>{r.requesterName}</td>
                  <td>{r.billName}</td>
                  <td>{r.category}</td>
                  <td>{fmtDate(r.due)}</td>
                  <td>{peso(r.amount)}</td>
                  <td style={{ fontSize: 11.5, color: "var(--text-dim)", whiteSpace: "nowrap" }}>{fmtDate(r.createdAt)}</td>
                  <td><button className="btn small" onClick={() => openReview(r)}>Review</button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="7"><div className="empty">Nothing is waiting for review.</div></td></tr>}
            </tbody>
          </table>
        ) : (
          <table>
            <thead><tr><th>Reviewed</th><th>Requested by</th><th>Bill</th><th>Amount</th><th>Status</th><th>Remarks</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td style={{ fontSize: 11.5, color: "var(--text-dim)", whiteSpace: "nowrap" }}>{r.reviewedAt ? new Date(r.reviewedAt).toLocaleString() : "—"}</td>
                  <td>{r.requesterName}</td>
                  <td>{r.billName}</td>
                  <td>{peso(r.amount)}</td>
                  <td><span className={"badge " + requestBadge(r.status)}>{requestLabel(r.status)}</span></td>
                  <td style={{ color: "var(--text-dim)" }}>{r.remarks || "—"}</td>
                  <td><button className="btn small ghost" onClick={() => openReview(r)}>Details</button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="7"><div className="empty">You have not reviewed any request yet.</div></td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <div className="modal-overlay" onClick={() => !busy && setOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{open.status === "Pending" ? "Review payment request" : "Request details"}</h3>
            <table>
              <tbody>
                <tr><td>Requested by</td><td><strong>{open.requesterName}</strong></td></tr>
                <tr><td>Bill</td><td>{open.billName} · {open.category}</td></tr>
                <tr><td>Amount</td><td><strong>{peso(open.amount)}</strong></td></tr>
                <tr><td>Due date</td><td>{fmtDate(open.due)}</td></tr>
                <tr><td>Status</td><td><span className={"badge " + requestBadge(open.status)}>{requestLabel(open.status)}</span></td></tr>
                {open.note && <tr><td>Requester's note</td><td>{open.note}</td></tr>}
                {open.gatewayRef && <tr><td>Gateway ref</td><td>{open.gatewayRef} <span className="flow-badge">simulated</span></td></tr>}
              </tbody>
            </table>

            <div className="mini-title" style={{ marginTop: 14 }}>History</div>
            {(open.history || []).map((h, i) => (
              <div key={i} style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "4px 0" }}>
                {new Date(h.at).toLocaleString()} — <strong>{h.action}</strong> · {h.by}{h.remarks ? ` — “${h.remarks}”` : ""}
              </div>
            ))}

            {open.status === "Pending" && (
              <>
                <div className="form-row" style={{ marginTop: 14 }}>
                  <label className="field">Remarks (required to reject or ask for a revision)</label>
                  <textarea rows="3" maxLength={300} value={remarks} onChange={(e) => { setRemarks(e.target.value); setErr(""); }} />
                  {err && <div className="form-msg error" style={{ marginTop: 8 }}>{err}</div>}
                </div>
                <div className="actions">
                  <button className="btn ghost" onClick={() => setOpen(null)} disabled={busy}>Close</button>
                  <button className="btn danger" onClick={() => submit("reject")} disabled={busy}>Reject</button>
                  <button className="btn ghost" onClick={() => submit("revise")} disabled={busy}>Request Revision</button>
                  <button className="btn" onClick={() => submit("approve")} disabled={busy}>{busy ? "Saving…" : "Approve"}</button>
                </div>
              </>
            )}
            {open.status !== "Pending" && (
              <div className="actions"><button className="btn ghost" onClick={() => setOpen(null)}>Close</button></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}