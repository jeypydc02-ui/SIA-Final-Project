function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#E3A008" strokeWidth="2.4" strokeLinecap="round">
      <circle cx="12" cy="12" r="4.2" />
      <line x1="12" y1="1.5" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22.5" />
      <line x1="4.2" y1="4.2" x2="5.9" y2="5.9" />
      <line x1="18.1" y1="18.1" x2="19.8" y2="19.8" />
      <line x1="1.5" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22.5" y2="12" />
      <line x1="4.2" y1="19.8" x2="5.9" y2="18.1" />
      <line x1="18.1" y1="5.9" x2="19.8" y2="4.2" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="#475569" stroke="none">
      <path d="M20.3 14.7A8.5 8.5 0 1 1 9.3 3.7a7 7 0 0 0 11 11z" />
    </svg>
  );
}

export default function ThemeToggle({ theme, setTheme }) {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      data-on={isDark}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="theme-toggle-thumb">
        {isDark ? <MoonIcon /> : <SunIcon />}
      </span>
    </button>
  );
}
