"use strict";

const express = require("express");
const { pool } = require("../db");
const { requireAuditAdmin } = require("../middleware/requireAuditAdmin");
const { CLIENT_EVENT_ALLOWLIST, record, MODULES } = require("../lib/auditService");

const router = express.Router();

// Helpers — all SQL uses ? placeholders; pool.query() rewrites them to $N via toPgSql()
function buildWhere(filters) {
  const clauses = [];
  const params = [];
  const push = (clause, value) => { clauses.push(clause); params.push(value); };

  if (filters.actor_id)      push("actor_id = ?",                   Number(filters.actor_id));
  if (filters.module)        push("module = ?",                      filters.module);
  if (filters.action)        push("action ILIKE ?",                  `%${filters.action}%`);
  if (filters.outcome)       push("outcome = ?",                     filters.outcome);
  if (filters.resource_type) push("resource_type = ?",               filters.resource_type);
  if (filters.from)          push("occurred_at >= ?::timestamptz",   filters.from);
  if (filters.to)            push("occurred_at <= ?::timestamptz",   filters.to);
  if (filters.session_id)    push("session_id = ?",                  filters.session_id);

  const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
  return { where, params };
}

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v).replace(/"/g, '""');
  return /[",\n\r]/.test(s) ? `"${s}"` : s;
}

// ── POST /client-event ── open to all authenticated users ──────────────────
router.post("/client-event", async (req, res) => {
  const { action, module: mod, resource_type, resource_id, meta } = req.body || {};
  if (!action || !CLIENT_EVENT_ALLOWLIST.has(String(action))) {
    return res.status(400).json({ error: "bad_request", message: "unknown or disallowed action" });
  }
  record(req, {
    module:       mod ?? "client",
    action:       String(action),
    resourceType: resource_type ?? null,
    resourceId:   resource_id  ?? null,
    meta:         meta ?? {},
  });
  return res.json({ ok: true });
});

// All remaining endpoints require audit admin
router.use(requireAuditAdmin);

// ── GET /events ─────────────────────────────────────────────────────────────
router.get("/events", async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit  ?? 100), 500);
    const offset = Number(req.query.offset ?? 0);
    const { where, params } = buildWhere(req.query);

    const countSql = `SELECT COUNT(*) AS cnt FROM audit_events ${where}`;
    const dataSql  = `
      SELECT id, occurred_at, actor_id, actor_email, actor_role, session_id,
             module, action, resource_type, resource_id,
             before_state, after_state, changes,
             outcome, ip_address, user_agent, meta
      FROM audit_events
      ${where}
      ORDER BY occurred_at DESC
      LIMIT ? OFFSET ?
    `;

    const [[{ cnt }]] = await pool.query(countSql, params);
    const [rows] = await pool.query(dataSql, [...params, limit, offset]);

    return res.json({ total: Number(cnt), limit, offset, events: rows });
  } catch (e) {
    console.error("[audit/events]", e.message);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /events/export ── CSV download ─────────────────────────────────────
router.get("/events/export", async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);
    const sql = `
      SELECT id, occurred_at, actor_email, actor_role, session_id,
             module, action, resource_type, resource_id,
             outcome, ip_address
      FROM audit_events ${where}
      ORDER BY occurred_at DESC
      LIMIT 10000
    `;
    const [rows] = await pool.query(sql, params);
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="audit-${today}.csv"`);
    res.write("id,occurred_at,actor_email,actor_role,session_id,module,action,resource_type,resource_id,outcome,ip_address\n");
    for (const r of rows) {
      res.write([r.id, r.occurred_at, r.actor_email, r.actor_role, r.session_id, r.module, r.action, r.resource_type, r.resource_id, r.outcome, r.ip_address].map(csvEscape).join(",") + "\n");
    }
    return res.end();
  } catch (e) {
    console.error("[audit/export]", e.message);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /facets ── distinct filter values ───────────────────────────────────
router.get("/facets", async (req, res) => {
  try {
    const [[mods], [actions], [actors]] = await Promise.all([
      pool.query(`SELECT DISTINCT module FROM audit_events ORDER BY module`),
      pool.query(`SELECT DISTINCT action FROM audit_events ORDER BY action LIMIT 200`),
      pool.query(`SELECT DISTINCT actor_id, actor_email FROM audit_events WHERE actor_id IS NOT NULL ORDER BY actor_email`),
    ]);
    return res.json({ modules: mods.map((r) => r.module), actions: actions.map((r) => r.action), actors });
  } catch (e) {
    console.error("[audit/facets]", e.message);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /users ── full roster with event counts (all users, not just those with events) ─────
router.get("/users", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        u.id,
        u.email,
        u.role,
        u.disabled_at IS NOT NULL                                    AS disabled,
        COUNT(ae.id)                                                 AS event_count,
        MAX(ae.occurred_at)                                          AS last_seen,
        COUNT(ae.id) FILTER (WHERE ae.outcome = 'failure')          AS failure_count,
        (SELECT MAX(l.occurred_at) FROM user_login_events l WHERE l.user_id = u.id) AS last_login
      FROM anpr_app_users u
      LEFT JOIN audit_events ae ON ae.actor_id = u.id
      GROUP BY u.id, u.email, u.role, u.disabled_at
      ORDER BY last_seen DESC NULLS LAST, u.email
    `);
    return res.json({ users: rows });
  } catch (e) {
    console.error("[audit/users]", e.message);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /users/:id/timeline ── merged audit + login events ──────────────────
router.get("/users/:id/timeline", async (req, res) => {
  try {
    const uid   = Number(req.params.id);
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const from  = req.query.from ?? null;
    const to    = req.query.to   ?? null;

    const ap = [uid];
    let awhere = "WHERE actor_id = ?";
    if (from) { awhere += " AND occurred_at >= ?::timestamptz"; ap.push(from); }
    if (to)   { awhere += " AND occurred_at <= ?::timestamptz"; ap.push(to);   }

    const [auditRows] = await pool.query(
      `SELECT id, occurred_at, 'audit' AS kind, module, action, outcome, ip_address, session_id, resource_type, resource_id, changes
       FROM audit_events ${awhere} ORDER BY occurred_at DESC LIMIT ${limit}`,
      ap
    );

    const lp = [uid];
    let lwhere = "WHERE user_id = ?";
    if (from) { lwhere += " AND occurred_at >= ?::timestamptz"; lp.push(from); }
    if (to)   { lwhere += " AND occurred_at <= ?::timestamptz"; lp.push(to);   }

    const [loginRows] = await pool.query(
      `SELECT id, occurred_at, 'login' AS kind, 'auth' AS module, 'user.login' AS action, outcome, ip_address, NULL AS session_id, NULL AS resource_type, NULL AS resource_id, NULL AS changes
       FROM user_login_events ${lwhere} ORDER BY occurred_at DESC LIMIT 50`,
      lp
    );

    const combined = [...auditRows, ...loginRows]
      .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
      .slice(0, limit);
    return res.json({ events: combined });
  } catch (e) {
    console.error("[audit/users/:id/timeline]", e.message);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /users/:id/sessions ── session summary ──────────────────────────────
router.get("/users/:id/sessions", async (req, res) => {
  try {
    const uid = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT
         session_id,
         MIN(occurred_at) AS started_at,
         MAX(occurred_at) AS last_active,
         COUNT(*)         AS event_count,
         MAX(ip_address)  AS ip_address
       FROM audit_events
       WHERE actor_id = ? AND session_id IS NOT NULL
       GROUP BY session_id
       ORDER BY last_active DESC
       LIMIT 30`,
      [uid]
    );
    return res.json({ sessions: rows });
  } catch (e) {
    console.error("[audit/users/:id/sessions]", e.message);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /logins ── login event list ─────────────────────────────────────────
router.get("/logins", async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit ?? 100), 500);
    const offset = Number(req.query.offset ?? 0);
    const clauses = [];
    const p = [];
    const push = (c, v) => { clauses.push(c); p.push(v); };

    if (req.query.user_id) push("user_id = ?",                  Number(req.query.user_id));
    if (req.query.outcome) push("outcome = ?",                   req.query.outcome);
    if (req.query.from)    push("occurred_at >= ?::timestamptz", req.query.from);
    if (req.query.to)      push("occurred_at <= ?::timestamptz", req.query.to);

    const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
    const [[{ cnt }]] = await pool.query(`SELECT COUNT(*) AS cnt FROM user_login_events ${where}`, p);
    const [rows] = await pool.query(
      `SELECT id, occurred_at, user_id, email, ip_address, user_agent, outcome
       FROM user_login_events ${where} ORDER BY occurred_at DESC LIMIT ? OFFSET ?`,
      [...p, limit, offset]
    );
    return res.json({ total: Number(cnt), limit, offset, logins: rows });
  } catch (e) {
    console.error("[audit/logins]", e.message);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /users/:id/export ── CSV for a user ─────────────────────────────────
router.get("/users/:id/export", async (req, res) => {
  try {
    const uid = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT id, occurred_at, module, action, resource_type, resource_id,
              outcome, ip_address, session_id, changes
       FROM audit_events WHERE actor_id = ? ORDER BY occurred_at DESC LIMIT 5000`,
      [uid]
    );
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="audit-user-${uid}.csv"`);
    res.write("id,occurred_at,module,action,resource_type,resource_id,outcome,ip_address,session_id\n");
    for (const r of rows) {
      res.write([r.id, r.occurred_at, r.module, r.action, r.resource_type, r.resource_id, r.outcome, r.ip_address, r.session_id].map(csvEscape).join(",") + "\n");
    }
    return res.end();
  } catch (e) {
    console.error("[audit/users/:id/export]", e.message);
    return res.status(500).json({ error: "server_error" });
  }
});

module.exports = { auditRouter: router };
