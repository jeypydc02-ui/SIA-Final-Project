import { useState } from "react";
import { peso, thisMonthISO } from "../lib/utils.js";
import { splitBudgets, monthSpending, monthYearLabel } from "../lib/budgets.js";
import MonthPicker from "../components/MonthPicker.jsx";

function BudgetRow({ label, limit, spent, strong }) {
  const variance = limit - spent;
  const over = variance < 0;
  return (
    <tr className={strong ? "row-total" : ""}>
      <td>{label}</td><td>{peso(limit)}</td><td>{peso(spent)}</td>
      <td style={{ color: over ? "var(--danger)" : "var(--ok)" }}>{over ? "-" : "+"}{peso(Math.abs(variance))}</td>
      <td><span className={"badge " + (over ? "danger" : "ok")}>{over ? "Over Budget" : "Within Budget"}</span></td>
    </tr>
  );
}

export default function ReportsScreen({ tx, bills, budgets }) {
  const [month, setMonth] = useState(thisMonthISO);
  const approved = tx.filter(t => t.status === "Approved");
  const byCat = {};
  approved.filter(t => t.type === "Expense").forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
  const max = Math.max(1, ...Object.values(byCat));
  // Budget vs. Actual compares a monthly limit with one month's spending —
  // the month in progress unless an earlier one is picked, the same figures
  // the Budgets screen shows. Earlier months use the current limits.
  const spending = monthSpending(tx, month);
  const { overall, categories } = splitBudgets(budgets);
  // paidAmount defaults to null on the model, so coerce before summing —
  // one legacy row without it would otherwise turn the whole total into NaN.
  const totalPaid = bills.filter(b => b.paid).reduce((s, b) => s + (Number(b.paidAmount) || 0), 0);
  const totalPending = bills.filter(b => !b.paid).reduce((s, b) => s + b.amount, 0);

  return (
    <div>
      <div className="pagehead"><div><h2>Reports</h2><div className="desc">Summarized spending and bill-payment performance (current entries only — earlier versions and deleted entries are left out).</div></div></div>
      <div className="grid grid-2">
        <div className="card">
          <h3>Expenses by Category <span style={{ fontWeight: 400, color: "var(--text-dim)" }}>· all time</span></h3>
          {Object.entries(byCat).map(([cat, amt]) => (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
                <span>{cat}</span><span style={{ fontWeight: 600 }}>{peso(amt)}</span>
              </div>
              <div className="progress-track"><div className="progress-fill" style={{ width: (amt / max * 100) + "%" }}></div></div>
            </div>
          ))}
          {Object.keys(byCat).length === 0 && <div className="empty">No expenses recorded yet.</div>}
        </div>
        <div className="card">
          <h3>Bill Payment Summary</h3>
          <div style={{ marginBottom: 14 }}>
            <div className="stat"><div className="value" style={{ fontSize: 22 }}>{peso(totalPaid)}</div><div className="label">Total paid to date</div></div>
          </div>
          <div>
            <div className="stat"><div className="value" style={{ fontSize: 22, color: "var(--warn)" }}>{peso(totalPending)}</div><div className="label">Total pending across {bills.filter(b => !b.paid).length} bills</div></div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="panel-head" style={{ flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Budget vs. Actual <span style={{ fontWeight: 400, color: "var(--text-dim)" }}>· {monthYearLabel(month)}</span></h3>
          <MonthPicker month={month} onChange={setMonth} />
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Category</th><th>Monthly Limit</th><th>Spent</th><th>Variance</th><th>Status</th></tr></thead>
            <tbody>
              {categories.map(b => <BudgetRow key={b._id} label={b.category} limit={b.limit} spent={spending.byCategory[b.category] || 0} />)}
              {overall && <BudgetRow label="Overall (all expenses)" limit={overall.limit} spent={spending.total} strong />}
              {budgets.length === 0 && <tr><td colSpan="5"><div className="empty">No budgets set yet.</div></td></tr>}
            </tbody>
          </table>
        </div>
        {month !== thisMonthISO() && budgets.length > 0 && <div className="hint" style={{ marginTop: 8 }}>Compared with your current limits.</div>}
      </div>
    </div>
  );
}
