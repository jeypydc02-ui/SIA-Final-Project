import { useState } from "react";
import { peso, fmtDate, txStatusLabel } from "../lib/utils.js";
import { fitCategory } from "../lib/categories.js";
import CategoryIcon from "../components/CategoryIcon.jsx";
import EntryFields, { entryProblem } from "../components/EntryFields.jsx";
import ReceiptDialog from "../components/ReceiptDialog.jsx";
import { receiptStatus } from "../lib/receipts.js";

// Every income and expense the person has recorded. Entries count the moment
// they are saved; editing one keeps the old figures as an earlier version
// (see Revision History), and deleting one stops it counting while keeping it
// in the history.
const FILTERS = [["all", "All"], ["Income", "Income"], ["Expense", "Expenses"]];
// Earlier versions and deleted entries live in Revision History, not here.
const SHOWN = ["Approved", "Needs Revision", "Rejected", "Pending Review"];
const EDITABLE = ["Approved", "Needs Revision"];

export default function EntriesScreen({ tx, editTx, deleteTx, receipts = [], submitReceipt, onNavigate }) {
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState(null); // {entry, value}
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [receiptFor, setReceiptFor] = useState(null); // the entry whose receipt is open

  // The latest receipt version per entry.
  const latestReceipt = new Map();
  receipts.forEach((r) => {
    const key = String(r.entryId);
    if (!latestReceipt.has(key) || latestReceipt.get(key).version < r.version) latestReceipt.set(key, r);
  });

  const current = tx.filter((t) => SHOWN.includes(t.status));
  const rows = current.filter((t) => filter === "all" || t.type === filter);
  const count = (key) => current.filter((t) => key === "all" || t.type === key).length;

  function openEdit(t) {
    setFormErr("");
    setDraft({ entry: t, value: { type: t.type, category: fitCategory(t.type, t.category), amount: String(t.amount), date: t.date, note: t.note || "" } });
  }
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    const problem = entryProblem(draft.value);
    if (problem) { setFormErr(problem); return; }
    setBusy(true);
    const ok = await editTx(draft.entry._id, { ...draft.value, amount: Number(draft.value.amount) });
    setBusy(false);
    if (ok) setDraft(null);
  }

  return (
    <div>
      <div className="pagehead">
        <div>
          <h2>My Entries</h2>
          <div className="desc">Every income and expense you have recorded. Changes are kept as versions in Revision History; attach a receipt to have it checked by a Reviewer.</div>
        </div>
        <button className="btn" onClick={() => onNavigate("/submit")}>+ Log Income/Expense</button>
      </div>

      <div className="tabrow" style={{ marginBottom: 14 }}>
        {FILTERS.map(([key, label]) => (
          <button key={key} type="button" className={"tab" + (filter === key ? " active" : "")} onClick={() => setFilter(key)}>
            {label}<span className="tab-count">{count(key)}</span>
          </button>
        ))}
      </div>

      <section className="panel">
        {rows.map((t) => {
          const editable = EDITABLE.includes(t.status) && !t.autoApproved;
          const receipt = latestReceipt.get(String(t._id));
          const canAttach = EDITABLE.includes(t.status);
          return (
            <div key={t._id} className="row static entry-row">
              <CategoryIcon category={t.category} />
              <span className="row-main">
                <span className="row-title">
                  {t.note || t.category}
                  {t.version > 1 && <span className="chip neutral">v{t.version}</span>}
                </span>
                <span className="row-sub">
                  {t.category} · {fmtDate(t.date)} · <span className={"status-" + t.status.replace(/\s/g, "-").toLowerCase()}>{txStatusLabel(t.status)}</span>
                  {t.autoApproved && " · from a bill payment"}
                </span>
              </span>
              <span className={"row-amount " + (t.status !== "Approved" ? "muted" : t.type === "Income" ? "pos" : "spent")}>
                {(t.type === "Income" ? "+" : "−") + peso(t.amount)}
              </span>
              <span className="entry-actions">
                {receipt ? (
                  <button type="button" className={"receipt-chip " + receiptStatus(receipt.status).tone} onClick={() => setReceiptFor(t)}>
                    Receipt v{receipt.version} · {receiptStatus(receipt.status).label}
                  </button>
                ) : canAttach && (
                  <button type="button" className="btn small ghost" onClick={() => setReceiptFor(t)}>Attach receipt</button>
                )}
                {editable && (
                  <>
                    <button className="btn small ghost" onClick={() => openEdit(t)}>Edit</button>
                    <button className="btn small danger" onClick={() => deleteTx(t)}>Delete</button>
                  </>
                )}
              </span>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="empty small">
            Nothing recorded yet. <button className="linkbtn" onClick={() => onNavigate("/submit")}>Log your first entry</button>
          </div>
        )}
      </section>

      {receiptFor && (
        <ReceiptDialog
          entry={tx.find((t) => t._id === receiptFor._id) || receiptFor}
          receipts={receipts} submitReceipt={submitReceipt} onClose={() => setReceiptFor(null)}
        />
      )}

      {draft && (
        <div className="modal-overlay" onClick={() => !busy && setDraft(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Entry</h3>
            <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
              Saving creates version {(draft.entry.version || 1) + 1}. The current figures stay visible in Revision History.
            </p>
            <form onSubmit={save}>
              <EntryFields value={draft.value} onChange={(value) => { setDraft({ ...draft, value }); setFormErr(""); }} />
              {formErr && <div className="form-msg error">{formErr}</div>}
              <div className="actions">
                <button type="button" className="btn ghost" onClick={() => setDraft(null)} disabled={busy}>Cancel</button>
                <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
