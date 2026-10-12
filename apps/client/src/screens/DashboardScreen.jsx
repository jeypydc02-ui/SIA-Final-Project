import UserHome from "./dashboard/UserHome.jsx";
import AdminConsole from "./dashboard/AdminConsole.jsx";
import ApproverHome from "./dashboard/ApproverHome.jsx";

// Each role lands on its own dashboard:
//   User     -> Home: their wallet
//   Approver -> the review queue
//   Admin    -> Admin Console: accounts, sign-ins and the health of the system.
//              An Admin keeps no wallet of their own.
export default function DashboardScreen(props) {
  if (props.session.role === "Admin") return <AdminConsole {...props} />;
  if (props.session.role === "Approver") return <ApproverHome {...props} />;
  return <UserHome {...props} />;
}