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
Bill reminders: once a day, every unpaid bill due within three days (or overdue) raises an alert in its owner's Inbox. The sweep (`apps/server/src/services/reminderSweep.js`) is run by the stand-alone worker in `services/reminder` on a schedule, and by the API itself on the first request of each day, for hosting where only one process runs. The worker never calls the API; both share the database, and each bill is claimed atomically so an alert is never sent twice.

## Roles

| Role | Dashboard | Can do |
|---|---|---|
| User | Home: wallet, spending by category, bills, budgets, recent entries | own bills, budgets, income/expense entries, receipts, notes |
| Admin | Admin Console: receipts waiting for review, system status, accounts, weekly activity, security | review receipts (verify, reject, request revision), manage accounts, roles, password resets and the audit log. **No wallet of their own** — finance endpoints refuse an Admin |

Income and expense entries count the moment they are recorded. Editing one saves a new version (v1 → v2) and keeps the earlier one in Revision History; deleting one keeps it in the history as "Deleted".

## Receipt review

An entry can carry a receipt: an uploaded photo/PDF (up to 2 MB, stored in MongoDB, type checked by its first bytes) or an https link to Google Drive, OneDrive or Dropbox. Attaching one sets it to **For Review** and notifies every Admin. An Admin verifies it, rejects it, or requests a revision (a note is required for both); the owner is notified and the note is kept on the entry. After a rejection or a revision request the owner attaches **v2**, and the earlier version stays in the history. A verified receipt is final — unless the entry's type, category, amount or date is edited later, which sends it back for review. Only the owner and the Admin can open the file; other Users never can. Because an Admin keeps no wallet, the person who judges evidence never submits any.

API: `POST /api/receipts`, `GET /api/receipts`, `GET /api/receipts/:id/file`, `GET /api/receipts/review` (Admin), `POST /api/receipts/:id/review` (Admin).

## Audit and integration log

Every important action is written to the audit log with a timestamp, the person, the action, a status (Success or Failed), a detail and the id of the record it concerned. Refused or failed changes — a second payment of a paid bill, an invalid upload, a review of a receipt already decided, a reminder sweep that could not run — are logged as **Failed** with the error message, and the Audit Log screen can show them on their own.

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
