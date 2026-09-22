export const NAV = [
  { group: "Overview", items: [
    { id: "dashboard", label: "Dashboard", ico: "01" },
  ]},
  { group: "Finance Records", items: [
    { id: "projects", label: "Bill Categories", ico: "02" },
    { id: "submission", label: "Log Income/Expense", ico: "03" },
    { id: "budgets", label: "Budgets", ico: "04" },
  ]},
  { group: "Bills & Payments", items: [
    { id: "bills", label: "Bill Reminders", ico: "05" },
    { id: "versions", label: "Revision History", ico: "06" },
    { id: "review", label: "Review & Approval", ico: "07" },
    { id: "comments", label: "Notes / Feedback", ico: "08" },
    { id: "history", label: "Payment History", ico: "09" },
  ]},
  { group: "System", items: [
    { id: "notifications", label: "Notification Log", ico: "10" },
    { id: "audit", label: "Audit Log", ico: "11", roles: ["Admin", "Reviewer"] },
    { id: "reports", label: "Reports", ico: "12" },
    { id: "users", label: "User & Role Mgmt", ico: "13", roles: ["Admin"] },
    { id: "settings", label: "Settings", ico: "14" },
  ]},
];

// "Category Detail" is reached by opening a category rather than from the
// sidebar, so it is not a NAV item — but the top bar still needs its title.
export const LABELS = {
  ...Object.fromEntries(NAV.flatMap(g => g.items).map(i => [i.id, i.label])),
  projectDetails: "Category Detail",
};
