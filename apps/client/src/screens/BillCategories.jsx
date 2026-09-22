import { peso, fmtDate, billStatus, statusBadgeClass } from "../lib/utils.js";

const CATEGORY_DESC = {
  Utilities: "Electricity, water, and related recurring bills.",
  Housing: "Rent, association dues, and property-related bills.",
  Internet: "Broadband and connectivity subscriptions.",
  Credit: "Credit card and loan obligations.",
  Subscription: "Streaming and recurring service subscriptions.",
  Other: "Bills that do not fit the categories above.",
};

function categoriesFrom(bills) {
  const counts = {};
  bills.forEach((b) => { counts[b.category] = (counts[b.category] || 0) + 1; });
  // Always offer the standard set, then add any category the user invented.
  const names = [...new Set([...Object.keys(CATEGORY_DESC), ...Object.keys(counts)])];
  return names.map((name) => ({
    name,
    count: counts[name] || 0,
    total: bills.filter((b) => b.category === name).reduce((s, b) => s + b.amount, 0),
  }));
}

export function ProjectList({ bills, onOpen }) {
  const cats = categoriesFrom(bills);
  return (
    <div>
      <div className="pagehead"><div><h2>Bill Categories</h2><div className="desc">Groupings used to organize bills, budgets, and reports. Select one to see its detail.</div></div></div>
      <div className="grid grid-3">
        {cats.map((c) => (
          <button
            type="button"
            className="card card-link"
            key={c.name}
            onClick={() => onOpen(c.name)}
          >
            <h3>{c.name}</h3>
            <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "0 0 12px" }}>
              {CATEGORY_DESC[c.name] || "Bills grouped under this category."}
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="badge neutral">{c.count} bill{c.count === 1 ? "" : "s"}</span>
              {c.total > 0 && <span style={{ fontSize: 12.5, fontWeight: 600 }}>{peso(c.total)}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ProjectDetails({ bills, category, onBack, onPick }) {
  const cats = categoriesFrom(bills);
  // Falls back to the first category so the screen is never blank if it is
  // reached without a selection.
  const active = category || cats[0]?.name || "Utilities";
  const rows = bills.filter((b) => b.category === active);
  const total = rows.reduce((s, b) => s + b.amount, 0);
  const paid = rows.filter((b) => b.paid).length;

  return (
    <div>
      <div className="pagehead">
        <div>
          <h2>Category Detail — {active}</h2>
          <div className="desc">{CATEGORY_DESC[active] || "All bills, statuses, and totals within this category."}</div>
        </div>
        <button className="btn ghost" onClick={onBack}>← All Categories</button>
      </div>

      <div className="tabrow">
        {cats.map((c) => (
          <button
            type="button"
            key={c.name}
            className={"tab" + (c.name === active ? " active" : "")}
            onClick={() => onPick(c.name)}
          >
            {c.name}<span className="tab-count">{c.count}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-3" style={{ margin: "16px 0" }}>
        <div className="card stat"><h3>Bills</h3><div className="value">{rows.length}</div><div className="label">in {active}</div></div>
        <div className="card stat"><h3>Total Value</h3><div className="value">{peso(total)}</div><div className="label">across all statuses</div></div>
        <div className="card stat"><h3>Settled</h3><div className="value">{paid} / {rows.length}</div><div className="label">bills already paid</div></div>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Bill</th><th>Due Date</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((b) => {
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
