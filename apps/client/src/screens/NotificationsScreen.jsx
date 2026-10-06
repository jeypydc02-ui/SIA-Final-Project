import Icon from "../components/Icon.jsx";
import { notifKind, notifTime, notifDay } from "../lib/notifications.js";

// Laid out like a phone's message list: who it is from, the message, the
// time on the right, and a dot while it is unread. Tapping one marks it read
// and opens the screen it is about.
export default function NotificationsScreen({ notifs, markRead, markAllRead, onNavigate }) {
  const unread = notifs.filter((n) => !n.read);

  function open(n) {
    if (!n.read) markRead(n._id);
    const { path } = notifKind(n.type);
    if (path !== "/notifications") onNavigate(path);
  }

  // Group under Today / Yesterday / This week / Earlier, newest first.
  const groups = [];
  for (const n of notifs) {
    const day = notifDay(n.ts);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(n);
    else groups.push({ day, items: [n] });
  }

  return (
    <div>
      <div className="pagehead">
        <div>
          <h2>Notification Log</h2>
          <div className="desc">Bill reminders, payments and budget alerts. New ones appear here as they happen.</div>
        </div>
        {unread.length > 0 && (
          <button className="btn ghost" onClick={markAllRead}>Mark all as read ({unread.length})</button>
        )}
      </div>

      {notifs.length === 0 ? (
        <div className="card"><div className="empty">No notifications yet.</div></div>
      ) : groups.map((g) => (
        <section key={g.day} className="inbox-group">
          <h3 className="inbox-day">{g.day}</h3>
          <div className="inbox">
            {g.items.map((n) => {
              const kind = notifKind(n.type);
              return (
                <button key={n._id} type="button" className={"inbox-item" + (n.read ? "" : " unread")} onClick={() => open(n)}>
                  <span className={"inbox-icon" + (kind.tone ? " " + kind.tone : "")}><Icon name={kind.icon} size={20} /></span>
                  <span className="inbox-body">
                    <span className="inbox-top">
                      <span className="inbox-title">{kind.title}</span>
                      <span className="inbox-time">{notifTime(n.ts)}</span>
                    </span>
                    <span className="inbox-text">{n.message}</span>
                  </span>
                  {!n.read && <span className="unread-dot" aria-label="Unread" />}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
