"use strict";

const crypto = require("crypto");
const jwt    = require("jsonwebtoken");
const { pool } = require("../db");

const REDACTED  = "••••";
const SENSITIVE = new Set([
  "stream_url", "password", "password_hash", "token", "secret",
  "api_key", "access_token", "refresh_token",
]);

const MODULES = {
  AUTH:       "auth",
  USERS:      "users",
  CAMERAS:    "cameras",
  WALKINS:    "walkins",
  MEET_GREET: "meet_greet",
  FRISKING:   "frisking",
  STAFF:      "staff",
  ALERTS:     "alerts",
  SETTINGS:   "settings",
  RBAC:       "rbac",
  CHAT:       "chat",
  LIVE_VIEW:  "live_view",
  REPORTS:    "reports",
};

// Allowlist for browser-reported client events
const CLIENT_EVENT_ALLOWLIST = new Set([
  "live.view_camera",
  "live.open_stream",
  "live.close_stream",
  "reports.download_pdf",
  "reports.send_email",
  "alerts.view_event",
  "alerts.dismiss_event",
  "analytics.filter_applied",
  "search.run",
  "user.logout",
]);

// Create tables once on startup
pool.query(`
  CREATE TABLE IF NOT EXISTS audit_events (
    id            BIGSERIAL    PRIMARY KEY,
    occurred_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    actor_id      INTEGER,
    actor_email   VARCHAR(255),
    actor_role    VARCHAR(64),
    session_id    VARCHAR(16),
    module        VARCHAR(64)  NOT NULL,
    action        VARCHAR(128) NOT NULL,
    resource_type VARCHAR(64),
    resource_id   VARCHAR(255),
    before_state  JSONB,
    after_state   JSONB,
    changes       JSONB,
    outcome       VARCHAR(16)  NOT NULL DEFAULT 'success',
    ip_address    TEXT,
    user_agent    TEXT,
    meta          JSONB        DEFAULT '{}'
  )
`).catch((e) => console.error("[audit] audit_events init:", e.message));

pool.query(`
  CREATE TABLE IF NOT EXISTS user_login_events (
    id          BIGSERIAL    PRIMARY KEY,
    occurred_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    user_id     INTEGER,
    email       VARCHAR(255),
    ip_address  TEXT,
    user_agent  TEXT,
    outcome     VARCHAR(16)  NOT NULL DEFAULT 'success'
  )
`).catch((e) => console.error("[audit] user_login_events init:", e.message));

// Indexes for common query patterns
pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_events_actor    ON audit_events(actor_id)`)
  .catch(() => {});
pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_events_occurred ON audit_events(occurred_at DESC)`)
  .catch(() => {});
pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_events_module   ON audit_events(module)`)
  .catch(() => {});
pool.query(`CREATE INDEX IF NOT EXISTS idx_login_events_user     ON user_login_events(user_id)`)
  .catch(() => {});

function sessionIdFromReq(req) {
  const h = String(req?.headers?.authorization || "");
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  try {
    const payload = jwt.decode(m[1]);
    if (!payload?.sub) return null;
    return crypto.createHash("sha256")
      .update(`${payload.sub}:${payload.iat || 0}`)
      .digest("hex")
      .slice(0, 16);
  } catch { return null; }
}

function diff(before, after) {
  if (!before || !after) return null;
  const changes = {};
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      const sens = SENSITIVE.has(k.toLowerCase());
      changes[k] = { before: sens ? REDACTED : before[k], after: sens ? REDACTED : after[k] };
    }
  }
  return Object.keys(changes).length ? changes : null;
}

function getIp(req) {
  return (String(req?.headers?.["x-forwarded-for"] || "").split(",")[0]?.trim() || req?.ip || null);
}

function record(req, event) {
  // Fire-and-forget — never awaited, never throws
  setImmediate(async () => {
    try {
      const actor = req?.user;
      // Allow callers to pass actor info explicitly (e.g. login — req.user is null pre-auth)
      const actorId    = event.actorId    ?? actor?.id    ?? null;
      const actorEmail = event.actorEmail ?? actor?.email ?? null;
      const actorRole  = event.actorRole  ?? actor?.role  ?? null;
      await pool.query(
        `INSERT INTO audit_events
           (actor_id, actor_email, actor_role, session_id, module, action,
            resource_type, resource_id, before_state, after_state, changes,
            outcome, ip_address, user_agent, meta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          actorId,
          actorEmail,
          actorRole,
          sessionIdFromReq(req),
          String(event.module || "unknown"),
          String(event.action || "unknown"),
          event.resourceType ?? null,
          event.resourceId  != null ? String(event.resourceId) : null,
          event.before  ? JSON.stringify(event.before)  : null,
          event.after   ? JSON.stringify(event.after)   : null,
          event.changes ? JSON.stringify(event.changes) : null,
          event.outcome ?? "success",
          getIp(req),
          req?.headers?.["user-agent"] ?? null,
          event.meta ? JSON.stringify(event.meta) : "{}",
        ]
      );
    } catch { /* swallow — audit must never break the action */ }
  });
}

function recordLogin(req, { userId, email, outcome = "success" }) {
  setImmediate(async () => {
    try {
      await pool.query(
        `INSERT INTO user_login_events (user_id, email, ip_address, user_agent, outcome)
         VALUES (?, ?, ?, ?, ?)`,
        [userId ?? null, email ?? null, getIp(req), req?.headers?.["user-agent"] ?? null, outcome]
      );
    } catch { /* swallow */ }
  });
}

module.exports = { MODULES, record, recordLogin, diff, sessionIdFromReq, CLIENT_EVENT_ALLOWLIST };
