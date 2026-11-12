"use strict";

const express     = require("express");
const nodemailer  = require("nodemailer");
const puppeteer   = require("puppeteer");
const fs          = require("fs");
const path        = require("path");
const { requireAuth } = require("../middleware/requireAuth");
const { pool } = require("../db");
const {
  fileWalkinsAnalytics,
  fileMeetGreetAnalytics,
  fileStaffAnalytics,
  fileAlerts,
  getDismissed,
} = require("./meghavi");

const router = express.Router();

const FIXED_RECIPIENTS = ["nvdevagurus@gmail.com"];

// ─── logo assets (loaded once at startup, embedded as data URIs) ─────────────

const PUBLIC_DIR = path.resolve(__dirname, "..", "..", "..", "client", "public");

function loadBase64(filePath, mime) {
  try {
    return `data:${mime};base64,${fs.readFileSync(filePath).toString("base64")}`;
  } catch { return null; }
}

const MEGHAVI_LOGO_URI     = loadBase64(path.join(PUBLIC_DIR, "brand", "woxsen-logo.png"), "image/png");
const ACCESSGENIE_LOGO_URI = loadBase64(path.join(PUBLIC_DIR, "brand", "woxsen-logo.png"), "image/png");

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtDuration(secs) {
  if (!secs) return "—";
  const m = Math.floor(secs / 60), s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtDurationLong(secs) {
  if (!secs) return "0 seconds";
  const m = Math.floor(secs / 60), s = secs % 60;
  const mStr = m > 0 ? `${m} minute${m !== 1 ? "s" : ""}` : "";
  const sStr = s > 0 ? `${s} second${s !== 1 ? "s" : ""}` : "";
  return [mStr, sStr].filter(Boolean).join(" and ");
}

function fmtIST(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function mailer() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.GMAIL_USER,
      pass: (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, ""),
    },
  });
}

// ─── Anomaly helpers ──────────────────────────────────────────────────────────

const DWELL_ANOMALY_THRESHOLD_S = 120;
const GROUP_ANOMALY_THRESHOLD   = 3;
const ACTIVE_WINDOW_MS          = 2 * 3600 * 1000;

function staffSeverity(secs) {
  if (secs >= 1200) return "Critical";
  if (secs >= 600)  return "High";
  if (secs >= 180)  return "Moderate";
  return "Low";
}

function eventStatus(occurredAt) {
  return Date.now() - new Date(occurredAt).getTime() < ACTIVE_WINDOW_MS ? "Active" : "Resolved";
}

function buildAnomalies(walkins, meetGreet, staff) {
  const items = [];

  for (const e of (staff.events || [])) {
    const secs = e.absent_duration_seconds || 0;
    items.push({
      occurred_at: e.detected_at,
      location:    e.location_name || e.location || "—",
      camera:      e.camera_name   || "—",
      alert_type:  "Staff Unavailability",
      description: `Reception desk was unattended for ${fmtDurationLong(secs)}.`,
      severity:    staffSeverity(secs),
      status:      eventStatus(e.detected_at),
    });
  }

  for (const e of (meetGreet.events || [])) {
    if (e.greeted) continue;
    const secs    = e.duration_seconds || 0;
    const durPart = secs > 0 ? ` The interaction window lasted ${fmtDurationLong(secs)}.` : "";
    items.push({
      occurred_at: e.detected_at,
      location:    e.location_name || "—",
      camera:      e.camera_name   || "—",
      alert_type:  "Meet & Greet Violation",
      description: `Customer arrived at the reception area but was not greeted within the configured threshold.${durPart}`,
      severity:    "Moderate",
      status:      eventStatus(e.detected_at),
    });
  }

  for (const e of (walkins.events || [])) {
    const dwell = e.dwell_seconds || 0;
    const count = e.person_count  || 1;
    if (dwell > DWELL_ANOMALY_THRESHOLD_S) {
      items.push({
        occurred_at: e.detected_at,
        location:    e.location_name || "—",
        camera:      e.camera_name   || "—",
        alert_type:  "Excessive Waiting Time",
        description: `Customer waiting time exceeded the configured threshold. Customer was present for ${fmtDurationLong(dwell)} before being attended to.`,
        severity:    dwell >= 600 ? "High" : "Moderate",
        status:      eventStatus(e.detected_at),
      });
    } else if (count > GROUP_ANOMALY_THRESHOLD) {
      items.push({
        occurred_at: e.detected_at,
        location:    e.location_name || "—",
        camera:      e.camera_name   || "—",
        alert_type:  "Walk-in Anomaly",
        description: `Unusually large group detected — ${count} customers entered simultaneously. Additional staffing attention may be required.`,
        severity:    "Low",
        status:      eventStatus(e.detected_at),
      });
    }
  }

  return items.sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
}

const ANOMALY_ORDER = [
  "Staff Unavailability",
  "Meet & Greet Violation",
  "Excessive Waiting Time",
  "Walk-in Anomaly",
  "Camera Offline",
  "Other Operational Alert",
];

function sevBadge(s) {
  const styles = {
    Critical: "background:#fde8e8;color:#991b1b;",
    High:     "background:#fee2e2;color:#dc2626;",
    Moderate: "background:#fef3c7;color:#d97706;",
    Low:      "background:#f0fdf4;color:#16a34a;",
  };
  return `<span class="badge" style="${styles[s] || ""}">${s}</span>`;
}

// ─── DB queries for PDF-only data (no file-based equivalent) ────────────────

async function dbWaitingTimeAnalytics(from, to) {
  try {
    const [[tot]] = await pool.query(
      `SELECT
         ROUND(AVG(e.greet_delay_seconds))                          AS avg_wait,
         MAX(e.greet_delay_seconds)                                 AS max_wait,
         COUNT(*)                                                   AS customers_served,
         COUNT(*) FILTER (WHERE e.greet_delay_seconds > 600)       AS long_waits
       FROM meghavi_meet_greet_events e
       WHERE e.greet_delay_seconds IS NOT NULL
         AND e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'`,
      [from, to]
    );
    const [dist] = await pool.query(
      `SELECT
         CASE WHEN greet_delay_seconds < 300  THEN '< 5 min'
              WHEN greet_delay_seconds < 600  THEN '5–10 min'
              WHEN greet_delay_seconds < 1200 THEN '10–20 min'
              ELSE '> 20 min' END AS range,
         COUNT(*) AS count
       FROM meghavi_meet_greet_events
       WHERE greet_delay_seconds IS NOT NULL
         AND detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
       GROUP BY 1 ORDER BY 1`,
      [from, to]
    );
    const [byCam] = await pool.query(
      `SELECT c.display_name AS location, ROUND(AVG(e.greet_delay_seconds)) AS avg_wait_seconds
       FROM meghavi_meet_greet_events e
       JOIN meghavi_cameras c ON c.id = e.camera_id
       WHERE e.greet_delay_seconds IS NOT NULL
         AND e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
       GROUP BY c.id, c.display_name ORDER BY avg_wait_seconds DESC LIMIT 10`,
      [from, to]
    );
    return {
      avg_wait_seconds:  tot?.avg_wait != null ? Number(tot.avg_wait) : null,
      max_wait_seconds:  tot?.max_wait != null ? Number(tot.max_wait) : null,
      customers_served:  Number(tot?.customers_served) || 0,
      long_waits:        Number(tot?.long_waits)       || 0,
      distribution:      dist.map(r => ({ range: r.range, count: Number(r.count) })),
      by_camera:         byCam.map(r => ({ location: r.location, avg_wait_seconds: Number(r.avg_wait_seconds) })),
    };
  } catch (e) {
    console.error("[email-report] waiting-time query:", e.message);
    return { avg_wait_seconds: null, max_wait_seconds: null, customers_served: 0, long_waits: 0, distribution: [], by_camera: [] };
  }
}

async function dbFriskingBagAnalytics(from, to) {
  try {
    const [[tot]] = await pool.query(
      `SELECT
         COUNT(*)                              AS total_detections,
         COUNT(DISTINCT e.track_id)           AS unique_track_ids,
         ROUND(AVG(e.confidence)::numeric, 2) AS avg_confidence,
         COUNT(e.owner_id)                    AS with_owner
       FROM meghavi_frisking_bag_events e
       WHERE e.saved_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND e.saved_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'`,
      [from, to]
    );
    const [byDay] = await pool.query(
      `SELECT to_char(e.saved_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day,
              COUNT(*) AS detections,
              COUNT(e.owner_id) AS with_owner
       FROM meghavi_frisking_bag_events e
       WHERE e.saved_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND e.saved_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
       GROUP BY 1 ORDER BY 1`,
      [from, to]
    );
    const total     = Number(tot?.total_detections) || 0;
    const withOwner = Number(tot?.with_owner)       || 0;
    return {
      total_detections:       total,
      unique_track_ids:       Number(tot?.unique_track_ids) || 0,
      avg_confidence:         tot?.avg_confidence != null ? Number(tot.avg_confidence) : null,
      owner_association_rate: total > 0 ? Math.round(100 * withOwner / total) : 0,
      by_day: byDay.map(r => ({ day: r.day, detections: Number(r.detections), with_owner: Number(r.with_owner) })),
    };
  } catch (e) {
    console.error("[email-report] frisking-bag query:", e.message);
    return { total_detections: 0, unique_track_ids: 0, avg_confidence: null, owner_association_rate: 0, by_day: [] };
  }
}

// ─── PDF generation ───────────────────────────────────────────────────────────

function buildHtml(from, to, walkins, meetGreet, staff, alerts, waitingTime = {}, friskingBag = {}) {
  const dateLabel = from === to ? from : `${from} to ${to}`;
  const generated = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const anomalies = buildAnomalies(walkins, meetGreet, staff);

  // Derived values — unchanged
  const greetRate     = meetGreet.greet_rate_pct != null ? meetGreet.greet_rate_pct.toFixed(1) + "%" : "—";
  const unavailPct    = staff.unavailability_pct  != null ? staff.unavailability_pct.toFixed(1)  + "%" : "—";
  const totalAbsentS  = staff.events.reduce((s, e) => s + (e.absent_duration_seconds || 0), 0);
  const highAnomCount = anomalies.filter(a => a.severity === "High" || a.severity === "Critical").length;

  const sevCount = { Low: 0, Moderate: 0, High: 0, Critical: 0 };
  for (const e of (staff.events || [])) {
    sevCount[staffSeverity(e.absent_duration_seconds || 0)]++;
  }

  const alertCatRows = alerts.breakdown.length
    ? alerts.breakdown.map(b =>
        `<tr><td>${b.category.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</td><td class="r">${b.count}</td><td class="r">${b.percentage}%</td></tr>`
      ).join("")
    : `<tr><td colspan="3" class="nodata">No alerts in this period</td></tr>`;

  const topHours = [...(walkins.hourly_trend || [])]
    .sort((a, b) => b.walkins - a.walkins)
    .slice(0, 8)
    .sort((a, b) => a.hour.localeCompare(b.hour));

  const anomByType = {};
  for (const a of anomalies) anomByType[a.alert_type] = (anomByType[a.alert_type] || 0) + 1;

  function noData(cols) {
    return `<tr><td colspan="${cols}" class="nodata">No data</td></tr>`;
  }

  const meghaviLogoHtml = MEGHAVI_LOGO_URI
    ? `<img src="${MEGHAVI_LOGO_URI}" alt="Woxsen University" style="height:44px;width:auto;object-fit:contain;display:block"/>`
    : "";
  const agLogoHtml = ACCESSGENIE_LOGO_URI
    ? `<img src="${ACCESSGENIE_LOGO_URI}" alt="Woxsen University" style="height:28px;width:auto;object-fit:contain;display:block"/>`
    : `<span style="font-weight:700;color:#EE4860;font-size:12px">WoxSight</span>`;
  const agFooterHtml = ACCESSGENIE_LOGO_URI
    ? `<img src="${ACCESSGENIE_LOGO_URI}" alt="Woxsen University" style="height:15px;width:auto;opacity:0.5;vertical-align:middle"/>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<style>
/* ── Reset ─────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 210mm; }
body {
  font-family: 'Segoe UI', Arial, sans-serif;
  font-size: 11.5px;
  color: #1e293b;
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ── Page shell ─────────────────────────────────────────────────────── */
.page { padding: 28px 36px 32px; }

/* ── Report header ──────────────────────────────────────────────────── */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 3px solid #EE4860;
  padding-bottom: 14px;
  margin-bottom: 20px;
}
.header-left  { display: flex; align-items: center; gap: 12px; }
.header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
.brand        { font-size: 18px; font-weight: 800; color: #EE4860; letter-spacing: -0.3px; line-height: 1.2; }
.brand-sub    { font-size: 10.5px; color: #6B6B6E; margin-top: 2px; }
.meta         { font-size: 10.5px; color: #64748b; line-height: 1.65; text-align: right; }
.meta strong  { display: block; color: #EE4860; font-size: 12px; font-weight: 700; }

/* ── Sections ───────────────────────────────────────────────────────── */
.section {
  margin-bottom: 28px;
  break-inside: avoid-page;
  page-break-inside: avoid;
}
.section-title {
  font-size: 10.5px;
  font-weight: 800;
  color: #EE4860;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border-left: 3px solid #EE4860;
  padding: 1px 0 1px 9px;
  margin-bottom: 14px;
  break-after: avoid;
  page-break-after: avoid;
}
.divider {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 22px 0;
}

/* ── Executive summary cards ────────────────────────────────────────── */
.exec-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}
.exec-card {
  border-radius: 7px;
  padding: 14px 16px 12px;
  border: 1px solid #dbeafe;
  background: #f0f7fa;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.exec-card.warn   { background: #fef9ec; border-color: #fde68a; }
.exec-card.danger { background: #fff1f1; border-color: #fecaca; }
.exec-card.ok     { background: #f0fdf4; border-color: #bbf7d0; }
.exec-num {
  font-size: 28px;
  font-weight: 800;
  color: #EE4860;
  line-height: 1;
  letter-spacing: -0.5px;
}
.exec-num.warn   { color: #d97706; }
.exec-num.danger { color: #dc2626; }
.exec-num.ok     { color: #16a34a; }
.exec-lbl {
  font-size: 9px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin-top: 7px;
  line-height: 1.35;
}

/* ── KPI card rows ──────────────────────────────────────────────────── */
.kpi-grid   { display: grid; gap: 10px; margin-bottom: 16px; }
.kpi-grid-4 { grid-template-columns: repeat(4, 1fr); }
.kpi-grid-3 { grid-template-columns: repeat(3, 1fr); }
.kpi-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 13px 15px 11px;
  display: flex;
  flex-direction: column;
}
.kpi-card .v {
  font-size: 20px;
  font-weight: 800;
  color: #EE4860;
  line-height: 1.1;
  letter-spacing: -0.3px;
  word-break: break-word;
  min-height: 24px;
}
.kpi-card .l {
  font-size: 9px;
  color: #64748b;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-top: 6px;
  line-height: 1.35;
}

/* ── Two-column layout ──────────────────────────────────────────────── */
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: start;
}
.col-label {
  font-size: 9px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin-bottom: 6px;
}

/* ── Tables ─────────────────────────────────────────────────────────── */
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10.5px;
  table-layout: fixed;
}
colgroup col { /* per-table overrides via style="" */ }
th {
  background: #EE4860;
  color: #fff;
  padding: 8px 10px;
  text-align: left;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  border: 1px solid #0a4257;
  line-height: 1.3;
  white-space: nowrap;
}
th.r { text-align: right; }
td {
  padding: 7px 10px;
  border: 1px solid #e2e8f0;
  vertical-align: middle;
  line-height: 1.35;
}
td.r     { text-align: right; }
td.nodata { text-align: center; color: #94a3b8; padding: 10px; }
tr:nth-child(even) td { background: #f8fafc; }

/* ── Summary table column widths ────────────────────────────────────── */
.summary-table col.c1 { width: 20%; }
.summary-table col.c2 { width: 30%; }
.summary-table col.c3 { width: 33%; }
.summary-table col.c4 { width: 17%; }

/* ── Badges (severity) ──────────────────────────────────────────────── */
.badge {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 9.5px;
  font-weight: 700;
  vertical-align: middle;
  white-space: nowrap;
}

/* ── Footer ─────────────────────────────────────────────────────────── */
.footer {
  margin-top: 28px;
  padding-top: 14px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 9.5px;
  color: #94a3b8;
}

/* ── Print / Puppeteer ──────────────────────────────────────────────── */
@media print {
  .section   { break-inside: avoid-page; }
  .kpi-grid  { break-inside: avoid; }
  .two-col   { break-inside: avoid; }
  .divider   { break-after: avoid; }
  .section-title { break-after: avoid; }
}
</style>
</head>
<body>
<div class="page">

<!-- HEADER -->
<div class="header">
  <div class="header-left">
    ${meghaviLogoHtml}
    <div>
      <div class="brand">WOXSIGHT — WOXSEN UNIVERSITY</div>
      <div class="brand-sub">Campus Video Analytics Report</div>
    </div>
  </div>
  <div class="header-right">
    ${agLogoHtml}
    <div class="meta">
      <strong>Report Period: ${dateLabel}</strong>
      Generated: ${generated} IST
    </div>
  </div>
</div>

<!-- EXECUTIVE SUMMARY -->
<div class="section">
  <div class="section-title">Executive Summary</div>

  <div class="exec-bar">
    <div class="exec-card">
      <div class="exec-num">${walkins.total}</div>
      <div class="exec-lbl">Total Walk-ins</div>
    </div>
    <div class="exec-card ${meetGreet.ungreeted > 0 ? "warn" : "ok"}">
      <div class="exec-num ${meetGreet.ungreeted > 0 ? "warn" : "ok"}">${greetRate}</div>
      <div class="exec-lbl">Greet Rate</div>
    </div>
    <div class="exec-card ${totalAbsentS > 0 ? "warn" : "ok"}">
      <div class="exec-num ${totalAbsentS > 0 ? "warn" : "ok"}">${unavailPct}</div>
      <div class="exec-lbl">Staff Unavailability</div>
    </div>
    <div class="exec-card ${highAnomCount > 0 ? "danger" : anomalies.length > 0 ? "warn" : "ok"}">
      <div class="exec-num ${highAnomCount > 0 ? "danger" : anomalies.length > 0 ? "warn" : "ok"}">${anomalies.length}</div>
      <div class="exec-lbl">Anomalies Detected</div>
    </div>
  </div>

  <table class="summary-table">
    <colgroup>
      <col class="c1"/><col class="c2"/><col class="c3"/><col class="c4"/>
    </colgroup>
    <thead>
      <tr><th>Module</th><th>Key Figure</th><th>Secondary</th><th>Status</th></tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Walk-ins</strong></td>
        <td>${walkins.total} people detected</td>
        <td>Peak: ${walkins.peak_hour || "—"}&nbsp;&middot;&nbsp;Avg dwell: ${walkins.avg_dwell_seconds ? fmtDuration(walkins.avg_dwell_seconds) : "—"}</td>
        <td>${walkins.total > 0 ? '<span style="color:#16a34a;font-weight:700">Active</span>' : "—"}</td>
      </tr>
      <tr>
        <td><strong>Meet &amp; Greet</strong></td>
        <td>${meetGreet.total_arrivals} arrivals&nbsp;&middot;&nbsp;${meetGreet.greeted} greeted</td>
        <td>${meetGreet.ungreeted} missed&nbsp;&middot;&nbsp;Greet rate: ${greetRate}</td>
        <td>${meetGreet.ungreeted > 0
          ? `<span style="color:#d97706;font-weight:700">${meetGreet.ungreeted} Missed</span>`
          : '<span style="color:#16a34a;font-weight:700">All Greeted</span>'}</td>
      </tr>
      <tr>
        <td><strong>Staff Unavailability</strong></td>
        <td>${staff.events.length} absence event${staff.events.length !== 1 ? "s" : ""}</td>
        <td>Downtime: ${fmtDuration(totalAbsentS)}&nbsp;&middot;&nbsp;${unavailPct} unavailability</td>
        <td>${staff.events.length > 0
          ? '<span style="color:#d97706;font-weight:700">Requires Attention</span>'
          : '<span style="color:#16a34a;font-weight:700">No Issues</span>'}</td>
      </tr>
      <tr>
        <td><strong>Anomalies &amp; Alerts</strong></td>
        <td>${anomalies.length} anomal${anomalies.length !== 1 ? "ies" : "y"} detected</td>
        <td>${highAnomCount} high/critical&nbsp;&middot;&nbsp;${alerts.events.length} alert events</td>
        <td>${highAnomCount > 0
          ? `<span style="color:#dc2626;font-weight:700">${highAnomCount} High/Critical</span>`
          : anomalies.length > 0
          ? '<span style="color:#d97706;font-weight:700">Review Recommended</span>'
          : '<span style="color:#16a34a;font-weight:700">All Clear</span>'}</td>
      </tr>
      <tr>
        <td><strong>Waiting Time</strong></td>
        <td>${waitingTime.customers_served} customers served</td>
        <td>Avg: ${waitingTime.avg_wait_seconds != null ? fmtDuration(waitingTime.avg_wait_seconds) : "—"}&nbsp;&middot;&nbsp;Long waits (&gt;10 min): ${waitingTime.long_waits}</td>
        <td>${waitingTime.long_waits > 0
          ? `<span style="color:#d97706;font-weight:700">${waitingTime.long_waits} Long Wait${waitingTime.long_waits !== 1 ? "s" : ""}</span>`
          : waitingTime.customers_served > 0
          ? '<span style="color:#16a34a;font-weight:700">All Within Threshold</span>'
          : "—"}</td>
      </tr>
      <tr>
        <td><strong>Frisking Bag</strong></td>
        <td>${friskingBag.total_detections} detection${friskingBag.total_detections !== 1 ? "s" : ""}</td>
        <td>${friskingBag.unique_track_ids} unique objects&nbsp;&middot;&nbsp;Owner assoc.: ${friskingBag.owner_association_rate}%</td>
        <td>${friskingBag.total_detections > 0
          ? `<span style="color:#EE4860;font-weight:700">${friskingBag.total_detections} Event${friskingBag.total_detections !== 1 ? "s" : ""}</span>`
          : '<span style="color:#64748b">None</span>'}</td>
      </tr>
    </tbody>
  </table>
</div>

<hr class="divider"/>

<!-- WALK-INS -->
<div class="section">
  <div class="section-title">Walk-ins Analytics</div>
  <div class="kpi-grid kpi-grid-4">
    <div class="kpi-card"><div class="v">${walkins.total}</div><div class="l">Total People</div></div>
    <div class="kpi-card"><div class="v">${walkins.avg_dwell_seconds ? fmtDuration(walkins.avg_dwell_seconds) : "—"}</div><div class="l">Avg Dwell Time</div></div>
    <div class="kpi-card"><div class="v">${walkins.peak_hour || "—"}</div><div class="l">Peak Hour</div></div>
    <div class="kpi-card"><div class="v">${walkins.peak_count || "—"}</div><div class="l">Peak Count</div></div>
  </div>
  <div class="two-col">
    <div>
      <div class="col-label">Busiest Hours</div>
      <table>
        <colgroup><col style="width:65%"/><col style="width:35%"/></colgroup>
        <thead><tr><th>Hour (IST)</th><th class="r">Walk-ins</th></tr></thead>
        <tbody>${topHours.length
          ? topHours.map(h => `<tr><td>${h.hour}</td><td class="r">${h.walkins}</td></tr>`).join("")
          : noData(2)}</tbody>
      </table>
    </div>
    <div>
      <div class="col-label">Daily Trend</div>
      <table>
        <colgroup><col style="width:65%"/><col style="width:35%"/></colgroup>
        <thead><tr><th>Day</th><th class="r">Walk-ins</th></tr></thead>
        <tbody>${(walkins.by_day || []).length
          ? walkins.by_day.map(d => `<tr><td>${d.day}</td><td class="r">${d.walkins}</td></tr>`).join("")
          : noData(2)}</tbody>
      </table>
    </div>
  </div>
</div>

<hr class="divider"/>

<!-- MEET & GREET -->
<div class="section">
  <div class="section-title">Meet &amp; Greet Analytics</div>
  <div class="kpi-grid kpi-grid-4">
    <div class="kpi-card"><div class="v">${meetGreet.total_arrivals}</div><div class="l">Total Arrivals</div></div>
    <div class="kpi-card"><div class="v" style="color:#16a34a">${meetGreet.greeted}</div><div class="l">Greeted</div></div>
    <div class="kpi-card"><div class="v" style="color:${meetGreet.ungreeted > 0 ? "#dc2626" : "#16a34a"}">${meetGreet.ungreeted}</div><div class="l">Missed</div></div>
    <div class="kpi-card"><div class="v" style="color:${(meetGreet.greet_rate_pct || 0) >= 80 ? "#16a34a" : "#d97706"}">${greetRate}</div><div class="l">Greet Rate</div></div>
  </div>
  <div class="col-label">Daily Breakdown</div>
  <table>
    <colgroup>
      <col style="width:22%"/><col style="width:16%"/><col style="width:16%"/><col style="width:16%"/><col style="width:30%"/>
    </colgroup>
    <thead>
      <tr><th>Date</th><th class="r">Arrivals</th><th class="r">Greeted</th><th class="r">Missed</th><th class="r">Greet Rate</th></tr>
    </thead>
    <tbody>${(meetGreet.by_day || []).length
      ? meetGreet.by_day.map(d =>
          `<tr>
            <td>${d.day}</td>
            <td class="r">${d.total}</td>
            <td class="r">${d.greeted}</td>
            <td class="r" style="color:${d.ungreeted > 0 ? "#dc2626" : "#16a34a"}">${d.ungreeted}</td>
            <td class="r">${d.greet_rate_pct != null ? d.greet_rate_pct + "%" : "—"}</td>
          </tr>`
        ).join("")
      : noData(5)}</tbody>
  </table>
</div>

<hr class="divider"/>

<!-- STAFF UNAVAILABILITY -->
<div class="section">
  <div class="section-title">Staff Unavailability</div>
  <div class="kpi-grid kpi-grid-4">
    <div class="kpi-card"><div class="v">${staff.events.length}</div><div class="l">Total Absences</div></div>
    <div class="kpi-card"><div class="v">${fmtDuration(totalAbsentS)}</div><div class="l">Total Downtime</div></div>
    <div class="kpi-card"><div class="v" style="color:${totalAbsentS > 0 ? "#d97706" : "#16a34a"}">${unavailPct}</div><div class="l">Unavailability %</div></div>
    <div class="kpi-card"><div class="v">${staff.affected_cameras || 0}</div><div class="l">Cameras Affected</div></div>
  </div>
  <div class="two-col">
    <div>
      <div class="col-label">By Severity</div>
      <table>
        <colgroup><col style="width:68%"/><col style="width:32%"/></colgroup>
        <thead><tr><th>Severity</th><th class="r">Events</th></tr></thead>
        <tbody>${["Critical","High","Moderate","Low"].filter(s => sevCount[s] > 0).map(s =>
            `<tr><td>${sevBadge(s)}</td><td class="r">${sevCount[s]}</td></tr>`
          ).join("") || noData(2)}</tbody>
      </table>
    </div>
    <div>
      <div class="col-label">Daily Rate</div>
      <table>
        <colgroup><col style="width:65%"/><col style="width:35%"/></colgroup>
        <thead><tr><th>Day</th><th class="r">Unavailability %</th></tr></thead>
        <tbody>${(staff.by_day || []).length
          ? staff.by_day.map(d => `<tr><td>${d.day}</td><td class="r">${d.rate}%</td></tr>`).join("")
          : noData(2)}</tbody>
      </table>
    </div>
  </div>
</div>

<hr class="divider"/>

<!-- ACTIVE ALERTS -->
<div class="section">
  <div class="section-title">Active Alerts</div>
  <div class="kpi-grid kpi-grid-3">
    <div class="kpi-card"><div class="v">${alerts.events.length}</div><div class="l">Total Alert Events</div></div>
    <div class="kpi-card"><div class="v" style="color:#dc2626">${alerts.events.filter(e => e.severity === "high").length}</div><div class="l">High Severity</div></div>
    <div class="kpi-card"><div class="v">${alerts.by_hour.length > 0 ? alerts.by_hour.reduce((a, b) => b.count > a.count ? b : a, { hour: "—", count: 0 }).hour : "—"}</div><div class="l">Busiest Alert Hour</div></div>
  </div>
  <div class="two-col">
    <div>
      <div class="col-label">By Category</div>
      <table>
        <colgroup><col style="width:56%"/><col style="width:20%"/><col style="width:24%"/></colgroup>
        <thead><tr><th>Category</th><th class="r">Count</th><th class="r">% of Total</th></tr></thead>
        <tbody>${alertCatRows}</tbody>
      </table>
    </div>
    <div>
      <div class="col-label">By Hour (IST)</div>
      <table>
        <colgroup><col style="width:65%"/><col style="width:35%"/></colgroup>
        <thead><tr><th>Hour</th><th class="r">Alerts</th></tr></thead>
        <tbody>${alerts.by_hour.slice(0, 10).map(h => `<tr><td>${h.hour}</td><td class="r">${h.count}</td></tr>`).join("") || noData(2)}</tbody>
      </table>
    </div>
  </div>
</div>

<hr class="divider"/>

<!-- ANOMALIES & ALERTS -->
<div class="section">
  <div class="section-title">Anomalies &amp; Alerts</div>
  ${anomalies.length === 0
    ? `<div style="text-align:center;padding:18px;color:#64748b;background:#f8fafc;border-radius:7px;border:1px solid #e2e8f0;font-size:11px;font-style:italic">
         No anomalies or operational alerts were detected during the selected reporting period.
       </div>`
    : `<div class="kpi-grid kpi-grid-4">
         <div class="kpi-card"><div class="v">${anomalies.length}</div><div class="l">Total Anomalies</div></div>
         <div class="kpi-card"><div class="v" style="color:#d97706">${anomalies.filter(a => a.status === "Active").length}</div><div class="l">Active</div></div>
         <div class="kpi-card"><div class="v" style="color:#dc2626">${highAnomCount}</div><div class="l">High / Critical</div></div>
         <div class="kpi-card"><div class="v" style="color:#16a34a">${anomalies.filter(a => a.status === "Resolved").length}</div><div class="l">Resolved</div></div>
       </div>
       <div class="two-col">
         <div>
           <div class="col-label">By Type</div>
           <table>
             <colgroup><col style="width:72%"/><col style="width:28%"/></colgroup>
             <thead><tr><th>Alert Type</th><th class="r">Count</th></tr></thead>
             <tbody>${ANOMALY_ORDER.filter(t => anomByType[t]).map(t =>
                 `<tr><td>${t}</td><td class="r">${anomByType[t]}</td></tr>`
               ).join("") || noData(2)}</tbody>
           </table>
         </div>
         <div>
           <div class="col-label">By Severity</div>
           <table>
             <colgroup><col style="width:68%"/><col style="width:32%"/></colgroup>
             <thead><tr><th>Severity</th><th class="r">Count</th></tr></thead>
             <tbody>${["Critical","High","Moderate","Low"].filter(s => anomalies.some(a => a.severity === s)).map(s => {
                 const c = anomalies.filter(a => a.severity === s).length;
                 return `<tr><td>${sevBadge(s)}</td><td class="r">${c}</td></tr>`;
               }).join("") || noData(2)}</tbody>
           </table>
         </div>
       </div>`
  }
</div>

<hr class="divider"/>

<!-- CUSTOMER WAITING TIME -->
<div class="section">
  <div class="section-title">Customer Waiting Time</div>
  ${waitingTime.customers_served === 0
    ? `<div style="text-align:center;padding:18px;color:#64748b;background:#f8fafc;border-radius:7px;border:1px solid #e2e8f0;font-size:11px;font-style:italic">
         No waiting time data available for the selected period.
       </div>`
    : `<div class="kpi-grid kpi-grid-4">
         <div class="kpi-card"><div class="v">${waitingTime.customers_served}</div><div class="l">Customers Served</div></div>
         <div class="kpi-card"><div class="v">${waitingTime.avg_wait_seconds != null ? fmtDuration(waitingTime.avg_wait_seconds) : "—"}</div><div class="l">Avg Wait Time</div></div>
         <div class="kpi-card"><div class="v">${waitingTime.max_wait_seconds != null ? fmtDuration(waitingTime.max_wait_seconds) : "—"}</div><div class="l">Max Wait Time</div></div>
         <div class="kpi-card"><div class="v" style="color:${waitingTime.long_waits > 0 ? "#d97706" : "#16a34a"}">${waitingTime.long_waits}</div><div class="l">Long Waits (&gt;10 min)</div></div>
       </div>
       <div class="two-col">
         <div>
           <div class="col-label">Wait Time Distribution</div>
           <table>
             <colgroup><col style="width:65%"/><col style="width:35%"/></colgroup>
             <thead><tr><th>Range</th><th class="r">Customers</th></tr></thead>
             <tbody>${waitingTime.distribution.length
               ? waitingTime.distribution.map(d => `<tr><td>${d.range}</td><td class="r">${d.count}</td></tr>`).join("")
               : `<tr><td colspan="2" class="nodata">No data</td></tr>`}</tbody>
           </table>
         </div>
         <div>
           <div class="col-label">By Camera / Location</div>
           <table>
             <colgroup><col style="width:62%"/><col style="width:38%"/></colgroup>
             <thead><tr><th>Location</th><th class="r">Avg Wait</th></tr></thead>
             <tbody>${waitingTime.by_camera.length
               ? waitingTime.by_camera.map(c => `<tr><td>${c.location}</td><td class="r">${fmtDuration(c.avg_wait_seconds)}</td></tr>`).join("")
               : `<tr><td colspan="2" class="nodata">No data</td></tr>`}</tbody>
           </table>
         </div>
       </div>`
  }
</div>

<hr class="divider"/>

<!-- FRISKING BAG -->
<div class="section">
  <div class="section-title">Frisking Bag</div>
  ${friskingBag.total_detections === 0
    ? `<div style="text-align:center;padding:18px;color:#64748b;background:#f8fafc;border-radius:7px;border:1px solid #e2e8f0;font-size:11px;font-style:italic">
         No frisking bag detection events in the selected period.
       </div>`
    : `<div class="kpi-grid kpi-grid-4">
         <div class="kpi-card"><div class="v">${friskingBag.total_detections}</div><div class="l">Total Detections</div></div>
         <div class="kpi-card"><div class="v">${friskingBag.unique_track_ids}</div><div class="l">Unique Objects</div></div>
         <div class="kpi-card"><div class="v">${friskingBag.avg_confidence != null ? (friskingBag.avg_confidence * 100).toFixed(1) + "%" : "—"}</div><div class="l">Avg Confidence</div></div>
         <div class="kpi-card"><div class="v">${friskingBag.owner_association_rate}%</div><div class="l">Owner Association</div></div>
       </div>
       <div class="col-label">Daily Breakdown</div>
       <table>
         <colgroup><col style="width:40%"/><col style="width:30%"/><col style="width:30%"/></colgroup>
         <thead><tr><th>Date</th><th class="r">Detections</th><th class="r">With Owner</th></tr></thead>
         <tbody>${friskingBag.by_day.length
           ? friskingBag.by_day.map(d => `<tr><td>${d.day}</td><td class="r">${d.detections}</td><td class="r">${d.with_owner}</td></tr>`).join("")
           : `<tr><td colspan="3" class="nodata">No data</td></tr>`}</tbody>
       </table>`
  }
</div>

<!-- FOOTER -->
<div class="footer">
  ${agFooterHtml}
  <span>Automatically generated by WoxSight &bull; Woxsen University Campus Video Analytics &bull; ${generated} IST</span>
</div>

</div>
</body>
</html>`;
}

async function generatePdf(html) {
  const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
    return pdf;
  } finally {
    await browser.close();
  }
}

// ─── Core send function (used by route + scheduler) ───────────────────────────

async function sendReport({ from, to, recipients }) {
  const dismissed = await getDismissed();
  const walkins   = fileWalkinsAnalytics(from, to, dismissed);
  const meetGreet = fileMeetGreetAnalytics(from, to, dismissed);
  const staff     = fileStaffAnalytics(from, to, dismissed);
  const alerts    = fileAlerts(from, to, dismissed);
  const [waitingTime, friskingBag] = await Promise.all([
    dbWaitingTimeAnalytics(from, to),
    dbFriskingBagAnalytics(from, to),
  ]);

  const html   = buildHtml(from, to, walkins, meetGreet, staff, alerts, waitingTime, friskingBag);
  const pdfBuf = await generatePdf(html);

  const dateLabel    = from === to ? from : `${from} to ${to}`;
  const subject      = `WoxSight — Campus Video Analytics Report (${dateLabel})`;
  const anomalies    = buildAnomalies(walkins, meetGreet, staff);
  const highAnoms    = anomalies.filter(a => a.severity === "High" || a.severity === "Critical").length;

  const mailBody = `
Hello,

Please find attached the WoxSight Campus Video Analytics Report for ${dateLabel}.

SUMMARY
──────────────────────────────
Date Range      : ${dateLabel}
Walk-ins        : ${walkins.total} people detected
Meet & Greet    : ${meetGreet.total_arrivals} arrivals (${meetGreet.greeted} greeted, ${meetGreet.ungreeted} missed)
Staff Absences  : ${staff.events.length} events
Total Alerts    : ${alerts.events.length} alerts
Anomalies       : ${anomalies.length} detected${highAnoms > 0 ? ` (${highAnoms} high/critical)` : ""}

Full details are available in the attached PDF report.

──────────────────────────────
WoxSight — Campus Video Analytics
Woxsen University
Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
  `.trim();

  const transport = mailer();
  await transport.sendMail({
    from: `"WoxSight Analytics" <${process.env.GMAIL_USER}>`,
    to: recipients.join(", "),
    subject,
    text: mailBody,
    attachments: [{
      filename: `woxsight-report-${dateLabel}.pdf`,
      content: pdfBuf,
      contentType: "application/pdf",
    }],
  });
}

// ─── API route ────────────────────────────────────────────────────────────────

// POST /api/meghavi/email/send
// Body: { from, to, recipients: string[] }
// Admin only
router.post("/send", requireAuth, async (req, res) => {
  const { role } = req.user || {};
  if ((role || "").toLowerCase() !== "admin") {
    return res.status(403).json({ error: "forbidden", message: "Admin only." });
  }

  const { from, to, recipients } = req.body || {};
  if (!from || !to) return res.status(400).json({ error: "bad_request", message: "from and to dates are required." });

  const toList = Array.isArray(recipients) && recipients.length > 0
    ? recipients.filter(r => /\S@\S/.test(r))
    : FIXED_RECIPIENTS;

  if (toList.length === 0) return res.status(400).json({ error: "bad_request", message: "No valid recipients." });

  try {
    await sendReport({ from, to, recipients: toList });
    res.json({ ok: true, message: `Report sent to ${toList.join(", ")}` });
  } catch (e) {
    console.error("[email-report] send failed:", e.message);
    res.status(500).json({ error: "send_failed", message: e.message });
  }
});

// ─── Scheduler: 10am IST daily for previous day ───────────────────────────────

function yesterdayIST() {
  const now  = new Date();
  const yest = new Date(now.getTime() + 5.5 * 3600000);
  yest.setUTCDate(yest.getUTCDate() - 1);
  return `${yest.getUTCFullYear()}-${String(yest.getUTCMonth() + 1).padStart(2, "0")}-${String(yest.getUTCDate()).padStart(2, "0")}`;
}

function msUntilNext10amIST() {
  // 10:00 IST = 04:30 UTC
  const now  = new Date();
  const next = new Date(now);
  next.setUTCHours(4, 30, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

function scheduleDailyReport() {
  const delay = msUntilNext10amIST();
  console.log(`[email-report] next daily report in ${Math.round(delay / 60000)} minutes (10:00 IST)`);
  setTimeout(async () => {
    const date = yesterdayIST();
    console.log(`[email-report] sending daily report for ${date}`);
    try {
      await sendReport({ from: date, to: date, recipients: FIXED_RECIPIENTS });
      console.log(`[email-report] daily report sent for ${date}`);
    } catch (e) {
      console.error("[email-report] daily report failed:", e.message);
    }
    scheduleDailyReport();
  }, delay);
}

module.exports = { emailReportRouter: router, scheduleDailyReport };
