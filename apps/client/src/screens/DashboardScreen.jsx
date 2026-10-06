import { useSearchParams } from "react-router-dom";
import UserHome from "./dashboard/UserHome.jsx";
import AdminConsole from "./dashboard/AdminConsole.jsx";
import ReviewerDesk from "./dashboard/ReviewerDesk.jsx";

// Each role lands on its own dashboard:
//   User  -> Home (their wallet)
//   Reviewer -> Review Desk (receipts waiting), with their own wallet one tap away
//   Admin -> Admin Console, with their own wallet one tap away
// The tab is in the address (?view=wallet), so Back and reload keep it.
export default function DashboardScreen(props) {
  const { session } = props;
  const [params, setParams] = useSearchParams();

  if (session.role === "User") return <UserHome {...props} />;

  const wallet = params.get("view") === "wallet";
  const deskLabel = session.role === "Admin" ? "Admin Console" : "Review Desk";
  return (
    <div>
      <div className="segmented" role="tablist" aria-label="Dashboard view">
        <button type="button" role="tab" aria-selected={!wallet} className={!wallet ? "active" : ""} onClick={() => setParams({}, { replace: true })}>
          {deskLabel}
        </button>
        <button type="button" role="tab" aria-selected={wallet} className={wallet ? "active" : ""} onClick={() => setParams({ view: "wallet" }, { replace: true })}>
          My Wallet
        </button>
      </div>
      {wallet ? <UserHome {...props} /> : session.role === "Admin" ? <AdminConsole {...props} /> : <ReviewerDesk {...props} />}
    </div>
  );
}
