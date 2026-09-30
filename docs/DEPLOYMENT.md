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
| `REMINDER_CRON`, `REMINDER_LEAD_DAYS` | Optional. Default `0 8 * * *` and `3`. | When the reminder worker runs, and how far ahead it looks. |

Do **not** set `RATE_LIMIT_LOGIN_MAX` or `RATE_LIMIT_REGISTER_MAX` in production. They exist so the test suite can log in many times.

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
npm run reminder                   # the reminder worker, as a second long-running process
```

Everyone else signs up through the app as a User. The Admin promotes Reviewers from User & Role Management.

## 4. Forgotten passwords

The system has no email service, so password reset goes through an Admin: **User & Role Management → Reset Password** issues a one-time temporary password, signs the person out everywhere, and makes them choose a new password at their next login. Confirm that the request really comes from the account owner before resetting.

## 5. Before going live

- [ ] `npm test` passes. It uses its own `fintrack_stark_test` database and refuses to reset any database whose name does not end in `_test`, so it cannot wipe production data.
- [ ] `npm run backup` works against the production database, and you have tried `npm run restore` on a copy.
- [ ] Update the contact line in the Privacy Policy (`apps/client/src/screens/LegalPages.jsx`) with a real contact for privacy requests, and have the Terms and Privacy Policy reviewed by your adviser.
