#!/usr/bin/env node
// Unified inference data ingest
// Usage:
//   node server/ingest.js                        — all modules, all dates
//   node server/ingest.js walkins                — one module
//   node server/ingest.js staff_unavailability 2026-08-31  — one module + date

const fs   = require("fs");
const path = require("path");
const { Pool } = require("pg");

const DATA_ROOT = path.resolve(__dirname, "../inference-data");
const pool = new Pool({
  host: "127.0.0.1", port: 5435, user: "aiserver",
  password: "aiserver123", database: "aiserver",
});

// ── Shared ───────────────────────────────────────────────────────────────────
const camCache = {};
async function resolveCameraId(cameraKey) {
  if (camCache[cameraKey] !== undefined) return camCache[cameraKey];
  const res = await pool.query(
    "SELECT id FROM meghavi_cameras WHERE camera_key = $1", [cameraKey]
  );
  camCache[cameraKey] = res.rows[0]?.id ?? null;
  return camCache[cameraKey];
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

function dateDirs(moduleDir, filterDate) {
  if (!fs.existsSync(moduleDir)) return [];
  return fs.readdirSync(moduleDir)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && (!filterDate || d === filterDate))
    .sort();
}

// ── Walk-ins ─────────────────────────────────────────────────────────────────
async function ingestWalkins(filterDate) {
  const moduleDir = path.join(DATA_ROOT, "walkins");
  const UPLOAD_DIR = path.resolve(__dirname, "uploads/meghavi/walkins");
  const URL_PREFIX  = "/api/meghavi/uploads/walkins";

  const logFile = path.join(moduleDir, "walkin_log.json");
  const data = readJson(logFile);
  const events = data?.events ?? (Array.isArray(data) ? data : []);
  if (!events.length) { console.log("  walkins: no events in walkin_log.json"); return; }

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  let inserted = 0, skipped = 0;

  for (const ev of events) {
    const camera_id = await resolveCameraId(ev.camera_key);
    if (!camera_id) { console.warn(`  ✗ camera '${ev.camera_key}' not found`); skipped++; continue; }

    // Copy snapshot into uploads if it exists in crops dir
    const dateDir  = filterDate || ev.detected_at?.slice(0, 10) || "2026-08-28";
    const cropsDir = path.join(moduleDir, dateDir, "crops");
    const snapFile = path.basename(ev.snapshot_url || ev.face_crop_url || "");
    let snapshot_url = ev.snapshot_url;
    if (snapFile && fs.existsSync(path.join(cropsDir, snapFile))) {
      fs.copyFileSync(path.join(cropsDir, snapFile), path.join(UPLOAD_DIR, snapFile));
      snapshot_url = `${URL_PREFIX}/${snapFile}`;
    }

    const existing = await pool.query(
      "SELECT id FROM meghavi_walkin_events WHERE camera_id=$1 AND detected_at=$2",
      [camera_id, ev.detected_at]
    );
    if (existing.rows.length) { skipped++; continue; }

    await pool.query(
      `INSERT INTO meghavi_walkin_events
         (camera_id, detected_at, person_count, confidence, dwell_seconds, snapshot_url, face_crop_url, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [camera_id, ev.detected_at, ev.person_count ?? 1, ev.confidence ?? null,
       ev.dwell_seconds ?? 0, snapshot_url, ev.face_crop_url ?? null, JSON.stringify(ev)]
    );
    inserted++;
  }
  console.log(`  walkins: +${inserted} inserted, ${skipped} skipped`);
}

// ── Meet & Greet ─────────────────────────────────────────────────────────────
async function ingestMeetGreet(filterDate) {
  const moduleDir  = path.join(DATA_ROOT, "meet-greet");
  const UPLOAD_DIR = path.resolve(__dirname, "uploads/meghavi/meet-greet");
  const URL_PREFIX  = "/api/meghavi/uploads/meet-greet";
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  for (const date of dateDirs(moduleDir, filterDate)) {
    const logFile = path.join(moduleDir, date, `mg_log_${date}.json`);
    const events  = readJson(logFile);
    if (!Array.isArray(events)) { console.log(`  meet-greet ${date}: no log`); continue; }

    let inserted = 0, skipped = 0;
    for (const ev of events) {
      const cameraKey = ev.camera_id || "Woxsen";
      const camera_id = await resolveCameraId(cameraKey);
      if (!camera_id) { console.warn(`  ✗ camera '${cameraKey}' not found`); skipped++; continue; }

      const detected_at = ev.saved_at?.includes("+") ? ev.saved_at : (ev.saved_at ? ev.saved_at + "+05:30" : null);
      if (!detected_at) { skipped++; continue; }

      const existing = await pool.query(
        "SELECT id FROM meghavi_meet_greet_events WHERE camera_id=$1 AND detected_at=$2",
        [camera_id, detected_at]
      );
      if (existing.rows.length) { skipped++; continue; }

      let snapshot_url = null;
      if (ev.snapshot) {
        const src = path.join(moduleDir, date, "snapshots", ev.snapshot);
        const dst = path.join(UPLOAD_DIR, ev.snapshot);
        if (fs.existsSync(src)) { fs.copyFileSync(src, dst); snapshot_url = `${URL_PREFIX}/${ev.snapshot}`; }
      }

      await pool.query(
        `INSERT INTO meghavi_meet_greet_events
           (camera_id, detected_at, greeted, duration_seconds, customers_in_roi, staff_in_roi, snapshot_url, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [camera_id, detected_at,
         ev.status === "SUCCESS", ev.duration_seconds ?? null,
         ev.customers_in_roi ?? null, ev.staff_in_roi ?? null,
         snapshot_url, JSON.stringify(ev)]
      );
      inserted++;
    }
    console.log(`  meet-greet ${date}: +${inserted} inserted, ${skipped} skipped`);
  }
}

// ── Staff Unavailability ──────────────────────────────────────────────────────
async function ingestStaff(filterDate) {
  const moduleDir  = path.join(DATA_ROOT, "staff-unavailability");
  const UPLOAD_DIR = path.resolve(__dirname, "uploads/meghavi/staff-availability");
  const URL_PREFIX  = "/api/meghavi/uploads/staff-availability";
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  for (const date of dateDirs(moduleDir, filterDate)) {
    const logFile = path.join(moduleDir, date, `staff_log_${date}.json`);
    const events  = readJson(logFile);
    if (!Array.isArray(events)) { console.log(`  staff ${date}: no log`); continue; }

    let inserted = 0, skipped = 0;
    for (const ev of events) {
      const camera_id = await resolveCameraId(ev.camera_id);
      if (!camera_id) { console.warn(`  ✗ camera '${ev.camera_id}' not found`); skipped++; continue; }

      const detected_at = ev.saved_at?.includes("+") ? ev.saved_at : (ev.saved_at ? ev.saved_at + "+05:30" : null);
      if (!detected_at) { skipped++; continue; }

      const existing = await pool.query(
        "SELECT id FROM meghavi_staff_availability_events WHERE camera_id=$1 AND detected_at=$2",
        [camera_id, detected_at]
      );
      if (existing.rows.length) { skipped++; continue; }

      let video_url = null;
      if (ev.video) {
        const webFile = ev.video.replace(".mp4", "_web.mp4");
        const webSrc  = path.join(moduleDir, date, "videos-web", webFile);
        const rawSrc  = path.join(moduleDir, date, "videos", ev.video);
        const useSrc  = fs.existsSync(webSrc) ? webSrc : fs.existsSync(rawSrc) ? rawSrc : null;
        const useFile = fs.existsSync(webSrc) ? webFile : ev.video;
        if (useSrc) {
          fs.copyFileSync(useSrc, path.join(UPLOAD_DIR, useFile));
          video_url = `${URL_PREFIX}/${useFile}`;
        }
      }

      await pool.query(
        `INSERT INTO meghavi_staff_availability_events
           (camera_id, detected_at, end_time, absent_duration_seconds, severity, video_url, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [camera_id, detected_at, ev.end_ts ?? null,
         ev.duration_seconds ?? null, ev.status ?? null,
         video_url, JSON.stringify(ev)]
      );
      inserted++;
    }
    console.log(`  staff ${date}: +${inserted} inserted, ${skipped} skipped`);
  }
}

// ── Waiting Time (placeholder) ───────────────────────────────────────────────
async function ingestWaitingTime(filterDate) {
  console.log("  waiting-time: no data yet");
}

// ── Main ──────────────────────────────────────────────────────────────────────
const MODULES = { walkins: ingestWalkins, meet_greet: ingestMeetGreet, staff_unavailability: ingestStaff, waiting_time: ingestWaitingTime };
const [,, moduleArg, dateArg] = process.argv;

(async () => {
  const toRun = moduleArg ? { [moduleArg]: MODULES[moduleArg] } : MODULES;
  if (moduleArg && !MODULES[moduleArg]) {
    console.error(`Unknown module: ${moduleArg}. Valid: ${Object.keys(MODULES).join(", ")}`);
    process.exit(1);
  }
  for (const [name, fn] of Object.entries(toRun)) {
    console.log(`\n[${name}]`);
    await fn(dateArg || null).catch(e => console.error(`  ERROR: ${e.message}`));
  }
  await pool.end();
  console.log("\n✓ Done");
})();
