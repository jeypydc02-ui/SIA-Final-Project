# FinTrack Stark

Personal Finance, Bill Reminder, and Payment Tracking Integration System.
SIA capstone project of Group Project Stark.

Live: https://sia-final-project.onrender.com

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
│   │       │   └── dashboard/  UserHome, ReviewerDesk, AdminConsole
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
The reminder worker never calls the API; it reads and writes the same database.

## Roles

| Role | Dashboard | Can do |
|---|---|---|
| User | Home: balance, quick actions, bills, spending, budgets | own bills, budgets, income/expense entries, notes |
| Reviewer | Review Desk: queue with approve / revise / reject (+ My Wallet tab) | review other people's entries; read the audit log |
| Admin | Admin Console: system status, users, review pipeline, security (+ My Wallet tab) | everything a Reviewer can, plus manage accounts, roles and password resets |

## Installing it as an app

FinTrack Stark is a progressive web app. On Android or desktop Chrome/Edge, open the site and choose **Install app** (or **Settings → Install the App**). On iPhone, open it in Safari, tap **Share → Add to Home Screen**. The installed app opens in its own window and still opens without a connection; financial data is never cached on the device.

## Running it locally

Requirements: Node.js 20+ and MongoDB running on `127.0.0.1:27017`.

```sh
npm install
npm run seed          # demo data (local only)
npm run dev           # API :4000, web :5173, reminder worker
```

Open http://localhost:5173. Demo accounts (local database only, never on the live site):

| Role | Email | Password |
|---|---|---|
| User | jp@fintrackstark.app | demo123 |
| Reviewer | reviewer@fintrackstark.app | reviewer123 |
| Admin | admin@fintrackstark.app | admin123 |

## Other commands

| Command | What it does |
|---|---|
| `npm test` | runs the Playwright suite against its own `fintrack_stark_test` database |
| `npm run build` | builds the web app into `apps/client/dist` |
| `npm start` | serves the API and the built web app on one port |
| `npm run reminder:once` | runs one reminder sweep and exits |
| `npm run backup` / `npm run restore -- <file>` | database backup and restore |
| `npm run create-admin` | creates the first Admin on a new database |

Deployment steps are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
