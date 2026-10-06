import { useEffect, useState } from "react";
import Icon from "./Icon.jsx";
import { fetchReceiptFile, receiptStatus, fileSize } from "../lib/receipts.js";
import { fmtDate } from "../lib/utils.js";

// One receipt: the photo itself, a PDF to open, or the link — with its
// version, status and the reviewer's note.
export function ReceiptPreview({ receipt }) {
  const [src, setSrc] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (receipt.kind !== "file") return undefined;
    let url = null;
    let cancelled = false;
    setSrc(null); setErr("");
    fetchReceiptFile(receipt._id)
      .then((u) => { if (cancelled) URL.revokeObjectURL(u); else { url = u; setSrc(u); } })
      .catch((e) => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [receipt._id, receipt.kind]);

  if (receipt.kind === "link") {
    return (
      <a className="receipt-link" href={receipt.url} target="_blank" rel="noopener noreferrer">
        <Icon name="download" size={18} />
        <span><strong>Open in {receipt.provider}</strong><span className="row-sub">{receipt.url}</span></span>
      </a>
    );
  }
  if (err) return <div className="form-msg error">{err}</div>;
  if (!src) return <div className="receipt-loading">Opening receipt…</div>;
  if (receipt.mimeType === "application/pdf") {
    return (
      <a className="receipt-link" href={src} download={receipt.fileName}>
        <Icon name="download" size={18} />
        <span><strong>Download PDF</strong><span className="row-sub">{receipt.fileName} · {fileSize(receipt.size)}</span></span>
      </a>
    );
  }
  return <img className="receipt-img" src={src} alt={`Receipt ${receipt.fileName}`} />;
}

export function ReceiptStatusChip({ receipt, prefix = true }) {
  const s = receiptStatus(receipt.status);
  return <span className={"badge " + s.tone}>{prefix ? `Receipt v${receipt.version} · ` : ""}{s.label}</span>;
}

export function ReceiptMeta({ receipt }) {
  return (
    <div className="receipt-meta">
      <div><ReceiptStatusChip receipt={receipt} /></div>
      <div className="row-sub">
        Submitted {fmtDate(receipt.submittedAt)}
        {receipt.kind === "file" ? ` · ${receipt.fileName}` : ` · ${receipt.provider} link`}
      </div>
      {receipt.reviewedAt && (
        <div className="receipt-note">
          <strong>{receipt.reviewerName}</strong> · {fmtDate(receipt.reviewedAt)}
          {receipt.reviewNote ? <div>“{receipt.reviewNote}”</div> : null}
        </div>
      )}
    </div>
  );
}
