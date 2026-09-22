export default function NotificationsScreen({ notifs, markRead, markAllRead }) {
  const unread = notifs.filter((n) => !n.read);

  return (
    <div>
      <div className="pagehead">
        <div>
          <h2>Notification Log</h2>
          <div className="desc">Alerts addressed to you from the Bill Reminder, Payment Tracking, and Review workflow integration.</div>
        </div>
        {unread.length > 0 && (
          <button className="btn ghost" onClick={markAllRead}>Mark all as read ({unread.length})</button>
        )}
      </div>
      <div className="card">
        {notifs.length === 0 ? <div className="empty">No notifications yet.</div> :
          notifs.map((n) => (
            <div key={n._id} className={"log-line" + (n.read ? " read" : "")}>
              {!n.read && <span className="unread-dot" title="Unread" />}
              <span className="tag">[{n.type}]</span>
              {n.message}
              <span style={{ float: "right", display: "flex", gap: 10, alignItems: "center" }}>
                {!n.read && (
                  <button className="linkbtn" onClick={() => markRead(n._id)}>Mark read</button>
                )}
                <span style={{ color: "var(--text-dim)" }}>{new Date(n.ts).toLocaleTimeString()}</span>
              </span>
            </div>
          ))
        }
      </div>
    </div>
  );
}
