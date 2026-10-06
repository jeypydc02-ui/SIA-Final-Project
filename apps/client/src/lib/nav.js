// Every screen has a URL. The sidebar, the page titles, and the router all
// read from this one list, so a screen cannot exist in the menu without an
// address you can bookmark, share, or reload.
//
// Two roles: a User keeps their own wallet; an Admin runs the system and
// reviews the receipts Users attach, with no wallet of their own.
const MEMBER = ["User"];
const ADMIN = ["Admin"];

export const NAV = [
  { group: "Overview", items: [
    { path: "/dashboard", label: "Dashboard", icon: "home" },
  ]},
  { group: "Finance Records", items: [
    { path: "/categories", label: "Bill Categories", icon: "grid", roles: MEMBER },
    { path: "/submit", label: "Log Income/Expense", icon: "edit", roles: MEMBER },
    { path: "/budgets", label: "Budgets", icon: "pie", roles: MEMBER },
  ]},
  { group: "Bills & Payments", items: [
    { path: "/bills", label: "Bill Reminders", icon: "receipt", roles: MEMBER },
    { path: "/revisions", label: "Revision History", icon: "history", roles: MEMBER },
    { path: "/entries", label: "My Entries", icon: "wallet", roles: MEMBER },
    { path: "/notes", label: "Notes / Feedback", icon: "message", roles: MEMBER },
    { path: "/payments", label: "Payment History", icon: "card", roles: MEMBER },
  ]},
  { group: "Review", items: [
    { path: "/review", label: "Receipt Review", icon: "check", roles: ADMIN },
  ]},
  { group: "System", items: [
    { path: "/notifications", label: "Notification Log", icon: "bell" },
    { path: "/audit", label: "Audit Log", icon: "shield", roles: ADMIN },
    { path: "/reports", label: "Reports", icon: "chart", roles: MEMBER },
    { path: "/users", label: "User & Role Mgmt", icon: "users", roles: ADMIN },
    { path: "/system", label: "System Settings", icon: "server", roles: ADMIN },
    { path: "/settings", label: "Settings", icon: "gear" },
  ]},
];

export const NAV_ITEMS = NAV.flatMap((g) => g.items);

// Category Detail is reached by opening a category rather than from the
// sidebar, so it is not a NAV item — but the top bar still needs its title.
export const TITLES = {
  ...Object.fromEntries(NAV_ITEMS.map((i) => [i.path, i.label])),
  "/categories/:name": "Category Detail",
};

// Which roles may open a given path, for the route guards. Paths not listed
// are open to every signed-in user.
export const PATH_ROLES = Object.fromEntries(
  NAV_ITEMS.filter((i) => i.roles).map((i) => [i.path, i.roles])
);

export const isMember = (session) => !!session && session.role === "User";
