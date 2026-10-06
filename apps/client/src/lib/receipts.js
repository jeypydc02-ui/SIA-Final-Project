// Receipts (proof for an income or expense entry): preparing a file for
// upload, opening an uploaded one, and how each review status reads.

export const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;
const LONGEST_SIDE = 1600; // plenty to read a receipt; phone photos are 4000+

export const RECEIPT_STATUS = {
  "For Review": { label: "For review", tone: "warn" },
  Verified: { label: "Verified", tone: "ok" },
  Rejected: { label: "Rejected", tone: "danger" },
  "Needs Revision": { label: "Needs revision", tone: "danger" },
  Replaced: { label: "Replaced", tone: "neutral" },
  Withdrawn: { label: "Withdrawn", tone: "neutral" },
};
export const receiptStatus = (s) => RECEIPT_STATUS[s] || { label: s, tone: "neutral" };

// A new version can be attached while the latest is waiting or was sent back;
// a verified receipt is final.
export const canReplace = (latest) => !latest || ["For Review", "Needs Revision", "Rejected"].includes(latest.status);

export function fileSize(bytes) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function readAsDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("That file could not be read."));
    r.readAsDataURL(blob);
  });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That photo could not be opened. Try a JPG or PNG."));
    img.src = url;
  });
}

// Turns a picked file into what the API takes: { fileName, mimeType, data }.
// Photos are scaled down and saved as JPEG, so an 8 MB phone photo uploads as
// a few hundred KB on a slow connection; PDFs are sent as they are.
export async function prepareReceiptFile(file) {
  if (file.type === "application/pdf") {
    if (file.size > MAX_RECEIPT_BYTES) throw new Error("That PDF is larger than 2 MB. Attach a link to it instead.");
    const dataUrl = await readAsDataURL(file);
    return { fileName: file.name, mimeType: "application/pdf", data: dataUrl.split(",")[1], size: file.size };
  }
  if (!/^image\//.test(file.type)) throw new Error("Choose a photo (JPG, PNG, WEBP) or a PDF.");

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, LONGEST_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // transparent PNGs become white, not black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const data = dataUrl.split(",")[1];
    const size = Math.floor((data.length * 3) / 4);
    if (size > MAX_RECEIPT_BYTES) throw new Error("That photo is still larger than 2 MB. Attach a link to it instead.");
    const base = file.name.replace(/\.[^.]+$/, "") || "receipt";
    return { fileName: base + ".jpg", mimeType: "image/jpeg", data, size };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// An uploaded receipt is only served with the session token, so it is
// fetched here and shown from a local blob: URL. The caller revokes it.
export async function fetchReceiptFile(receiptId) {
  const token = sessionStorage.getItem("fts_token");
  let res;
  try {
    res = await fetch(`/api/receipts/${receiptId}/file`, { headers: { Authorization: "Bearer " + token } });
  } catch (e) {
    throw new Error("Could not reach the server to open the receipt.");
  }
  if (!res.ok) {
    let message = "The receipt could not be opened.";
    try { message = (await res.json()).error || message; } catch (e) { /* not JSON */ }
    throw new Error(message);
  }
  return URL.createObjectURL(await res.blob());
}
