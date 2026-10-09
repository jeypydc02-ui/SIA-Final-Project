# Deploying FinTrack Stark

A checklist for putting the system on a real server. Everything here is required unless marked optional.

## 1. Environment variables

| Variable | Value in production | Why |
|---|---|---|
| `NODE_ENV` | `production` | Stops `npm run seed` from creating the demo accounts, whose passwords are public. |
| `MONGO_URI` | Your production database, e.g. `mongodb+srv://…/fintrack_stark` | Defaults to a local database otherwise. Keep it out of the repository. |
| `PORT` | Whatever the host assigns | Defaults to 4000. |
| `TRUST_PROXY` | `1` **only** if a reverse proxy or platform load balancer sits in front (nginx, Render, Railway, Heroku and similar). Leave it unset if clients connect to Node directly. | The login rate limiter counts per client address. Trusting `X-Forwarded-For` with no proxy in front lets anyone fake a new address on every request. |
| `APP_TIMEZONE` | Optional. Defaults to `Asia/Manila`. | Decides what "today" means for due dates, payments and reminders. |
| `REMINDER_CRON`, `REMINDER_LEAD_DAYS` | Optional. Default `0 8 * * *` and `3`. | When the separate reminder worker runs, and the default reminder lead time. Once an Admin sets the lead time in System Settings, that value is used instead. |
| `REMINDERS_IN_API` | Optional. Leave unset. | The API runs the daily bill-reminder sweep itself (on start-up and on the first request of each day). Set to `0` only if a separate reminder worker runs instead. Running both is safe: no alert is ever sent twice. |
| `APP_URL` | The public address, e.g. `https://finstrack-stark.onrender.com` | Where password-reset links point. On Render, `RENDER_EXTERNAL_URL` is used if this is unset. In production the address is never taken from the request, so without either one no reset e-mail is sent. |
| `BREVO_API_KEY`, `MAIL_FROM` | A Brevo API key, and the sender address verified in Brevo | **Use this on Render.** Sends the sign-up codes and reset links over HTTPS. Render's free plan blocks outgoing SMTP (ports 25, 465 and 587), so Gmail cannot send from there. |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | A Gmail address and a 16-character App Password | For running it on your own computer, or a host that allows SMTP. Needs 2-Step Verification on the Google account; create the App Password at myaccount.google.com/apppasswords. Never the normal Gmail password. |
| `MAIL_FROM_NAME` | Optional. Defaults to `FinTrack Stark`. | The sender name people see. |

If both Brevo and Gmail are set, Brevo is used. In production with neither, sign-up and password reset answer "We could not send the e-mail right now" — set one before going live.

Do **not** set `RATE_LIMIT_LOGIN_MAX`, `RATE_LIMIT_REGISTER_MAX`, `RATE_LIMIT_MAIL_MAX` or `DEV_MAILBOX` in production. They exist so the test suite can sign in and read its e-mails many times (`DEV_MAILBOX` is ignored when `NODE_ENV=production`).

## 2. HTTPS

Serve the app over HTTPS only. The platforms above do this for you; on your own server, put nginx or Caddy in front with a certificate. The API sends `Strict-Transport-Security`, so once a browser has reached the site over HTTPS it refuses plain HTTP.

## 3. First run

```sh
npm install
npm run build                      # builds the React app into apps/client/dist
ADMIN_EMAIL=you@example.com \
ADMIN_PASSWORD='at least 12 characters' \
ADMIN_FIRST_NAME=Juan ADMIN_LAST_NAME='Dela Cruz' \
npm run create-admin               # the first Admin; never run `npm run seed` in production
npm start                          # API + built frontend on one port
npm run reminder                   # optional: the stand-alone reminder worker, if the host allows a second process
```

The system has exactly one Admin: `create-admin` refuses to make a second. Everyone else signs up through the app as a User, confirming their e-mail with a code, and roles are never changed from the app. The Admin keeps no wallet, so use a separate User account for your own bills and entries.

## 4. E-mail: sign-up codes and forgotten passwords

People reset their own password: **Forgot your password?** on the sign-in page e-mails a link that works once, lasts 30 minutes, and signs the account out everywhere. Admins do not issue passwords.

**On Render (Brevo):**
1. Create a free account at brevo.com. Under **Senders, domains & dedicated IPs**, add and verify the address the e-mails come from.
2. Under **SMTP & API → API keys**, create a key.
3. On Render → the service → **Environment**, add `BREVO_API_KEY` (the key), `MAIL_FROM` (the verified sender) and `APP_URL` (the site address), then save; Render redeploys.
4. Sign up with a new address on the live site and check that the code arrives (look in spam the first time).

**On your own computer (Gmail):**
1. Turn on 2-Step Verification on the Google account, then create an App Password at myaccount.google.com/apppasswords.
2. Set `GMAIL_USER` and `GMAIL_APP_PASSWORD` in the terminal before `npm run dev` (PowerShell: `$env:GMAIL_USER="you@gmail.com"; $env:GMAIL_APP_PASSWORD="abcd efgh ijkl mnop"`).

Keep these values in environment variables only — never in the repository.

## 5. Before going live

- [ ] `npm test` passes. It uses its own `fintrack_stark_test` database and refuses to reset any database whose name does not end in `_test`, so it cannot wipe production data.
- [ ] `npm run backup` works against the production database, and you have tried `npm run restore` on a copy.
- [ ] Update the contact line in the Privacy Policy (`apps/client/src/screens/LegalPages.jsx`) with a real contact for privacy requests, and have the Terms and Privacy Policy reviewed by your adviser.
