// How each kind of notification looks in the Inbox and the pop-up: a short
// title, an icon, and the screen it opens — like the sender line of a message.
const KINDS = {
  reminder: { title: "Bill due soon", icon: "bell", path: "/bills" },
  overdue: { title: "Bill overdue", icon: "alert", path: "/bills", tone: "danger" },
  bill: { title: "Bill added", icon: "receipt", path: "/bills" },
  payment: { title: "Payment recorded", icon: "card", path: "/payments", tone: "ok" },
  budget: { title: "Budget alert", icon: "pie", path: "/budgets", tone: "warn" },
  role: { title: "Account", icon: "shield", path: "/settings" },
  // Left over from the retired review step, so old messages still read well.
  approved: { title: "Entry recorded", icon: "check", path: "/entries", tone: "ok" },
  rejected: { title: "Entry", icon: "check", path: "/entries" },
  revision: { title: "Entry", icon: "check", path: "/entries" },
};

export function notifKind(type) {
  return KINDS[type] || { title: "FinTrack Stark", icon: "bell", path: "/notifications" };
}

// "3:26 PM" today, "Yesterday", the weekday within a week, else "Oct 5".
export function notifTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.floor((startOfToday - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (days <= 0) return d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-PH", { weekday: "short" });
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
}

// Section heading for a day, as messaging apps group a conversation list.
export function notifDay(ts) {
  const d = new Date(ts);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.floor((startOfToday - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  return "Earlier";
}
