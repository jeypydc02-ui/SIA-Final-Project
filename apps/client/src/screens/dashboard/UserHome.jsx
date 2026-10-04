import { useState } from "react";
import { peso, fmtDate, billStatus, thisMonthISO, todayISO } from "../../lib/utils.js";
import Icon from "../../components/Icon.jsx";
import CategoryIcon from "../../components/CategoryIcon.jsx";
import DonutChart from "../../components/DonutChart.jsx";

// The personal wallet: what a User sees first, and what staff open under
// "My Wallet". Laid out like the finance apps people already know — balance
// card and quick actions (GCash), spending ring (Monefy), money left per budget
// (YNAB) — with lists instead of tables so it reads well on a phone.

function readHidden() {
  try { return localStorage.getItem("fts_hide_balance") === "1"; } catch (e) { return false; }
}

const daysUntil = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  const [ty, tm, td] = todayISO().split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
};

function dueText(bill) {
  const n = daysUntil(bill.due);
  if (n < 0) return `Overdue by ${-n} day${n === -1 ? "" : "s"}`;
  if (n === 0) return "Due today";
  if (n === 1) return "Due tomorrow";
  return `Due in ${n} days · ${fmtDate(bill.due)}`;
}

export default function UserHome({ bills, tx, budgets, onNavigate }) {
  const [hidden, setHidden] = useState(readHidden);
  const toggleHidden = () => {
    setHidden((h) => {
      try { localStorage.setItem("fts_hide_balance", h ? "0" : "1"); } catch (e) { /* private mode */ }
      return !h;
    });
  };
  const money = (n) => (hidden ? "₱ ••••••" : peso(n));

  const approved = tx.filter((t) => t.status === "Approved");
  const sum = (list, type) => list.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
  const balance = sum(approved, "Income") - sum(approved, "Expense");
  const month = thisMonthISO();
  const monthApproved = approved.filter((t) => String(t.date).startsWith(month));
  const monthIncome = sum(monthApproved, "Income");
  const monthExpense = sum(monthApproved, "Expense");
  const pendingCount = tx.filter((t) => t.status === "Pending Review").length;

  const unpaid = bills.filter((b) => !b.paid).sort((a, b) => a.due.localeCompare(b.due));
  const overdue = unpaid.filter((b) => billStatus(b.due, false) === "Overdue").length;

  const byCategory = {};
  monthApproved.filter((t) => t.type === "Expense").forEach((t) => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });
  const slices = Object.entries(byCategory).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  const recent = tx.slice(0, 6);
  const monthName = new Date().toLocaleDateString("en-PH", { month: "long", timeZone: "Asia/Manila" });

  const QUICK = [
    { label: "Expense", icon: "minus", to: "/submit?type=Expense" },
    { label: "Income", icon: "plus", to: "/submit?type=Income" },
    { label: "Pay Bills", icon: "receipt", to: "/bills" },
    { label: "Budgets", icon: "pie", to: "/budgets" },
  ];

  return (
    <div className="home">
      <div className="home-top">
        <section className="hero">
          <div className="hero-head">
            <span>Available Balance</span>
            <button type="button" className="hero-eye" onClick={toggleHidden} aria-label={hidden ? "Show balance" : "Hide balance"}>
              <Icon name={hidden ? "eyeOff" : "eye"} size={18} />
            </button>
          </div>
          <div className="hero-amount">{money(balance)}</div>
          <div className="hero-sub">{pendingCount ? `${pendingCount} entr${pendingCount === 1 ? "y" : "ies"} waiting for review` : "All entries reviewed"}</div>
          <div className="hero-month">
            <div className="hero-month-income"><span>Income · {monthName}</span><strong className="amt">{money(monthIncome)}</strong></div>
            <div className="hero-month-expense"><span>Spent · {monthName}</span><strong className="amt">{money(monthExpense)}</strong></div>
          </div>
        </section>

        <section className="panel quick">
          {QUICK.map((q) => (
            <button key={q.label} type="button" className="quick-btn" onClick={() => onNavigate(q.to)}>
              <span className="quick-circle"><Icon name={q.icon} size={22} /></span>
              <span className="quick-label">{q.label}</span>
            </button>
          ))}
        </section>
      </div>

      <div className="home-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Upcoming bills {overdue > 0 && <span className="chip danger">{overdue} overdue</span>}</h3>
            <button className="linkbtn" onClick={() => onNavigate("/bills")}>See all</button>
          </div>
          {unpaid.slice(0, 5).map((b) => {
            const late = daysUntil(b.due) < 0;
            return (
              <button key={b._id} type="button" className="row" onClick={() => onNavigate("/bills")}>
                <CategoryIcon category={b.category} />
                <span className="row-main">
                  <span className="row-title">{b.name}{b.repeat === "monthly" && <span className="chip neutral">Monthly</span>}</span>
                  <span className={"row-sub" + (late ? " danger" : "")}>{dueText(b)}</span>
                </span>
                <span className="row-amount">{money(b.amount)}</span>
              </button>
            );
          })}
          {unpaid.length === 0 && <div className="empty small">No bills due. You're all caught up.</div>}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Spending in {monthName}</h3>
            <button className="linkbtn" onClick={() => onNavigate("/reports")}>Reports</button>
          </div>
          <div className="spend">
            <DonutChart slices={slices} centerTop={hidden ? "••••" : peso(monthExpense)} centerBottom="spent" />
            <div className="spend-legend">
              {slices.slice(0, 6).map((s) => (
                <div key={s.label} className="legend-row">
                  <CategoryIcon category={s.label} size={26} />
                  <span className="legend-name">{s.label}</span>
                  <span className="legend-pct">{Math.round((s.value / monthExpense) * 100)}%</span>
                </div>
              ))}
              {slices.length === 0 && <div className="empty small">No approved spending yet this month.</div>}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Budgets</h3>
            <button className="linkbtn" onClick={() => onNavigate("/budgets")}>Manage</button>
          </div>
          {budgets.map((b) => {
            const spent = byCategory[b.category] || 0;
            const left = b.limit - spent;
            const pct = b.limit > 0 ? Math.min(100, Math.round((spent / b.limit) * 100)) : 0;
            return (
              <div key={b._id} className="budget-row">
                <CategoryIcon category={b.category} size={32} />
                <div className="budget-main">
                  <div className="budget-top">
                    <span className="row-title">{b.category}</span>
                    <span className={left < 0 ? "budget-left danger" : "budget-left"}>
                      {left < 0 ? `Over by ${money(-left)}` : `${money(left)} left`}
                    </span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: pct + "%", background: pct >= 100 ? "var(--danger)" : pct >= 80 ? "var(--warn)" : "var(--ok)" }} />
                  </div>
                  <div className="row-sub">{money(spent)} of {money(b.limit)}</div>
                </div>
              </div>
            );
          })}
          {budgets.length === 0 && (
            <div className="empty small">
              No budgets yet. <button className="linkbtn" onClick={() => onNavigate("/budgets")}>Set your first budget</button>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Recent activity</h3>
            <button className="linkbtn" onClick={() => onNavigate("/review")}>All entries</button>
          </div>
          {recent.map((t) => (
            <div key={t._id} className="row static">
              <CategoryIcon category={t.category} />
              <span className="row-main">
                <span className="row-title">{t.note || t.category}</span>
                <span className="row-sub">{fmtDate(t.date)} · <span className={"status-" + t.status.replace(/\s/g, "-").toLowerCase()}>{t.status}</span></span>
              </span>
              <span className={"row-amount " + (t.status !== "Approved" ? "muted" : t.type === "Income" ? "pos" : "neg")} title={t.status !== "Approved" ? "Not counted in your balance" : undefined}>
                {hidden ? "••••" : (t.type === "Income" ? "+" : "−") + peso(t.amount)}
              </span>
            </div>
          ))}
          {recent.length === 0 && <div className="empty small">Nothing logged yet. Tap + to add your first entry.</div>}
        </section>
      </div>
    </div>
  );
}
