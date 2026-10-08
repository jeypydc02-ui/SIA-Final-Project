import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { todayISO } from "../lib/utils.js";
import { categoriesFor, fitCategory } from "../lib/categories.js";
import EntryFields, { entryProblem } from "../components/EntryFields.jsx";

const blank = (type = "Expense") => ({ type, category: categoriesFor(type)[0], amount: "", date: todayISO(), note: "" });

// ?type=Income or ?type=Expense, as sent by the quick-add sheet.
const typeFrom = (params) => (params.get("type") === "Income" ? "Income" : "Expense");

export default function LogEntryScreen({ addTx }) {
  const [params] = useSearchParams();
  const [form, setForm] = useState(() => blank(typeFrom(params)));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

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
    setErr("");
    // The button stays disabled until the server answers, so a slow connection
    // cannot turn one entry into two, and the form is only cleared once the
    // entry is actually saved — a failed request keeps what was typed.
    setBusy(true);
    const ok = await addTx({ ...form, amount: Number(form.amount) });
    setBusy(false);
    if (ok) setForm(blank(form.type));
  }
  return (
    <div>
      <div className="pagehead"><div><h2>Log Income / Expense</h2><div className="desc">Recorded right away — it counts toward your balance, budgets and reports as soon as you save it.</div></div></div>
      <div className="card" style={{ maxWidth: 520 }}>
        <form onSubmit={submit}>
          <EntryFields value={form} onChange={(v) => { setForm(v); setErr(""); }} />
          {err && <div className="form-msg error">{err}</div>}
          <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Save Entry"}</button>
        </form>
      </div>
    </div>
  );
}
