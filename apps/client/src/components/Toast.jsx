import Icon from "./Icon.jsx";

// Two kinds of toast: a plain confirmation ("Bill added."), given as a string,
// and an incoming notification ({ kind: "notice", text }), shown like a chat
// app's new-message banner — with a bell, and opening the Inbox when tapped.
export default function Toast({ toast, onOpen }) {
  if (toast && toast.kind === "notice") {
    return (
      <button type="button" className="toast notice" onClick={onOpen}>
        <span className="toast-bell"><Icon name="bell" size={18} /></span>
        <span className="toast-body">
          <strong>New notification</strong>
          <span>{toast.text}</span>
        </span>
      </button>
    );
  }
  return <div className="toast">{typeof toast === "string" ? toast : toast.text}</div>;
}
