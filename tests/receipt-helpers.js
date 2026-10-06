const { api } = require("./helpers");
const { samplePng } = require("../scripts/sample-receipt");

const PNG = samplePng();
const pngBody = (extra = {}) => ({ kind: "file", fileName: "receipt.png", mimeType: "image/png", data: PNG.toString("base64"), ...extra });

// Records an entry and attaches a receipt to it; returns both.
async function entryWithReceipt(token, entryBody = {}, receiptBody = pngBody()) {
  const entry = await api("/api/transactions", {
    method: "POST", token, body: { type: "Expense", category: "Food", amount: 420, note: "receipt test", ...entryBody },
  });
  const receipt = await api("/api/receipts", { method: "POST", token, body: { ...receiptBody, transactionId: entry.data._id } });
  return { entry: entry.data, receipt };
}

module.exports = { PNG, pngBody, entryWithReceipt };
