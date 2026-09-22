export const NAV = [
  { group: "Overview", items: [
    { id: "dashboard", label: "Dashboard" },
  ]},
  { group: "Finance Records", items: [
    { id: "projects", label: "Bill Categories" },
    { id: "submission", label: "Log Income/Expense" },
    { id: "budgets", label: "Budgets" },
  ]},
  { group: "Bills & Payments", items: [
    { id: "bills", label: "Bill Reminders" },
    { id: "versions", label: "Revision History" },
    { id: "review", label: "Review & Approval" },
    { id: "comments", label: "Notes / Feedback" },
    { id: "history", label: "Payment History" },
  ]},
  { group: "System", items: [
    { id: "notifications", label: "Notification Log" },
    { id: "audit", label: "Audit Log", roles: ["Admin", "Reviewer"] },
    { id: "reports", label: "Reports" },
    { id: "users", label: "User & Role Mgmt", roles: ["Admin"] },
    { id: "settings", label: "Settings" },
  ]},
];

// "Category Detail" is reached by opening a category rather than from the
// sidebar, so it is not a NAV item — but the top bar still needs its title.
export const LABELS = {
  ...Object.fromEntries(NAV.flatMap(g => g.items).map(i => [i.id, i.label])),
  projectDetails: "Category Detail",
};
