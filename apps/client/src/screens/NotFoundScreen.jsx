export default function NotFoundScreen({ onHome }) {
  return (
    <div className="card">
      <div className="empty">
        <div className="big">404</div>
        That page does not exist.{" "}
        <button className="linkbtn" onClick={onHome}>Go to the dashboard</button>
      </div>
    </div>
  );
}
