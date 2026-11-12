
# WoxSight — Campus Video Analytics Platform

AI-powered campus monitoring built for **Woxsen University**, on the [AccessGenie](https://accessgenie.in) stack. The platform ingests computer-vision inference logs streamed from on-premise cameras, turns them into real-time dashboards and analytics, and delivers automated daily PDF briefings by email.

---

## What It Does

WoxSight connects to a fleet of IP cameras on campus and provides:

- **Real-time dashboard** — live KPI tiles for footfall, crowd density, alert counts, and staff presence updated every 30 s
- **Campus footfall analytics** — hourly walk-in trends at every campus entrance, with day-over-day comparison
- **Reception engagement** — greeted vs missed visitor tracking at the front desk
- **Faculty / staff presence** — absence heatmaps and coverage timelines by department
- **Visitor waiting time** — queue length and dwell-time analysis in reception
- **Security screening** — bag anomaly events flagged by the on-prem detector
- **Crowd gathering alerts** — density threshold breaches with severity levels (alarm / critical)
- **After-hours intrusion** — movement detected outside scheduled operating hours
- **Live camera view** — HLS streams from all registered cameras with online/offline status
- **Active alerts** — real-time feed of crowd and security events
- **Daily briefing PDF** — auto-generated report emailed every morning with the previous day's highlights
- **Role-based access control** — page-level permissions with an admin UI for managing users and roles

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     Browser (React SPA)                      │
│    MUI v9 · TanStack Query v5 · React Router v7 · Recharts   │
└──────────────────────┬───────────────────────────────────────┘
                       │  HTTPS  /api/*
┌──────────────────────▼───────────────────────────────────────┐
│                  Express API  (Node.js)                       │
│  JWT Auth · Page-level RBAC · Campus analytics endpoints     │
│  Puppeteer PDF · Nodemailer SMTP · pg Pool · Audit trail      │
└──────────┬────────────────────────────┬──────────────────────┘
           │                            │
   ┌───────▼────────┐         ┌─────────▼──────────┐
   │   PostgreSQL    │         │  JSON inference     │
   │  Users · RBAC  │         │  logs (file-based)  │
   │  Camera registry│         │  Walk-ins           │
   │  Security events│         │  Crowd / alerts     │
   │  Audit logs     │         │  Staff presence     │
   └────────────────┘         └────────────────────┘
                                        ▲
                               ┌────────┴────────┐
                               │  On-prem OMEN   │
                               │  camera host    │
                               │  (CV inference  │
                               │   + S3 sync)    │
                               └─────────────────┘
```

**Dual data-source pattern:**

| Source | What it stores |
|--------|----------------|
| **PostgreSQL** | User accounts, roles, page permissions, camera registry, frisking/security events, audit logs |
| **File-based JSON logs** | CV inference output (walk-ins, crowd events, staff presence, after-hours detections) — read fresh on every API request |

Inference media (snapshots and video clips) is stored in **AWS S3** (`ap-south-1`) and served via pre-signed URLs. Configuration changes made in the UI are published to S3 for the on-prem detector to poll — see [`server/INFERENCE_CONFIG_CONTRACT.md`](server/INFERENCE_CONFIG_CONTRACT.md) for the protocol.

All times are stored and displayed in **IST (Asia/Kolkata, UTC+5:30)**.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 19, TypeScript, Vite |
| UI components | MUI (Material UI) v9 |
| Data fetching | TanStack Query v5 |
| Routing | React Router v7 |
| Charts | Recharts |
| Maps | Leaflet + MapLibre GL |
| Video streaming | hls.js |
| Client-side PDF | jsPDF + jspdf-autotable |
| Font | Poppins (via @fontsource) |
| Backend runtime | Node.js, Express 4 |
| Database | PostgreSQL (`pg`) |
| Auth | JWT + bcrypt |
| Security | Helmet, express-rate-limit |
| Server-side PDF | Puppeteer |
| Email | Nodemailer (SMTP / Gmail) |
| Object storage | AWS S3 (SDK v3) |
| Video processing | ffmpeg-static + ffprobe-static |
| Date/time | Day.js |
| Validation | Zod |

---

## Quick Start

> Run these commands in two separate terminal windows.

### Prerequisites

- Node.js ≥ 20
- PostgreSQL ≥ 14
- An `.env` file in `server/` (see [Environment Variables](#environment-variables))

### Terminal 1 — API server

```bash
cd server
cp .env.example .env          # fill in DB credentials, JWT secret, SMTP, S3 keys
npm install
npm run dev                   # starts on http://localhost:4001
```

### Terminal 2 — React frontend

```bash
cd client
npm install
npm run dev                   # starts on http://localhost:5173
```

Open **http://localhost:5173** in your browser. The Vite dev server proxies all `/api/*` requests to port 4001 automatically.

### Database — first-time setup

```bash
# Create the main schema (cameras, security events, etc.)
psql -U your_db_user -d aiserver -f server/sql/meghavi_poc.sql

# (Optional) seed staff video references for the Staff page
psql -U your_db_user -d aiserver -f server/sql/meghavi_staff_videos_seed.sql
```

The server auto-creates RBAC tables, audit log tables, and default roles on first start — no additional SQL needed for those.

---

## Repository Layout

```
Industry Track/
├── client/                              # React 19 SPA (Vite + TypeScript)
│   ├── public/
│   │   └── brand/                       # Woxsen logo and brand assets
│   └── src/
│       ├── auth/
│       │   └── AuthContext.tsx          # JWT auth state + hooks
│       ├── components/
│       │   ├── dashboard/meghavi/       # Dashboard KPI cards, trend chart, live overview
│       │   └── login/                   # Login page components + theme
│       ├── lib/
│       │   ├── dsTokens.ts              # WoxSight design-system colour/spacing tokens
│       │   ├── meghaviApi.ts            # Typed TanStack Query hooks for every endpoint
│       │   ├── operationalReportPdf.ts  # Client-side daily briefing PDF builder
│       │   └── permissions.tsx          # RBAC gate component + hook
│       ├── pages/                       # Route-level page components
│       │   ├── analytics/
│       │   │   ├── WalkinsAnalyticsPage.tsx     # Campus footfall deep-dive
│       │   │   ├── CrowdGatheringPage.tsx        # Crowd density events
│       │   │   └── AfterHoursPage.tsx            # After-hours intrusion events
│       │   ├── DashboardPage.tsx        # Main landing dashboard
│       │   ├── LiveViewPage.tsx         # HLS camera grid
│       │   ├── ActiveAlertsPage.tsx     # Real-time alerts feed
│       │   ├── ReportsPage.tsx          # PDF report download + email dispatch
│       │   ├── StaffPage.tsx            # Staff presence + video evidence
│       │   ├── SettingsPage.tsx         # Admin: cameras, RBAC, inference config
│       │   ├── AuditLogsPage.tsx        # System audit trail
│       │   └── KnownFacesPage.tsx       # Registered face library
│       └── theme.ts                     # MUI theme (coral #EE4860 + charcoal #414042)
│
├── server/                              # Node.js / Express API
│   ├── src/
│   │   ├── routes/
│   │   │   ├── meghavi.js               # All campus analytics endpoints + JSON parsers
│   │   │   ├── emailReport.js           # Puppeteer PDF generation + email dispatch
│   │   │   └── auth.js                  # JWT login + user management
│   │   ├── cameras.js                   # Camera registry helpers
│   │   ├── initDb.js                    # Auto-migrations on first boot
│   │   ├── domain.js                    # Site domain / tenant config
│   │   └── lib/
│   │       └── pages.js                 # RBAC page catalogue
│   ├── sql/                             # Schema files and dev seeds
│   └── INFERENCE_CONFIG_CONTRACT.md     # Protocol for pushing config to on-prem host
│
├── inference-data/                      # Live JSON log files from on-prem cameras
│   ├── walkins/                         # Entrance footfall logs
│   ├── overcrowding/                    # Crowd density event logs
│   └── after_hours/                     # After-hours detection logs
│
└── config/
    ├── en.lang.json                     # Brand strings, UI labels, page titles
    └── site.config.json                 # Site settings (timezone, camera IDs, thresholds)
```

---

## Environment Variables

Copy `server/.env.example` to `server/.env` and fill in the values below. A `client/.env.example` is also provided for any frontend-specific overrides.

### Server (`server/.env`)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/aiserver`) |
| `JWT_SECRET` | Random secret for signing JWT tokens |
| `GMAIL_USER` | SMTP sender email address |
| `GMAIL_APP_PASSWORD` | Gmail app password (not your account password) |
| `AWS_ACCESS_KEY_ID` | AWS credentials for S3 inference media bucket |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `AWS_REGION` | S3 bucket region (default `ap-south-1`) |
| `S3_BUCKET` | S3 bucket name for inference snapshots and video clips |
| `PORT` | API server port (default `4001`) |
| `INFERENCE_DATA_DIR` | Absolute path to the `inference-data/` folder on the server |

---

## Authentication & RBAC

- **JWT-based login** — tokens issued on `/api/auth/login`, required on all protected routes as a `Bearer` header.
- **Demo / mock mode** — if the DB is unavailable, a mock-credential fallback lets you explore the UI without a live database.
- **Page-level RBAC** — every page (e.g. `meghavi_dashboard`, `meghavi_walkins`) maps to a set of API route prefixes. Access is checked on both the frontend (route guard) and the backend (middleware).
- **Role seeding** — default roles (`admin`, `viewer`) and page permissions are created automatically on first boot via `initDb.js`.
- **Admin UI** — the Settings page includes a full RBAC panel where admins can create users, assign roles, and toggle page-level permissions without touching the database directly.

---

## Inference Data Contract

WoxSight is a **read-only consumer** of CV inference output. The on-prem OMEN host runs the actual detectors, writes JSON log files, and optionally syncs media to S3. The web server reads those JSON files directly from `inference-data/` on every API request — there is no queue or push mechanism from the camera host to the API server.

Configuration changes (loitering threshold, after-hours schedule, confidence floors, ROI) are published to a versioned JSON document in S3 that the on-prem host is expected to poll. See [`server/INFERENCE_CONFIG_CONTRACT.md`](server/INFERENCE_CONFIG_CONTRACT.md) for the full protocol.

---

## Branding

| Property | Value |
|----------|-------|
| Product name | **WoxSight** |
| Organisation | Woxsen University |
| Primary colour | `#EE4860` (coral red) |
| Secondary colour | `#414042` (charcoal) |
| Font | Poppins |
| Logo | `client/public/brand/woxsen-logo.png` |

> **Note on internal naming:** Database tables (`meghavi_*`) and API paths (`/api/meghavi/*`) retain their original identifiers to avoid a database migration — these are internal only and not user-visible.

---

## Production Build

```bash
# Build the React SPA
cd client && npm run build      # outputs to client/dist/

# Serve the API + static files
cd server && npm start          # NODE_ENV=production
```

Point a reverse proxy (nginx / Caddy) at port 4001 and serve `client/dist/` as static files, or configure Express to serve them from `../client/dist`.

---

## Screenshots

> _Run the app locally and add dashboard screenshots here._

---

## License

Private — Woxsen University / AccessGenie internal deployment. Not for public redistribution.
