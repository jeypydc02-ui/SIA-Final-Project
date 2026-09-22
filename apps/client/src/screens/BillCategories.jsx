import { peso, fmtDate, billStatus, statusBadgeClass } from "../lib/utils.js";

const CATEGORY_DESC = {
  Utilities: "Electricity, water, and related recurring bills.",
  Housing: "Rent, association dues, and property-related bills.",
  Internet: "Broadband and connectivity subscriptions.",
  Credit: "Credit card and loan obligations.",
  Subscription: "Streaming and recurring service subscriptions.",
};

export function ProjectList({ bills }) {
  const counts = {};
  bills.forEach(b => { counts[b.category] = (counts[b.category] || 0) + 1; });
  const cats = Object.keys(counts).length ? Object.keys(counts) : Object.keys(CATEGORY_DESC);
  return (
    <div>
      <div className="pagehead"><div><h2>Bill Categories</h2><div className="desc">Groupings used to organize bills, budgets, and reports.</div></div></div>
      <div className="grid grid-3">
        {cats.map(name => {
          const count = counts[name] || 0;
          return (
            <div className="card" key={name}>
              <h3>{name}</h3>
              <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "0 0 12px" }}>{CATEGORY_DESC[name] || "Bills grouped under this category."}</p>
              <span className="badge neutral">{count} bill{count === 1 ? "" : "s"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProjectDetails({ bills }) {
  const rows = bills.filter(b => b.category === "Utilities");
  return (
    <div>
      <div className="pagehead"><div><h2>Category Detail — Utilities</h2><div className="desc">All bills, statuses, and totals within this category.</div></div></div>
      <div className="card">
        <table>
          <thead><tr><th>Bill</th><th>Due Date</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map(b => {
              const s = billStatus(b.due, b.paid);
              return <tr key={b._id}><td>{b.name}</td><td>{fmtDate(b.due)}</td><td>{peso(b.amount)}</td><td><span className={"badge " + statusBadgeClass(s)}>{s}</span></td></tr>;
            })}
            {rows.length === 0 && <tr><td colSpan="4"><div className="empty">No bills in this category yet.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
