import { useState } from "react";
import { peso, fmtDate, txStatusBadge } from "../lib/utils.js";

// Builds the real revision chains out of the stored version/parentId fields
// (spec FR-004). Nothing here is synthesised: every row is a record that was
// actually written when someone resubmitted an entry.
function buildChains(tx) {
  const byParent = new Map();
  tx.forEach((t) => {
    if (!t.parentId) return;
    byParent.set(String(t.parentId), t);
  });
  return tx
    .filter((t) => !t.parentId)
    .map((root) => {
      const chain = [root];
      let current = root;
      while (byParent.has(String(current._id))) {
        current = byParent.get(String(current._id));
        chain.push(current);
      }
      return chain;
    })
    .sort((a, b) => b.length - a.length || new Date(b[0].createdAt) - new Date(a[0].createdAt));
}

function diff(prev, next) {
  const parts = [];
  if (prev.amount !== next.amount) parts.push(`amount ${peso(prev.amount)} → ${peso(next.amount)}`);
  if (prev.category !== next.category) parts.push(`category ${prev.category} → ${next.category}`);
  if (prev.date !== next.date) parts.push(`date ${fmtDate(prev.date)} → ${fmtDate(next.date)}`);
  if ((prev.note || "") !== (next.note || "")) parts.push("note edited");
  return parts.length ? parts.join(", ") : "resubmitted without changes";
}

export default function VersionHistory({ tx }) {
  const chains = buildChains(tx);
  const revised = chains.filter((c) => c.length > 1);
  const [open, setOpen] = useState(() => new Set());

  function toggle(id) {
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="pagehead">
        <div>
          <h2>Revision History</h2>
          <div className="desc">Version trail for submitted entries — v1 → v2 → v3, with what changed at each step.</div>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card stat"><h3>Entries</h3><div className="value">{chains.length}</div><div className="label">submission chains</div></div>
        <div className="card stat"><h3>Revised</h3><div className="value">{revised.length}</div><div className="label">went through a revision</div></div>
        <div className="card stat"><h3>Versions</h3><div className="value">{tx.length}</div><div className="label">records stored in total</div></div>
      </div>

      <div className="card">
        <table>
          <thead><tr><th></th><th>Entry</th><th>Latest Amount</th><th>Versions</th><th>Current Status</th></tr></thead>
          <tbody>
            {chains.map((chain) => {
              const latest = chain[chain.length - 1];
              const id = String(chain[0]._id);
              const isOpen = open.has(id);
              return [
                <tr key={id} className={chain.length > 1 ? "row-link" : undefined} onClick={chain.length > 1 ? () => toggle(id) : undefined}>
                  <td style={{ width: 24, color: "var(--text-dim)" }}>{chain.length > 1 ? (isOpen ? "▾" : "▸") : ""}</td>
                  <td>{latest.type} · {latest.category}{latest.note ? ` — ${latest.note}` : ""}</td>
                  <td>{peso(latest.amount)}</td>
                  <td><span className="badge neutral">v{latest.version || 1}</span></td>
                  <td><span className={"badge " + txStatusBadge(latest.status)}>{latest.status}</span></td>
                </tr>,
                isOpen && (
                  <tr key={id + "-detail"}>
                    <td colSpan="5" style={{ background: "var(--row-hover)" }}>
                      <div className="timeline">
                        {chain.map((v, i) => (
                          <div className="timeline-item" key={String(v._id)}>
                            <div className="timeline-dot" />
                            <div>
                              <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                                v{v.version || 1} — {peso(v.amount)}
                                <span className={"badge " + txStatusBadge(v.status)} style={{ marginLeft: 8 }}>{v.status}</span>
                              </div>
                              <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 3 }}>
                                {i === 0 ? "Originally submitted" : diff(chain[i - 1], v)}
                                {v.reviewComment ? ` · Reviewer: "${v.reviewComment}"` : ""}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ),
              ];
            })}
            {chains.length === 0 && <tr><td colSpan="5"><div className="empty">No submissions yet.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
