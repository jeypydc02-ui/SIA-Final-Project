import { categoriesFor, fitCategory } from "../lib/categories.js";
import { todayISO } from "../lib/utils.js";

// The fields of an income/expense entry, shared by Log Entry, Edit and
// Resubmit so the same rules apply everywhere: the category list follows the
// type, and the date cannot be in the future.
export default function EntryFields({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <>
      <div className="form-grid">
        <div className="form-row"><label className="field">Type</label>
          <select value={value.type} onChange={(e) => set({ type: e.target.value, category: fitCategory(e.target.value, value.category) })}>
            <option>Expense</option><option>Income</option>
          </select>
        </div>
        <div className="form-row"><label className="field">Category</label>
          <select value={value.category} onChange={(e) => set({ category: e.target.value })}>
            {categoriesFor(value.type).map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="form-grid">
        <div className="form-row"><label className="field">Amount (₱)</label><input type="number" min="0.01" step="0.01" max="1000000000000" value={value.amount} onChange={(e) => set({ amount: e.target.value })} required /></div>
        <div className="form-row"><label className="field">Date</label><input type="date" max={todayISO()} value={value.date} onChange={(e) => set({ date: e.target.value })} required /></div>
      </div>
      <div className="form-row"><label className="field">Note</label><input value={value.note || ""} maxLength={300} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. Groceries at SM" /></div>
    </>
  );
}

// Client-side check matching the server's rules, so the person sees the
// problem before anything is sent.
export function entryProblem(v) {
  if (!(Number(v.amount) > 0)) return "Enter an amount greater than zero.";
  if (!v.date) return "Choose a date.";
  if (v.date > todayISO()) return "The date cannot be in the future.";
  if (!categoriesFor(v.type).includes(v.category)) return "Choose a category for this type.";
  return null;
}
