import { peso, thisMonthISO } from "../lib/utils.js";

export default function ReportsScreen({ tx, bills, budgets }) {
  const approved = tx.filter(t => t.status === "Approved");
  const byCat = {};
  approved.filter(t => t.type === "Expense").forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
  const max = Math.max(1, ...Object.values(byCat));
  // Budget vs. Actual compares a monthly limit, so it uses this month only,
  // the same figure the Budgets screen shows.
  const month = thisMonthISO();
  const monthByCat = {};
  approved.filter(t => t.type === "Expense" && String(t.date).startsWith(month))
    .forEach(t => { monthByCat[t.category] = (monthByCat[t.category] || 0) + t.amount; });
  // paidAmount defaults to null on the model, so coerce before summing —
  // one legacy row without it would otherwise turn the whole total into NaN.
  const totalPaid = bills.filter(b => b.paid).reduce((s, b) => s + (Number(b.paidAmount) || 0), 0);
  const totalPending = bills.filter(b => !b.paid).reduce((s, b) => s + b.amount, 0);

  return (
    <div>
      <div className="pagehead"><div><h2>Reports</h2><div className="desc">Summarized spending and bill-payment performance (approved entries only).</div></div></div>
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
          {Object.keys(byCat).length === 0 && <div className="empty">No approved expenses yet.</div>}
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
        <h3>Budget vs. Actual <span style={{ fontWeight: 400, color: "var(--text-dim)" }}>· this month</span></h3>
        <table>
          <thead><tr><th>Category</th><th>Monthly Limit</th><th>Spent This Month</th><th>Variance</th><th>Status</th></tr></thead>
          <tbody>
            {budgets.map(b => {
              const spent = monthByCat[b.category] || 0;
              const variance = b.limit - spent;
              const over = variance < 0;
              return (
                <tr key={b._id}>
                  <td>{b.category}</td><td>{peso(b.limit)}</td><td>{peso(spent)}</td>
                  <td style={{ color: over ? "var(--danger)" : "var(--ok)" }}>{over ? "-" : "+"}{peso(Math.abs(variance))}</td>
                  <td><span className={"badge " + (over ? "danger" : "ok")}>{over ? "Over Budget" : "Within Budget"}</span></td>
                </tr>
              );
            })}
            {budgets.length === 0 && <tr><td colSpan="5"><div className="empty">No budgets set yet.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
