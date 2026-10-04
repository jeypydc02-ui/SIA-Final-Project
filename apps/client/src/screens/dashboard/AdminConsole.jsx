import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { todayISO, phDateOf, initials } from "../../lib/utils.js";
import Icon from "../../components/Icon.jsx";

// An administrator runs the system, so their dashboard is a console: is it up,
// who is using it, is review keeping up, is anyone trying passwords. Personal
// money lives under "My Wallet", not here.

// A MongoDB id starts with its creation time in seconds, so account age needs
// no extra field.
const createdAt = (id) => new Date(parseInt(String(id).slice(0, 8), 16) * 1000);

const ACTION_ICON = (action) =>
  /Login|Logout/.test(action) ? "users"
  : /Failed|Reset/.test(action) ? "alert"
  : /Payment|Bill/.test(action) ? "receipt"
  : /Approved|Rejected|Revision|Review/.test(action) ? "check"
  : /Budget/.test(action) ? "pie"
  : /Role|Account/.test(action) ? "shield"
  : "edit";

function timeOf(ts) {
  return new Date(ts).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
}

export default function AdminConsole({ session, queue, users, auditLog, onNavigate }) {
  const [health, setHealth] = useState(null);
  useEffect(() => {
    let live = true;
    api("/api/health").then((h) => live && setHealth(h)).catch(() => live && setHealth({ status: "down" }));
    return () => { live = false; };
  }, []);

  const roles = ["Admin", "Reviewer", "User"].map((r) => ({ role: r, n: users.filter((u) => u.role === r).length }));
  const weekAgo = Date.now() - 7 * 86400000;
  const newThisWeek = users.filter((u) => createdAt(u._id).getTime() >= weekAgo).length;
  const newest = [...users].sort((a, b) => createdAt(b._id) - createdAt(a._id)).slice(0, 5);

  const waiting = queue.filter((t) => t.status === "Pending Review" && String(t.submittedBy) !== String(session.id));
  const pipeline = [
    { label: "Pending review", n: queue.filter((t) => t.status === "Pending Review").length, tone: "warn" },
    { label: "Approved", n: queue.filter((t) => t.status === "Approved").length, tone: "ok" },
    { label: "Needs revision", n: queue.filter((t) => t.status === "Needs Revision").length, tone: "neutral" },
    { label: "Rejected", n: queue.filter((t) => t.status === "Rejected").length, tone: "danger" },
  ];
  const pipelineMax = Math.max(1, ...pipeline.map((p) => p.n));

  const today = todayISO();
  const todays = auditLog.filter((l) => phDateOf(l.ts) === today);
  const failed = auditLog.filter((l) => l.action === "Failed Login");
  const failedToday = failed.filter((l) => phDateOf(l.ts) === today).length;

  const up = health && health.status === "ok";
  const dbUp = health && health.db === "connected";

  const ACTIONS = [
    { label: "Manage users", hint: "Roles, deletions", icon: "users", to: "/users" },
    { label: "Reset a password", hint: "For a locked-out user", icon: "shield", to: "/users" },
    { label: "Audit log", hint: "Every recorded action", icon: "history", to: "/audit" },
    { label: "Review queue", hint: `${waiting.length} waiting`, icon: "check", to: "/review" },
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
        <div className="kpi">
          <div className="kpi-label">Awaiting review</div>
          <div className="kpi-value" style={{ color: waiting.length ? "var(--warn)" : undefined }}>{waiting.length}</div>
          <div className="kpi-foot">{waiting.length ? "needs a reviewer's decision" : "queue is clear"}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Activity today</div>
          <div className="kpi-value">{todays.length}</div>
          <div className="kpi-foot">actions in the audit log</div>
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
              <span className="chip neutral">{u.role}</span>
            </div>
          ))}
        </section>

        <section className="panel">
          <div className="panel-head"><h3>Review pipeline</h3><button className="linkbtn" onClick={() => onNavigate("/review")}>Open queue</button></div>
          {pipeline.map((p) => (
            <div key={p.label} className="bar-row">
              <span className="bar-label">{p.label}</span>
              <span className="bar-track"><span className={"bar-fill tone-bar-" + p.tone} style={{ width: (p.n / pipelineMax) * 100 + "%" }} /></span>
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
          <div className="panel-head"><h3>Activity feed</h3><button className="linkbtn" onClick={() => onNavigate("/audit")}>See all</button></div>
          {auditLog.slice(0, 8).map((l) => (
            <div key={l._id} className="row static">
              <span className="feed-ico"><Icon name={ACTION_ICON(l.action)} size={16} /></span>
              <span className="row-main"><span className="row-title">{l.user} · {l.action}</span><span className="row-sub">{timeOf(l.ts)}</span></span>
            </div>
          ))}
          {auditLog.length === 0 && <div className="empty small">No activity yet.</div>}
        </section>
      </div>
    </div>
  );
}
