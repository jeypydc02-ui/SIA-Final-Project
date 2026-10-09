import { useState } from "react";
import { peso, fmtDate, billStatus, thisMonthISO, todayISO, txStatusLabel } from "../../lib/utils.js";
import Icon from "../../components/Icon.jsx";
import CategoryIcon, { categoryTone } from "../../components/CategoryIcon.jsx";
import DonutChart from "../../components/DonutChart.jsx";
import { shiftMonth, monthLabel, splitBudgets } from "../../lib/budgets.js";

// The personal wallet: what a User sees first, and what staff open under
// "My Wallet". The summary card follows the familiar budgeting-app pattern —
// month tabs, a spending ring with income and spending in the middle, the
// balance, and big minus/plus buttons to log money out or in — followed by the
// month's categories, bills, budgets and recent entries as lists.

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
  const current = thisMonthISO();
  const [month, setMonth] = useState(current);

  const toggleHidden = () => {
    setHidden((h) => {
      try { localStorage.setItem("fts_hide_balance", h ? "0" : "1"); } catch (e) { /* private mode */ }
      return !h;
    });
  };
  const money = (n) => (hidden ? "₱ ••••" : peso(n));

  const approved = tx.filter((t) => t.status === "Approved");
  const sum = (list, type) => list.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
  const balance = sum(approved, "Income") - sum(approved, "Expense");
  const monthApproved = approved.filter((t) => String(t.date).startsWith(month));
  const monthIncome = sum(monthApproved, "Income");
  const monthExpense = sum(monthApproved, "Expense");

  // Category totals for the chosen month: income first, then spending, largest first.
  const totals = {};
  monthApproved.forEach((t) => {
    const key = t.type + "|" + t.category;
    totals[key] = (totals[key] || 0) + t.amount;
  });
  const rows = Object.entries(totals)
    .map(([key, value]) => { const [type, category] = key.split("|"); return { type, category, value }; })
    .sort((a, b) => (a.type === b.type ? b.value - a.value : a.type === "Income" ? -1 : 1));
  const slices = rows.filter((r) => r.type === "Expense").map((r) => ({ label: r.category, value: r.value }));

  // Budgets are always about the month in progress, whatever month is shown above.
  const thisMonthSpent = {};
  approved.filter((t) => t.type === "Expense" && String(t.date).startsWith(current))
    .forEach((t) => { thisMonthSpent[t.category] = (thisMonthSpent[t.category] || 0) + t.amount; });
  const thisMonthTotal = Object.values(thisMonthSpent).reduce((s, n) => s + n, 0);
  const { overall, categories: categoryBudgets } = splitBudgets(budgets);

  const unpaid = bills.filter((b) => !b.paid).sort((a, b) => a.due.localeCompare(b.due));
  const overdue = unpaid.filter((b) => billStatus(b.due, false) === "Overdue").length;
  // Earlier versions and deleted entries are history, not activity.
  const recent = tx.filter((t) => t.status !== "Superseded" && t.status !== "Deleted").slice(0, 6);

  const QUICK = [
    { label: "Pay bills", icon: "receipt", to: "/bills" },
    { label: "Budgets", icon: "pie", to: "/budgets" },
    { label: "Reports", icon: "chart", to: "/reports" },
    { label: "Payments", icon: "card", to: "/payments" },
  ];

  return (
    <div className="home">
      <div className="home-top">
        <section className="wallet">
          <div className="wallet-bar">
            <span className="wallet-title"><Icon name="wallet" size={18} /> My Wallet</span>
            <button type="button" className="wallet-eye" onClick={toggleHidden} aria-label={hidden ? "Show amounts" : "Hide amounts"}>
              <Icon name={hidden ? "eyeOff" : "eye"} size={18} />
            </button>
          </div>

          <div className="wallet-months" aria-label="Month">
            <button type="button" onClick={() => setMonth(shiftMonth(month, -1))}>{monthLabel(shiftMonth(month, -1))}</button>
            <button type="button" className="on" aria-current="true">{monthLabel(month)}</button>
            <button type="button" disabled={month >= current} onClick={() => setMonth(shiftMonth(month, 1))}>
              {monthLabel(shiftMonth(month, 1))}
            </button>
          </div>

          <div className="wallet-ring">
            <DonutChart
              slices={slices} size={200} thickness={26}
              centerTop={hidden ? "••••" : peso(monthIncome)}
              centerBottom={hidden ? "••••" : `(${peso(monthExpense)})`}
            />
          </div>
          <div className="wallet-legend-line">
            <span className="wallet-income">Income <strong className="amt">{money(monthIncome)}</strong></span>
            <span className="wallet-expense">Spent <strong className="amt">{money(monthExpense)}</strong></span>
          </div>

          <div className="wallet-balance-pill">Balance <strong className="wallet-balance">{money(balance)}</strong></div>

          <div className="wallet-buttons">
            <button type="button" className="round-btn minus" onClick={() => onNavigate("/submit?type=Expense")} aria-label="Log an expense">
              <Icon name="minus" size={30} strokeWidth={2.4} />
            </button>
            <button type="button" className="round-btn plus" onClick={() => onNavigate("/submit?type=Income")} aria-label="Log income">
              <Icon name="plus" size={30} strokeWidth={2.4} />
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>{monthLabel(month)} by category</h3>
          </div>
          {rows.map((r) => (
            <div key={r.type + r.category} className="row static">
              <CategoryIcon category={r.category} />
              <span className="row-main">
                <span className="row-title">{r.category}</span>
                {r.type === "Expense" && monthExpense > 0 && (
                  <span className="cat-bar"><span className={"cat-bar-fill fill-" + categoryTone(r.category)} style={{ width: Math.round((r.value / monthExpense) * 100) + "%" }} /></span>
                )}
                {r.type === "Income" && <span className="row-sub">Income</span>}
              </span>
              <span className={"row-amount " + (r.type === "Income" ? "pos" : "spent")}>{money(r.value)}</span>
            </div>
          ))}
          {rows.length === 0 && <div className="empty small">No income or spending recorded in {monthLabel(month)}.</div>}
          <div className="quick-strip">
            {QUICK.map((q) => (
              <button key={q.label} type="button" className="quick-btn" onClick={() => onNavigate(q.to)}>
                <span className="quick-circle"><Icon name={q.icon} size={20} /></span>
                <span className="quick-label">{q.label}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="home-grid three">
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
            <h3>Budgets · {monthLabel(current)}</h3>
            <button className="linkbtn" onClick={() => onNavigate("/budgets")}>Manage</button>
          </div>
          {overall && (() => {
            const left = overall.limit - thisMonthTotal;
            const pct = overall.limit > 0 ? Math.min(100, Math.round((thisMonthTotal / overall.limit) * 100)) : 0;
            return (
              <div className="budget-row overall">
                <span className="quick-circle small"><Icon name="pie" size={16} /></span>
                <div className="budget-main">
                  <div className="budget-top">
                    <span className="row-title">All spending</span>
                    <span className={left < 0 ? "budget-left danger" : "budget-left"}>
                      {left < 0 ? `Over by ${money(-left)}` : `${money(left)} left`}
                    </span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: pct + "%", background: pct >= 100 ? "var(--danger)" : pct >= 80 ? "var(--warn)" : "var(--primary)" }} />
                  </div>
                  <div className="row-sub">{money(thisMonthTotal)} of {money(overall.limit)}</div>
                </div>
              </div>
            );
          })()}
          {categoryBudgets.map((b) => {
            const spent = thisMonthSpent[b.category] || 0;
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
                    <div className="progress-fill" style={{ width: pct + "%", background: pct >= 100 ? "var(--danger)" : pct >= 80 ? "var(--warn)" : "var(--primary)" }} />
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
            <h3>Recent entries</h3>
            <button className="linkbtn" onClick={() => onNavigate("/entries")}>All entries</button>
          </div>
          {recent.map((t) => (
            <div key={t._id} className="row static">
              <CategoryIcon category={t.category} />
              <span className="row-main">
                <span className="row-title">{t.note || t.category}</span>
                <span className="row-sub">{fmtDate(t.date)} · <span className={"status-" + t.status.replace(/\s/g, "-").toLowerCase()}>{txStatusLabel(t.status)}</span></span>
              </span>
              <span className={"row-amount " + (t.status !== "Approved" ? "muted" : t.type === "Income" ? "pos" : "spent")} title={t.status !== "Approved" ? "Not counted in your balance" : undefined}>
                {hidden ? "••••" : (t.type === "Income" ? "+" : "−") + peso(t.amount)}
              </span>
            </div>
          ))}
          {recent.length === 0 && <div className="empty small">Nothing logged yet. Tap − or + to add your first entry.</div>}
        </section>
      </div>
    </div>
  );
}
