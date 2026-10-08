import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { todayISO, phDateOf, initials } from "../../lib/utils.js";
import Icon from "../../components/Icon.jsx";

// An administrator runs the system, so their dashboard is a console: is it
// up, who is using it, who signed up or signed in, is anyone trying
// passwords. The Admin keeps no wallet, and the log they see holds security
// and system events only — what Users do with their own money stays private
// to them (My Activity).

// A MongoDB id starts with its creation time in seconds, so account age needs
// no extra field.
const createdAt = (id) => new Date(parseInt(String(id).slice(0, 8), 16) * 1000);

const ACTION_ICON = (action) =>
  /Failed/.test(action) ? "alert"
  : /Login|Logout/.test(action) ? "users"
  : /Password/.test(action) ? "shield"
  : /Role|Account/.test(action) ? "users"
  : /Settings/.test(action) ? "server"
  : "edit";

function timeOf(ts) {
  return new Date(ts).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
}

export default function AdminConsole({ users, auditLog, onNavigate }) {
  const [health, setHealth] = useState(null);
  useEffect(() => {
    let live = true;
    api("/api/health").then((h) => live && setHealth(h)).catch(() => live && setHealth({ status: "down" }));
    return () => { live = false; };
  }, []);

  const deactivated = users.filter((u) => u.active === false).length;
  const roles = ["Admin", "User"].map((r) => ({ role: r, n: users.filter((u) => u.role === r).length }));
  const weekAgo = Date.now() - 7 * 86400000;
  const newThisWeek = users.filter((u) => createdAt(u._id).getTime() >= weekAgo).length;
  const newest = [...users].sort((a, b) => createdAt(b._id) - createdAt(a._id)).slice(0, 5);

  const today = todayISO();
  const todays = auditLog.filter((l) => phDateOf(l.ts) === today);

  // Security and system events over the last seven days, by kind.
  const week = auditLog.filter((l) => new Date(l.ts).getTime() >= weekAgo);
  const activity = [
    { label: "Sign-ins", n: week.filter((l) => l.action === "Login").length, tone: "neutral" },
    { label: "New accounts", n: week.filter((l) => l.action === "Account Created").length, tone: "ok" },
    { label: "Password resets", n: week.filter((l) => /^Password (Reset|Changed)/.test(l.action)).length, tone: "warn" },
    { label: "Account changes", n: week.filter((l) => /^Role Changed|^Account (Deactivated|Reactivated|Deleted)/.test(l.action)).length, tone: "neutral" },
    { label: "Failed / refused", n: week.filter((l) => l.status === "Failed").length, tone: "danger" },
  ];
  const activityMax = Math.max(1, ...activity.map((p) => p.n));
  const failed = auditLog.filter((l) => l.action === "Failed Login");
  const failedToday = failed.filter((l) => phDateOf(l.ts) === today).length;

  const up = health && health.status === "ok";
  const dbUp = health && health.db === "connected";

  const ACTIONS = [
    { label: "Manage users", hint: "Roles, deactivation, deletion", icon: "users", to: "/users" },
    { label: "System settings", hint: "Reminders, budgets, sessions", icon: "server", to: "/system" },
    { label: "Audit log", hint: "Sign-ins and account changes", icon: "history", to: "/audit" },
  ];

  return (
    <div className="console">
      <section className="console-status">
        <div className="console-title">
          <Icon name="server" size={20} />
          <div>
            <div className="console-name">Admin Console</div>
            <div className="console-sub">FinTrack Stark system overview</div>
          </div>
        </div>
        <div className="status-lights">
          <span className={"light " + (health ? (up ? "on" : "off") : "wait")}>API {health ? (up ? "online" : "unreachable") : "checking…"}</span>
          <span className={"light " + (health ? (dbUp ? "on" : "off") : "wait")}>Database {health ? (dbUp ? "connected" : "disconnected") : "checking…"}</span>
        </div>
      </section>

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">Accounts</div>
          <div className="kpi-value">{users.length}</div>
          <div className="kpi-foot">{newThisWeek} new this week</div>
        </div>
        <button type="button" className="kpi kpi-link" onClick={() => onNavigate("/users")}>
          <div className="kpi-label">Deactivated</div>
          <div className="kpi-value">{deactivated}</div>
          <div className="kpi-foot">{deactivated ? "accounts that cannot sign in" : "Every account is active"}</div>
        </button>
        <div className="kpi">
          <div className="kpi-label">Activity today</div>
          <div className="kpi-value">{todays.length}</div>
          <div className="kpi-foot">security & system events</div>
        </div>
        <div className={"kpi" + (failedToday >= 5 ? " alarm" : "")}>
          <div className="kpi-label">Failed logins today</div>
          <div className="kpi-value">{failedToday}</div>
          <div className="kpi-foot">{failedToday >= 5 ? "Check the audit log" : "Nothing unusual"}</div>
        </div>
      </div>

      <div className="console-grid">
        <section className="panel">
          <div className="panel-head"><h3>Users by role</h3><button className="linkbtn" onClick={() => onNavigate("/users")}>Manage</button></div>
          <div className="stacked" role="img" aria-label={roles.map((r) => `${r.n} ${r.role}`).join(", ")}>
            {roles.map((r) => r.n > 0 && <span key={r.role} className={"seg seg-" + r.role.toLowerCase()} style={{ flex: r.n }} />)}
          </div>
          <div className="legend-inline">
            {roles.map((r) => <span key={r.role}><i className={"dot seg-" + r.role.toLowerCase()} />{r.role} <strong>{r.n}</strong></span>)}
          </div>
          <div className="mini-title">Newest accounts</div>
          {newest.map((u) => (
            <div key={u._id} className="row static">
              <span className="avatar small">{initials(u.name)}</span>
              <span className="row-main"><span className="row-title">{u.name}</span><span className="row-sub">{u.email}</span></span>
              <span className={"chip " + (u.active === false ? "danger" : "neutral")}>{u.active === false ? "Deactivated" : u.role}</span>
            </div>
          ))}
        </section>

        <section className="panel">
          <div className="panel-head"><h3>Security events this week</h3><button className="linkbtn" onClick={() => onNavigate("/audit")}>Audit log</button></div>
          {activity.map((p) => (
            <div key={p.label} className="bar-row">
              <span className="bar-label">{p.label}</span>
              <span className="bar-track"><span className={"bar-fill tone-bar-" + p.tone} style={{ width: (p.n / activityMax) * 100 + "%" }} /></span>
              <span className="bar-n">{p.n}</span>
            </div>
          ))}
          <div className="mini-title">Shortcuts</div>
          <div className="admin-actions">
            {ACTIONS.map((a) => (
              <button key={a.label} type="button" className="admin-action" onClick={() => onNavigate(a.to)}>
                <span className="quick-circle small"><Icon name={a.icon} size={18} /></span>
                <span><span className="row-title">{a.label}</span><span className="row-sub">{a.hint}</span></span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h3>Security</h3><button className="linkbtn" onClick={() => onNavigate("/audit")}>Audit log</button></div>
          {failed.slice(0, 5).map((l) => (
            <div key={l._id} className="row static">
              <span className="feed-ico danger"><Icon name="alert" size={16} /></span>
              <span className="row-main"><span className="row-title">Failed login · {l.user}</span><span className="row-sub">{timeOf(l.ts)}</span></span>
            </div>
          ))}
          {failed.length === 0 && <div className="empty small">No failed logins recorded.</div>}
        </section>

        <section className="panel">
          <div className="panel-head"><h3>Recent events</h3><button className="linkbtn" onClick={() => onNavigate("/audit")}>See all</button></div>
          {auditLog.slice(0, 8).map((l) => (
            <div key={l._id} className="row static">
              <span className="feed-ico"><Icon name={ACTION_ICON(l.action)} size={16} /></span>
              <span className="row-main"><span className="row-title">{l.user} · {l.action}</span><span className="row-sub">{timeOf(l.ts)}</span></span>
            </div>
          ))}
          {auditLog.length === 0 && <div className="empty small">No events yet.</div>}
        </section>
      </div>
    </div>
  );
}
