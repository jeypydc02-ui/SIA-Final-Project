import { useState } from "react";
import ReceiptPicker from "./ReceiptPicker.jsx";
import { ReceiptPreview, ReceiptMeta } from "./ReceiptView.jsx";
import { canReplace } from "../lib/receipts.js";
import { peso, fmtDate } from "../lib/utils.js";

// The receipt behind one entry, for its owner: the latest version with its
// review status, the earlier versions, and — while it is still open — a way
// to attach a new version.
export default function ReceiptDialog({ entry, receipts, submitReceipt, onClose }) {
  const versions = receipts
    .filter((r) => String(r.entryId) === String(entry._id))
    .sort((a, b) => b.version - a.version);
  const latest = versions[0] || null;
  const [shown, setShown] = useState(latest ? latest._id : null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const open = versions.find((r) => r._id === shown);
  const replaceable = canReplace(latest);

  async function send(e) {
    e.preventDefault();
    if (busy) return;
    if (!draft) { setErr("Choose a file or paste a link first."); return; }
    setBusy(true);
    const ok = await submitReceipt(entry._id, draft);
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <div className="modal-overlay" onClick={() => !busy && onClose()}>
      <div className="modal receipt-modal" role="dialog" aria-label="Receipt" onClick={(e) => e.stopPropagation()}>
        <h3>Receipt</h3>
        <p className="row-sub" style={{ marginTop: -8 }}>
          {entry.type} · {entry.category} · {peso(entry.amount)} · {fmtDate(entry.date)}{entry.note ? ` — ${entry.note}` : ""}
        </p>

        {open && (
          <div className="receipt-current">
            <ReceiptMeta receipt={open} />
            <ReceiptPreview receipt={open} />
          </div>
        )}

        {versions.length > 1 && (
          <div className="receipt-versions">
            <div className="field">All versions</div>
            {versions.map((r) => (
              <button key={r._id} type="button" className={"version-pill" + (r._id === shown ? " active" : "")} onClick={() => setShown(r._id)}>
                v{r.version} · {r.status}
              </button>
            ))}
          </div>
        )}

        {replaceable ? (
          <form onSubmit={send} className="receipt-form">
            <div className="field">
              {!latest ? "Attach a receipt" : latest.status === "For Review" ? `Replace with version ${latest.version + 1}` : `Send version ${latest.version + 1}`}
            </div>
            {!latest && <div className="hint" style={{ marginTop: 0, marginBottom: 8 }}>A Reviewer checks it against this entry. The entry already counts in your balance either way.</div>}
            <ReceiptPicker value={draft} onChange={(v) => { setDraft(v); setErr(""); }} idPrefix={"receipt-" + entry._id} />
            {err && <div className="form-msg error">{err}</div>}
            <div className="actions">
              <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Close</button>
              <button className="btn" type="submit" disabled={busy}>{busy ? "Sending…" : "Submit for Review"}</button>
            </div>
          </form>
        ) : (
          <div className="actions">
            <span className="row-sub" style={{ marginRight: "auto" }}>A verified receipt is final.</span>
            <button type="button" className="btn" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
