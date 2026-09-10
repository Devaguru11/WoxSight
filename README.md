# Meghavi Wellness — Video Analytics Platform

AI-powered wellness center monitoring for Meghavi Wellness Spa, powered by [AccessGenie](https://accessgenie.in). The platform ingests computer-vision inference logs from on-premise cameras, turns them into real-time dashboards and analytics, and delivers automated daily PDF reports by email.

---

## Quick Start

> Run these commands in three separate terminal windows in the exact order shown.

### Terminal 1 — API server
```bash
cd "Meghavi Wellness Deva/server"
cp .env.example .env          # fill in DB credentials and JWT secret
npm install
npm run dev                   # starts on http://localhost:4001
```

### Terminal 2 — React frontend (development)
```bash
cd "Meghavi Wellness Deva/client"
npm install
npm run dev                   # starts on http://localhost:5173
```

Open **http://localhost:5173** in your browser. The Vite dev server proxies all `/api/*` calls to port 4001 automatically — no CORS issues.

### Terminal 3 (optional) — Production build
```bash
cd "Meghavi Wellness Deva/client"
npm run build                 # output in client/dist/
# Then the Express server can serve dist/ as static files
```

### One-command start (if you use PM2 or concurrently)
```bash
# From the repo root
cd "Meghavi Wellness Deva"
cd server && npm install && npm run dev &
cd ../client && npm install && npm run dev
```

### Database first-time setup
```bash
psql -U your_db_user -d aiserver -f server/sql/meghavi_poc.sql
```
The server also auto-creates RBAC tables, audit tables, and frisking bag tables on first start via built-in migrations — no extra SQL needed for those.

---

## Contents

- [Architecture Overview](#architecture-overview)
- [Modules](#modules)
- [Tech Stack](#tech-stack)
- [Repository Layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [Database Setup](#database-setup)
- [Data Sources](#data-sources)
- [Authentication & RBAC](#authentication--rbac)
- [Audit Logs](#audit-logs)
- [Email Reports](#email-reports)
- [API Reference](#api-reference)
- [Deployment](#deployment)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Browser (React SPA)                   │
│   MUI v9 · TanStack Query · React Router · Recharts     │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTPS  /api/*
┌─────────────────────▼───────────────────────────────────┐
│                 Express API  (Node.js)                   │
│  JWT Auth · RBAC · Meghavi analytics · Email reports     │
│  Puppeteer PDF · Nodemailer SMTP · pg Pool · Audit trail │
└──────────┬──────────────────────────┬───────────────────┘
           │                          │
    ┌──────▼──────┐          ┌────────▼────────┐
    │  PostgreSQL  │          │  JSON log files  │
    │  Auth · RBAC │          │  Walk-ins        │
    │  Cameras DB  │          │  Meet & Greet    │
    │  Frisking Bag│          │  Staff Absence   │
    │  Audit logs  │          └─────────────────┘
    └─────────────┘
```

**Dual data source pattern:**
- **PostgreSQL** stores user accounts, roles, page permissions, camera registry, frisking bag events, and audit logs.
- **File-based JSON inference logs** (`Walk-ins/`, `Meet & Greet/`, `Staff Unavailability/`) are read on every API request from the on-premise camera pipeline. No caching — always live.

All times are **IST (Asia/Kolkata, UTC+5:30)**. The DB session is pinned to UTC; conversion happens at the query layer with `AT TIME ZONE 'Asia/Kolkata'`.

---

## Modules

### Walk-ins Analytics
Tracks every customer entry detected by reception cameras. Shows total headcount, average dwell time, peak hours, and a daily trend breakdown. Events can be dismissed (thumbs-down) to exclude false positives.

### Meet & Greet Analytics
Monitors whether arriving customers are greeted by staff within the configured threshold. Reports greet rate, missed greetings, average delay, and daily breakdown by camera.

### Staff Unavailability
Detects periods when the reception desk is unattended. Calculates total absence duration, unavailability percentage, and severity:

| Severity | Absence Duration |
|----------|-----------------|
| Low      | < 3 minutes     |
| Moderate | 3–10 minutes    |
| High     | 10–20 minutes   |
| Critical | > 20 minutes    |

### Customer Waiting Time
Derived from `meet_greet_events.greet_delay_seconds`. Flags customers who waited longer than 10 minutes, with hourly trend, wait-time distribution buckets (< 5 min / 5–10 min / 10–20 min / > 20 min), and per-camera breakdown.

### Frisking Bag Anomaly Detection
Tracks bags left unattended or separated from their owner in sensitive areas. Provides total detections, unique track IDs, confidence distribution, owner-association rate, and a full events table with snapshot/video thumbnails. Events are DB-backed and persisted from the inference pipeline.

### Active Alerts
Unified operational alert feed aggregating events from all modules — staff absence, missed greetings, walk-ins, and frisking bag anomalies. Filterable by category, severity, status, and date range.

### Live View
Connected camera feeds via HLS streams, with per-camera status indicators.

### Reports
Admin-only page to generate and email a full PDF analytics report for any date range, covering all six modules.

### Settings & RBAC
Role-based access control with per-page grants. Admins manage users, roles, and page permissions through the Settings panel. Module-level detector parameters (confidence, thresholds) are stored and published to the on-premise inference host.

### Audit Logs
Full tamper-evident event log tracking every user action — logins, logouts, settings changes, feedback submissions, page views. Searchable/filterable table, per-user timeline, session explorer, and CSV export. Restricted to admin roles.

---

## Tech Stack

### Backend (`server/`)

| Package | Purpose |
|---------|---------|
| Express | HTTP API server |
| `pg` | PostgreSQL driver with mysql2-compat `?` placeholder shim |
| `jsonwebtoken` | JWT access (15 min) + refresh (30 day) tokens |
| `bcrypt` | Password hashing |
| `puppeteer` | Server-side A4 PDF generation for email reports |
| `nodemailer` | Gmail SMTP email delivery |
| `multer` | Inference media upload (snapshot + video) |
| `helmet` | HTTP security headers |
| `ffmpeg-static` / `ffprobe-static` | Video clip processing |
| `dotenv` | Environment configuration |

### Frontend (`client/`)

| Package | Purpose |
|---------|---------|
| React 19 | UI framework |
| TypeScript | Type safety (strict mode, zero errors) |
| Vite | Build tooling + dev proxy |
| MUI v9 | Component library (`slotProps` API) |
| TanStack Query | Server state management & caching |
| React Router 7 | Client-side routing + `RequirePage` guards |
| Recharts | Analytics charts (bar, area, pie) |
| Axios | HTTP client with JWT refresh interceptor |
| hls.js | HLS live stream playback |
| jsPDF | Client-side PDF export |

---

## Repository Layout

```
Meghavi Wellness Deva/
├── client/                          # React SPA
│   ├── public/
│   │   ├── meghavi.png              # Meghavi logo (embedded in PDF reports)
│   │   └── AccessGenieLogo.svg      # AccessGenie brand logo
│   └── src/
│       ├── App.tsx                  # Route definitions + RequirePage guards
│       ├── auth/
│       │   ├── AuthContext.tsx      # Login/logout, JWT refresh, user state
│       │   └── tokenStore.ts        # localStorage/sessionStorage token store
│       ├── components/
│       │   ├── AppShell.tsx         # Sidebar nav (permission-filtered, collapsible)
│       │   ├── AppMasthead.tsx      # Top bar with email report button
│       │   ├── audit/
│       │   │   ├── AuditTrail.tsx   # Event log table with filters + CSV export
│       │   │   └── UserAuditExplorer.tsx  # Per-user timeline, sessions view
│       │   ├── dashboard/meghavi/   # Dashboard KPI cards + trend chart
│       │   └── meghavi/             # Shared inference card + media viewer
│       ├── lib/
│       │   ├── api.ts               # Axios instance + silent refresh interceptor
│       │   ├── meghaviApi.ts        # Typed hooks for all Meghavi endpoints
│       │   ├── auditActions.ts      # Action labels, time formatters, avatar utils
│       │   └── permissions.tsx      # RBAC context + RequirePage guard
│       └── pages/
│           ├── DashboardPage.tsx
│           ├── ActiveAlertsPage.tsx
│           ├── ReportsPage.tsx
│           ├── AuditLogsPage.tsx
│           ├── IntegrationsPage.tsx  # Coming Soon overlay
│           └── analytics/
│               ├── WalkinsAnalyticsPage.tsx
│               ├── MeetGreetPage.tsx
│               ├── StaffUnavailabilityAnalyticsPage.tsx
│               ├── WaitingTimeAnalyticsPage.tsx
│               └── FriskingBagAnalyticsPage.tsx
│
├── server/                          # Express API
│   ├── src/
│   │   ├── index.js                 # Entry point — mounts all routers
│   │   ├── db.js                    # pg Pool with mysql2 SQL shim (? → $N)
│   │   ├── routes/
│   │   │   ├── meghavi.js           # All Meghavi analytics endpoints + file parsers
│   │   │   ├── emailReport.js       # PDF generation, email delivery, daily scheduler
│   │   │   ├── auth.js              # Login, refresh, logout, /me
│   │   │   ├── audit.js             # Audit event log, user roster, timeline, sessions
│   │   │   ├── rbac.js              # User management, page grants
│   │   │   └── settings.js          # System settings (general + module scopes)
│   │   ├── middleware/
│   │   │   ├── requireAuth.js             # JWT access token validation
│   │   │   ├── requireAuthOrInternal.js   # Auth OR INTERNAL_SERVICE_KEY header
│   │   │   ├── requireAuditAdmin.js       # Audit admin role check
│   │   │   └── requirePageAccess.js       # Per-page RBAC enforcement
│   │   └── lib/
│   │       ├── auditService.js      # record(), recordLogin(), event allowlist
│   │       └── pages.js             # PAGES catalogue — RBAC source of truth
│   └── sql/
│       └── meghavi_poc.sql          # Schema + seed data for Meghavi tables
│
├── Walk-ins/                        # Inference JSON logs — walk-in cameras
│   ├── crops/                       # Snapshot images
│   └── inference_log.json
├── Meet & Greet/                    # Inference logs — greet cameras
│   └── inference_log.json
├── Staff Unavailability/            # Absence detection logs + video clips
│   ├── absences-web/
│   ├── absences-28th/
│   └── absences-29th/
└── config/                          # Shared site configuration
```

---

## Prerequisites

- **Node.js** 18+
- **PostgreSQL** 14+
- **Puppeteer** — Chromium is bundled; Linux may need additional system libs (see [Deployment](#deployment))
- A **Gmail account** with an App Password for email reports (Settings → Security → App Passwords)

---

## Environment Variables

Copy `server/.env.example` to `server/.env` and fill in the values.

```env
# ── Server ────────────────────────────────────────────────────────────────────
PORT=4001

# ── PostgreSQL ────────────────────────────────────────────────────────────────
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=aiserver
DB_POOL_MAX=10
DB_SSL=false              # set to "true" for TLS (RDS, Supabase, etc.)

# ── JWT ───────────────────────────────────────────────────────────────────────
JWT_SECRET=change_me_to_a_long_random_string

# ── Internal service key (inference pipeline → ingest endpoints) ──────────────
INTERNAL_SERVICE_KEY=your_internal_key_here

# ── Gmail SMTP ────────────────────────────────────────────────────────────────
# Use an App Password — not your real account password
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   # spaces are stripped automatically

# ── Inference pipeline (legacy AccessGenie modules, optional) ─────────────────
AI_ASSISTANT_URL=http://127.0.0.1:9001
RECEIVER_RESULTS_DIR=/var/receiver-results

# ── Public URL (used in PDF report asset paths) ───────────────────────────────
PUBLIC_SITE_URL=https://your-domain.com
```

> **Never commit `.env` or any credentials file to version control.**

---

## Running Locally

### 1. Install dependencies

```bash
cd "Meghavi Wellness Deva/server" && npm install
cd "Meghavi Wellness Deva/client" && npm install
```

### 2. Configure environment

```bash
cd "Meghavi Wellness Deva/server"
cp .env.example .env
# Edit .env — set DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET at minimum
```

### 3. Start the API server

```bash
cd "Meghavi Wellness Deva/server"
npm run dev        # nodemon hot-reload, recommended for development
# or
npm start          # plain node, for production
```

API is available at **http://localhost:4001**. On startup it:
- Runs DB migrations (creates RBAC, audit, frisking bag tables if missing)
- Starts the camera alert monitor
- Starts the inference ingest scheduler
- Schedules the daily 10:00 AM IST email report

### 4. Start the frontend dev server

```bash
cd "Meghavi Wellness Deva/client"
npm run dev
```

App opens at **http://localhost:5173**. The Vite proxy (`vite.config.ts`) forwards `/api/*` to port 4001 — no separate CORS configuration needed.

### 5. Build for production

```bash
cd "Meghavi Wellness Deva/client"
npm run build     # output → client/dist/
```

Serve `client/dist/` as static files through nginx or Express's `express.static()`.

---

## Database Setup

Run the Meghavi schema on first install:

```bash
psql -U your_db_user -d aiserver -f server/sql/meghavi_poc.sql
```

This creates:

| Table | Purpose |
|-------|---------|
| `meghavi_locations` | Site locations (Gachibowli, Banjara Hills) |
| `meghavi_cameras` | Camera registry with module assignments |
| `meghavi_camera_modules` | Per-camera module config |
| `meghavi_walkin_events` | Walk-in detection records |
| `meghavi_meet_greet_events` | Meet & greet interaction records |
| `meghavi_staff_availability_events` | Staff absence records |

The following tables are **auto-created at server startup** (no SQL file needed):

| Table | Purpose |
|-------|---------|
| `anpr_app_users` | User accounts + roles |
| `user_page_permission` | Per-user page grants |
| `app_setting` | System settings by scope |
| `app_setting_audit` | Settings change history |
| `meghavi_frisking_bag_events` | Frisking bag detection records |
| `meghavi_feedback` | Thumbs-down / confirmed event feedback |
| `audit_events` | Full application audit trail |
| `user_login_events` | Login / logout history |

---

## Data Sources

The analytics engine reads from two sources depending on the module:

### File-based JSON logs (primary for Walk-ins, Meet & Greet, Staff)

| Directory | Log file | Used by |
|-----------|----------|---------|
| `Walk-ins/` | `inference_log.json` | Walk-ins Analytics |
| `Meet & Greet/*/` | `inference_log.json` | Meet & Greet, Waiting Time |
| `Staff Unavailability/` | `inference_log.json` | Staff Unavailability |

Parsed on every request via `fileWalkinsAnalytics()`, `fileMeetGreetAnalytics()`, `fileStaffAnalytics()`, `fileAlerts()` in `meghavi.js`. No caching — always reflects the latest files.

### PostgreSQL (Frisking Bag + supporting data)

Frisking bag events, camera metadata, user accounts, page permissions, and audit logs live in PostgreSQL. The frisking bag sync runs at startup and can also be triggered via `POST /api/meghavi/ingest/frisking-bag/sync`.

### Ingestion endpoints (AI module → backend)

```
POST /api/meghavi/ingest/walkin
POST /api/meghavi/ingest/meet-greet
POST /api/meghavi/ingest/staff-availability
POST /api/meghavi/ingest/frisking-bag
```

Require either a valid JWT **or** the `x-internal-key: <INTERNAL_SERVICE_KEY>` header. Accepts multipart (with `snapshot` and `video` file fields) or JSON.

---

## Authentication & RBAC

### Auth flow

1. `POST /api/auth/login` → returns `accessToken` (15 min JWT) + `refreshToken` (30 day JWT)
2. Client stores tokens in `localStorage`; sends `Authorization: Bearer <accessToken>` on every request
3. On 401, the Axios interceptor silently calls `POST /api/auth/refresh` and retries — no logout flash
4. `POST /api/auth/logout` records the logout in the audit trail
5. `GET /api/auth/me` returns the current user's profile

### Roles

| Role | Access |
|------|--------|
| `admin` / `superadmin` | Full access to all pages including Audit Logs, RBAC, and Settings |
| `manager` | Access to pages explicitly granted by an admin |
| `viewer` | Read-only access to granted pages |

### Page grants

Pages are catalogued in `server/src/lib/pages.js`. Granting a page to a user gives them both the sidebar nav item and the underlying API access.

**Meghavi page keys:**

| Key | Page |
|-----|------|
| `meghavi_dashboard` | Wellness Dashboard |
| `meghavi_walkins` | Walk-ins Analytics |
| `meghavi_meet_greet` | Meet & Greet Analytics |
| `meghavi_staff_unavailability` | Staff Unavailability |
| `meghavi_waiting_time` | Customer Waiting Time |
| `meghavi_frisking_bag` | Frisking Bag Anomaly |
| `meghavi_alerts` | Active Alerts |
| `meghavi_cameras` | Live View / Cameras |
| `meghavi_reports` | Reports (+ email send) |
| `settings` | System Settings |
| `access_control` | Roles & Access |
| `audit_logs` | Audit Logs (admin only) |

RBAC is enforced at two layers:
- **Client** — `<RequirePage>` in `App.tsx` renders an access-denied panel; `AppShell.tsx` filters the sidebar
- **Server** — `requirePageAccess` middleware checks every `/api/meghavi/*` call and returns 403 for missing grants

---

## Audit Logs

Every meaningful user action is recorded to `audit_events` in PostgreSQL.

**What's captured:**
- Login success / failure
- Logout
- Settings changes (before/after state diff)
- Feedback submissions (thumbs-down / confirmed)
- Page views and live stream opens (client-reported)
- RBAC changes (role, page grants)

**Audit admin access:**
The `/audit` page and all `/api/audit/*` endpoints require `isAuditAdmin(role)` — roles containing "admin" (admin, superadmin, super_admin, administrator).

**Audit trail page features:**
- Searchable event table with module, outcome, action, and date filters
- CSV export
- Per-user timeline view with merged login events
- Session explorer (sessions grouped by JWT)
- User roster showing all users even with zero events

---

## Email Reports

### Manual (from the dashboard)
Admin users see an email icon in the top-right masthead. Click to open the send dialog — choose a date range, optionally add extra recipients, and send.

`POST /api/meghavi/email/send`

### Automated daily report
A self-rescheduling `setTimeout` fires every day at **10:00 AM IST (04:30 UTC)**. It builds the previous day's report and emails it to the fixed recipients list in `emailReport.js`.

### Report sections
1. **Executive Summary** — all-modules KPI table
2. **Walk-ins** — KPI cards + busiest hours + daily trend
3. **Meet & Greet** — KPI cards + daily breakdown
4. **Staff Unavailability** — KPI cards + severity breakdown + daily rate
5. **Customer Waiting Time** — KPI cards + distribution + per-camera average
6. **Frisking Bag** — KPI cards + daily detection breakdown
7. **Active Alerts** — KPI cards + by-category + by-hour
8. **Anomalies** — summary + by-type + by-severity

PDF is rendered from full HTML (base64-embedded logos) via Puppeteer A4, then attached to a Gmail SMTP email. No external URLs — fully offline-capable.

**Gmail config:**
```
host: smtp.gmail.com, port: 587, secure: false
App Password with spaces stripped: .replace(/\s+/g, "")
```

---

## API Reference

All routes are prefixed with `/api`. Protected routes require `Authorization: Bearer <accessToken>`.

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | None | Email + password login |
| POST | `/auth/refresh` | None | Exchange refresh token for new access token |
| POST | `/auth/logout` | JWT | Record logout in audit trail |
| GET  | `/auth/me` | JWT | Current user profile |

### Meghavi Analytics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/meghavi/cameras` | JWT | Camera registry |
| GET | `/meghavi/dashboard/summary` | JWT/Internal | KPI summary |
| GET | `/meghavi/analytics/walkins` | JWT | Walk-in analytics (`?from=&to=`) |
| GET | `/meghavi/analytics/meet-greet` | JWT | Meet & greet analytics |
| GET | `/meghavi/analytics/staff-availability` | JWT | Staff unavailability |
| GET | `/meghavi/analytics/waiting-time` | JWT | Customer waiting time |
| GET | `/meghavi/analytics/frisking-bag` | JWT | Frisking bag anomalies |
| GET | `/meghavi/alerts` | JWT | Aggregated alerts feed |
| POST | `/meghavi/feedback` | JWT | Thumbs-down / confirm event |

### Ingestion (internal / AI pipeline)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/meghavi/ingest/walkin` | JWT or Key | Walk-in event (multipart or JSON) |
| POST | `/meghavi/ingest/meet-greet` | JWT or Key | Meet & greet event |
| POST | `/meghavi/ingest/staff-availability` | JWT or Key | Staff absence event |
| POST | `/meghavi/ingest/frisking-bag` | JWT or Key | Frisking bag detection |
| POST | `/meghavi/ingest/frisking-bag/sync` | JWT or Key | Re-sync frisking log files → DB |

### Reports

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/meghavi/email/send` | JWT (admin) | Generate PDF and send by email |

### Audit

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/audit/client-event` | JWT | Report a client-side action |
| GET  | `/audit/events` | JWT (admin) | Paginated event log with filters |
| GET  | `/audit/events/export` | JWT (admin) | CSV download of filtered events |
| GET  | `/audit/facets` | JWT (admin) | Distinct modules, actions, actors |
| GET  | `/audit/users` | JWT (admin) | All users with event counts |
| GET  | `/audit/users/:id/timeline` | JWT (admin) | Merged audit + login timeline |
| GET  | `/audit/users/:id/sessions` | JWT (admin) | Session summary |
| GET  | `/audit/users/:id/export` | JWT (admin) | Per-user CSV export |
| GET  | `/audit/logins` | JWT (admin) | Login event list |

### RBAC

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET  | `/rbac/me` | JWT | Current user's page grants + role |
| GET  | `/rbac/pages` | JWT | Full page catalogue |
| GET  | `/rbac/users` | JWT (admin) | All users |
| POST | `/rbac/users` | JWT (admin) | Create user |
| PUT  | `/rbac/users/:id/pages` | JWT (admin) | Set page grants |
| PUT  | `/rbac/users/:id/role` | JWT (admin) | Change role |
| PUT  | `/rbac/users/:id/status` | JWT (admin) | Enable / disable account |
| PUT  | `/rbac/users/:id/password` | JWT (admin) | Reset password |

### Settings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET  | `/settings` | JWT | All settings by scope |
| PUT  | `/settings/:scope` | JWT | Save a scope (`general`, `walkins`, `waiting_time`, `staff_unavailability`, `cameras`, `notifications`, …) |
| POST | `/settings/publish` | JWT | Re-publish detector config to S3 |
| GET  | `/settings/audit` | JWT | Settings change history |

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | API liveness check |

---

## Deployment

### Reverse proxy (nginx)

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    # Serve React build
    location / {
        root /path/to/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API to Express
    location /api/ {
        proxy_pass http://127.0.0.1:4001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;   # needed for Puppeteer PDF generation
    }

    # Static media served by Express under /api/meghavi/uploads/
    # (already handled by Express — no extra nginx alias needed)
}
```

### Process management (PM2)

```bash
npm install -g pm2

cd "Meghavi Wellness Deva/server"
pm2 start npm --name "meghavi-api" -- start

pm2 save
pm2 startup        # enable on system boot
```

### Puppeteer on Linux (Ubuntu/Debian)

Puppeteer bundles Chromium but needs these system libraries:

```bash
sudo apt-get install -y \
  libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 libgbm1 libasound2
```

---

## Locations

| Location | City | Cameras |
|----------|------|---------|
| Gachibowli Complex | Hyderabad | Reception (walk-ins + meet & greet + staff + frisking) |
| Banjara Hills Villa | Hyderabad | Reception (walk-ins + staff) |

---

*Built and maintained by **Deva** · Powered by [AccessGenie](https://accessgenie.in)*
