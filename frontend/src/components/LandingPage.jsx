import ThemeToggle from "./ThemeToggle.jsx";

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
function TrackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 5-6" />
    </svg>
  );
}
function CheckShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9.5 12l2 2 3.5-4" />
    </svg>
  );
}

const FEATURES = [
  { Icon: BellIcon, title: "Bill Reminders", desc: "Get notified before due dates so you never miss a payment." },
  { Icon: TrackIcon, title: "Payment Tracking", desc: "Log every transaction and see exactly where your money goes." },
  { Icon: CheckShieldIcon, title: "Review & Approval", desc: "Submitted entries go through a review workflow before they're finalized." },
];

export default function LandingPage({ theme, setTheme, onLogin, onGetStarted }) {
  return (
    <div className="landing-wrap">
      <div className="landing-nav">
        <div className="brand" style={{ border: "none", padding: 0, margin: 0 }}>
          <div className="brand-logo">FS</div>
          <div className="brand-text">
            <div className="mark">FinTrack Stark</div>
            <div className="sub">Personal Finance · Bill Reminder · Payment Tracking</div>
          </div>
        </div>
        <div className="landing-nav-actions">
          <ThemeToggle theme={theme} setTheme={setTheme} />
          <button type="button" className="btn ghost" onClick={onLogin}>Log In</button>
          <button type="button" className="btn" onClick={onGetStarted}>Get Started</button>
        </div>
      </div>

      <div className="landing-hero">
        <h1>Track every peso. Never miss a bill.</h1>
        <p>FinTrack Stark helps you manage bills, log payments, and keep your budget on track — with a built-in review and approval workflow for shared finances.</p>
        <div className="landing-hero-actions">
          <button type="button" className="btn" onClick={onGetStarted}>Create Free Account</button>
          <button type="button" className="btn ghost" onClick={onLogin}>Log In</button>
        </div>
      </div>

      <div className="landing-features">
        {FEATURES.map(({ Icon, title, desc }) => (
          <div className="card landing-feature" key={title}>
            <div className="ico"><Icon /></div>
            <h4>{title}</h4>
            <p>{desc}</p>
          </div>
        ))}
      </div>

      <div className="landing-foot">© {new Date().getFullYear()} FinTrack Stark · Project Stark — SIA Capstone</div>
    </div>
  );
}
