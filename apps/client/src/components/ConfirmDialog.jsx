export default function ConfirmDialog({ message, confirmLabel = "Yes, Continue", onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Please Confirm</h3>
        <p style={{ fontSize: 13.5, color: "var(--text)", margin: "0 0 4px" }}>{message}</p>
        <div className="actions">
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          <button className="btn danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
