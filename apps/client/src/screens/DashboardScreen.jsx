import { useSearchParams } from "react-router-dom";
import UserHome from "./dashboard/UserHome.jsx";
import ReviewerDesk from "./dashboard/ReviewerDesk.jsx";
import AdminConsole from "./dashboard/AdminConsole.jsx";

// Each role lands on its own dashboard:
//   User     -> Home (their wallet)
//   Reviewer -> Review Desk, with My Wallet one tap away
//   Admin    -> Admin Console, with My Wallet one tap away
// The tab is in the address (?view=wallet), so Back and reload keep it.
export default function DashboardScreen(props) {
  const { session } = props;
  const [params, setParams] = useSearchParams();

  if (session.role === "User") return <UserHome {...props} />;

  const workLabel = session.role === "Admin" ? "Admin Console" : "Review Desk";
  const wallet = params.get("view") === "wallet";

  return (
    <div>
      <div className="segmented" role="tablist" aria-label="Dashboard view">
        <button type="button" role="tab" aria-selected={!wallet} className={!wallet ? "active" : ""} onClick={() => setParams({}, { replace: true })}>
          {workLabel}
        </button>
        <button type="button" role="tab" aria-selected={wallet} className={wallet ? "active" : ""} onClick={() => setParams({ view: "wallet" }, { replace: true })}>
          My Wallet
        </button>
      </div>
      {wallet
        ? <UserHome {...props} />
        : session.role === "Admin" ? <AdminConsole {...props} /> : <ReviewerDesk {...props} />}
    </div>
  );
}
