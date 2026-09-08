import { peso, fmtDate } from "../utils.js";

export default function PaymentHistory({ bills }) {
  const paid = bills.filter(b => b.paid);
  return (
    <div>
      <div className="pagehead"><div><h2>Payment History</h2><div className="desc">All completed bill payments, most recent first.</div></div></div>
      <div className="card">
        {paid.length === 0 ? <div className="empty"><div className="big">—</div>No payments recorded yet.</div> : (
          <table>
            <thead><tr><th>Bill</th><th>Category</th><th>Paid On</th><th>Amount Paid</th><th>Ref.</th></tr></thead>
            <tbody>
              {paid.map(b => (
                <tr key={b._id}><td>{b.name}</td><td>{b.category}</td><td>{fmtDate(b.paidOn)}</td><td>{peso(b.paidAmount)}</td><td style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{b._id.slice(-8)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
