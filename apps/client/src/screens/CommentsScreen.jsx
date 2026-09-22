import { useState } from "react";
import { fmtDate, peso } from "../lib/utils.js";

export default function CommentsScreen({ comments, addComment, tx = [] }) {
  const [text, setText] = useState("");
  const [filter, setFilter] = useState("all"); // all | notes | feedback

  // Lets a review comment name the entry it was left on, instead of floating
  // in the list with no context (spec section 5, Comment / Feedback Module).
  const txById = new Map(tx.map((t) => [String(t._id), t]));

  function add(e) {
    e.preventDefault();
    if (!text.trim()) return;
    addComment(text.trim());
    setText("");
  }

  const shown = comments.filter((c) => {
    if (filter === "notes") return !c.transactionId;
    if (filter === "feedback") return !!c.transactionId;
    return true;
  });

  return (
    <div>
      <div className="pagehead">
        <div>
          <h2>Notes / Feedback</h2>
          <div className="desc">Your personal notes, plus reviewer comments left on your submitted entries.</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <form onSubmit={add} style={{ display: "flex", gap: 10 }}>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Add a personal note..." />
          <button className="btn" type="submit">Post</button>
        </form>
      </div>

      <div className="tabrow" style={{ marginBottom: 16 }}>
        {[["all", "All"], ["notes", "My Notes"], ["feedback", "Review Feedback"]].map(([id, label]) => (
          <button key={id} type="button" className={"tab" + (filter === id ? " active" : "")} onClick={() => setFilter(id)}>
            {label}
            <span className="tab-count">
              {id === "all" ? comments.length : comments.filter(c => (id === "notes" ? !c.transactionId : !!c.transactionId)).length}
            </span>
          </button>
        ))}
      </div>

      <div className="card">
        {shown.length === 0 ? <div className="empty">Nothing here yet.</div> : shown.map(n => {
          const entry = n.transactionId ? txById.get(String(n.transactionId)) : null;
          return (
            <div key={n._id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
              {n.transactionId && (
                <div style={{ marginBottom: 4 }}>
                  <span className="badge neutral">
                    {entry ? `on ${entry.type} · ${entry.category} · ${peso(entry.amount)}` : "review feedback"}
                  </span>
                </div>
              )}
              <div style={{ fontSize: 13 }}>{n.text}</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>{n.author} · {fmtDate(n.ts)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
