import { useState } from "react";
import { fmtDate } from "../utils.js";

export default function CommentsScreen({ comments, addComment }) {
  const [text, setText] = useState("");
  function add(e) {
    e.preventDefault();
    if (!text.trim()) return;
    addComment(text.trim());
    setText("");
  }
  return (
    <div>
      <div className="pagehead"><div><h2>Notes / Feedback</h2><div className="desc">Personal notes, plus reviewer comments left on submitted entries.</div></div></div>
      <div className="card" style={{ marginBottom: 16 }}>
        <form onSubmit={add} style={{ display: "flex", gap: 10 }}>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Add a note..." />
          <button className="btn" type="submit">Post</button>
        </form>
      </div>
      <div className="card">
        {comments.length === 0 ? <div className="empty">No notes yet.</div> : comments.map(n => (
          <div key={n._id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <div style={{ fontSize: 13 }}>{n.text}</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>{n.author} · {fmtDate(n.ts)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
