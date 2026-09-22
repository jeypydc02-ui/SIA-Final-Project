// Every screen has a URL. The sidebar, the page titles, and the router all
// read from this one list, so a screen cannot exist in the menu without an
// address you can bookmark, share, or reload.
export const NAV = [
  { group: "Overview", items: [
    { path: "/dashboard", label: "Dashboard" },
  ]},
  { group: "Finance Records", items: [
    { path: "/categories", label: "Bill Categories" },
    { path: "/submit", label: "Log Income/Expense" },
    { path: "/budgets", label: "Budgets" },
  ]},
  { group: "Bills & Payments", items: [
    { path: "/bills", label: "Bill Reminders" },
    { path: "/revisions", label: "Revision History" },
    { path: "/review", label: "Review & Approval" },
    { path: "/notes", label: "Notes / Feedback" },
    { path: "/payments", label: "Payment History" },
  ]},
  { group: "System", items: [
    { path: "/notifications", label: "Notification Log" },
    { path: "/audit", label: "Audit Log", roles: ["Admin", "Reviewer"] },
    { path: "/reports", label: "Reports" },
    { path: "/users", label: "User & Role Mgmt", roles: ["Admin"] },
    { path: "/settings", label: "Settings" },
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
