export default function NotificationsScreen({ notifs }) {
  return (
    <div>
      <div className="pagehead"><div><h2>Notification Log</h2><div className="desc">Auto-generated alerts from the Bill Reminder, Payment Tracking, and Review workflow integration.</div></div></div>
      <div className="card">
        {notifs.length === 0 ? <div className="empty">No notifications yet.</div> :
          notifs.map(n => (
            <div key={n._id} className="log-line"><span className="tag">[{n.type}]</span>{n.message} <span style={{ float: "right", color: "var(--text-dim)" }}>{new Date(n.ts).toLocaleTimeString()}</span></div>
          ))
        }
      </div>
    </div>
  );
}
