# FinTrack Stark

Personal Finance, Bill Reminder, and Payment Tracking Integration System.
SIA capstone project of Group Project Stark.

Live: https://finstrack-stark.onrender.com

## Folder structure

```
SIA/
├── apps/
│   ├── client/                 React web app (Vite), installable as a PWA
│   │   ├── public/             manifest, service worker (sw.js), app icons
│   │   └── src/
│   │       ├── App.jsx         routes and app-wide state (session, data, actions)
│   │       ├── components/     shared UI: Shell, Sidebar, Topbar, BottomNav,
│   │       │                   QuickAdd, dialogs, route guards, error boundary
│   │       ├── screens/        one file per page, named <Page>Screen.jsx
│   │       │   └── dashboard/  UserHome, AdminConsole
│   │       └── lib/            api.js, nav.js (menu), utils.js (dates, money),
│   │                           categories.js, pwa.js (install + service worker)
│   │
│   └── server/                 Express REST API
│       ├── server.js           app setup, middleware, error handler
│       └── src/
│           ├── config/         database connection
│           ├── routes/         URL → controller mapping and role checks
│           ├── controllers/    request handling and business rules
│           ├── models/         Mongoose schemas
│           ├── middleware/     auth, rate limit, security headers
│           ├── services/       sessions, passwords, audit log, notifications
│           └── utils/          date and input validation helpers
│
├── services/
│   └── reminder/               scheduled bill-reminder worker (separate process)
│
├── scripts/                    seed, backup, restore, create-admin
├── tests/                      Playwright tests (functional, integration,
│                               error handling, security, end-to-end, regression)
└── docs/                       deployment guide and appendices
```

How a request flows: `screens/*` call `lib/api.js` → `routes/*` → `controllers/*` → `models/*` (MongoDB).
Bill reminders: once a day, every unpaid bill due within the reminder lead time (3 days by default, a system setting) or overdue raises an alert in its owner's Inbox. The sweep (`apps/server/src/services/reminderSweep.js`) is run by the stand-alone worker in `services/reminder` on a schedule, and by the API itself on the first request of each day, for hosting where only one process runs. The worker never calls the API; both share the database, and each bill is claimed atomically so an alert is never sent twice.

## Roles

| Role | Dashboard | Can do |
|---|---|---|
| User | Home: wallet, spending by category, bills, budgets, recent entries | own bills, budgets, income/expense entries, notes, and their own **My Activity** history |
| Admin | Admin Console: system status, accounts, deactivated accounts, security events this week, failed logins | the system's one Admin (created with `npm run create-admin`): deactivate, reactivate or remove User accounts, system settings, and the security log. Roles are never changed from the app. **No wallet of their own** — finance endpoints refuse an Admin, and the Admin never sees anyone's money or activity |

Income and expense entries count the moment they are recorded. Editing one saves a new version (v1 → v2) and keeps the earlier one in Revision History; deleting one keeps it in the history as "Deleted".

## Accounts: e-mail code, forgotten passwords, deactivation

- **Sign-up with an e-mail code.** `POST /api/auth/register` checks the details and e-mails a 6-digit code; nothing is created yet. `POST /api/auth/register/verify` with the right code creates the account and signs it in. A code lasts 10 minutes and allows 5 tries; `POST /api/auth/register/resend` sends a new one at most once a minute. Only a SHA-256 hash of the code is stored, and an unfinished sign-up is deleted when its code expires.
- **Forgot password.** `POST /api/auth/forgot` e-mails a link to `/reset-password?token=…` (same answer whether or not the address has an account). `POST /api/auth/reset` sets the new password; the link works once, lasts 30 minutes, and signs the account out everywhere. Admins no longer issue temporary passwords.
- **Deactivate / reactivate.** `PUT /api/users/:id/status { active }` (Admin). A deactivated account keeps its data but cannot sign in or reset its password, and its open sessions end at once. Nobody can deactivate themselves or the last active Admin.

E-mail is sent through Gmail (an App Password) or the Brevo HTTPS API — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). With neither configured in development, codes and links are printed in the API's terminal.

## System settings

The Admin manages three system-wide settings from **System Settings** (`/system`, `GET`/`PUT /api/settings`): the bill reminder lead time (1–14 days, default 3), the budget warning level (50–95%, default 80) and the session length (1–24 hours, default 8, for new sign-ins). They are stored in the shared database, so the separate reminder worker uses the same lead time as the API, and every change is written to the audit log as "Settings Changed".

## Audit and integration log

Every important action is written to the audit log with a timestamp, the person, the action, a status (Success or Failed), a detail and the id of the record it concerned. Each line has a scope, so the log has two audiences:

- **My Activity** (`/activity`, `GET /api/activity`, Users): what that person did with their own money and account — entries recorded, edited or deleted, bills added, edited or paid, budgets, profile and password changes, and their own refused actions.
- **Audit Log** (`/audit`, `GET /api/audit-log`, Admin): security and system events only — sign-ups, sign-ins and sign-outs, failed logins, password resets, role changes, deactivation, deletions, settings, refused permissions.

Password changes and resets appear in both. Refused or failed changes are logged as **Failed** with the error message, and either screen can show them.

## Live updates

Signed-in screens hold a Server-Sent Events connection (`GET /api/events`). When something changes for that person — a notification, a bill, an entry — the server pushes a short "changed" message and the screen reloads its data through `GET /api/sync` (one request for everything), so new notifications appear without refreshing.

## Installing it as an app

FinTrack Stark is a progressive web app. On Android or desktop Chrome/Edge, open the site and choose **Install app** (or **Settings → Install the App**). On iPhone, open it in Safari, tap **Share → Add to Home Screen**. The installed app opens in its own window and still opens without a connection; financial data is never cached on the device.

## Running it locally

Requirements: Node.js 20+ and MongoDB running on `127.0.0.1:27017`.

```sh
npm install
npm run seed          # demo data (local only): jp@ / demo123, arvy@ / demo456, admin@ / admin123
npm run dev           # API :4000, web :5173, reminder worker
```

Open http://localhost:5173. Demo accounts (local database only, never on the live site):

| Role | Email | Password |
|---|---|---|
| User | jp@fintrackstark.app | demo123 |
| User | arvy@fintrackstark.app | demo456 |
| Admin | admin@fintrackstark.app | admin123 |

## Other commands

| Command | What it does |
|---|---|
| `npm test` | runs the Playwright suite against its own `fintrack_stark_test` database |
| `npm run build` | builds the web app into `apps/client/dist` |
| `npm start` | serves the API and the built web app on one port |
| `npm run reminder:once` | runs one reminder sweep and exits |
| `npm run backup` / `npm run restore -- <file> --yes` | database backup and restore (without `--yes`, restore only shows which database it would replace) |
| `npm run create-admin` | creates the first Admin on a new database |

Deployment steps are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
