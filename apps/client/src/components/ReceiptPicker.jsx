import { useState } from "react";
import Icon from "./Icon.jsx";
import { prepareReceiptFile, fileSize } from "../lib/receipts.js";

// Choose how to attach a receipt: upload a photo or PDF (on a phone this
// offers the camera), or paste a link to it in Google Drive, OneDrive or
// Dropbox. Reports the ready-to-send receipt, or null, through onChange.
export default function ReceiptPicker({ value, onChange, idPrefix = "receipt" }) {
  const [mode, setMode] = useState(value && value.kind === "link" ? "link" : "file");
  const [preparing, setPreparing] = useState(false);
  const [err, setErr] = useState("");
  const [url, setUrl] = useState(value && value.kind === "link" ? value.url : "");

  async function pick(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // picking the same file again still fires
    if (!file) return;
    setErr("");
    setPreparing(true);
    try {
      const prepared = await prepareReceiptFile(file);
      onChange({ kind: "file", ...prepared });
    } catch (problem) {
      setErr(problem.message);
      onChange(null);
    } finally {
      setPreparing(false);
    }
  }

  function switchTo(next) {
    setMode(next);
    setErr("");
    onChange(next === "link" && url.trim() ? { kind: "link", url: url.trim() } : null);
  }

  return (
    <div className="receipt-picker">
      <div className="segmented small" role="tablist" aria-label="How to attach the receipt">
        <button type="button" role="tab" aria-selected={mode === "file"} className={mode === "file" ? "active" : ""} onClick={() => switchTo("file")}>Upload photo / PDF</button>
        <button type="button" role="tab" aria-selected={mode === "link"} className={mode === "link" ? "active" : ""} onClick={() => switchTo("link")}>Paste a link</button>
      </div>

      {mode === "file" ? (
        <div>
          <label className="file-drop" htmlFor={idPrefix + "-file"}>
            <Icon name="receipt" size={22} />
            <span>
              {preparing ? "Preparing…" : value && value.kind === "file"
                ? <><strong>{value.fileName}</strong> · {fileSize(value.size)} — tap to change</>
                : <>Tap to choose a photo of the receipt, or a PDF <span className="hint">(up to 2 MB)</span></>}
            </span>
          </label>
          <input id={idPrefix + "-file"} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={pick} aria-label="Receipt file" />
        </div>
      ) : (
        <div className="form-row">
          <input
            type="url" inputMode="url" value={url} maxLength={500} aria-label="Receipt link"
            placeholder="https://drive.google.com/…"
            onChange={(e) => { setUrl(e.target.value); onChange(e.target.value.trim() ? { kind: "link", url: e.target.value.trim() } : null); }}
          />
          <div className="hint">A shared link from Google Drive, OneDrive or Dropbox (https only).</div>
        </div>
      )}
      {err && <div className="form-msg error">{err}</div>}
    </div>
  );
}
