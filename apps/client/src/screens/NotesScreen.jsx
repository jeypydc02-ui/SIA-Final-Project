import { useState } from "react";
import { fmtDate, peso } from "../lib/utils.js";
import Icon from "../components/Icon.jsx";

// Works like the notes app on a phone: each note has a title and a body, the
// list shows a short preview, and tapping one opens the whole note. A note can
// also be about one of your entries (spec section 5, Comment / Feedback Module).
const FILTERS = [["all", "All"], ["notes", "My Notes"], ["feedback", "On Entries"]];
const EMPTY = { title: "", text: "", transactionId: "" };

// Older notes have no title; like a phone, the first line stands in for one.
function headline(n) {
  if (n.title) return { title: n.title, body: n.text };
  const [first, ...rest] = n.text.split("\n");
  return { title: first.length > 60 ? first.slice(0, 60) + "…" : first, body: rest.join("\n").trim() || (first.length > 60 ? n.text : "") };
}

export default function NotesScreen({ comments, addNote, editNote, deleteNote, tx = [], me }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState(null); // { id?, title, text, transactionId }
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState("");

  const txById = new Map(tx.map((t) => [String(t._id), t]));
  const entryLabel = (n) => {
    const entry = txById.get(String(n.transactionId));
    return entry ? `${entry.type} · ${entry.category} · ${peso(entry.amount)}` : "an entry";
  };
  // Entries a new note can be about: the current ones, not earlier versions.
  const linkable = tx.filter((t) => t.status === "Approved" || t.status === "Needs Revision");

  const q = query.trim().toLowerCase();
  const shown = comments.filter((c) => {
    if (filter === "notes" && c.transactionId) return false;
    if (filter === "feedback" && !c.transactionId) return false;
    return !q || (c.title || "").toLowerCase().includes(q) || c.text.toLowerCase().includes(q);
  });
  const count = (id) => comments.filter((c) => (id === "all" ? true : id === "notes" ? !c.transactionId : !!c.transactionId)).length;
  const opened = openId ? comments.find((c) => c._id === openId) : null;
  const mine = (n) => n && String(n.authorId) === String(me);

  function startNew() {
    setFormErr("");
    setOpenId(null);
    setDraft({ ...EMPTY, transactionId: filter === "feedback" && linkable[0] ? String(linkable[0]._id) : "" });
  }
  function startEdit(n) {
    setFormErr("");
    setDraft({ id: n._id, title: n.title || "", text: n.text, transactionId: n.transactionId || "" });
  }
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    if (!draft.text.trim()) { setFormErr("Write something in the note first."); return; }
    setBusy(true);
    const body = { title: draft.title.trim(), text: draft.text.trim() };
    const ok = draft.id
      ? await editNote(draft.id, body)
      : await addNote({ ...body, ...(draft.transactionId ? { transactionId: draft.transactionId } : {}) });
    setBusy(false);
    // Kept on failure, so a note is never lost to a dropped connection.
    if (ok) {
      if (draft.id) setOpenId(draft.id);
      setDraft(null);
    }
  }

  return (
    <div>
      <div className="pagehead">
        <div>
          <h2>Notes / Feedback</h2>
          <div className="desc">Your notes, and notes about your income and expense entries.</div>
        </div>
        <button className="btn" onClick={startNew}>+ New Note</button>
      </div>

      <div className="notes-tools">
        <div className="tabrow">
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" className={"tab" + (filter === id ? " active" : "")} onClick={() => setFilter(id)}>
              {label}<span className="tab-count">{count(id)}</span>
            </button>
          ))}
        </div>
        <input className="notes-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" aria-label="Search notes" />
      </div>

      {shown.length === 0 ? (
        <div className="card">
          <div className="empty">
            {q ? "No notes match your search." : <>No notes yet. <button className="linkbtn" onClick={startNew}>Write your first note</button></>}
          </div>
        </div>
      ) : (
        <div className="notes-grid">
          {shown.map((n) => {
            const { title, body } = headline(n);
            return (
              <button key={n._id} type="button" className="note-card" onClick={() => setOpenId(n._id)}>
                <span className="note-title">{title}</span>
                {body && <span className="note-preview">{body}</span>}
                <span className="note-meta">
                  {fmtDate(n.ts)}
                  {n.transactionId && <span className="chip neutral">{entryLabel(n)}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {opened && !draft && (
        <div className="modal-overlay" onClick={() => setOpenId(null)}>
          <div className="modal note-view" role="dialog" aria-label={headline(opened).title} onClick={(e) => e.stopPropagation()}>
            <div className="note-view-head">
              <button type="button" className="note-back" aria-label="Back to notes" onClick={() => setOpenId(null)}>
                <Icon name="arrowRight" size={18} className="flip" /> Notes
              </button>
              {mine(opened) && (
                <span className="note-view-actions">
                  <button type="button" className="btn small ghost" onClick={() => startEdit(opened)}>Edit</button>
                  <button type="button" className="btn small danger" onClick={() => { setOpenId(null); deleteNote(opened); }}>Delete</button>
                </span>
              )}
            </div>
            <h3 className="note-view-title">{opened.title || headline(opened).title}</h3>
            <div className="note-view-meta">
              {fmtDate(opened.ts)}{opened.editedAt ? " · edited" : ""}
              {!mine(opened) && ` · by ${opened.author}`}
              {opened.transactionId && <> · about <strong>{entryLabel(opened)}</strong></>}
            </div>
            <div className="note-view-text">{opened.text}</div>
          </div>
        </div>
      )}

      {draft && (
        <div className="modal-overlay" onClick={() => !busy && setDraft(null)}>
          <div className="modal note-edit" onClick={(e) => e.stopPropagation()}>
            <h3>{draft.id ? "Edit Note" : "New Note"}</h3>
            <form onSubmit={save}>
              <input className="note-title-input" value={draft.title} maxLength={120} placeholder="Title"
                aria-label="Title" onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              <textarea className="note-text-input" value={draft.text} maxLength={5000} placeholder="Note" aria-label="Note"
                autoFocus onChange={(e) => { setDraft({ ...draft, text: e.target.value }); setFormErr(""); }} />
              {!draft.id && (
                <div className="form-row">
                  <label className="field" htmlFor="note-entry">About an entry (optional)</label>
                  <select id="note-entry" value={draft.transactionId} onChange={(e) => setDraft({ ...draft, transactionId: e.target.value })}>
                    <option value="">None — a personal note</option>
                    {linkable.map((t) => (
                      <option key={t._id} value={t._id}>
                        {fmtDate(t.date)} · {t.type} · {t.category} · {peso(t.amount)}{t.note ? ` — ${t.note}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {formErr && <div className="form-msg error">{formErr}</div>}
              <div className="actions">
                <button type="button" className="btn ghost" onClick={() => setDraft(null)} disabled={busy}>Cancel</button>
                <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Save Note"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
