import Icon from "./Icon.jsx";
import { notifKind } from "../lib/notifications.js";

// Two kinds of toast: a plain confirmation ("Bill added."), given as a string,
// and an incoming notification ({ kind: "notice", text }), shown like a chat
// app's new-message banner — with a bell, and opening the Inbox when tapped.
export default function Toast({ toast, onOpen }) {
  if (toast && toast.kind === "notice") {
    const kind = toast.type ? notifKind(toast.type) : { title: "New notifications", icon: "bell" };
    return (
      <button type="button" className="toast notice" onClick={onOpen}>
        <span className="toast-bell"><Icon name={kind.icon} size={18} /></span>
        <span className="toast-body">
          <strong>{kind.title}</strong>
          <span>{toast.text}</span>
        </span>
      </button>
    );
  }
  return <div className="toast">{typeof toast === "string" ? toast : toast.text}</div>;
}
