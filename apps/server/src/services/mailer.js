// Sends the system's e-mails: registration codes and password-reset links.
//
// Three ways to send, picked by what the deployment has configured:
//   1. Brevo's HTTPS e-mail API (BREVO_API_KEY + MAIL_FROM). Works on hosting
//      that blocks SMTP — Render's free tier blocks ports 25, 465 and 587 — so
//      this is the one for the live site.
//   2. Gmail over SMTP with an App Password (GMAIL_USER + GMAIL_APP_PASSWORD).
//      Works from a laptop or any host that allows SMTP.
//   3. Neither configured, outside production: the message is printed in the
//      server's terminal (and kept in a small in-memory outbox when
//      DEV_MAILBOX=1, for the automated tests). In production this refuses,
//      so a missing setting is an error instead of a code nobody receives.
const nodemailer = require("nodemailer");

const FROM_NAME = process.env.MAIL_FROM_NAME || "FinTrack Stark";
const isProduction = () => process.env.NODE_ENV === "production";

let gmail = null;
function gmailTransport() {
  if (!gmail) {
    gmail = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
  }
  return gmail;
}

// Development outbox: the last messages sent, newest last.
const outbox = [];
const devMailbox = () => process.env.DEV_MAILBOX === "1" && !isProduction();

function mailMode() {
  if (process.env.BREVO_API_KEY && process.env.MAIL_FROM) return "brevo";
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return "gmail";
  return isProduction() ? "none" : "console";
}

async function sendMail({ to, subject, text, html }) {
  const mode = mailMode();
  if (mode === "brevo") {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: process.env.MAIL_FROM },
        to: [{ email: to }],
        subject, textContent: text, htmlContent: html,
      }),
    });
    if (!res.ok) throw new Error(`Brevo refused the message (${res.status}).`);
    return;
  }
  if (mode === "gmail") {
    await gmailTransport().sendMail({ from: `"${FROM_NAME}" <${process.env.GMAIL_USER}>`, to, subject, text, html });
    return;
  }
  if (mode === "none") {
    throw new Error("E-mail is not configured (set BREVO_API_KEY and MAIL_FROM, or GMAIL_USER and GMAIL_APP_PASSWORD).");
  }
  // Development: show it in the terminal.
  console.log(`\n[mail] to ${to} — ${subject}\n${text}\n`);
  if (devMailbox()) {
    outbox.push({ to: to.toLowerCase(), subject, text, at: Date.now() });
    if (outbox.length > 50) outbox.shift();
  }
}

// For the development outbox route only.
function lastMailTo(to) {
  for (let i = outbox.length - 1; i >= 0; i--) if (outbox[i].to === String(to).toLowerCase()) return outbox[i];
  return null;
}

// One look for every message: a heading, a sentence, and the code or button.
function layout({ heading, intro, highlight, button, outro }) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  return `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0F1E46">
  <div style="font-size:20px;font-weight:700;color:#2F6FED;margin-bottom:16px">FinTrack Stark</div>
  <h2 style="font-size:18px;margin:0 0 12px">${esc(heading)}</h2>
  <p style="font-size:14px;line-height:1.6;margin:0 0 16px">${esc(intro)}</p>
  ${highlight ? `<div style="font-size:30px;font-weight:700;letter-spacing:8px;background:#EAF1FF;border-radius:10px;padding:14px;text-align:center;margin:0 0 16px">${esc(highlight)}</div>` : ""}
  ${button ? `<p style="margin:0 0 16px"><a href="${esc(button.href)}" style="display:inline-block;background:#2F6FED;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">${esc(button.label)}</a></p>` : ""}
  <p style="font-size:12.5px;line-height:1.6;color:#5E6B85;margin:0">${esc(outro)}</p>
</div>`;
}

module.exports = { sendMail, mailMode, lastMailTo, devMailbox, layout };
