import { thisMonthISO } from "../lib/utils.js";
import { shiftMonth, monthYearLabel } from "../lib/budgets.js";

// ‹ October 2026 › — steps back through earlier months; never past the
// current one, since nothing has been spent in the future yet.
export default function MonthPicker({ month, onChange }) {
  const current = thisMonthISO();
  return (
    <div className="month-picker" role="group" aria-label="Month">
      <button type="button" className="month-step" aria-label="Previous month" onClick={() => onChange(shiftMonth(month, -1))}>‹</button>
      <span className="month-picker-label" aria-live="polite">{monthYearLabel(month)}</span>
      <button type="button" className="month-step" aria-label="Next month" disabled={month >= current} onClick={() => onChange(shiftMonth(month, 1))}>›</button>
      {month !== current && <button type="button" className="linkbtn" onClick={() => onChange(current)}>Back to this month</button>}
    </div>
  );
}
