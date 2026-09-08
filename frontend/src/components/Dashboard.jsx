import { peso, fmtDate, billStatus, statusBadgeClass } from "../utils.js";

export default function Dashboard({ bills, tx, budgets, notifs }) {
  const approved = tx.filter(t => t.status === "Approved");
  const pendingCount = tx.filter(t => t.status === "Pending Review").length;
  const income = approved.filter(t => t.type === "Income").reduce((s, t) => s + t.amount, 0);
  const expense = approved.filter(t => t.type === "Expense").reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  const upcoming = bills.filter(b => !b.paid);
  const overdueCount = upcoming.filter(b => billStatus(b.due, b.paid) === "Overdue").length;
  const dueSoonCount = upcoming.filter(b => { const s = billStatus(b.due, b.paid); return s === "Due Today" || s === "Upcoming"; }).length;

  return (
    <div>
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="card stat">
          <h3>Balance</h3>
          <div className="value">{peso(balance)}</div>
          <div className="label">Approved income minus expenses</div>
          <div className="delta up">{approved.length} approved · {pendingCount} pending review</div>
        </div>
        <div className="card stat">
          <h3>Total Income</h3>
          <div className="value">{peso(income)}</div>
          <div className="label">Approved, this period</div>
        </div>
        <div className="card stat">
          <h3>Total Expenses</h3>
          <div className="value">{peso(expense)}</div>
          <div className="label">Approved, this period</div>
        </div>
        <div className="card stat">
          <h3>Bills Pending</h3>
          <div className="value" style={{ color: overdueCount ? "var(--danger)" : "var(--text)" }}>{upcoming.length}</div>
          <div className="label">{overdueCount} overdue · {dueSoonCount} upcoming</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Upcoming &amp; Overdue Bills</h3>
          <table>
            <thead><tr><th>Bill</th><th>Category</th><th>Due</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {upcoming.slice(0, 6).map(b => {
                const s = billStatus(b.due, b.paid);
                return (
                  <tr key={b._id}>
                    <td>{b.name}</td><td>{b.category}</td><td>{fmtDate(b.due)}</td><td>{peso(b.amount)}</td>
                    <td><span className={"badge " + statusBadgeClass(s)}>{s}</span></td>
                  </tr>
                );
              })}
              {upcoming.length === 0 && <tr><td colSpan="5"><div className="empty">All bills settled. Nothing pending.</div></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Recent Notifications</h3>
          {notifs.slice(0, 5).map(n => (
            <div key={n._id} className="log-line"><span className="tag">[{n.type}]</span>{n.message}</div>
          ))}
          {notifs.length === 0 && <div className="empty">No notifications yet.</div>}
        </div>
      </div>

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        {budgets.map(b => {
          const spent = approved.filter(t => t.type === "Expense" && t.category === b.category).reduce((s, t) => s + t.amount, 0);
          const pct = Math.min(100, Math.round(spent / b.limit * 100));
          return (
            <div className="card" key={b.category}>
              <h3>{b.category} Budget</h3>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
                <span>{peso(spent)}</span><span style={{ color: "var(--text-dim)" }}>of {peso(b.limit)}</span>
              </div>
              <div className="progress-track"><div className="progress-fill" style={{ width: pct + "%", background: pct >= 100 ? "var(--danger)" : pct >= 75 ? "var(--warn)" : "var(--primary)" }}></div></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
