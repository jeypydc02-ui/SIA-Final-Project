import { useState } from "react";
import Icon from "../components/Icon.jsx";
import { notifTime, notifDay } from "../lib/notifications.js";

// My Activity: what this person did in FinTrack Stark — entries recorded,
// bills added, edited or paid, budgets, profile and password changes — newest
// first, laid out like the Notification Log. Only their own lines; the
// Admin's log never shows them.
const KINDS = [
  { test: /^Failed/, icon: "alert", tone: "danger", group: "account" },
  { test: /^Income Recorded/, icon: "plus", tone: "ok", group: "money" },
  { test: /^Expense Recorded/, icon: "wallet", group: "money" },
  { test: /^Transaction/, icon: "edit", group: "money" },
  { test: /^Payment/, icon: "card", tone: "ok", group: "bills" },
  { test: /^Bill/, icon: "receipt", group: "bills" },
  { test: /^Budget/, icon: "pie", group: "money" },
  { test: /^Password|^Profile/, icon: "shield", group: "account" },
];
const kindOf = (action) => KINDS.find((k) => k.test.test(action)) || { icon: "history", group: "account" };

const FILTERS = [["all", "All"], ["money", "Entries & budgets"], ["bills", "Bills & payments"], ["account", "Account"]];

export default function ActivityScreen({ activity = [] }) {
  const [filter, setFilter] = useState("all");
  const count = (key) => activity.filter((l) => key === "all" || kindOf(l.action).group === key).length;
  const rows = activity.filter((l) => filter === "all" || kindOf(l.action).group === filter);

  const groups = [];
  for (const l of rows) {
    const day = notifDay(l.ts);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(l);
    else groups.push({ day, items: [l] });
  }

  return (
    <div>
      <div className="pagehead">
        <div>
          <h2>My Activity</h2>
          <div className="desc">Everything you did in FinTrack Stark: entries, bills, payments, budgets, and changes to your profile or password. Only you can see this.</div>
        </div>
      </div>

      <div className="tabrow" style={{ marginBottom: 14 }}>
        {FILTERS.map(([key, label]) => (
          <button key={key} type="button" className={"tab" + (filter === key ? " active" : "")} onClick={() => setFilter(key)}>
            {label}<span className="tab-count">{count(key)}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card"><div className="empty">{activity.length ? "Nothing of this kind yet." : "Nothing yet. What you record or change will be listed here."}</div></div>
      ) : groups.map((g) => (
        <section key={g.day} className="inbox-group">
          <h3 className="inbox-day">{g.day}</h3>
          <div className="inbox">
            {g.items.map((l) => {
              const kind = kindOf(l.action);
              const failed = l.status === "Failed";
              return (
                <div key={l._id} className="inbox-item static">
                  <span className={"inbox-icon" + (kind.tone ? " " + kind.tone : "")}><Icon name={kind.icon} size={20} /></span>
                  <span className="inbox-body">
                    <span className="inbox-top">
                      <span className="inbox-title">{failed ? "Not saved" : l.action}</span>
                      <span className="inbox-time">{notifTime(l.ts)}</span>
                    </span>
                    <span className="inbox-text">{l.detail}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
