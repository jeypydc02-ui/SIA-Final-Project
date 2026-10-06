import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { todayISO } from "../lib/utils.js";
import { categoriesFor, fitCategory } from "../lib/categories.js";
import EntryFields, { entryProblem } from "../components/EntryFields.jsx";
import ReceiptPicker from "../components/ReceiptPicker.jsx";

const blank = (type = "Expense") => ({ type, category: categoriesFor(type)[0], amount: "", date: todayISO(), note: "" });

// ?type=Income or ?type=Expense, as sent by the quick-add sheet.
const typeFrom = (params) => (params.get("type") === "Income" ? "Income" : "Expense");

export default function LogEntryScreen({ addTx }) {
  const [params] = useSearchParams();
  const [form, setForm] = useState(() => blank(typeFrom(params)));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // Optional proof: a photo/PDF or a link. Sent for review after the entry saves.
  const [withReceipt, setWithReceipt] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [pickerKey, setPickerKey] = useState(0);

  // Picking the other type from quick add while already on this screen.
  useEffect(() => {
    const type = typeFrom(params);
    setForm((f) => (f.type === type ? f : { ...f, type, category: fitCategory(type, f.category) }));
  }, [params]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const problem = entryProblem(form);
    if (problem) { setErr(problem); return; }
    if (withReceipt && !receipt) { setErr("Choose the receipt file or paste its link — or untick “Attach a receipt”."); return; }
    setErr("");
    // The button stays disabled until the server answers, so a slow connection
    // cannot turn one entry into two, and the form is only cleared once the
    // entry is actually saved — a failed request keeps what was typed.
    setBusy(true);
    const ok = await addTx({ ...form, amount: Number(form.amount) }, withReceipt ? receipt : null);
    setBusy(false);
    if (ok) {
      setForm(blank(form.type));
      setReceipt(null);
      setWithReceipt(false);
      setPickerKey((k) => k + 1);
    }
  }
  return (
    <div>
      <div className="pagehead"><div><h2>Log Income / Expense</h2><div className="desc">Recorded right away — it counts toward your balance, budgets and reports as soon as you save it.</div></div></div>
      <div className="card" style={{ maxWidth: 520 }}>
        <form onSubmit={submit}>
          <EntryFields value={form} onChange={(v) => { setForm(v); setErr(""); }} />
          <label className="check-row">
            <input type="checkbox" checked={withReceipt} onChange={(e) => { setWithReceipt(e.target.checked); setErr(""); }} />
            Attach a receipt <span className="hint" style={{ margin: 0 }}>(optional — an Admin checks it)</span>
          </label>
          {withReceipt && <ReceiptPicker key={pickerKey} value={receipt} onChange={(v) => { setReceipt(v); setErr(""); }} idPrefix="log-receipt" />}
          {err && <div className="form-msg error">{err}</div>}
          <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Save Entry"}</button>
        </form>
      </div>
    </div>
  );
}
