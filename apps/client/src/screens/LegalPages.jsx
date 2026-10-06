import { Link } from "react-router-dom";

// The sign-up form asks people to agree to these, so they must exist. Every
// statement here describes what the code actually does; update the text if the
// data handling changes.
const UPDATED = "September 30, 2026";

function LegalFrame({ title, children }) {
  return (
    <div className="legal-page">
      <div className="legal-inner">
        <Link to="/" className="legal-back">← FinTrack Stark</Link>
        <h1>{title}</h1>
        <div className="legal-updated">Last updated {UPDATED}</div>
        {children}
      </div>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalFrame title="Privacy Policy">
      <p>
        FinTrack Stark is a personal finance, bill reminder and payment tracking system. This page explains what it
        stores about you, why, and who can see it, in line with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173).
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your first and last name, email address, and your password in hashed form. Your actual password is never stored.</li>
        <li><strong>Financial records you enter:</strong> bills, payments you mark as made, income and expense entries, budgets, and personal notes.</li>
        <li><strong>Receipts you attach:</strong> a photo or PDF you upload is stored in the system's database; for a link (Google Drive, OneDrive, Dropbox) only the link is stored, and the file stays where you keep it.</li>
        <li><strong>Activity records:</strong> an audit log of important actions (sign-ins, failed sign-ins, payments, entries, edits and deletions) with your name and the time, and the notifications addressed to you.</li>
      </ul>

      <h2>Why we use it</h2>
      <p>
        Only to run the service: to sign you in, show you your own records, send you bill reminders inside the app,
        keep the history of your income and expense entries, have the receipts you attach checked, and keep an audit trail that protects the integrity of the records.
        We do not sell your data, show advertising, or share it with third parties.
      </p>

      <h2>Who can see it</h2>
      <ul>
        <li><strong>You</strong> see your own bills, budgets, entries, notes and notifications.</li>
        <li><strong>Reviewers</strong> see a receipt you attach, with your name and the one entry it is for (type, category, amount, date and note), so they can check it. They do not see the rest of your wallet, and cannot review their own receipts.</li>
        <li><strong>Administrators</strong> see the list of accounts (name, email and role) and the audit log of actions. They do not see your bills, budgets, entries, receipts or notes.</li>
      </ul>

      <h2>Storage on your device</h2>
      <p>
        The app keeps your sign-in token in your browser's session storage, which is cleared when the tab is closed,
        and remembers your light or dark theme choice. It uses no tracking or advertising cookies.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Your records are kept while your account exists. If an Administrator deletes your account, your bills, budgets,
        income and expense entries, receipts, notes and notifications are deleted with it. The audit log of actions is kept as
        the system's record.
      </p>

      <h2>Your rights</h2>
      <p>
        Under the Data Privacy Act you may ask to access, correct, or delete your personal data, and object to its processing.
        You can correct your name and email yourself in Settings. For anything else, contact the administrator of this
        FinTrack Stark service.
      </p>
    </LegalFrame>
  );
}

export function TermsPage() {
  return (
    <LegalFrame title="Terms of Service">
      <p>By creating an account and using FinTrack Stark, you agree to these terms.</p>

      <h2>Your account</h2>
      <ul>
        <li>Give your real name and an email address you control.</li>
        <li>Keep your password to yourself. You are responsible for what is done with your account.</li>
        <li>If you forget your password, an administrator can issue a temporary one, which you must replace at your next sign-in.</li>
      </ul>

      <h2>Your records</h2>
      <ul>
        <li>FinTrack Stark is a record-keeping tool. It does not move money: marking a bill as paid records a payment you made elsewhere.</li>
        <li>Enter information that is accurate. You can correct an entry at any time; the earlier version is kept, and every change is recorded in the audit log.</li>
        <li>Bill reminders are a convenience. You remain responsible for paying your bills on time.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>
        Do not try to access other people's records, get around the access controls, or disrupt the service.
        Accounts that do may be suspended or deleted by an administrator.
      </p>

      <h2>No warranty</h2>
      <p>
        The service is provided as is. We work to keep it available and your data safe, but we cannot promise it will be
        uninterrupted or error-free, and it is not financial advice.
      </p>

      <h2>Changes</h2>
      <p>These terms may be updated. The date at the top shows when they last changed.</p>

      <p>See also the <Link to="/privacy">Privacy Policy</Link>.</p>
    </LegalFrame>
  );
}
