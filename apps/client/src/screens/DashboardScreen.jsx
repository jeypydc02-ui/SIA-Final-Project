import UserHome from "./dashboard/UserHome.jsx";
import AdminConsole from "./dashboard/AdminConsole.jsx";

// Each role lands on its own dashboard:
//   User  -> Home: their wallet
//   Admin -> Admin Console: accounts, sign-ins and the health of the system.
//            An Admin keeps no wallet of their own.
export default function DashboardScreen(props) {
  return props.session.role === "Admin" ? <AdminConsole {...props} /> : <UserHome {...props} />;
}
