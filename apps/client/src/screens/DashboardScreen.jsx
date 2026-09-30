import { peso, fmtDate, billStatus, statusBadgeClass, thisMonthISO, todayISO, phDateOf } from "../lib/utils.js";

// One dashboard, three audiences. Everyone gets their own money ("My
// Finances"); Reviewers and Admins first see the work that is waiting for
// them, because that is why they open the app. Showing staff the same
// personal-finance screen as a User made the roles look identical.
export default function DashboardScreen({ session, bills, tx, budgets, notifs, queue = [], users = [], auditLog = [], onNavigate }) {
  const firstName = (session.name || "").split(" ")[0];
  const staff = session.role === "Admin" || session.role === "Reviewer";

  return (
    <div>
      <div className="pagehead">
        <div>
          <h2>Hi, {firstName}</h2>
          <div className="desc">
            {session.role === "Admin" && "Here is what is happening across FinTrack Stark, followed by your own finances."}
            {session.role === "Reviewer" && "Entries waiting for your review come first, followed by your own finances."}
            {session.role === "User" && "Your balance, bills and budgets at a glance."}
          </div>
        </div>
      </div>

      {session.role === "Admin" && <AdminOverview session={session} queue={queue} users={users} auditLog={auditLog} onNavigate={onNavigate} />}
      {session.role === "Reviewer" && <ReviewerOverview session={session} queue={queue} onNavigate={onNavigate} />}

      {staff && <div className="section-title">My Finances</div>}
      <PersonalFinances bills={bills} tx={tx} budgets={budgets} notifs={notifs} onNavigate={onNavigate} />
    </div>
  );
}

function waitingFor(queue, session) {
  return queue.filter((t) => t.status === "Pending Review" && String(t.submittedBy) !== String(session.id));
}

function daysSince(value) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
}

function oldestLabel(pending) {
  if (!pending.length) return "Nothing waiting";
  const oldest = pending.reduce((a, b) => (new Date(a.createdAt) < new Date(b.createdAt) ? a : b));
  const d = daysSince(oldest.createdAt);
  return d === 0 ? "Oldest submitted today" : `Oldest waiting ${d} day${d === 1 ? "" : "s"}`;
}

function AdminOverview({ session, queue, users, auditLog, onNavigate }) {
  const pending = waitingFor(queue, session);
  const count = (role) => users.filter((u) => u.role === role).length;
  const today = todayISO();
  const todays = auditLog.filter((l) => phDateOf(l.ts) === today);
  const failedLogins = todays.filter((l) => l.action === "Failed Login").length;

  return (
    <>
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="card stat">
          <h3>Accounts</h3>
          <div className="value">{users.length}</div>
          <div className="label">{count("Admin")} Admin · {count("Reviewer")} Reviewer · {count("User")} User</div>
        </div>
        <div className="card stat">
          <h3>Awaiting Review</h3>
          <div className="value" style={{ color: pending.length ? "var(--warn)" : "var(--text)" }}>{pending.length}</div>
          <div className="label">{oldestLabel(pending)}</div>
        </div>
        <div className="card stat">
          <h3>Activity Today</h3>
          <div className="value">{todays.length}</div>
          <div className="label">actions in the audit log</div>
        </div>
        <div className="card stat">
          <h3>Failed Logins Today</h3>
          <div className="value" style={{ color: failedLogins >= 5 ? "var(--danger)" : "var(--text)" }}>{failedLogins}</div>
          <div className="label">{failedLogins >= 5 ? "Worth checking the audit log" : "Nothing unusual"}</div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 8 }}>
        <PendingList pending={pending} onNavigate={onNavigate} />
        <div className="card">
          <div className="card-head">
            <h3>Recent Activity</h3>
            <button className="linkbtn" onClick={() => onNavigate("/audit")}>Audit log →</button>
          </div>
          {auditLog.slice(0, 6).map((l) => (
            <div key={l._id} className="activity-row">
              <div><strong>{l.user}</strong> · {l.action}</div>
              <div className="activity-time">{new Date(l.ts).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
            </div>
          ))}
          {auditLog.length === 0 && <div className="empty">No activity yet.</div>}
          <div style={{ marginTop: 12 }}>
            <button className="btn small ghost" onClick={() => onNavigate("/users")}>Manage users</button>
          </div>
        </div>
      </div>
    </>
  );
}

function ReviewerOverview({ session, queue, onNavigate }) {
  const pending = waitingFor(queue, session);
  const decidedByMe = queue.filter((t) => String(t.reviewedBy) === String(session.id) && ["Approved", "Rejected", "Needs Revision"].includes(t.status));
  const mineWaiting = queue.filter((t) => t.status === "Pending Review" && String(t.submittedBy) === String(session.id)).length;

  return (
    <>
      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card stat">
          <h3>Awaiting Your Review</h3>
          <div className="value" style={{ color: pending.length ? "var(--warn)" : "var(--text)" }}>{pending.length}</div>
          <div className="label">{oldestLabel(pending)}</div>
        </div>
        <div className="card stat">
          <h3>Reviewed by You</h3>
          <div className="value">{decidedByMe.length}</div>
          <div className="label">
            {decidedByMe.filter((t) => t.status === "Approved").length} approved · {decidedByMe.filter((t) => t.status === "Rejected").length} rejected · {decidedByMe.filter((t) => t.status === "Needs Revision").length} sent back
          </div>
        </div>
        <div className="card stat">
          <h3>Your Own Entries</h3>
          <div className="value">{mineWaiting}</div>
          <div className="label">waiting for another reviewer</div>
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <PendingList pending={pending} onNavigate={onNavigate} />
      </div>
    </>
  );
}

function PendingList({ pending, onNavigate }) {
  // Oldest first: the entry that has waited longest should be decided next.
  const rows = [...pending].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(0, 5);
  return (
    <div className="card">
      <div className="card-head">
        <h3>Waiting for Review</h3>
        <button className="linkbtn" onClick={() => onNavigate("/review")}>Open queue →</button>
      </div>
      <table>
        <thead><tr><th>Type</th><th>Category</th><th>Amount</th><th>Submitted</th></tr></thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t._id} className="row-link" onClick={() => onNavigate("/review")}>
              <td>{t.type}</td><td>{t.category}</td><td>{peso(t.amount)}</td><td>{fmtDate(t.createdAt)}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan="4"><div className="empty">All caught up — nothing to review.</div></td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function PersonalFinances({ bills, tx, budgets, notifs, onNavigate }) {
  const approved = tx.filter(t => t.status === "Approved");
  const pendingCount = tx.filter(t => t.status === "Pending Review").length;
  const income = approved.filter(t => t.type === "Income").reduce((s, t) => s + t.amount, 0);
  const expense = approved.filter(t => t.type === "Expense").reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  const upcoming = bills.filter(b => !b.paid);
  const overdueCount = upcoming.filter(b => billStatus(b.due, b.paid) === "Overdue").length;
  const dueSoonCount = upcoming.filter(b => { const s = billStatus(b.due, b.paid); return s === "Due Today" || s === "Upcoming"; }).length;
  // Budgets are monthly limits: only this month's approved expenses count.
  const month = thisMonthISO();
  const monthExpenses = approved.filter(t => t.type === "Expense" && String(t.date).startsWith(month));

  return (
    <>
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
          <div className="label">All approved income</div>
        </div>
        <div className="card stat">
          <h3>Total Expenses</h3>
          <div className="value">{peso(expense)}</div>
          <div className="label">All approved expenses</div>
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

      {budgets.length === 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Budgets</h3>
          <div className="empty">
            No budgets set yet.
            {onNavigate && <> <button className="linkbtn" onClick={() => onNavigate("/budgets")}>Add your first budget</button> to track spending against a limit.</>}
          </div>
        </div>
      )}

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        {budgets.map(b => {
          const spent = monthExpenses.filter(t => t.category === b.category).reduce((s, t) => s + t.amount, 0);
          // Guard against a zero limit so the bar never renders as Infinity.
          const pct = b.limit > 0 ? Math.min(100, Math.round(spent / b.limit * 100)) : 0;
          return (
            <div className="card" key={b.category}>
              <h3>{b.category} Budget</h3>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
                <span>{peso(spent)}</span><span style={{ color: "var(--text-dim)" }}>of {peso(b.limit)} this month</span>
              </div>
              <div className="progress-track"><div className="progress-fill" style={{ width: pct + "%", background: pct >= 100 ? "var(--danger)" : pct >= 75 ? "var(--warn)" : "var(--primary)" }}></div></div>
            </div>
          );
        })}
      </div>
    </>
  );
}
