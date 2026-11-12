"use strict";

/**
 * Meghavi Wellness POC — API routes
 *
 * Ingestion  (AI module or manual → backend):
 *   POST /api/meghavi/ingest/walkin            multipart or JSON
 *   POST /api/meghavi/ingest/meet-greet        multipart or JSON
 *   POST /api/meghavi/ingest/staff-availability multipart or JSON
 *
 * File upload fields (multipart only):
 *   snapshot  — inference snapshot image (jpg/png)
 *   video     — short inference clip (mp4/avi/mov)
 *
 * Frontend retrieval:
 *   GET  /api/meghavi/cameras
 *   GET  /api/meghavi/dashboard/summary
 *   GET  /api/meghavi/analytics/walkins
 *   GET  /api/meghavi/analytics/meet-greet
 *   GET  /api/meghavi/analytics/staff-availability
 *
 * Auth:
 *   Ingestion: x-internal-key header (AI module) OR user JWT
 *   Retrieval: user JWT only
 */

const express = require("express");
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const { pool }                    = require("../db");
const { requireAuth }             = require("../middleware/requireAuth");
const { requireAuthOrInternal }   = require("../middleware/requireAuthOrInternal");
const { record, MODULES }         = require("../lib/auditService");

const router = express.Router();

// ---------------------------------------------------------------------------
// Media upload – disk storage
// ---------------------------------------------------------------------------

const UPLOADS_ROOT = path.resolve(__dirname, "..", "..", "uploads", "meghavi");

// Ensure subdirectories exist at module load time
for (const sub of ["walkins", "meet-greet", "staff-availability", "streams", "frisking-bag"]) {
  fs.mkdirSync(path.join(UPLOADS_ROOT, sub), { recursive: true });
}

function makeStorage(subdir) {
  return multer.diskStorage({
    destination: path.join(UPLOADS_ROOT, subdir),
    filename(_req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase() || ".bin";
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  });
}

const UPLOAD_FIELDS = [
  { name: "snapshot", maxCount: 1 },
  { name: "video",    maxCount: 1 },
];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB per file

function makeUpload(subdir) {
  return multer({
    storage: makeStorage(subdir),
    limits: { fileSize: MAX_FILE_SIZE },
  }).fields(UPLOAD_FIELDS);
}

const walkinUpload       = makeUpload("walkins");
const meetGreetUpload    = makeUpload("meet-greet");
const staffUpload        = makeUpload("staff-availability");
const friskingBagUpload  = makeUpload("frisking-bag");

/** Build the public URL for an uploaded file. */
function fileUrl(subdir, filename) {
  return `/api/meghavi/uploads/${subdir}/${filename}`;
}

// Create frisking bag table, migrate schema, then run first file sync — all chained
// so syncFriskingLog never fires before the column/index exist.
pool.query(`
  CREATE TABLE IF NOT EXISTS meghavi_frisking_bag_events (
    id                SERIAL PRIMARY KEY,
    camera_id         INTEGER      REFERENCES meghavi_cameras(id) ON DELETE SET NULL,
    saved_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    frame_number      INTEGER,
    video_time        VARCHAR(20),
    class_name        VARCHAR(64)  DEFAULT 'bag',
    track_id          INTEGER,
    confidence        FLOAT,
    owner_id          VARCHAR(64),
    owner_distance_px FLOAT,
    thumbnail_url     TEXT,
    snapshot_url      TEXT,
    video_url         TEXT,
    metadata          JSONB        DEFAULT '{}',
    created_at        TIMESTAMPTZ  DEFAULT NOW()
  )
`).then(() => pool.query(`
  ALTER TABLE meghavi_frisking_bag_events
    ADD COLUMN IF NOT EXISTS external_event_id VARCHAR(64) DEFAULT NULL
`)).then(() => syncFriskingLog())
  .then(() => syncFriskingDirs())
  .catch((e) => console.error("[meghavi] frisking_bag init:", e.message));

// Create feedback table on startup
pool.query(`
  CREATE TABLE IF NOT EXISTS meghavi_feedback (
    id           SERIAL PRIMARY KEY,
    event_id     VARCHAR(255)  NOT NULL,
    module       VARCHAR(64)   NOT NULL,
    feedback     VARCHAR(16)   NOT NULL,
    snapshot_url TEXT,
    video_url    TEXT,
    created_at   TIMESTAMPTZ   DEFAULT NOW()
  )
`).then(() =>
  // Migrate event_id from INTEGER to VARCHAR so file-based modules (meet_greet,
  // walkins) can store filename/string IDs, not just numeric DB row IDs.
  pool.query(`
    DO $$
    BEGIN
      IF (SELECT data_type FROM information_schema.columns
          WHERE table_name = 'meghavi_feedback' AND column_name = 'event_id') = 'integer' THEN
        ALTER TABLE meghavi_feedback ALTER COLUMN event_id TYPE VARCHAR(255) USING event_id::text;
      END IF;
    END
    $$
  `)
).catch((e) => console.error("[meghavi] feedback table init:", e.message));

/** Extract snapshot_url and video_url from request (multipart or JSON). */
function extractMediaUrls(req, subdir) {
  const snapshotFile = req.files?.snapshot?.[0];
  const videoFile    = req.files?.video?.[0];
  return {
    snapshot_url: snapshotFile
      ? fileUrl(subdir, snapshotFile.filename)
      : (req.body.snapshot_url || null),
    video_url: videoFile
      ? fileUrl(subdir, videoFile.filename)
      : (req.body.video_url || null),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bad(res, msg)      { return res.status(400).json({ error: "bad_request", message: msg }); }
function notFound(res, msg) { return res.status(404).json({ error: "not_found",   message: msg }); }

/** Parse YYYY-MM-DD range; defaults to today in Asia/Kolkata. */
function parseDateRange(query) {
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
  return {
    from: isDate(query.from) ? query.from : todayStr,
    to:   isDate(query.to)   ? query.to   : todayStr,
  };
}

/** Normalise free-text location names to the two canonical branch names. */
function normalizeLocation(name) {
  if (!name) return "";
  const n = name.trim();
  if (/woxsen/i.test(n)) return "Woxsen University";
  return n;
}

/** Resolve camera_key → camera row (with location). Returns null if unknown. */
async function resolveCamera(cameraKey) {
  const [rows] = await pool.query(
    `SELECT c.id, c.camera_key, c.display_name, c.area, c.status,
            l.id AS location_id, l.name AS location_name
     FROM   meghavi_cameras c
     JOIN   meghavi_locations l ON l.id = c.location_id
     WHERE  c.camera_key = ? AND c.status = 'active'
     LIMIT  1`,
    [cameraKey]
  );
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// GET /api/meghavi/cameras
// ---------------------------------------------------------------------------

router.get("/cameras", requireAuth, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.camera_key, c.display_name, c.area, c.status,
              l.id AS location_id, l.name AS location_name, c.stream_url
       FROM   meghavi_cameras c
       JOIN   meghavi_locations l ON l.id = c.location_id
       WHERE  c.hidden = false AND c.stream_url IS NOT NULL
       ORDER  BY l.id, c.id`
    );
    res.json({ cameras: rows });
  } catch (e) {
    console.error("[meghavi] cameras:", e.message);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/meghavi/ingest/walkin
// JSON fields: camera_key, detected_at, person_count?, confidence?,
//              snapshot_url?, video_url?, metadata?
// Multipart:   same fields as text + snapshot (file) + video (file)
// ---------------------------------------------------------------------------

router.post("/ingest/walkin", requireAuthOrInternal, walkinUpload, async (req, res) => {
  const {
    camera_key, detected_at,
    person_count = 1,
    confidence   = null,
    metadata     = {},
  } = req.body || {};

  if (!camera_key)  return bad(res, "camera_key is required");
  if (!detected_at) return bad(res, "detected_at is required");

  const count = Number(person_count);
  if (!Number.isInteger(count) || count < 1)
    return bad(res, "person_count must be a positive integer");

  const cam = await resolveCamera(camera_key);
  if (!cam) return notFound(res, `Camera '${camera_key}' is not registered.`);

  const { snapshot_url, video_url } = extractMediaUrls(req, "walkins");

  try {
    const [result] = await pool.query(
      `INSERT INTO meghavi_walkin_events
         (camera_id, detected_at, person_count, confidence, snapshot_url, video_url, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [cam.id, detected_at, count, confidence || null, snapshot_url, video_url,
       typeof metadata === "string" ? metadata : JSON.stringify(metadata)]
    );
    res.status(201).json({ id: result.insertId, status: "ok", location: cam.location_name });
  } catch (e) {
    console.error("[meghavi] ingest/walkin:", e.message);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/meghavi/ingest/meet-greet
// JSON fields: camera_key, detected_at, greeted (bool), greet_delay_seconds?,
//              confidence?, snapshot_url?, video_url?, metadata?
// ---------------------------------------------------------------------------

router.post("/ingest/meet-greet", requireAuthOrInternal, meetGreetUpload, async (req, res) => {
  const {
    camera_key, detected_at,
    greet_delay_seconds = null,
    confidence          = null,
    metadata            = {},
  } = req.body || {};

  // greeted can arrive as string "true"/"false" from multipart form fields
  const greetedRaw = req.body?.greeted;
  const greeted = greetedRaw === true || greetedRaw === "true";
  const greetedProvided = greetedRaw !== undefined && greetedRaw !== null && greetedRaw !== "";

  if (!camera_key)       return bad(res, "camera_key is required");
  if (!detected_at)      return bad(res, "detected_at is required");
  if (!greetedProvided)  return bad(res, "greeted (true/false) is required");

  const cam = await resolveCamera(camera_key);
  if (!cam) return notFound(res, `Camera '${camera_key}' is not registered.`);

  const { snapshot_url, video_url } = extractMediaUrls(req, "meet-greet");

  try {
    const [result] = await pool.query(
      `INSERT INTO meghavi_meet_greet_events
         (camera_id, detected_at, greeted, greet_delay_seconds, confidence, snapshot_url, video_url, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [cam.id, detected_at, greeted,
       greet_delay_seconds !== null ? Number(greet_delay_seconds) : null,
       confidence || null, snapshot_url, video_url,
       typeof metadata === "string" ? metadata : JSON.stringify(metadata)]
    );
    res.status(201).json({ id: result.insertId, status: "ok", location: cam.location_name });
  } catch (e) {
    console.error("[meghavi] ingest/meet-greet:", e.message);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/meghavi/ingest/staff-availability
// JSON fields: camera_key, detected_at, staff_present (bool),
//              absent_duration_seconds?, confidence?, snapshot_url?, video_url?, metadata?
// ---------------------------------------------------------------------------

router.post("/ingest/staff-availability", requireAuthOrInternal, staffUpload, async (req, res) => {
  const {
    camera_key, detected_at,
    absent_duration_seconds = null,
    confidence              = null,
    metadata                = {},
  } = req.body || {};

  const staffPresentRaw = req.body?.staff_present;
  const staff_present   = staffPresentRaw === true || staffPresentRaw === "true";
  const staffProvided   = staffPresentRaw !== undefined && staffPresentRaw !== null && staffPresentRaw !== "";

  if (!camera_key)    return bad(res, "camera_key is required");
  if (!detected_at)   return bad(res, "detected_at is required");
  if (!staffProvided) return bad(res, "staff_present (true/false) is required");

  const cam = await resolveCamera(camera_key);
  if (!cam) return notFound(res, `Camera '${camera_key}' is not registered.`);

  const { snapshot_url, video_url } = extractMediaUrls(req, "staff-availability");

  try {
    const [result] = await pool.query(
      `INSERT INTO meghavi_staff_availability_events
         (camera_id, detected_at, staff_present, absent_duration_seconds, confidence, snapshot_url, video_url, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [cam.id, detected_at, staff_present,
       absent_duration_seconds !== null ? Number(absent_duration_seconds) : null,
       confidence || null, snapshot_url, video_url,
       typeof metadata === "string" ? metadata : JSON.stringify(metadata)]
    );
    res.status(201).json({ id: result.insertId, status: "ok", location: cam.location_name });
  } catch (e) {
    console.error("[meghavi] ingest/staff-availability:", e.message);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/meghavi/dashboard/summary
// Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD  (default: today IST for both)
//        ?date=YYYY-MM-DD                 (legacy single-day — treated as from=to=date)
//        &location_id=<int>               (optional)
// ---------------------------------------------------------------------------

router.get("/dashboard/summary", requireAuth, async (req, res) => {
  // Support legacy ?date= as well as ?from=&to=
  const q = req.query.date
    ? { from: req.query.date, to: req.query.date }
    : req.query;
  const { from, to } = parseDateRange(q);
  const dismissed = await getDismissed();
  const result = fileDashboard(from, to, dismissed);
  try {
    const { prevFrom, prevTo } = prevPeriod(from, to);
    const FB_DISMISSED = `AND e.id NOT IN (SELECT event_id::int FROM meghavi_feedback WHERE module = 'frisking_bag' AND feedback = 'thumbs_down')`;
    const [[fbCountRow], [prevFbCountRow], [fbRecentRows]] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS cnt FROM meghavi_frisking_bag_events e
         WHERE e.saved_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
           AND e.saved_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
           ${FB_DISMISSED}`,
        [from, to]
      ),
      pool.query(
        `SELECT COUNT(*) AS cnt FROM meghavi_frisking_bag_events e
         WHERE e.saved_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
           AND e.saved_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
           ${FB_DISMISSED}`,
        [prevFrom, prevTo]
      ),
      pool.query(
        `SELECT e.id, e.saved_at, e.owner_id, e.thumbnail_url, e.snapshot_url,
                COALESCE(c.display_name, 'Woxsen Camera') AS camera_name
         FROM meghavi_frisking_bag_events e
         LEFT JOIN meghavi_cameras c ON c.id = e.camera_id
         WHERE e.saved_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
           AND e.saved_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
           ${FB_DISMISSED}
         ORDER BY e.saved_at DESC
         LIMIT 4`,
        [from, to]
      ),
    ]);
    const fbCount     = Number(fbCountRow[0].cnt);
    const prevFbCount = Number(prevFbCountRow[0].cnt);
    const patch       = {};
    if (fbCount > 0 || prevFbCount > 0) {
      patch.total_alerts      = result.total_alerts      + fbCount;
      patch.prev_total_alerts = result.prev_total_alerts + prevFbCount;
    }
    if (fbRecentRows.length > 0) {
      const fbAlerts = fbRecentRows.map(e => ({
        module: "frisking_bag",
        severity: e.owner_id ? "info" : "warning",
        occurred_at: e.saved_at,
        camera_name: e.camera_name,
        absent_duration_seconds: null,
        greeted: null,
        snapshot_url: e.thumbnail_url || e.snapshot_url || null,
      }));
      patch.recent_alerts = [...result.recent_alerts, ...fbAlerts]
        .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
        .slice(0, 10);
    }
    if (Object.keys(patch).length > 0) return res.json({ ...result, ...patch });
  } catch (err) {
    console.error("[meghavi] frisking bag dashboard merge failed:", err.message);
  }
  return res.json(result);
  const locationId = req.query.location_id ? Number(req.query.location_id) : null;
  const camFilter  = locationId ? "AND c.location_id = ?" : "";
  const locParam   = locationId ? [locationId] : [];

  // Previous period of same length for delta comparison
  const fromMs = new Date(from + "T00:00:00").getTime();
  const toMs   = new Date(to   + "T00:00:00").getTime();
  const spanDays = Math.round((toMs - fromMs) / 86400000) + 1;
  const prevFrom = new Date(fromMs - spanDays * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const prevTo   = new Date(toMs   - spanDays * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const isSingleDay = from === to;

  try {
    // Walk-ins total
    const [[wRow]] = await pool.query(
      `SELECT COALESCE(SUM(e.person_count), 0) AS total
       FROM   meghavi_walkin_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}`,
      [from, to, ...locParam]
    );

    // Staff unavailability
    const [[sRow]] = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE NOT e.staff_present)                                     AS absent_events,
         COUNT(*)                                                                          AS total_events,
         COALESCE(SUM(e.absent_duration_seconds) FILTER (WHERE NOT e.staff_present), 0)  AS total_absent_secs
       FROM   meghavi_staff_availability_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}`,
      [from, to, ...locParam]
    );

    // Meet & Greet totals
    const [[mgRow]] = await pool.query(
      `SELECT
         COUNT(*)                                        AS total,
         COUNT(*) FILTER (WHERE NOT e.greeted)          AS ungreeted
       FROM   meghavi_meet_greet_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}`,
      [from, to, ...locParam]
    );

    // Trend data — hourly for single day, daily for ranges
    let trend;
    if (isSingleDay) {
      const [walkinHourly] = await pool.query(
        `SELECT to_char(date_trunc('hour', e.detected_at AT TIME ZONE 'Asia/Kolkata'), 'HH24:00') AS hour,
                SUM(e.person_count) AS walkins
         FROM   meghavi_walkin_events e
         JOIN   meghavi_cameras c ON c.id = e.camera_id
         WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
           AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
           ${camFilter}
         GROUP  BY 1 ORDER BY 1`,
        [from, from, ...locParam]
      );
      const [staffHourly] = await pool.query(
        `SELECT to_char(date_trunc('hour', e.detected_at AT TIME ZONE 'Asia/Kolkata'), 'HH24:00') AS hour,
                ROUND(100.0 * COUNT(*) FILTER (WHERE NOT e.staff_present) / NULLIF(COUNT(*),0), 1) AS rate
         FROM   meghavi_staff_availability_events e
         JOIN   meghavi_cameras c ON c.id = e.camera_id
         WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
           AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
           ${camFilter}
         GROUP  BY 1 ORDER BY 1`,
        [from, from, ...locParam]
      );
      const [mgHourly] = await pool.query(
        `SELECT to_char(date_trunc('hour', e.detected_at AT TIME ZONE 'Asia/Kolkata'), 'HH24:00') AS hour,
                COUNT(*) AS total
         FROM   meghavi_meet_greet_events e
         JOIN   meghavi_cameras c ON c.id = e.camera_id
         WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
           AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
           ${camFilter}
         GROUP  BY 1 ORDER BY 1`,
        [from, from, ...locParam]
      );
      const walkinMap = Object.fromEntries(walkinHourly.map((r) => [r.hour, Number(r.walkins)]));
      const staffMap  = Object.fromEntries(staffHourly.map((r)  => [r.hour, Number(r.rate)]));
      const mgMap     = Object.fromEntries(mgHourly.map((r)    => [r.hour, Number(r.total)]));
      trend = Array.from({ length: 24 }, (_, i) => {
        const hour = `${String(i).padStart(2, "0")}:00`;
        return { hour, walkins: walkinMap[hour] ?? 0, staff_unavail_pct: staffMap[hour] ?? 0, meet_greet: mgMap[hour] ?? 0 };
      });
    } else {
      const [walkinDaily] = await pool.query(
        `SELECT to_char(date_trunc('day', e.detected_at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS day,
                SUM(e.person_count) AS walkins
         FROM   meghavi_walkin_events e
         JOIN   meghavi_cameras c ON c.id = e.camera_id
         WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
           AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
           ${camFilter}
         GROUP  BY 1 ORDER BY 1`,
        [from, to, ...locParam]
      );
      const [staffDaily] = await pool.query(
        `SELECT to_char(date_trunc('day', e.detected_at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS day,
                ROUND(100.0 * COUNT(*) FILTER (WHERE NOT e.staff_present) / NULLIF(COUNT(*),0), 1) AS rate
         FROM   meghavi_staff_availability_events e
         JOIN   meghavi_cameras c ON c.id = e.camera_id
         WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
           AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
           ${camFilter}
         GROUP  BY 1 ORDER BY 1`,
        [from, to, ...locParam]
      );
      const [mgDaily] = await pool.query(
        `SELECT to_char(date_trunc('day', e.detected_at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS day,
                COUNT(*) AS total
         FROM   meghavi_meet_greet_events e
         JOIN   meghavi_cameras c ON c.id = e.camera_id
         WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
           AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
           ${camFilter}
         GROUP  BY 1 ORDER BY 1`,
        [from, to, ...locParam]
      );
      const walkinByDay = Object.fromEntries(walkinDaily.map((r) => [r.day, Number(r.walkins)]));
      const staffByDay  = Object.fromEntries(staffDaily.map((r)  => [r.day, Number(r.rate)]));
      const mgByDay     = Object.fromEntries(mgDaily.map((r)    => [r.day, Number(r.total)]));
      trend = [];
      for (let i = 0; i < spanDays; i++) {
        const d = new Date(fromMs + i * 86400000);
        const dayStr   = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
        const dayLabel = d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });
        trend.push({ hour: dayLabel, walkins: walkinByDay[dayStr] ?? 0, staff_unavail_pct: staffByDay[dayStr] ?? 0, meet_greet: mgByDay[dayStr] ?? 0 });
      }
    }

    // Total alert count — same criteria as GET /alerts so both pages agree.
    const [[alertCountRow]] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM meghavi_staff_availability_events e
          JOIN meghavi_cameras c ON c.id = e.camera_id
          WHERE NOT e.staff_present
            AND e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
            AND e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
            ${camFilter})
         +
         (SELECT COUNT(*) FROM meghavi_meet_greet_events e
          JOIN meghavi_cameras c ON c.id = e.camera_id
          WHERE (NOT e.greeted OR e.greet_delay_seconds > 300)
            AND e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
            AND e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
            ${camFilter})
         +
         (SELECT COUNT(*) FROM meghavi_walkin_events e
          JOIN meghavi_cameras c ON c.id = e.camera_id
          WHERE e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
            AND e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
            AND e.id NOT IN (SELECT event_id FROM meghavi_feedback WHERE module = 'walkins' AND feedback = 'thumbs_down')
            ${camFilter})
         AS total_alerts`,
      [from, to, ...locParam, from, to, ...locParam, from, to, ...locParam]
    );

    // Recent alerts (last 10 within the period) for the dashboard feed.
    const [alertRows] = await pool.query(
      `(
         SELECT 'staff_availability' AS module, 'high' AS severity,
                e.detected_at AS occurred_at, c.display_name AS camera_name,
                e.absent_duration_seconds, NULL::boolean AS greeted, e.snapshot_url
         FROM   meghavi_staff_availability_events e
         JOIN   meghavi_cameras c ON c.id = e.camera_id
         WHERE  NOT e.staff_present
           AND  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
           AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
           ${camFilter}
       ) UNION ALL (
         SELECT 'meet_greet' AS module, 'warning' AS severity,
                e.detected_at AS occurred_at, c.display_name AS camera_name,
                NULL AS absent_duration_seconds, e.greeted, e.snapshot_url
         FROM   meghavi_meet_greet_events e
         JOIN   meghavi_cameras c ON c.id = e.camera_id
         WHERE  (NOT e.greeted OR e.greet_delay_seconds > 300)
           AND  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
           AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
           ${camFilter}
       ) UNION ALL (
         SELECT 'walkin' AS module, 'info' AS severity,
                e.detected_at AS occurred_at, c.display_name AS camera_name,
                NULL::int AS absent_duration_seconds, NULL::boolean AS greeted, e.snapshot_url
         FROM   meghavi_walkin_events e
         JOIN   meghavi_cameras c ON c.id = e.camera_id
         WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
           AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
           AND  e.id NOT IN (SELECT event_id FROM meghavi_feedback WHERE module = 'walkins' AND feedback = 'thumbs_down')
           ${camFilter}
       )
       ORDER BY occurred_at DESC LIMIT 10`,
      [from, to, ...locParam, from, to, ...locParam, from, to, ...locParam]
    );

    // Previous period — walkins
    const [[prevWRow]] = await pool.query(
      `SELECT COALESCE(SUM(e.person_count), 0) AS total
       FROM   meghavi_walkin_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}`,
      [prevFrom, prevTo, ...locParam]
    );

    // Previous period — staff
    const [[prevSRow]] = await pool.query(
      `SELECT COALESCE(SUM(e.absent_duration_seconds) FILTER (WHERE NOT e.staff_present), 0) AS total_absent_secs
       FROM   meghavi_staff_availability_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}`,
      [prevFrom, prevTo, ...locParam]
    );

    // Previous period — meet & greet
    const [[prevMgRow]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM   meghavi_meet_greet_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}`,
      [prevFrom, prevTo, ...locParam]
    );

    // Previous period — alerts count
    const [[prevAlertRow]] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM meghavi_staff_availability_events e
          JOIN meghavi_cameras c ON c.id = e.camera_id
          WHERE NOT e.staff_present
            AND e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
            AND e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
            ${camFilter})
         +
         (SELECT COUNT(*) FROM meghavi_meet_greet_events e
          JOIN meghavi_cameras c ON c.id = e.camera_id
          WHERE (NOT e.greeted OR e.greet_delay_seconds > 300)
            AND e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
            AND e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
            ${camFilter})
         +
         (SELECT COUNT(*) FROM meghavi_walkin_events e
          JOIN meghavi_cameras c ON c.id = e.camera_id
          WHERE e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
            AND e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
            ${camFilter})
         AS total_alerts`,
      [prevFrom, prevTo, ...locParam, prevFrom, prevTo, ...locParam, prevFrom, prevTo, ...locParam]
    );

    const mgTotal      = Number(mgRow.total)   || 0;
    const mgUngreeted  = Number(mgRow.ungreeted) || 0;
    // Time-based rate: absent seconds vs (8-hour business day × spanDays), capped at 100.
    const dashAbsentSecs = Number(sRow.total_absent_secs) || 0;
    const dashUnavailPct = +(Math.min(100, (dashAbsentSecs / (8 * 3600 * spanDays)) * 100).toFixed(1));
    const prevAbsentSecs = Number(prevSRow.total_absent_secs) || 0;
    const prevUnavailPct = +(Math.min(100, (prevAbsentSecs / (8 * 3600 * spanDays)) * 100).toFixed(1));

    res.json({
      date:                          from,
      from,
      to,
      is_single_day:                 isSingleDay,
      walkins_today:                 Number(wRow.total),
      prev_walkins_today:            Number(prevWRow.total),
      staff_unavailability_pct:      dashUnavailPct,
      prev_staff_unavailability_pct: prevUnavailPct,
      total_absent_minutes:          Math.round(Number(sRow.total_absent_secs) / 60),
      meet_greet_total:              mgTotal,
      prev_meet_greet_total:         Number(prevMgRow.total) || 0,
      meet_greet_ungreeted:          mgUngreeted,
      greet_rate_pct:                mgTotal > 0 ? +((100 * (mgTotal - mgUngreeted) / mgTotal).toFixed(1)) : null,
      total_alerts:                  Number(alertCountRow.total_alerts) || 0,
      prev_total_alerts:             Number(prevAlertRow.total_alerts) || 0,
      trend,
      recent_alerts:                 alertRows,
    });
  } catch (e) {
    console.error("[meghavi] dashboard/summary:", e.message);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/meghavi/analytics/walkins
// Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD&location_id=<int>
// ---------------------------------------------------------------------------

router.get("/analytics/walkins", requireAuth, async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const dismissed = await getDismissed();
  return res.json(fileWalkinsAnalytics(from, to, dismissed));
  const locationId   = req.query.location_id ? Number(req.query.location_id) : null;
  const camFilter    = locationId ? "AND c.location_id = ?" : "";
  const locParam     = locationId ? [locationId] : [];

  const fromDate     = new Date(from + "T00:00:00");
  const numDays      = Math.round((new Date(to + "T00:00:00") - fromDate) / 86400000) + 1;
  const prevToDate   = new Date(fromDate.getTime() - 86400000);
  const prevFromDate = new Date(prevToDate.getTime() - (numDays - 1) * 86400000);
  const prevFrom     = prevFromDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const prevTo       = prevToDate.toLocaleDateString("en-CA",   { timeZone: "Asia/Kolkata" });

  try {
    const [[totRow]] = await pool.query(
      `SELECT COALESCE(SUM(e.person_count), 0) AS total
       FROM   meghavi_walkin_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}`,
      [from, to, ...locParam]
    );

    const [[peakRow]] = await pool.query(
      `SELECT to_char(date_trunc('hour', e.detected_at AT TIME ZONE 'Asia/Kolkata'), 'HH12:00 AM') AS peak_hour,
              SUM(e.person_count) AS peak_count
       FROM   meghavi_walkin_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}
       GROUP  BY 1 ORDER BY 2 DESC LIMIT 1`,
      [from, to, ...locParam]
    );

    const [[prevPeakRow]] = await pool.query(
      `SELECT to_char(date_trunc('hour', e.detected_at AT TIME ZONE 'Asia/Kolkata'), 'HH12:00 AM') AS peak_hour
       FROM   meghavi_walkin_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}
       GROUP  BY 1 ORDER BY SUM(e.person_count) DESC LIMIT 1`,
      [prevFrom, prevTo, ...locParam]
    );

    const [[camOnlineRow]] = await pool.query(
      `SELECT COUNT(DISTINCT e.camera_id) AS total
       FROM   meghavi_walkin_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.id NOT IN (SELECT event_id FROM meghavi_feedback WHERE module = 'walkins' AND feedback = 'thumbs_down')
         ${camFilter}`,
      [from, to, ...locParam]
    );

    const [hourlyRows] = await pool.query(
      `SELECT to_char(date_trunc('hour', e.detected_at AT TIME ZONE 'Asia/Kolkata'), 'HH24:00') AS hour,
              SUM(e.person_count) AS walkins
       FROM   meghavi_walkin_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}
       GROUP  BY 1 ORDER BY 1`,
      [from, to, ...locParam]
    );

    const [byDayRows] = await pool.query(
      `SELECT to_char(e.detected_at AT TIME ZONE 'Asia/Kolkata', 'Dy DD Mon') AS day,
              SUM(e.person_count) AS walkins
       FROM   meghavi_walkin_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.detected_at::date >= ?::date
         AND  e.detected_at::date <= ?::date
         ${camFilter}
       GROUP  BY to_char(e.detected_at AT TIME ZONE 'Asia/Kolkata', 'Dy DD Mon'),
                 (e.detected_at AT TIME ZONE 'Asia/Kolkata')::date
       ORDER  BY (e.detected_at AT TIME ZONE 'Asia/Kolkata')::date`,
      [from, to, ...locParam]
    );

    const [byCamRows] = await pool.query(
      `SELECT c.display_name AS location, SUM(e.person_count) AS walkins
       FROM   meghavi_walkin_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}
       GROUP  BY c.id, c.display_name ORDER BY walkins DESC`,
      [from, to, ...locParam]
    );

    const [events] = await pool.query(
      `SELECT e.id, c.camera_key, c.display_name AS camera_name, l.name AS location_name,
              e.detected_at, e.person_count, e.confidence, e.snapshot_url, e.video_url,
              COALESCE((e.metadata->>'dwell_seconds')::int, 0) AS dwell_seconds
       FROM   meghavi_walkin_events e
       JOIN   meghavi_cameras c  ON c.id  = e.camera_id
       JOIN   meghavi_locations l ON l.id = c.location_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.id NOT IN (SELECT event_id FROM meghavi_feedback WHERE module = 'walkins' AND feedback = 'thumbs_down')
         ${camFilter}
       ORDER  BY e.detected_at DESC LIMIT 100`,
      [from, to, ...locParam]
    );

    const [[prevTotRow]] = await pool.query(
      `SELECT COALESCE(SUM(e.person_count), 0) AS total,
              COALESCE(AVG((e.metadata->>'dwell_seconds')::int), 0) AS avg_dwell
       FROM   meghavi_walkin_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}`,
      [prevFrom, prevTo, ...locParam]
    );

    const [[dwellRow]] = await pool.query(
      `SELECT COALESCE(AVG((e.metadata->>'dwell_seconds')::int), 0) AS avg_dwell
       FROM   meghavi_walkin_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.id NOT IN (SELECT event_id FROM meghavi_feedback WHERE module = 'walkins' AND feedback = 'thumbs_down')
         ${camFilter}`,
      [from, to, ...locParam]
    );

    res.json({
      from, to,
      total:               Number(totRow.total),
      prev_total:          Number(prevTotRow.total),
      avg_dwell_seconds:      Math.round(Number(dwellRow.avg_dwell)),
      prev_avg_dwell_seconds: Math.round(Number(prevTotRow.avg_dwell)),
      peak_hour:      peakRow?.peak_hour     || null,
      prev_peak_hour: prevPeakRow?.peak_hour || null,
      peak_count:     peakRow ? Number(peakRow.peak_count) : 0,
      cameras_online: Number(camOnlineRow.total),
      hourly_trend: hourlyRows.map((r) => ({ hour: r.hour, walkins: Number(r.walkins) })),
      by_day:       byDayRows.map((r)  => ({ day: r.day,  walkins: Number(r.walkins) })),
      events,
    });
  } catch (e) {
    console.error("[meghavi] analytics/walkins:", e.message);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/meghavi/analytics/meet-greet
// ---------------------------------------------------------------------------

router.get("/analytics/meet-greet", requireAuth, async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const dismissed = await getDismissed();
  return res.json(fileMeetGreetAnalytics(from, to, dismissed));
  const locationId   = req.query.location_id ? Number(req.query.location_id) : null;
  const camFilter    = locationId ? "AND c.location_id = ?" : "";
  const locParam     = locationId ? [locationId] : [];

  const fromDate     = new Date(from + "T00:00:00");
  const numDays      = Math.round((new Date(to + "T00:00:00") - fromDate) / 86400000) + 1;
  const prevToDate   = new Date(fromDate.getTime() - 86400000);
  const prevFromDate = new Date(prevToDate.getTime() - (numDays - 1) * 86400000);
  const prevFrom     = prevFromDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const prevTo       = prevToDate.toLocaleDateString("en-CA",   { timeZone: "Asia/Kolkata" });

  try {
    const [[totRow]] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE e.greeted)                                               AS greeted,
         COUNT(*) FILTER (WHERE NOT e.greeted)                                           AS ungreeted,
         ROUND(AVG(e.greet_delay_seconds) FILTER (WHERE e.greeted AND e.greet_delay_seconds IS NOT NULL)) AS avg_delay_secs
       FROM   meghavi_meet_greet_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}`,
      [from, to, ...locParam]
    );

    const [hourlyRows] = await pool.query(
      `SELECT to_char(date_trunc('hour', e.detected_at AT TIME ZONE 'Asia/Kolkata'), 'HH24:00') AS hour,
              COUNT(*) AS total,
              COUNT(*) FILTER (WHERE e.greeted) AS greeted,
              ROUND(100.0 * COUNT(*) FILTER (WHERE e.greeted) / NULLIF(COUNT(*),0), 1) AS greet_rate_pct
       FROM   meghavi_meet_greet_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}
       GROUP  BY 1 ORDER BY 1`,
      [from, to, ...locParam]
    );

    const [events] = await pool.query(
      `SELECT e.id, c.camera_key, c.display_name AS camera_name, l.name AS location_name,
              e.detected_at, e.greeted, e.greet_delay_seconds, e.confidence, e.snapshot_url, e.video_url
       FROM   meghavi_meet_greet_events e
       JOIN   meghavi_cameras c  ON c.id  = e.camera_id
       JOIN   meghavi_locations l ON l.id = c.location_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}
       ORDER  BY e.detected_at DESC LIMIT 100`,
      [from, to, ...locParam]
    );

    const [[prevTotRow]] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE e.greeted)     AS greeted,
         COUNT(*) FILTER (WHERE NOT e.greeted) AS ungreeted,
         ROUND(AVG(e.greet_delay_seconds) FILTER (WHERE e.greeted AND e.greet_delay_seconds IS NOT NULL)) AS avg_delay_secs
       FROM   meghavi_meet_greet_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}`,
      [prevFrom, prevTo, ...locParam]
    );

    const total       = Number(totRow.total)   || 0;
    const greeted     = Number(totRow.greeted) || 0;
    const prevTotal   = Number(prevTotRow.total)   || 0;
    const prevGreeted = Number(prevTotRow.greeted) || 0;

    res.json({
      from, to,
      total_arrivals:               total,
      greeted,
      ungreeted:                    Number(totRow.ungreeted) || 0,
      greet_rate_pct:               total > 0 ? +(100 * greeted / total).toFixed(1) : null,
      avg_greet_delay_seconds:      totRow.avg_delay_secs ? Number(totRow.avg_delay_secs) : null,
      prev_total_arrivals:          prevTotal,
      prev_greeted:                 prevGreeted,
      prev_ungreeted:               Number(prevTotRow.ungreeted) || 0,
      prev_greet_rate_pct:          prevTotal > 0 ? +(100 * prevGreeted / prevTotal).toFixed(1) : null,
      prev_avg_greet_delay_seconds: prevTotRow.avg_delay_secs ? Number(prevTotRow.avg_delay_secs) : null,
      hourly: hourlyRows.map((r) => ({
        hour:           r.hour,
        total:          Number(r.total),
        greeted:        Number(r.greeted),
        ungreeted:      Number(r.total) - Number(r.greeted),
        greet_rate_pct: Number(r.greet_rate_pct),
      })),
      events,
    });
  } catch (e) {
    console.error("[meghavi] analytics/meet-greet:", e.message);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/meghavi/analytics/staff-availability
// ---------------------------------------------------------------------------

router.get("/analytics/staff-availability", requireAuth, async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const dismissed = await getDismissed();
  return res.json(fileStaffAnalytics(from, to, dismissed));
  const locationId   = req.query.location_id ? Number(req.query.location_id) : null;
  const camFilter    = locationId ? "AND c.location_id = ?" : "";
  const locParam     = locationId ? [locationId] : [];

  // Compute previous period of equal length (for comparison deltas).
  const fromDate  = new Date(from + "T00:00:00");
  const toDate    = new Date(to   + "T00:00:00");
  const numDays   = Math.round((toDate - fromDate) / 86400000) + 1;
  const prevToDate   = new Date(fromDate.getTime() - 86400000);
  const prevFromDate = new Date(prevToDate.getTime() - (numDays - 1) * 86400000);
  const prevFrom  = prevFromDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const prevTo    = prevToDate.toLocaleDateString("en-CA",   { timeZone: "Asia/Kolkata" });
  // Unavailability rate denominator: 8-hour business day per day in range.
  const BUSINESS_SECS = numDays * 8 * 3600;

  try {
    const [[totRow]] = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE NOT e.staff_present) AS absent_events,
         COALESCE(SUM(e.absent_duration_seconds) FILTER (WHERE NOT e.staff_present), 0) AS total_absent_secs,
         COUNT(DISTINCT c.camera_key) FILTER (WHERE NOT e.staff_present) AS affected_cam_count
       FROM   meghavi_staff_availability_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}`,
      [from, to, ...locParam]
    );

    // Previous period — same shape, used only for delta computation.
    const [[prevRow]] = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE NOT e.staff_present) AS absent_events,
         COALESCE(SUM(e.absent_duration_seconds) FILTER (WHERE NOT e.staff_present), 0) AS total_absent_secs,
         COUNT(DISTINCT c.camera_key) FILTER (WHERE NOT e.staff_present) AS affected_cam_count
       FROM   meghavi_staff_availability_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}`,
      [prevFrom, prevTo, ...locParam]
    );

    const [hourlyRows] = await pool.query(
      `SELECT to_char(date_trunc('hour', e.detected_at AT TIME ZONE 'Asia/Kolkata'), 'HH24:00') AS hour,
              ROUND(100.0 * COUNT(*) FILTER (WHERE NOT e.staff_present) / NULLIF(COUNT(*),0), 1) AS unavail_pct
       FROM   meghavi_staff_availability_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}
       GROUP  BY 1 ORDER BY 1`,
      [from, to, ...locParam]
    );

    const [byDayRows] = await pool.query(
      `SELECT to_char(date_trunc('day', e.detected_at AT TIME ZONE 'Asia/Kolkata'), 'Dy DD') AS day,
              ROUND(100.0 * COUNT(*) FILTER (WHERE NOT e.staff_present) / NULLIF(COUNT(*),0), 1) AS rate
       FROM   meghavi_staff_availability_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}
       GROUP  BY date_trunc('day', e.detected_at AT TIME ZONE 'Asia/Kolkata'), 1
       ORDER  BY date_trunc('day', e.detected_at AT TIME ZONE 'Asia/Kolkata')`,
      [from, to, ...locParam]
    );

    const [unattendedRows] = await pool.query(
      `SELECT e.id, c.camera_key, c.display_name AS area, c.area AS area_type,
              e.detected_at AS occurred_at, e.absent_duration_seconds, e.snapshot_url, e.video_url
       FROM   meghavi_staff_availability_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  NOT e.staff_present
         AND  e.absent_duration_seconds > 300
         AND  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}
       ORDER  BY e.detected_at DESC LIMIT 50`,
      [from, to, ...locParam]
    );

    // All absence events (no duration threshold) — for the capture table with video playback
    const [allAbsenceRows] = await pool.query(
      `SELECT e.id, c.camera_key, c.display_name AS camera_name, l.name AS location_name,
              e.detected_at, e.absent_duration_seconds, e.snapshot_url, e.video_url
       FROM   meghavi_staff_availability_events e
       JOIN   meghavi_cameras c  ON c.id  = e.camera_id
       JOIN   meghavi_locations l ON l.id = c.location_id
       WHERE  NOT e.staff_present
         AND  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.id NOT IN (SELECT event_id FROM meghavi_feedback WHERE module = 'staff_availability' AND feedback = 'thumbs_down')
         ${camFilter}
       ORDER  BY e.detected_at DESC LIMIT 200`,
      [from, to, ...locParam]
    );

    const absentEvents    = Number(totRow.absent_events)     || 0;
    const totalAbsentSecs = Number(totRow.total_absent_secs) || 0;
    const affectedCams    = Number(totRow.affected_cam_count)|| 0;
    const totalAbsentMins = Math.round(totalAbsentSecs / 60);
    // Time-based rate: absent seconds vs 8-hour business day (capped at 100).
    const unavailPct = +(Math.min(100, (totalAbsentSecs / BUSINESS_SECS) * 100).toFixed(1));

    const prevAbsentEvents    = Number(prevRow.absent_events)     || 0;
    const prevTotalAbsentSecs = Number(prevRow.total_absent_secs) || 0;
    const prevAffectedCams    = Number(prevRow.affected_cam_count)|| 0;
    const prevUnavailPct = +(Math.min(100, (prevTotalAbsentSecs / BUSINESS_SECS) * 100).toFixed(1));

    res.json({
      from, to,
      unavailability_pct:   unavailPct,
      total_absence_events: absentEvents,
      total_absent_minutes: totalAbsentMins,
      affected_cameras:     affectedCams,
      // Previous period — used by the frontend to compute comparison deltas.
      prev_unavailability_pct:   prevUnavailPct,
      prev_total_absence_events: prevAbsentEvents,
      prev_total_absent_minutes: Math.round(prevTotalAbsentSecs / 60),
      prev_affected_cameras:     prevAffectedCams,
      hourly_rate: hourlyRows.map((r) => ({ hour: r.hour, rate: Number(r.unavail_pct) })),
      by_day:      byDayRows.map((r)  => ({ day: r.day,  rate: Number(r.rate) })),
      unattended_areas: unattendedRows,
      events: allAbsenceRows,
    });
  } catch (e) {
    console.error("[meghavi] analytics/staff-availability:", e.message);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/meghavi/analytics/waiting-time
// Derived from meet_greet_events.greet_delay_seconds
// Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD&location_id=<int>
// ---------------------------------------------------------------------------

router.get("/analytics/waiting-time", requireAuth, async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const locationId   = req.query.location_id ? Number(req.query.location_id) : null;
  const camFilter    = locationId ? "AND c.location_id = ?" : "";
  const locParam     = locationId ? [locationId] : [];

  const fromDate     = new Date(from + "T00:00:00");
  const numDays      = Math.round((new Date(to + "T00:00:00") - fromDate) / 86400000) + 1;
  const prevToDate   = new Date(fromDate.getTime() - 86400000);
  const prevFromDate = new Date(prevToDate.getTime() - (numDays - 1) * 86400000);
  const prevFrom     = prevFromDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const prevTo       = prevToDate.toLocaleDateString("en-CA",   { timeZone: "Asia/Kolkata" });

  try {
    const [[totRow]] = await pool.query(
      `SELECT
         ROUND(AVG(e.greet_delay_seconds))  AS avg_wait,
         MAX(e.greet_delay_seconds)         AS max_wait,
         MIN(e.greet_delay_seconds)         AS min_wait,
         COUNT(*)                           AS customers_served
       FROM   meghavi_meet_greet_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.greet_delay_seconds IS NOT NULL
         AND  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}`,
      [from, to, ...locParam]
    );

    const [hourlyRows] = await pool.query(
      `SELECT to_char(date_trunc('hour', e.detected_at AT TIME ZONE 'Asia/Kolkata'), 'HH24:00') AS hour,
              ROUND(AVG(e.greet_delay_seconds)) AS avg_wait
       FROM   meghavi_meet_greet_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.greet_delay_seconds IS NOT NULL
         AND  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}
       GROUP  BY 1 ORDER BY 1`,
      [from, to, ...locParam]
    );

    const [distRows] = await pool.query(
      `SELECT
         CASE WHEN greet_delay_seconds < 300  THEN '< 5 min'
              WHEN greet_delay_seconds < 600  THEN '5–10 min'
              WHEN greet_delay_seconds < 1200 THEN '10–20 min'
              ELSE '> 20 min' END AS range,
         COUNT(*) AS count
       FROM   meghavi_meet_greet_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.greet_delay_seconds IS NOT NULL
         AND  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}
       GROUP  BY 1`,
      [from, to, ...locParam]
    );

    const [longWaitRows] = await pool.query(
      `SELECT e.id, c.display_name AS camera_name, l.name AS location_name,
              e.greet_delay_seconds AS wait_seconds, e.detected_at, e.greeted, e.snapshot_url
       FROM   meghavi_meet_greet_events e
       JOIN   meghavi_cameras c  ON c.id  = e.camera_id
       JOIN   meghavi_locations l ON l.id = c.location_id
       WHERE  e.greet_delay_seconds > 600
         AND  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.id NOT IN (SELECT event_id::int FROM meghavi_feedback WHERE module = 'waiting_time' AND feedback = 'thumbs_down' AND event_id ~ '^[0-9]+$')
         ${camFilter}
       ORDER  BY e.greet_delay_seconds DESC LIMIT 20`,
      [from, to, ...locParam]
    );

    const [byCamRows] = await pool.query(
      `SELECT c.display_name AS location, ROUND(AVG(e.greet_delay_seconds)) AS avg_wait_seconds
       FROM   meghavi_meet_greet_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.greet_delay_seconds IS NOT NULL
         AND  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}
       GROUP  BY c.id, c.display_name ORDER BY avg_wait_seconds DESC`,
      [from, to, ...locParam]
    );

    const [[prevTotRow]] = await pool.query(
      `SELECT
         ROUND(AVG(e.greet_delay_seconds)) AS avg_wait,
         COUNT(*)                          AS customers_served
       FROM   meghavi_meet_greet_events e
       JOIN   meghavi_cameras c ON c.id = e.camera_id
       WHERE  e.greet_delay_seconds IS NOT NULL
         AND  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}`,
      [prevFrom, prevTo, ...locParam]
    );

    const totalDist = distRows.reduce((s, r) => s + Number(r.count), 0) || 1;

    res.json({
      from, to,
      avg_wait_seconds:      totRow?.avg_wait  != null ? Number(totRow.avg_wait)  : null,
      max_wait_seconds:      totRow?.max_wait  != null ? Number(totRow.max_wait)  : null,
      min_wait_seconds:      totRow?.min_wait  != null ? Number(totRow.min_wait)  : null,
      customers_served:      Number(totRow?.customers_served) || 0,
      prev_avg_wait_seconds: prevTotRow?.avg_wait != null ? Number(prevTotRow.avg_wait) : null,
      prev_customers_served: Number(prevTotRow?.customers_served) || 0,
      hourly_trend:          hourlyRows.map((r) => ({ hour: r.hour, avg_wait: Number(r.avg_wait) })),
      distribution:          distRows.map((r) => ({
        range: r.range,
        count: Number(r.count),
        percentage: Math.round(100 * Number(r.count) / totalDist),
      })),
      long_wait_events:  longWaitRows,
      by_camera:         byCamRows.map((r) => ({ location: r.location, avg_wait_seconds: Number(r.avg_wait_seconds) })),
    });
  } catch (e) {
    console.error("[meghavi] analytics/waiting-time:", e.message);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/meghavi/ingest/frisking-bag
// Fields: camera_key, saved_at, frame_number?, video_time?, class_name?,
//         track_id?, confidence?, owner_id?, owner_distance_px?, metadata?
// ---------------------------------------------------------------------------

router.post("/ingest/frisking-bag", requireAuthOrInternal, friskingBagUpload, async (req, res) => {
  const {
    camera_key,
    saved_at          = new Date().toISOString(),
    frame_number      = null,
    video_time        = null,
    class_name        = "bag",
    track_id          = null,
    confidence        = null,
    owner_id          = null,
    owner_distance_px = null,
    metadata          = {},
  } = req.body || {};

  if (!camera_key) return bad(res, "camera_key is required");

  const cam = await resolveCamera(camera_key);
  if (!cam) return notFound(res, `Camera '${camera_key}' is not registered.`);

  const { snapshot_url, video_url } = extractMediaUrls(req, "frisking-bag");
  const thumbnailFile = req.files?.thumbnail?.[0];
  const thumbnail_url = thumbnailFile
    ? fileUrl("frisking-bag", thumbnailFile.filename)
    : snapshot_url;

  try {
    const [result] = await pool.query(
      `INSERT INTO meghavi_frisking_bag_events
         (camera_id, saved_at, frame_number, video_time, class_name, track_id,
          confidence, owner_id, owner_distance_px, thumbnail_url, snapshot_url, video_url, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [
        cam.id, saved_at,
        frame_number !== null ? Number(frame_number) : null,
        video_time || null,
        class_name || "bag",
        track_id   !== null ? Number(track_id)   : null,
        confidence !== null ? Number(confidence) : null,
        owner_id || null,
        owner_distance_px !== null ? Number(owner_distance_px) : null,
        thumbnail_url, snapshot_url, video_url,
        typeof metadata === "string" ? metadata : JSON.stringify(metadata),
      ]
    );
    res.status(201).json({ id: result.insertId, status: "ok", location: cam.location_name });
  } catch (e) {
    console.error("[meghavi] ingest/frisking-bag:", e.message);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/meghavi/ingest/frisking-bag/sync
// Trigger an immediate re-sync of frisking_log.json → DB (admin/internal only)
// ---------------------------------------------------------------------------

router.post("/ingest/frisking-bag/sync", requireAuthOrInternal, async (_req, res) => {
  try {
    await Promise.all([syncFriskingLog(), syncFriskingDirs()]);
    res.json({ status: "ok" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/meghavi/analytics/frisking-bag
// Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD&location_id=<int>
// ---------------------------------------------------------------------------

router.get("/analytics/frisking-bag", requireAuth, async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const locationId   = req.query.location_id ? Number(req.query.location_id) : null;
  const camFilter    = locationId ? "AND c.location_id = ?" : "";
  const locParam     = locationId ? [locationId] : [];

  const fromMs    = new Date(from + "T00:00:00").getTime();
  const toMs      = new Date(to   + "T00:00:00").getTime();
  const spanDays  = Math.round((toMs - fromMs) / 86400000) + 1;
  const prevFrom  = new Date(fromMs - spanDays * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const prevTo    = new Date(toMs   - spanDays * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  try {
    // KPI totals (excludes user-dismissed thumbs-down events for consistency)
    const [[totRow]] = await pool.query(
      `SELECT
         COUNT(*)                                AS total_detections,
         COUNT(DISTINCT e.track_id)             AS unique_track_ids,
         ROUND(AVG(e.confidence)::numeric, 3)   AS avg_confidence,
         COUNT(e.owner_id)                      AS with_owner
       FROM  meghavi_frisking_bag_events e
       LEFT JOIN meghavi_cameras c ON c.id = e.camera_id
       WHERE e.saved_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND e.saved_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND e.id NOT IN (SELECT event_id::int FROM meghavi_feedback WHERE module = 'frisking_bag' AND feedback = 'thumbs_down')
         ${camFilter}`,
      [from, to, ...locParam]
    );

    const [[prevTotRow]] = await pool.query(
      `SELECT COUNT(*) AS total_detections, COUNT(e.owner_id) AS with_owner
       FROM  meghavi_frisking_bag_events e
       LEFT JOIN meghavi_cameras c ON c.id = e.camera_id
       WHERE e.saved_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND e.saved_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}`,
      [prevFrom, prevTo, ...locParam]
    );

    // Events list
    const [eventsRows] = await pool.query(
      `SELECT e.id, e.saved_at, e.frame_number, e.video_time, e.class_name,
              e.track_id, e.confidence, e.owner_id, e.owner_distance_px,
              e.thumbnail_url, e.snapshot_url, e.video_url,
              COALESCE(c.display_name, 'Campus Camera') AS camera_name,
              COALESCE(NULLIF(l.name, ''), 'Woxsen University') AS location_name
       FROM  meghavi_frisking_bag_events e
       LEFT JOIN meghavi_cameras  c ON c.id  = e.camera_id
       LEFT JOIN meghavi_locations l ON l.id = c.location_id
       WHERE e.saved_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND e.saved_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND e.id NOT IN (SELECT event_id::int FROM meghavi_feedback WHERE module = 'frisking_bag' AND feedback = 'thumbs_down')
         ${camFilter}
       ORDER BY e.saved_at DESC
       LIMIT 500`,
      [from, to, ...locParam]
    );

    // Confidence distribution
    const [distRows] = await pool.query(
      `SELECT
         CASE WHEN e.confidence < 0.55 THEN '0.45–0.55'
              WHEN e.confidence < 0.65 THEN '0.55–0.65'
              WHEN e.confidence < 0.75 THEN '0.65–0.75'
              ELSE '0.75+' END AS bucket,
         COUNT(*) AS count
       FROM  meghavi_frisking_bag_events e
       LEFT JOIN meghavi_cameras c ON c.id = e.camera_id
       WHERE e.confidence IS NOT NULL
         AND e.saved_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND e.saved_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}
       GROUP BY 1
       ORDER BY 1`,
      [from, to, ...locParam]
    );

    // Detections over time (by hour)
    const [hourlyRows] = await pool.query(
      `SELECT to_char(date_trunc('hour', e.saved_at AT TIME ZONE 'Asia/Kolkata'), 'HH24:00') AS hour,
              COUNT(*) AS detections
       FROM  meghavi_frisking_bag_events e
       LEFT JOIN meghavi_cameras c ON c.id = e.camera_id
       WHERE e.saved_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND e.saved_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}
       GROUP BY 1 ORDER BY 1`,
      [from, to, ...locParam]
    );

    // Detections by day
    const [byDayRows] = await pool.query(
      `SELECT to_char(e.saved_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day,
              COUNT(*) AS detections
       FROM  meghavi_frisking_bag_events e
       LEFT JOIN meghavi_cameras c ON c.id = e.camera_id
       WHERE e.saved_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND e.saved_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}
       GROUP BY 1 ORDER BY 1`,
      [from, to, ...locParam]
    );

    const total = Number(totRow?.total_detections) || 0;
    const withOwner = Number(totRow?.with_owner) || 0;

    res.json({
      from, to,
      total_detections:      total,
      unique_track_ids:      Number(totRow?.unique_track_ids) || 0,
      avg_confidence:        totRow?.avg_confidence != null ? Number(totRow.avg_confidence) : null,
      owner_association_rate: total > 0 ? Math.round(100 * withOwner / total) : 0,
      prev_total_detections: Number(prevTotRow?.total_detections) || 0,
      prev_owner_association_rate: (() => {
        const pt = Number(prevTotRow?.total_detections) || 0;
        const po = Number(prevTotRow?.with_owner) || 0;
        return pt > 0 ? Math.round(100 * po / pt) : 0;
      })(),
      events: eventsRows,
      confidence_distribution: distRows.map((r) => ({ bucket: r.bucket, count: Number(r.count) })),
      hourly_trend: hourlyRows.map((r) => ({ hour: r.hour, detections: Number(r.detections) })),
      by_day: byDayRows.map((r) => ({ day: r.day, detections: Number(r.detections) })),
    });
  } catch (e) {
    console.error("[meghavi] analytics/frisking-bag:", e.message);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/meghavi/alerts
// Aggregates staff_availability (absent) + meet_greet (ungreeted / long delay)
// Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD&location_id=<int>
// ---------------------------------------------------------------------------

router.get("/alerts", requireAuth, async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const dismissed = await getDismissed();
  const fileResult = fileAlerts(from, to, dismissed);
  try {
    const [fbRows] = await pool.query(
      `SELECT e.id, e.saved_at, e.class_name, e.owner_id, e.thumbnail_url, e.snapshot_url, e.video_url,
              COALESCE(c.display_name, 'Campus Camera') AS camera_name,
              COALESCE(NULLIF(l.name, ''), 'Woxsen University') AS location_name
       FROM meghavi_frisking_bag_events e
       LEFT JOIN meghavi_cameras   c ON c.id  = e.camera_id
       LEFT JOIN meghavi_locations l ON l.id  = c.location_id
       WHERE e.saved_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND e.saved_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND e.id NOT IN (SELECT event_id::int FROM meghavi_feedback WHERE module = 'frisking_bag' AND feedback = 'thumbs_down')
       ORDER BY e.saved_at DESC`,
      [from, to]
    );
    if (fbRows.length > 0) {
      const NOW = Date.now();
      const fbEvents = fbRows.map(e => {
        const age = NOW - new Date(e.saved_at).getTime();
        const status = age < 3600000 ? "active" : age < 14400000 ? "investigating" : "resolved";
        return {
          id: `fb-${e.id}`,
          category: "frisking_bag",
          severity: e.owner_id ? "info" : "warning",
          status,
          title: e.owner_id ? "Bag Anomaly – Owner Linked" : "Bag Anomaly – Owner Not Found",
          description: `${e.class_name || "Bag"} detected at ${e.camera_name}`,
          location: e.location_name,
          camera: e.camera_name,
          occurred_at: e.saved_at,
          snapshot_url: e.thumbnail_url || e.snapshot_url || null,
          video_url: e.video_url || null,
        };
      });
      const merged = [...fileResult.events, ...fbEvents]
        .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
      const catC = {}, hourC = {}, statC = { active: 0, investigating: 0, resolved: 0 };
      for (const ev of merged) {
        catC[ev.category] = (catC[ev.category] || 0) + 1;
        const h = istHourStr(ev.occurred_at);
        hourC[h] = (hourC[h] || 0) + 1;
        statC[ev.status] = (statC[ev.status] || 0) + 1;
      }
      const total = merged.length;
      return res.json({
        ...fileResult,
        events: merged,
        breakdown: Object.entries(catC).map(([category, count]) => ({
          category, count, percentage: total > 0 ? +((100 * count / total).toFixed(1)) : 0,
        })),
        by_hour: Object.entries(hourC).sort().map(([hour, count]) => ({ hour, count })),
        status_summary: Object.entries(statC).map(([status, count]) => ({
          status, count, percentage: total > 0 ? +((100 * count / total).toFixed(1)) : 0,
        })),
      });
    }
  } catch (err) {
    console.error("[meghavi] frisking bag alerts merge failed:", err.message);
  }
  return res.json(fileResult);
  const locationId   = req.query.location_id ? Number(req.query.location_id) : null;
  const camFilter    = locationId ? "AND c.location_id = ?" : "";
  const locParam     = locationId ? [locationId] : [];

  try {
    const [staffRows] = await pool.query(
      `SELECT e.id, 'staff_unavailability' AS category,
              CASE WHEN e.absent_duration_seconds > 1200 THEN 'high'
                   WHEN e.absent_duration_seconds > 600  THEN 'warning'
                   ELSE 'info' END AS severity,
              e.detected_at AS occurred_at,
              c.display_name AS camera_name, c.camera_key,
              l.name AS location_name,
              e.absent_duration_seconds, e.snapshot_url, e.video_url
       FROM   meghavi_staff_availability_events e
       JOIN   meghavi_cameras c  ON c.id  = e.camera_id
       JOIN   meghavi_locations l ON l.id = c.location_id
       WHERE  NOT e.staff_present
         AND  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}`,
      [from, to, ...locParam]
    );

    const [meetRows] = await pool.query(
      `SELECT e.id, 'meet_greet' AS category,
              CASE WHEN NOT e.greeted THEN 'high'
                   WHEN e.greet_delay_seconds > 300 THEN 'warning'
                   ELSE 'info' END AS severity,
              e.detected_at AS occurred_at,
              c.display_name AS camera_name, c.camera_key,
              l.name AS location_name,
              e.greeted, e.greet_delay_seconds AS absent_duration_seconds,
              e.snapshot_url, e.video_url
       FROM   meghavi_meet_greet_events e
       JOIN   meghavi_cameras c  ON c.id  = e.camera_id
       JOIN   meghavi_locations l ON l.id = c.location_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         ${camFilter}`,
      [from, to, ...locParam]
    );

    const [walkinRows] = await pool.query(
      `SELECT e.id, 'walkins' AS category,
              CASE WHEN e.person_count > 5 THEN 'high'
                   WHEN e.person_count > 1 THEN 'warning'
                   ELSE 'info' END AS severity,
              e.detected_at AS occurred_at,
              c.display_name AS camera_name, c.camera_key,
              l.name AS location_name,
              NULL::int AS absent_duration_seconds, e.snapshot_url, e.video_url,
              e.person_count
       FROM   meghavi_walkin_events e
       JOIN   meghavi_cameras c  ON c.id  = e.camera_id
       JOIN   meghavi_locations l ON l.id = c.location_id
       WHERE  e.detected_at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.detected_at <  (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
         AND  e.id NOT IN (SELECT event_id::int FROM meghavi_feedback WHERE module = 'walkins' AND feedback = 'thumbs_down' AND event_id ~ '^[0-9]+$')
         ${camFilter}`,
      [from, to, ...locParam]
    );

    const NOW = Date.now();
    const ONE_HOUR   = 3_600_000;
    const FOUR_HOURS = 14_400_000;

    const allEvents = [...staffRows, ...meetRows, ...walkinRows]
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
      .map((e) => {
        const age    = NOW - new Date(e.occurred_at).getTime();
        const status = age < ONE_HOUR ? "active" : age < FOUR_HOURS ? "investigating" : "resolved";
        const title  = e.category === "staff_unavailability"
          ? (e.absent_duration_seconds > 1200 ? "Critical Staff Absence" : "Reception Unattended")
          : e.category === "meet_greet"
          ? (e.greeted ? (e.absent_duration_seconds > 300 ? "Long Wait Before Greeting" : "Customer Greeted") : "Customer Not Greeted")
          : e.category === "walkins" && e.person_count != null
          ? (e.person_count > 1 ? "Group Walk-in Detected" : "Walk-in Detected")
          : "Alert";
        const description = e.category === "staff_unavailability"
          ? `${e.camera_name} unattended for ${Math.round(e.absent_duration_seconds / 60)}m`
          : e.category === "walkins" && e.person_count != null
          ? `${e.person_count} person${e.person_count > 1 ? "s" : ""} detected at ${e.camera_name}`
          : e.category === "meet_greet"
          ? (e.greeted
              ? (e.absent_duration_seconds > 300
                  ? `Customer greeted after ${Math.round(e.absent_duration_seconds / 60)}m at ${e.camera_name}`
                  : `Customer greeted at ${e.camera_name}`)
              : `Customer not greeted at ${e.camera_name}`)
          : `Alert at ${e.camera_name}`;
        return {
          id: e.id,
          category: e.category,
          severity: e.severity,
          status,
          title,
          description,
          location:     e.location_name,
          camera:       e.camera_key,
          occurred_at:  e.occurred_at,
          snapshot_url: e.snapshot_url || null,
          video_url:    e.video_url    || null,
        };
      });

    const catLabelMap = { staff_unavailability: "Staff Unavailability", meet_greet: "Meet & Greet", walkins: "Walk-ins" };
    const catCounts   = {};
    const hourCounts  = {};
    const statusCounts = { Active: 0, Investigating: 0, Resolved: 0 };

    for (const ev of allEvents) {
      catCounts[ev.category] = (catCounts[ev.category] || 0) + 1;
      const h = new Date(ev.occurred_at).toLocaleString("en-IN", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).padStart(2, "0");
      hourCounts[h] = (hourCounts[h] || 0) + 1;
      const sk = ev.status.charAt(0).toUpperCase() + ev.status.slice(1);
      if (statusCounts[sk] !== undefined) statusCounts[sk]++;
    }

    const total = allEvents.length || 1;
    const breakdown = Object.entries(catCounts).map(([cat, cnt]) => ({
      category:   catLabelMap[cat] || cat,
      count:      Number(cnt),
      percentage: Math.round(100 * Number(cnt) / total),
    }));
    const by_hour = Object.entries(hourCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hour, count]) => ({ hour, count: Number(count) }));
    const statusTotal = allEvents.length || 1;
    const status_summary = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count: Number(count),
      percentage: Math.round(100 * Number(count) / statusTotal),
    }));

    res.json({ events: allEvents, breakdown, by_hour, status_summary });
  } catch (e) {
    console.error("[meghavi] alerts:", e.message);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/meghavi/feedback
// Save thumbs-up / thumbs-down inference feedback (false positives for training)
// ---------------------------------------------------------------------------

router.post("/feedback", requireAuth, async (req, res) => {
  const { event_id, module: mod, feedback, snapshot_url, video_url } = req.body;
  if (!event_id || !mod || !feedback) return res.status(400).json({ error: "bad_request" });
  try {
    await pool.query(
      `INSERT INTO meghavi_feedback (event_id, module, feedback, snapshot_url, video_url)
       VALUES (?, ?, ?, ?, ?)`,
      [event_id, mod, feedback, snapshot_url || null, video_url || null]
    );
    const auditModule = mod === "frisking_bag" ? MODULES.FRISKING
      : mod === "walkins"            ? MODULES.WALKINS
      : mod === "meet_greet"         ? MODULES.MEET_GREET
      : mod === "staff_availability" ? MODULES.STAFF
      : mod === "waiting_time"       ? MODULES.MEET_GREET
      : MODULES.ALERTS;
    record(req, {
      module:       auditModule,
      action:       feedback === "thumbs_down" ? "event.false_positive" : "event.confirmed",
      resourceType: mod,
      resourceId:   String(event_id),
      outcome:      "success",
      meta:         { feedback, module: mod },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("[meghavi] feedback:", e.message);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------------------------------------------------------------------------
// File-based data helpers (shared by /inferences + analytics endpoints)
// ---------------------------------------------------------------------------

const INFERENCE_ROOT = path.resolve(__dirname, "..", "..", "..", "inference-data");
const WALKINS_LOG    = path.join(INFERENCE_ROOT, "walkins", "walkin_log.json");
const FRISKING_LOG   = path.join(INFERENCE_ROOT, "frisking-bag", "frisking_log.json");
const STAFF_SQL_BAK  = path.resolve(__dirname, "..", "..", "sql", "bkp-receptionist-db-28-AUG-26.sql");

// ---------------------------------------------------------------------------
// File-based frisking bag sync — reads frisking_log.json and upserts into DB
// ---------------------------------------------------------------------------

async function syncFriskingLog() {
  const log = readJsonSafe(FRISKING_LOG);
  if (!log?.events?.length) return;
  let inserted = 0;
  for (const e of log.events) {
    if (!e.event_id && e.event_id !== 0) continue;
    const extId = String(e.event_id);
    try {
      const [existing] = await pool.query(
        `SELECT 1 FROM meghavi_frisking_bag_events WHERE external_event_id = ? LIMIT 1`,
        [extId]
      );
      if (existing.length > 0) continue;
      const cam = e.camera_key ? await resolveCamera(e.camera_key) : null;
      await pool.query(
        `INSERT INTO meghavi_frisking_bag_events
           (camera_id, saved_at, frame_number, video_time, class_name, track_id,
            confidence, owner_id, owner_distance_px, thumbnail_url, snapshot_url,
            video_url, metadata, external_event_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cam?.id ?? null,
          e.saved_at || new Date().toISOString(),
          e.frame_number ?? null,
          e.video_time   ?? null,
          e.class_name   ?? "bag",
          e.track_id     ?? null,
          e.confidence   ?? null,
          e.owner_id     ?? null,
          e.owner_distance_px ?? null,
          e.thumbnail_url ?? null,
          e.snapshot_url  ?? null,
          e.video_url     ?? null,
          JSON.stringify(e.metadata ?? {}),
          extId,
        ]
      );
      inserted++;
    } catch (err) {
      console.error(`[meghavi] frisking bag sync event ${extId}:`, err.message);
    }
  }
  if (inserted > 0) console.log(`[meghavi] synced ${inserted} frisking bag event(s) from frisking_log.json`);
}

// ---------------------------------------------------------------------------
// Dated-dir sync — reads inference-data/frisking-bag/YYYY-MM-DD/*.json
// Each file = one frame; may contain multiple bag detections.
// Filename format: HHMMSS_frameXXXXXX.json  (time encoded in name)
// ---------------------------------------------------------------------------

async function syncFriskingDirs() {
  const friskingRoot = path.join(INFERENCE_ROOT, "frisking-bag");
  const dates = dateDirs(friskingRoot);
  if (!dates.length) return;
  let inserted = 0;

  for (const date of dates) {
    const dir = path.join(friskingRoot, date);
    let files;
    try { files = fs.readdirSync(dir).filter(f => f.endsWith(".json")); }
    catch { continue; }

    for (const file of files) {
      const stem = file.replace(/\.json$/, "");
      const data = readJsonSafe(path.join(dir, file));
      if (!data?.bags?.length) continue;

      // Parse saved_at from dirname + HHMMSS prefix in filename
      const timePart = stem.split("_")[0];
      const hh = timePart.slice(0, 2) || "00";
      const mm = timePart.slice(2, 4) || "00";
      const ss = timePart.slice(4, 6) || "00";
      const savedAt = `${date}T${hh}:${mm}:${ss}+05:30`;

      // Format video_time from timestamp_s (seconds → HH:MM:SS)
      const ts  = Number(data.timestamp_s ?? 0);
      const vh  = String(Math.floor(ts / 3600)).padStart(2, "0");
      const vm  = String(Math.floor((ts % 3600) / 60)).padStart(2, "0");
      const vs  = String(Math.floor(ts % 60)).padStart(2, "0");
      const videoTime = `${vh}:${vm}:${vs}`;

      // Snapshot URL — JPG has the same stem as the JSON
      const jpgPath = path.join(dir, stem + ".jpg");
      const imgUrl  = fs.existsSync(jpgPath)
        ? `/inference-data/frisking-bag/${date}/${stem}.jpg`
        : null;

      for (const bag of data.bags) {
        const extId = `file_${date}_${stem}_${bag.track_id}`;
        const ownerId = (bag.owner !== null && bag.owner !== undefined && bag.owner.track_id !== undefined)
          ? String(bag.owner.track_id)
          : null;

        try {
          const [existing] = await pool.query(
            `SELECT 1 FROM meghavi_frisking_bag_events WHERE external_event_id = ? LIMIT 1`,
            [extId]
          );
          if (existing.length > 0) continue;
          await pool.query(
            `INSERT INTO meghavi_frisking_bag_events
               (camera_id, saved_at, frame_number, video_time, class_name, track_id,
                confidence, owner_id, owner_distance_px, thumbnail_url, snapshot_url,
                video_url, metadata, external_event_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              null,
              savedAt,
              data.frame_index ?? null,
              videoTime,
              bag.class_name ?? "bag",
              bag.track_id   ?? null,
              bag.confidence ?? null,
              ownerId,
              bag.owner?.distance_px ?? null,
              imgUrl,
              imgUrl,
              null,
              JSON.stringify(data),
              extId,
            ]
          );
          inserted++;
        } catch (err) {
          console.error(`[meghavi] frisking dir sync ${extId}:`, err.message);
        }
      }
    }
  }

  if (inserted > 0) console.log(`[meghavi] synced ${inserted} frisking bag event(s) from dated dirs`);
}

// Periodic re-sync every 30 s (startup sync is chained in the table-init above)
setInterval(() => Promise.all([
  syncFriskingLog().catch(()  => {}),
  syncFriskingDirs().catch(() => {}),
]), 30_000);

// Dynamically returns all YYYY-MM-DD date dirs under a module folder.
// No code change needed when new date folders are dropped by OMEN.
function dateDirs(moduleDir) {
  try {
    return fs.readdirSync(moduleDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
      .map(d => d.name).sort();
  } catch { return []; }
}

function readJsonSafe(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch { return null; }
}

function istDate(iso) {
  const ms = new Date(iso).getTime() + 5.5 * 3600000;
  const d  = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
}
function istHourStr(iso) {
  const ms = new Date(iso).getTime() + 5.5 * 3600000;
  return String(new Date(ms).getUTCHours()).padStart(2,"0") + ":00";
}
function prevPeriod(from, to) {
  const numDays = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
  const prevTo  = new Date(new Date(from).getTime() - 86400000).toISOString().slice(0,10);
  const prevFrom= new Date(new Date(from).getTime() - numDays*86400000).toISOString().slice(0,10);
  return { prevFrom, prevTo };
}

// Find the actual date dir containing a walkin crop file (files may have been
// migrated into a different date dir than their detected_at date).
const _walkinDirsCache = { dirs: null };
function remapWalkinUrl(u, preferredDate) {
  if (!u) return null;
  if (u.startsWith("/")) return u;   // already a resolved absolute path
  const file = u.split("/").pop();
  if (!_walkinDirsCache.dirs) {
    _walkinDirsCache.dirs = dateDirs(path.join(INFERENCE_ROOT, "walkins"));
  }
  const ordered = [preferredDate, ..._walkinDirsCache.dirs.filter(d => d !== preferredDate)];
  for (const d of ordered) {
    if (fs.existsSync(path.join(INFERENCE_ROOT, "walkins", d, "crops", file))) {
      return `/inference-data/walkins/${d}/crops/${file}`;
    }
  }
  return null;
}

// Reads individual *.json event files from dated subdirs under inference-data/walkins/
function loadSubdirWalkinRows() {
  const walkinRoot = path.join(INFERENCE_ROOT, "walkins");
  const rows = [];
  for (const date of dateDirs(walkinRoot)) {
    const dateDir = path.join(walkinRoot, date);
    let files;
    try { files = fs.readdirSync(dateDir); } catch { continue; }
    for (const fname of files) {
      if (!fname.endsWith(".json") || fname.startsWith(".")) continue;
      const ev = readJsonSafe(path.join(dateDir, fname));
      if (!ev || !ev.timestamp) continue;
      const raw = ev.timestamp || "";
      const detected_at = raw.includes("+") || raw.endsWith("Z") ? raw : raw + "+05:30";
      // body_crop / face_crop are relative paths like "data/walkins/YYYY-MM-DD/file.jpg"
      // Server serves /inference-data/* → inference-data/, so strip leading "data/" and prepend /inference-data/
      const toUrl = (p) => p ? `/inference-data/${p.replace(/^data\//, "")}` : null;
      rows.push({
        event_id: `walkin-${date}-tid${ev.track_id ?? fname}`,
        camera_key: ev.camera_id || "unknown",
        camera_name: ev.camera_id || "Campus Camera",
        location: "Campus",
        detected_at,
        person_count: 1,
        confidence: null,
        snapshot_url: toUrl(ev.body_crop ?? ev.full_frame),
        face_crop_url: ev.has_face ? toUrl(ev.face_crop) : null,
        dwell_seconds: 0,
      });
    }
  }
  return rows;
}

async function getDismissed() {
  try {
    const [rows] = await pool.query(`SELECT event_id, module FROM meghavi_feedback WHERE feedback = 'thumbs_down'`);
    const out = {};
    for (const r of rows) {
      if (!out[r.module]) out[r.module] = new Set();
      out[r.module].add(String(r.event_id));
    }
    return out;
  } catch { return {}; }
}

function loadStaffSqlRows() {
  try {
    const sql = fs.readFileSync(STAFF_SQL_BAK, "utf8");
    const re  = /\(\s*(\d+)\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*([\d.]+)\s*,\s*'([^']*)'\s*,\s*\d+\s*,\s*'[^']*'\s*,\s*'[^']*'\s*\)/g;
    const rows = []; let m;
    while ((m = re.exec(sql)) !== null) {
      const secs     = Math.round(parseFloat(m[6]));
      const filename = m[7].split(/[/\\]/).pop();
      rows.push({
        id: parseInt(m[1]), camera_key: m[2], camera_name: m[3],
        location: "Woxsen",
        detected_at: m[4], end_time: m[5],
        absent_duration_seconds: secs,
        severity: secs >= 600 ? "high" : secs >= 180 ? "moderate" : "low",
        snapshot_url: null,
        video_url: `/inference-data/staff-unavailability/2026-08-27/videos/${filename}`,
      });
    }
    return rows;
  } catch(e) { return []; }
}

function loadMGRows() {
  const rows = [];
  const mgRoot = path.join(INFERENCE_ROOT, "meet-greet");
  for (const date of dateDirs(mgRoot)) {
    const dateDir  = path.join(mgRoot, date);
    const logFile  = path.join(dateDir, `mg_log_${date}.json`);
    const events   = readJsonSafe(logFile);
    if (!Array.isArray(events)) continue;
    for (const ev of events) {
      const raw  = ev.saved_at || "";
      const detected_at = raw.includes("+") || raw.endsWith("Z") ? raw : raw + "+05:30";
      const pngName = ev.snapshot || "";
      const snapshot_url = pngName
        ? `/inference-data/meet-greet/${date}/snapshots/${pngName}`
        : null;
      rows.push({
        id: `${date}/${pngName || detected_at}`,
        camera_key: ev.camera_id || "Campus-Cam",
        camera_name: ev.camera_id === "Woxsen" ? "Woxsen Desk" : (ev.camera_id || ""),
        location: normalizeLocation(ev.site_name || "Woxsen"),
        detected_at,
        greeted: ev.status === "SUCCESS",
        duration_seconds: Math.round(ev.duration_seconds || 0),
        snapshot_url,
        customers_in_roi: ev.customers_in_roi || 0,
        staff_in_roi: ev.staff_in_roi || 0,
        status: ev.status || "",
        exit_reason: ev.exit_reason || "",
      });
    }
  }
  return rows.sort((a, b) => (a.detected_at || "").localeCompare(b.detected_at || ""));
}

function fileWalkinsAnalytics(from, to, dismissed = {}) {
  const dw  = dismissed.walkins ?? new Set();
  const legacyEvents = readJsonSafe(WALKINS_LOG)?.events ?? [];
  const subdirRows   = loadSubdirWalkinRows();
  const all = [...legacyEvents, ...subdirRows].filter(e => !dw.has(String(e.event_id)));
  const ev  = all.filter(e => { const d = istDate(e.detected_at); return d >= from && d <= to; });
  const total    = ev.reduce((s,e) => s + (e.person_count||1), 0);
  const evWithDwell = ev.filter(e => e.dwell_seconds > 0);
  const avgDwell = evWithDwell.length ? Math.round(evWithDwell.reduce((s,e)=>s+e.dwell_seconds,0)/evWithDwell.length) : 0;
  const hMap = {}; const dMap = {};
  for (const e of ev) {
    const h = istHourStr(e.detected_at); const d = istDate(e.detected_at);
    hMap[h] = (hMap[h]||0) + (e.person_count||1);
    dMap[d] = (dMap[d]||0) + (e.person_count||1);
  }
  const hourly_trend = Object.entries(hMap).sort((a,b)=>a[0].localeCompare(b[0])).map(([hour,walkins])=>({hour,walkins}));
  const peakE = hourly_trend.reduce((a,b)=>b.walkins>a.walkins?b:a, {hour:null,walkins:0});
  const by_day = Object.entries(dMap).sort().map(([d,walkins])=>({
    day: new Date(d+"T12:00:00Z").toLocaleDateString("en-IN",{weekday:"short",day:"2-digit",month:"short",timeZone:"UTC"}), walkins,
  }));
  const { prevFrom, prevTo } = prevPeriod(from, to);
  const pev = all.filter(e=>{const d=istDate(e.detected_at);return d>=prevFrom&&d<=prevTo;});
  return {
    from, to, total, prev_total: pev.reduce((s,e)=>s+(e.person_count||1),0),
    avg_dwell_seconds: avgDwell,
    prev_avg_dwell_seconds: (()=>{const pd=pev.filter(e=>e.dwell_seconds>0);return pd.length?Math.round(pd.reduce((s,e)=>s+e.dwell_seconds,0)/pd.length):0;})(),
    peak_hour: peakE.hour, prev_peak_hour: null, peak_count: peakE.walkins,
    cameras_online: new Set(ev.map(e=>e.camera_name)).size,
    hourly_trend, by_day,
    events: ev.map(e=>{
      const date = istDate(e.detected_at);
      return { id:e.event_id, camera_key:e.camera_key||e.camera_name, camera_name:e.camera_name,
        location_name:normalizeLocation(e.location), detected_at:e.detected_at, person_count:e.person_count,
        confidence:e.confidence, snapshot_url:remapWalkinUrl(e.snapshot_url,date), face_crop_url:remapWalkinUrl(e.face_crop_url,date), video_url:null, dwell_seconds:e.dwell_seconds||0 };
    }),
  };
}

function loadSubdirStaffRows() {
  const staffRoot = path.join(INFERENCE_ROOT, "staff-unavailability");
  const rows = [];
  for (const date of dateDirs(staffRoot)) {
    const dateDir = path.join(staffRoot, date);
    const events  = readJsonSafe(path.join(dateDir, `staff_log_${date}.json`));
    if (!Array.isArray(events)) continue;
    for (const ev of events) {
      const raw = ev.saved_at || "";
      const detected_at = raw.includes("+") || raw.endsWith("Z") ? raw : raw + "+05:30";
      const secs = Math.round(ev.duration_seconds || 0);
      const rawVideoFile = ev.video || "";
      const webFile  = rawVideoFile.replace(/\.mp4$/i, "_web.mp4");
      const webExists = fs.existsSync(path.join(dateDir, "videos-web", webFile));
      const videoFile = webExists ? webFile : rawVideoFile;
      const videoDir  = webExists ? "videos-web" : "videos";
      const video_url = videoFile
        ? `/inference-data/staff-unavailability/${date}/${videoDir}/${videoFile}`
        : null;
      rows.push({
        id: `staff-${date}-${videoFile || detected_at}`,
        camera_key: ev.camera_id || "",
        camera_name: ev.camera_id === "Woxsen" ? "Woxsen Desk" : (ev.camera_id || ""),
        location: normalizeLocation(ev.site_name || ""),
        detected_at,
        end_time: null,
        absent_duration_seconds: secs,
        severity: secs >= 600 ? "high" : secs >= 180 ? "moderate" : "low",
        snapshot_url: null,
        video_url,
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Overcrowding & After-Hours file loaders
// ---------------------------------------------------------------------------

function loadCrowdRows() {
  const root = path.join(INFERENCE_ROOT, "overcrowding");
  const rows = [];
  for (const date of dateDirs(root)) {
    const dateDir = path.join(root, date);
    let files;
    try { files = fs.readdirSync(dateDir); } catch { continue; }
    for (const fname of files) {
      if (!fname.endsWith(".json") || fname.startsWith(".")) continue;
      const ev = readJsonSafe(path.join(dateDir, fname));
      if (!ev || !ev.timestamp) continue;
      const raw = ev.timestamp;
      const detected_at = raw.includes("+") || raw.endsWith("Z") ? raw : raw + "+05:30";
      const toUrl = (p) => p ? `/inference-data/${p.replace(/^data\//, "")}` : null;
      rows.push({
        id: `crowd-${date}-${fname.replace(".json", "")}`,
        camera_id: ev.camera_id || "Campus-Cam",
        camera_name: ev.camera_id || "Campus Camera",
        location: "Woxsen University",
        detected_at,
        person_count: ev.person_count || 0,
        threshold: ev.threshold || 4,
        snapshot_url: toUrl(ev.snapshot),
        severity: (ev.person_count || 0) >= 6 ? "high" : "warning",
      });
    }
  }
  return rows;
}

function loadAfterHoursRows() {
  const root = path.join(INFERENCE_ROOT, "after_hours");
  const rows = [];
  for (const date of dateDirs(root)) {
    const dateDir = path.join(root, date);
    let files;
    try { files = fs.readdirSync(dateDir); } catch { continue; }
    for (const fname of files) {
      if (!fname.endsWith(".json") || fname.startsWith(".")) continue;
      const ev = readJsonSafe(path.join(dateDir, fname));
      if (!ev || !ev.timestamp) continue;
      const raw = ev.timestamp;
      const detected_at = raw.includes("+") || raw.endsWith("Z") ? raw : raw + "+05:30";
      // JSON snapshot paths use "data/afterhours/..." but the actual folder is "after_hours"
      const toUrl = (p) => p ? `/inference-data/${p.replace(/^data\/afterhours\//, "after_hours/")}` : null;
      rows.push({
        id: `ah-${date}-${fname.replace(".json", "")}`,
        camera_id: ev.camera_id || "Campus-Cam",
        camera_name: ev.camera_id || "Campus Camera",
        location: "Woxsen University",
        detected_at,
        person_count: ev.person_count || 0,
        business_hours: ev.business_hours || "09:00 – 18:00",
        snapshot_url: toUrl(ev.snapshot),
        severity: "warning",
      });
    }
  }
  return rows;
}

function fileStaffAnalytics(from, to, dismissed = {}) {
  const ds  = dismissed.staff_unavailability ?? new Set();
  const all = loadSubdirStaffRows().filter(e => !ds.has(String(e.id)));
  const ev  = all.filter(e=>{const d=istDate(e.detected_at);return d>=from&&d<=to;});
  const totalSecs = ev.reduce((s,e)=>s+e.absent_duration_seconds,0);
  const numDays   = Math.round((new Date(to)-new Date(from))/86400000)+1;
  const BSECS     = numDays*8*3600;
  const hMap={}; const dMap={};
  for (const e of ev) {
    const h=istHourStr(e.detected_at); const d=istDate(e.detected_at);
    hMap[h]=(hMap[h]||0)+e.absent_duration_seconds;
    dMap[d]=(dMap[d]||0)+e.absent_duration_seconds;
  }
  const { prevFrom, prevTo } = prevPeriod(from, to);
  const pev      = all.filter(e=>{const d=istDate(e.detected_at);return d>=prevFrom&&d<=prevTo;});
  const prevSecs = pev.reduce((s,e)=>s+e.absent_duration_seconds,0);
  return {
    from, to,
    unavailability_pct: +Math.min(100,(totalSecs/BSECS)*100).toFixed(1),
    total_absence_events: ev.length, total_absent_minutes: Math.round(totalSecs/60),
    affected_cameras: new Set(ev.map(e=>e.camera_key)).size,
    prev_unavailability_pct: +Math.min(100,(prevSecs/BSECS)*100).toFixed(1),
    prev_total_absence_events: pev.length, prev_total_absent_minutes: Math.round(prevSecs/60),
    prev_affected_cameras: new Set(pev.map(e=>e.camera_key)).size,
    hourly_rate: Object.entries(hMap).sort().map(([hour,s])=>({hour,rate:+((s/3600)*100).toFixed(1)})),
    by_day: Object.entries(dMap).sort().map(([d,s])=>({
      day:new Date(d+"T12:00:00Z").toLocaleDateString("en-IN",{weekday:"short",day:"2-digit",timeZone:"UTC"}),
      rate:+((s/(8*3600))*100).toFixed(1),
    })),
    unattended_areas: ev.filter(e=>e.absent_duration_seconds>300).map(e=>({
      id:e.id, camera_key:e.camera_key, area:e.camera_name, area_type:"reception",
      occurred_at:e.detected_at, absent_duration_seconds:e.absent_duration_seconds,
      snapshot_url:null, video_url:e.video_url,
    })),
    events: ev.map(e=>({ id:e.id, camera_key:e.camera_key, camera_name:e.camera_name,
      location_name:e.location, detected_at:e.detected_at,
      absent_duration_seconds:e.absent_duration_seconds, snapshot_url:null, video_url:e.video_url })),
  };
}

function fileMeetGreetAnalytics(from, to, dismissed = {}) {
  const dm   = dismissed.meet_greet ?? new Set();
  const all  = loadMGRows().filter(e => !dm.has(String(e.id)));
  const ev   = all.filter(e=>e.detected_at&&e.detected_at.slice(0,10)>=from&&e.detected_at.slice(0,10)<=to);
  const total = ev.length, greeted = ev.filter(e=>e.greeted).length;
  const hMap = {}, dMap = {};
  for (const e of ev) {
    const h=(e.detected_at||"00").slice(11,13)+":00";
    if (!hMap[h]) hMap[h]={total:0,greeted:0};
    hMap[h].total++; if(e.greeted) hMap[h].greeted++;
    const day=e.detected_at.slice(0,10);
    if (!dMap[day]) dMap[day]={total:0,greeted:0};
    dMap[day].total++; if(e.greeted) dMap[day].greeted++;
  }
  const { prevFrom, prevTo } = prevPeriod(from, to);
  const pev = all.filter(e=>e.detected_at&&e.detected_at.slice(0,10)>=prevFrom&&e.detected_at.slice(0,10)<=prevTo);
  const prevGreeted = pev.filter(e=>e.greeted).length;
  return {
    from, to, total_arrivals:total, greeted, ungreeted:total-greeted,
    greet_rate_pct: total>0?+(100*greeted/total).toFixed(1):null, avg_greet_delay_seconds:null,
    prev_total_arrivals:pev.length, prev_greeted:prevGreeted, prev_ungreeted:pev.length-prevGreeted,
    prev_greet_rate_pct: pev.length>0?+(100*prevGreeted/pev.length).toFixed(1):null,
    prev_avg_greet_delay_seconds: null,
    by_day: Object.entries(dMap).sort().map(([day,{total,greeted}])=>({
      day, total, greeted, ungreeted:total-greeted,
      greet_rate_pct:total>0?+(100*greeted/total).toFixed(1):0,
    })),
    hourly: Object.entries(hMap).sort().map(([hour,{total,greeted}])=>({
      hour, total, greeted, ungreeted:total-greeted,
      greet_rate_pct:total>0?+(100*greeted/total).toFixed(1):0,
    })),
    events: ev.map(e=>({ id:e.id, camera_key:e.camera_key, camera_name:e.camera_name,
      location_name:e.location, detected_at:e.detected_at, greeted:e.greeted,
      greet_delay_seconds:null, confidence:null, snapshot_url:e.snapshot_url, video_url:null,
      duration_seconds: e.duration_seconds, customers_in_roi: e.customers_in_roi,
      staff_in_roi: e.staff_in_roi, status: e.status, exit_reason: e.exit_reason })),
  };
}

// GET /api/meghavi/analytics/overcrowding
router.get("/analytics/overcrowding", requireAuth, (req, res) => {
  try {
    const { from, to } = parseDateRange(req.query);
    const all  = loadCrowdRows();
    const rows = all.filter(e => { const d = istDate(e.detected_at); return d >= from && d <= to; });
    const hMap = {}, dMap = {};
    for (const e of rows) {
      const h = istHourStr(e.detected_at); const d = istDate(e.detected_at);
      hMap[h] = (hMap[h]||0) + 1; dMap[d] = (dMap[d]||0) + 1;
    }
    const { prevFrom, prevTo } = prevPeriod(from, to);
    const prev = all.filter(e => { const d = istDate(e.detected_at); return d >= prevFrom && d <= prevTo; });
    const peakEntry = Object.entries(hMap).sort((a,b) => b[1]-a[1])[0];
    res.json({
      from, to,
      total: rows.length,
      prev_total: prev.length,
      cameras_active: new Set(rows.map(e => e.camera_id)).size,
      alerts_triggered: rows.filter(e => e.severity === "high").length,
      peak_hour: peakEntry ? peakEntry[0] : null,
      hourly_trend: Object.entries(hMap).sort().map(([hour,count]) => ({ hour, count })),
      by_day: Object.entries(dMap).sort().map(([d,count]) => ({
        day: new Date(d+"T12:00:00Z").toLocaleDateString("en-IN", { weekday:"short", day:"2-digit", month:"short", timeZone:"UTC" }), count,
      })),
      events: rows.map(e => ({
        id: e.id, camera_name: e.camera_name, location: e.location,
        detected_at: e.detected_at, person_count: e.person_count,
        threshold: e.threshold, severity: e.severity, snapshot_url: e.snapshot_url,
      })),
    });
  } catch(e) { console.error("[meghavi] overcrowding:", e.message); res.status(500).json({ error:"server_error" }); }
});

// GET /api/meghavi/analytics/after-hours
router.get("/analytics/after-hours", requireAuth, (req, res) => {
  try {
    const { from, to } = parseDateRange(req.query);
    const all  = loadAfterHoursRows();
    const rows = all.filter(e => { const d = istDate(e.detected_at); return d >= from && d <= to; });
    const hMap = {}, dMap = {};
    for (const e of rows) {
      const h = istHourStr(e.detected_at); const d = istDate(e.detected_at);
      hMap[h] = (hMap[h]||0) + 1; dMap[d] = (dMap[d]||0) + 1;
    }
    const { prevFrom, prevTo } = prevPeriod(from, to);
    const prev = all.filter(e => { const d = istDate(e.detected_at); return d >= prevFrom && d <= prevTo; });
    res.json({
      from, to,
      total: rows.length,
      prev_total: prev.length,
      cameras_triggered: new Set(rows.map(e => e.camera_id)).size,
      alerts_sent: rows.length,
      avg_duration: null,
      hourly_trend: Object.entries(hMap).sort().map(([hour,count]) => ({ hour, count })),
      events: rows.map(e => ({
        id: e.id, camera_name: e.camera_name, location: e.location,
        detected_at: e.detected_at, person_count: e.person_count,
        business_hours: e.business_hours, severity: e.severity, snapshot_url: e.snapshot_url,
      })),
    });
  } catch(e) { console.error("[meghavi] after-hours:", e.message); res.status(500).json({ error:"server_error" }); }
});

function fileAlerts(from, to, dismissed = {}) {
  const dw = dismissed.walkins ?? new Set();
  const ds = dismissed.staff_unavailability ?? new Set();
  const dm = dismissed.meet_greet ?? new Set();
  const NOW = Date.now();
  const walkinEv = [...(readJsonSafe(WALKINS_LOG)?.events??[]), ...loadSubdirWalkinRows()]
    .filter(e=>!dw.has(String(e.event_id)))
    .filter(e=>{const d=istDate(e.detected_at);return d>=from&&d<=to;})
    .map(e=>{
      const date = istDate(e.detected_at);
      return {id:`w-${e.event_id}`,category:"walkins",detected_at:e.detected_at,camera_key:e.camera_key||e.camera_name,
        camera_name:e.camera_name,location:normalizeLocation(e.location),snapshot_url:remapWalkinUrl(e.snapshot_url,date),video_url:null,
        person_count:e.person_count,greeted:null,absent_duration_seconds:null, dwell_seconds: e.dwell_seconds || 0,
        severity_raw:e.person_count>3?"high":"warning"};
    });
  const staffEv = [
    ...loadSubdirStaffRows().map(e=>({
      id:`s-${e.id}`,category:"staff_unavailability",detected_at:e.detected_at,
      camera_key:e.camera_key,camera_name:e.camera_name,location:e.location,
      snapshot_url:null,video_url:e.video_url,person_count:null,greeted:null,
      absent_duration_seconds:e.absent_duration_seconds,
      severity_raw:e.severity==="high"?"high":"warning"
    })).filter(e=>!ds.has(String(e.id))),
  ].filter(e=>{const d=istDate(e.detected_at);return d>=from&&d<=to;});
  const mgEv = loadMGRows()
    .filter(e=>!dm.has(String(e.id)))
    .filter(e=>e.detected_at&&e.detected_at.slice(0,10)>=from&&e.detected_at.slice(0,10)<=to)
    .map(e=>({id:`m-${e.id}`,category:"meet_greet",detected_at:e.detected_at,
      camera_key:e.camera_key,camera_name:e.camera_name,location:e.location,
      snapshot_url:e.snapshot_url,video_url:null,person_count:null,greeted:e.greeted,
      absent_duration_seconds:null,severity_raw:!e.greeted?"warning":"info"}));

  const crowdEv = loadCrowdRows()
    .filter(e=>{const d=istDate(e.detected_at);return d>=from&&d<=to;})
    .map(e=>({id:e.id,category:"overcrowding",detected_at:e.detected_at,
      camera_key:e.camera_id,camera_name:e.camera_name,location:e.location,
      snapshot_url:e.snapshot_url,video_url:null,person_count:e.person_count,
      greeted:null,absent_duration_seconds:null,dwell_seconds:0,severity_raw:e.severity}));

  const ahEv = loadAfterHoursRows()
    .filter(e=>{const d=istDate(e.detected_at);return d>=from&&d<=to;})
    .map(e=>({id:e.id,category:"after_hours",detected_at:e.detected_at,
      camera_key:e.camera_id,camera_name:e.camera_name,location:e.location,
      snapshot_url:e.snapshot_url,video_url:null,person_count:e.person_count,
      greeted:null,absent_duration_seconds:null,dwell_seconds:0,severity_raw:"warning"}));

  const allEv = [...staffEv,...mgEv,...walkinEv,...crowdEv,...ahEv].sort((a,b)=>new Date(b.detected_at)-new Date(a.detected_at));
  const events = allEv.map(e=>{
    const age=NOW-new Date(e.detected_at).getTime();
    const status=age<3600000?"active":age<14400000?"investigating":"resolved";
    const title=e.category==="staff_unavailability"?(e.absent_duration_seconds>1200?"Critical Staff Absence":"Reception Unattended")
      :e.category==="meet_greet"?(e.greeted?"Customer Greeted":"Customer Not Greeted")
      :e.category==="overcrowding"?"Crowd Gathering Detected"
      :e.category==="after_hours"?"After-Hours Activity Detected"
      :(e.person_count>1?"Group Walk-in Detected":"Walk-in Detected");
    const description=e.category==="staff_unavailability"?`${e.camera_name} unattended for ${Math.round(e.absent_duration_seconds/60)}m`
      :e.category==="walkins"?`${e.person_count} person${e.person_count>1?"s":""} at ${e.camera_name}`
      :e.category==="overcrowding"?`${e.person_count} persons detected at ${e.camera_name}`
      :e.category==="after_hours"?`${e.person_count} person${e.person_count>1?"s":""} detected outside hours at ${e.camera_name}`
      :(e.greeted?`Customer greeted at ${e.camera_name}`:`Customer not greeted at ${e.camera_name}`);
    return {id:e.id,category:e.category,severity:e.severity_raw,status,title,description,
      location:e.location,camera:e.camera_key,occurred_at:e.detected_at,
      snapshot_url:e.snapshot_url||null,video_url:e.video_url||null, dwell_seconds:e.dwell_seconds};
  });

  const catC={};const hourC={};const statC={active:0,investigating:0,resolved:0};
  for (const ev of events) {
    catC[ev.category]=(catC[ev.category]||0)+1;
    const h=istHourStr(ev.occurred_at); hourC[h]=(hourC[h]||0)+1;
    statC[ev.status]=(statC[ev.status]||0)+1;
  }
  const total=events.length;
  return {
    from, to, events,
    breakdown: Object.entries(catC).map(([category,count])=>({category,count,percentage:total>0?+((100*count/total).toFixed(1)):0})),
    by_hour: Object.entries(hourC).sort().map(([hour,count])=>({hour,count})),
    status_summary: Object.entries(statC).map(([status,count])=>({status,count,percentage:total>0?+((100*count/total).toFixed(1)):0})),
  };
}

function fileDashboard(from, to, dismissed = {}) {
  const dw = dismissed.walkins              ?? new Set();
  const ds = dismissed.staff_unavailability ?? new Set();
  const dm = dismissed.meet_greet           ?? new Set();
  const allWalkins = [...(readJsonSafe(WALKINS_LOG)?.events??[]), ...loadSubdirWalkinRows()].filter(e=>!dw.has(String(e.event_id)));
  const walkinEv = allWalkins.filter(e=>{const d=istDate(e.detected_at);return d>=from&&d<=to;});
  const walkinTotal = walkinEv.reduce((s,e)=>s+(e.person_count||1),0);
  const { prevFrom, prevTo } = prevPeriod(from, to);
  const prevWalkins = allWalkins.filter(e=>{const d=istDate(e.detected_at);return d>=prevFrom&&d<=prevTo;}).reduce((s,e)=>s+(e.person_count||1),0);
  const allStaff = [...loadStaffSqlRows(), ...loadSubdirStaffRows()].filter(e=>!ds.has(String(e.id)));
  const staffEv = allStaff.filter(e=>{const d=istDate(e.detected_at);return d>=from&&d<=to;});
  const totalAbsentSecs = staffEv.reduce((s,e)=>s+e.absent_duration_seconds,0);
  const numDays = Math.max(1, Math.round((new Date(to)-new Date(from))/86400000)+1);
  const unavailPct = +Math.min(100,(totalAbsentSecs/(numDays*8*3600))*100).toFixed(1);
  const prevStaffEv = allStaff.filter(e=>{const d=istDate(e.detected_at);return d>=prevFrom&&d<=prevTo;});
  const prevAbsentSecs = prevStaffEv.reduce((s,e)=>s+e.absent_duration_seconds,0);
  const prevUnavailPct = +Math.min(100,(prevAbsentSecs/(numDays*8*3600))*100).toFixed(1);
  const allMg = loadMGRows().filter(e=>!dm.has(String(e.id)));
  const mgEv = allMg.filter(e=>e.detected_at&&e.detected_at.slice(0,10)>=from&&e.detected_at.slice(0,10)<=to);
  const mgTotal = mgEv.length, mgUngreeted = mgEv.filter(e=>!e.greeted).length;
  const prevMgEv = allMg.filter(e=>e.detected_at&&e.detected_at.slice(0,10)>=prevFrom&&e.detected_at.slice(0,10)<=prevTo);
  const wMap={},sMap={},mMap={};
  for (const e of walkinEv) { const h=istHourStr(e.detected_at); wMap[h]=(wMap[h]||0)+(e.person_count||1); }
  for (const e of staffEv)  { const h=istHourStr(e.detected_at); sMap[h]=(sMap[h]||0)+e.absent_duration_seconds; }
  for (const e of mgEv)     { const h=(e.detected_at||"").slice(11,13)+":00"; mMap[h]=(mMap[h]||0)+1; }
  const trend=Array.from({length:24},(_,i)=>{
    const h=String(i).padStart(2,"0")+":00";
    return {hour:h,walkins:wMap[h]||0,staff_unavail_pct:+((sMap[h]||0)/3600*100).toFixed(1),meet_greet:mMap[h]||0};
  });
  const alertData = fileAlerts(from, to, dismissed);
  const prevAlertData = fileAlerts(prevFrom, prevTo, dismissed);
  // Build recent_alerts: take up to 4 from each category so all 3 types are represented,
  // then merge, sort by recency, and take top 10.
  const toShape = e => ({
    module: e.category, severity: e.severity, occurred_at: e.occurred_at, camera_name: e.camera,
    absent_duration_seconds: e.category==="staff_unavailability"
      ? staffEv.find(s=>`s-${s.id}`===e.id)?.absent_duration_seconds ?? null : null,
    greeted: e.category==="meet_greet" ? mgEv.find(m=>`m-${m.id}`===e.id)?.greeted ?? null : null,
    snapshot_url: e.snapshot_url||null,
  });
  const byCategory = {};
  for (const e of alertData.events) {
    if (!byCategory[e.category]) byCategory[e.category]=[];
    if (byCategory[e.category].length < 4) byCategory[e.category].push(e);
  }
  const recent_alerts = Object.values(byCategory).flat()
    .sort((a,b)=>new Date(b.occurred_at)-new Date(a.occurred_at))
    .slice(0,10).map(toShape);
  return {
    date: from, from, to, is_single_day: from===to,
    walkins_today: walkinTotal, prev_walkins_today: prevWalkins,
    staff_unavailability_pct: unavailPct, prev_staff_unavailability_pct: prevUnavailPct,
    total_absent_minutes: Math.round(totalAbsentSecs/60),
    meet_greet_total: mgTotal, prev_meet_greet_total: prevMgEv.length,
    meet_greet_ungreeted: mgUngreeted,
    greet_rate_pct: mgTotal>0?+(100*(mgTotal-mgUngreeted)/mgTotal).toFixed(1):null,
    total_alerts: alertData.events.length, prev_total_alerts: prevAlertData.events.length,
    crowd_events_today: alertData.events.filter(e=>e.category==="overcrowding").length,
    after_hours_today:  alertData.events.filter(e=>e.category==="after_hours").length,
    trend, recent_alerts,
  };
}

// ---------------------------------------------------------------------------
// GET /api/meghavi/inferences
// Reads raw inference JSON files from disk and returns unified event list.
// ---------------------------------------------------------------------------

router.get("/inferences", requireAuth, async (req, res) => {
  try {
    const dismissed = await getDismissed();
    const dw = dismissed.walkins ?? new Set();
    const ds = dismissed.staff_unavailability ?? new Set();
    const dm = dismissed.meet_greet ?? new Set();

    // Walk-ins
    const walkinLog = readJsonSafe(WALKINS_LOG);
    const walkins = (walkinLog?.events ?? []).filter(e => !dw.has(String(e.event_id))).map((e) => {
      const date = istDate(e.detected_at);
      return {
        id:           e.event_id,
        type:         "walkins",
        camera_name:  e.camera_name,
        location:     e.location,
        detected_at:  e.detected_at,
        person_count: e.person_count,
        confidence:   e.confidence,
        dwell_seconds: e.dwell_seconds,
        snapshot_url: remapWalkinUrl(e.snapshot_url,date),
        face_crop_url: remapWalkinUrl(e.face_crop_url,date),
        video_url:    null,
      };
    });

    // Staff Unavailability — all dated subdirs in inference-data/staff-unavailability/
    const staff = loadSubdirStaffRows().map((e) => ({
      id:                      e.id,
      type:                    "staff_unavailability",
      camera_name:             e.camera_name,
      location:                e.location,
      detected_at:             e.detected_at,
      end_time:                e.end_time || null,
      absent_duration_seconds: e.absent_duration_seconds,
      severity:                e.severity,
      snapshot_url:            null,
      video_url:               e.video_url || null,
    })).filter(e => !ds.has(String(e.id)));

    // Meet & Greet — reuse loadMGRows() which handles both legacy and mg_log_* formats
    const meetGreet = loadMGRows()
      .filter(e => !dm.has(String(e.id)))
      .map(e => ({
        id:               e.id,
        type:             "meet_greet",
        camera_name:      e.camera_name,
        location:         e.location,
        detected_at:      e.detected_at,
        event_subtype:    e.status === "SUCCESS" ? "greet" : "no_greet",
        greeted:          e.greeted,
        duration_seconds: e.duration_seconds,
        customers_in_roi: e.customers_in_roi,
        staff_in_roi:     e.staff_in_roi,
        status:           e.status,
        exit_reason:      e.exit_reason,
        snapshot_url:     e.snapshot_url,
        video_url:        null,
      }));

    res.json({ walkins, staff_unavailability: staff, meet_greet: meetGreet });
  } catch (e) {
    console.error("[meghavi] inferences:", e.message);
    res.status(500).json({ error: "server_error" });
  }
});

module.exports = {
  meghaviRouter: router,
  fileWalkinsAnalytics,
  fileMeetGreetAnalytics,
  fileStaffAnalytics,
  fileAlerts,
  getDismissed,
};
