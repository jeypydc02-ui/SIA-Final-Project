import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle.jsx";
import Icon from "../components/Icon.jsx";
import CategoryIcon from "../components/CategoryIcon.jsx";
import DonutChart from "../components/DonutChart.jsx";
import { canInstall, promptInstall, onInstallChange, isInstalled } from "../lib/pwa.js";

// Public landing page. Everything on it describes what FinTrack Stark actually
// does; there are no invented ratings, download counts or testimonials.

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#roles", label: "Roles" },
  { href: "#security", label: "Security" },
  { href: "#faq", label: "FAQ" },
];

const FEATURES = [
  { icon: "receipt", title: "Bill reminders", text: "Add your bills once. The reminder service alerts you before each due date, and monthly bills come back on their own." },
  { icon: "card", title: "Payment tracking", text: "Mark a bill as paid and the payment is logged as an expense, with a notification and an audit record — in one tap." },
  { icon: "pie", title: "Monthly budgets", text: "Set a limit per category. FinTrack Stark shows what is left and warns you at 80% and when you go over." },
  { icon: "check", title: "Receipt review", text: "Attach a photo, PDF or Drive link of the receipt. An Admin verifies it, and edits keep the earlier version — nothing changes silently." },
];

const STEPS = [
  { n: 1, title: "Add your bills and budgets", text: "Rent, electricity, internet — set the due date and whether it repeats every month." },
  { n: 2, title: "Log what comes in and goes out", text: "Record income and expenses, or pay a bill. Your balance and budgets update right away." },
  { n: 3, title: "Stay ahead of every due date", text: "Reminders, budget warnings and a clear monthly picture of where your money went." },
];

const ROLES = [
  { role: "User", icon: "wallet", title: "Your wallet", points: ["Balance and monthly spending at a glance", "Bills, budgets and payment history", "Quick add for expenses, income and bills"] },
  { role: "Admin", icon: "server", title: "The admin console", points: ["Receipt review: verify, reject or ask for a clearer copy", "Accounts, roles and password resets", "System status, weekly activity and the audit log"] },
];

const FACTS = [
  { value: "8 hrs", label: "before a sign-in expires, so a forgotten session on a shared computer does not stay open" },
  { value: "0", label: "financial records stored on your device by the app — your data always comes fresh from the server" },
  { value: "3", label: "roles with separate access: people only ever see their own bills, budgets and notes" },
  { value: "v1 → v2", label: "every edit to an entry keeps the earlier version, and every change is written to the audit log" },
];

const FAQ = [
  { q: "What is FinTrack Stark?", a: "A personal finance app for tracking bills, payments, income, expenses and monthly budgets, with reminders before due dates and live notifications." },
  { q: "Does it move real money?", a: "No. FinTrack Stark is a record-keeping tool. Marking a bill as paid records a payment you made elsewhere — it never connects to a bank or e-wallet." },
  { q: "How do bill reminders work?", a: "Once a day, the reminder service checks every unpaid bill and sends an alert to your Inbox when one is due within three days or already overdue. Monthly bills schedule next month's bill when you pay them." },
  { q: "What is a receipt review?", a: "When you record an expense or income you can attach its receipt — a photo, a PDF, or a Google Drive, OneDrive or Dropbox link. An Admin checks it against the entry and verifies it, rejects it, or asks for a clearer copy. Your entry counts in your balance either way." },
  { q: "Can I fix a wrong entry?", a: "Yes. Edit it from My Entries and the corrected version counts from then on, while the earlier one stays in Revision History. Deleting an entry stops it counting but keeps it in the history." },
  { q: "Is my financial data safe?", a: "Passwords are hashed, sessions expire after eight hours, and other users cannot see your bills, budgets or notes. Read the Privacy Policy for the details." },
  { q: "Can I install it on my phone?", a: "Yes. On Android or Chrome, choose Install app. On iPhone, open it in Safari and tap Share, then Add to Home Screen. It opens like an app and still opens without a connection." },
];

// Sample figures for the illustration only.
const MOCK_SLICES = [
  { label: "Housing", value: 14000 }, { label: "Food", value: 6200 }, { label: "Utilities", value: 3130 },
  { label: "Transport", value: 2100 }, { label: "Internet", value: 1699 },
];

function PhoneMockup() {
  return (
    <div className="mock-wrap" aria-hidden="true">
      <div className="mock-float f1"><CategoryIcon category="Food" size={34} /><span><strong>Groceries</strong><em>₱1,240.00</em></span></div>
      <div className="mock-float f2"><CategoryIcon category="Utilities" size={34} /><span><strong>Meralco</strong><em>Due in 2 days</em></span></div>
      <div className="mock-float f3"><CategoryIcon category="Subscription" size={34} /><span><strong>Netflix</strong><em>₱549.00</em></span></div>
      <div className="mock-phone">
        <div className="mock-bar"><span className="mock-logo">FS</span> FinTrack</div>
        <div className="mock-months"><span>August</span><span className="on">September</span><span>October</span></div>
        <div className="mock-donut">
          <DonutChart slices={MOCK_SLICES} size={176} thickness={24} centerTop="₱42,000" centerBottom="(₱27,129)" />
        </div>
        <div className="mock-balance">Balance <strong>₱14,871.00</strong></div>
        <div className="mock-buttons">
          <span className="mock-btn minus"><Icon name="minus" size={26} strokeWidth={2.4} /></span>
          <span className="mock-btn plus"><Icon name="plus" size={26} strokeWidth={2.4} /></span>
        </div>
      </div>
    </div>
  );
}

function InstallButton({ className }) {
  const [, rerender] = useState(0);
  useEffect(() => onInstallChange(() => rerender((n) => n + 1)), []);
  if (!canInstall() || isInstalled()) return null;
  return (
    <button type="button" className={className} onClick={promptInstall}>
      <Icon name="download" size={18} /> Install app
    </button>
  );
}

export default function LandingPage({ theme, setTheme, onLogin, onGetStarted }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const year = new Date().getFullYear();

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-container lp-nav-inner">
          <a href="#top" className="lp-brand" onClick={() => setMenuOpen(false)}>
            <span className="brand-logo">FS</span>
            <span>FinTrack <b>Stark</b></span>
          </a>
          <nav className={"lp-links" + (menuOpen ? " open" : "")} aria-label="Sections">
            {NAV_LINKS.map((l) => <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}>{l.label}</a>)}
            <button type="button" className="lp-link-btn" onClick={onLogin}>Log in</button>
          </nav>
          <div className="lp-nav-actions">
            <ThemeToggle theme={theme} setTheme={setTheme} />
            <button type="button" className="lp-login" onClick={onLogin}>Log in</button>
            <button type="button" className="pill" onClick={onGetStarted}>Get started</button>
            <button type="button" className="lp-burger" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
              <Icon name="menu" size={22} />
            </button>
          </div>
        </div>
      </header>

      <section className="lp-hero" id="top">
        <div className="lp-container lp-hero-inner">
          <div className="lp-hero-copy">
            <div className="lp-badges">
              <span className="lp-badge"><Icon name="receipt" size={16} /> Bill reminders</span>
              <span className="lp-badge"><Icon name="download" size={16} /> Installable app</span>
              <span className="lp-badge"><Icon name="bell" size={16} /> Live notifications</span>
            </div>
            <h1>Take control of every peso.</h1>
            <p className="lp-lead">
              FinTrack Stark keeps your bills, payments and budgets in one place — reminding you before
              due dates, logging every payment, and showing exactly where your money goes each month.
            </p>
            <div className="lp-cta-row">
              <button type="button" className="pill big" onClick={onGetStarted}>Create free account</button>
              <button type="button" className="pill big outline" onClick={onLogin}>Log in</button>
              <InstallButton className="pill big ghost" />
            </div>
            <p className="lp-note">Free to use · Philippine peso and calendar · Works on phone and desktop</p>
          </div>
          <PhoneMockup />
        </div>
      </section>

      <section className="lp-section" id="features">
        <div className="lp-container">
          <span className="lp-tag">Features</span>
          <div className="lp-bento">
            <div className="bento-card intro">
              <h2>Everything you need to stay on top of your bills</h2>
              <p>Simple, organised and private.</p>
              <div className="bento-mini">
                <div className="bento-mini-head">Food budget · this month</div>
                <div className="bento-mini-amount">₱1,850.00 left</div>
                <div className="progress-track"><div className="progress-fill" style={{ width: "69%", background: "var(--primary)" }} /></div>
                <div className="bento-mini-rows">
                  <span>Spent</span><span>₱4,150.00</span>
                  <span>Limit</span><span>₱6,000.00</span>
                </div>
              </div>
            </div>
            <div className="bento-col">
              <div className="bento-card circles">
                {["subscription", "card", "chart", "bell"].map((i) => <span key={i} className="bento-circle"><Icon name={i} size={26} /></span>)}
                <p>Recurring bills, payments, reports and reminders — working together.</p>
              </div>
              <div className="bento-card accent">
                <div className="bento-big">₱</div>
                <p>Built for the Philippine peso and Manila time, so “due today” means today.</p>
              </div>
            </div>
            <div className="bento-card dark">
              <div className="bento-list-head"><span>September</span><span>Balance ₱14,871.00</span></div>
              {[["Salary", "+₱42,000.00", true], ["Housing", "₱14,000.00"], ["Food", "₱6,200.00"], ["Utilities", "₱3,130.00"], ["Transport", "₱2,100.00"], ["Internet", "₱1,699.00"]].map(([c, a, inc]) => (
                <div key={c} className="bento-list-row">
                  <CategoryIcon category={c} size={30} />
                  <span>{c}</span>
                  <strong className={inc ? "inc" : ""}>{a}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="lp-features">
            {FEATURES.map((f) => (
              <div key={f.title} className="lp-feature">
                <span className="lp-feature-ico"><Icon name={f.icon} size={22} /></span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section tint" id="how">
        <div className="lp-container">
          <span className="lp-tag">How it works</span>
          <h2 className="lp-h2">Three steps to a calmer month</h2>
          <div className="lp-steps">
            {STEPS.map((s) => (
              <div key={s.n} className="lp-step">
                <span className="lp-step-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" id="roles">
        <div className="lp-container">
          <span className="lp-tag">Roles</span>
          <h2 className="lp-h2">One app, three ways to use it</h2>
          <p className="lp-sub">Every account starts as a User. Admins run the system and check receipts; they keep no wallet of their own.</p>
          <div className="lp-roles two">
            {ROLES.map((r) => (
              <div key={r.role} className={"lp-role role-" + r.role.toLowerCase()}>
                <span className="lp-role-ico"><Icon name={r.icon} size={24} /></span>
                <div className="lp-role-name">{r.role}</div>
                <h3>{r.title}</h3>
                <ul>{r.points.map((p) => <li key={p}><Icon name="check" size={16} />{p}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section tint" id="security">
        <div className="lp-container lp-security">
          <div>
            <span className="lp-tag">Security & privacy</span>
            <h2 className="lp-h2">Your money records stay yours.</h2>
            <p className="lp-sub">
              FinTrack Stark is built so that people only see what they should, every change is recorded,
              and nothing sensitive is left behind on the device you used.
            </p>
            <Link to="/privacy" className="pill outline">Read the Privacy Policy</Link>
          </div>
          <div className="lp-facts">
            {FACTS.map((f) => (
              <div key={f.label} className="lp-fact">
                <div className="lp-fact-value">{f.value}</div>
                <p>{f.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" id="faq">
        <div className="lp-container lp-faq">
          <div>
            <span className="lp-tag">FAQ</span>
            <h2 className="lp-h2">Questions? Answers.</h2>
            <p className="lp-sub">Quick answers about how FinTrack Stark works.</p>
            <button type="button" className="pill outline" onClick={onGetStarted}>Try it yourself</button>
          </div>
          <div className="lp-faq-list">
            {FAQ.map((f, i) => (
              <div key={f.q} className={"lp-faq-item" + (openFaq === i ? " open" : "")}>
                <button type="button" aria-expanded={openFaq === i} onClick={() => setOpenFaq(openFaq === i ? -1 : i)}>
                  <span>{f.q}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {openFaq === i && <p>{f.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-container">
        <div className="lp-band">
          <h2>Ready to take control of your money?</h2>
          <div className="lp-band-actions">
            <button type="button" className="pill big white" onClick={onGetStarted}>Create free account</button>
            <InstallButton className="pill big white-outline" />
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-grid">
          <div className="lp-footer-brand">
            <div className="lp-brand"><span className="brand-logo">FS</span><span>FinTrack <b>Stark</b></span></div>
            <p>Personal Finance, Bill Reminder and Payment Tracking Integration System — a Systems Integration and Architecture capstone by Project Stark.</p>
          </div>
          <div>
            <h4>Product</h4>
            <a href="#features">Features</a><a href="#how">How it works</a><a href="#roles">Roles</a><a href="#faq">FAQ</a>
          </div>
          <div>
            <h4>Account</h4>
            <button type="button" onClick={onLogin}>Log in</button>
            <button type="button" onClick={onGetStarted}>Create account</button>
          </div>
          <div>
            <h4>Legal</h4>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
          </div>
        </div>
        <div className="lp-container lp-copy">© {year} FinTrack Stark · Project Stark</div>
      </footer>
    </div>
  );
}
