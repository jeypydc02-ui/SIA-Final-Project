import Icon from "./Icon.jsx";

// Each category gets an icon and a soft colour, the way Monefy and GCash mark
// a transaction at a glance. The colours are muted tints (the "tone" classes
// in index.css), so the screen keeps one strong accent colour.
const STYLE = {
  Food: { icon: "food", tone: "orange" },
  Transport: { icon: "transport", tone: "blue" },
  Utilities: { icon: "utilities", tone: "yellow" },
  Housing: { icon: "housing", tone: "teal" },
  Internet: { icon: "internet", tone: "indigo" },
  Credit: { icon: "credit", tone: "red" },
  Subscription: { icon: "subscription", tone: "purple" },
  Other: { icon: "other", tone: "gray" },
  Salary: { icon: "salary", tone: "green" },
  Freelance: { icon: "freelance", tone: "green" },
  Allowance: { icon: "allowance", tone: "green" },
  "Other Income": { icon: "otherIncome", tone: "green" },
};

export const categoryTone = (category) => (STYLE[category] || STYLE.Other).tone;

export default function CategoryIcon({ category, size = 36 }) {
  const s = STYLE[category] || STYLE.Other;
  return (
    <span className={"cat-icon tone-" + s.tone} style={{ width: size, height: size }} aria-hidden="true">
      <Icon name={s.icon} size={Math.round(size * 0.5)} />
    </span>
  );
}
