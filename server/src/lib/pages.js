"use strict";

// The catalogue of protectable pages.
//
// This is the single source of truth for RBAC on the server. Each entry maps a
// page to the API path prefixes that back it, so revoking a page revokes its
// data too — hiding a nav item alone would leave the endpoints wide open to
// anyone who typed the URL.
//
// The client mirrors the keys in client/src/lib/permissions.tsx (PageKey union).

const PAGES = [
  // ─── WoxSight Analytics ───────────────────────────────────────────────────
  {
    key: "meghavi_dashboard",
    label: "Campus Dashboard",
    group: "WoxSight Analytics",
    route: "/dashboard",
    api: ["/meghavi/dashboard/summary"],
  },
  {
    key: "meghavi_walkins",
    label: "Walk-ins Analytics",
    group: "WoxSight Analytics",
    route: "/analytics/walk-ins",
    api: ["/meghavi/analytics/walkins"],
  },
  {
    key: "meghavi_meet_greet",
    label: "Meet & Greet Analytics",
    group: "WoxSight Analytics",
    route: "/analytics/meet-greet",
    api: ["/meghavi/analytics/meet-greet"],
  },
  {
    key: "meghavi_staff_unavailability",
    label: "Staff Unavailability",
    group: "WoxSight Analytics",
    route: "/analytics/staff-unavailability",
    api: ["/meghavi/analytics/staff-availability"],
  },
  {
    key: "meghavi_waiting_time",
    label: "Customer Waiting Time",
    group: "WoxSight Analytics",
    route: "/analytics/waiting-time",
    api: ["/meghavi/analytics/waiting-time"],
  },
  {
    key: "meghavi_frisking_bag",
    label: "Frisking Bag",
    group: "WoxSight Analytics",
    route: "/analytics/frisking-bag",
    api: ["/meghavi/analytics/frisking-bag"],
  },
  {
    key: "meghavi_alerts",
    label: "Active Alerts",
    group: "WoxSight Analytics",
    route: "/alerts",
    api: ["/meghavi/alerts"],
  },
  {
    key: "meghavi_reports",
    label: "Reports",
    group: "WoxSight Analytics",
    route: "/reports",
    // The Reports page re-uses the same analytics endpoints as the individual
    // pages and the email-send endpoint. No unique path to gate here — access
    // is enforced client-side via RequirePage; granting this key also grants
    // the user visibility of the Reports nav item.
    api: ["/meghavi/email/send"],
  },
  {
    key: "meghavi_cameras",
    label: "Cameras / Live View",
    group: "WoxSight Analytics",
    route: "/live",
    api: ["/meghavi/cameras", "/streams"],
  },

  // ─── Legacy / InferenceViewer pages ──────────────────────────────────────
  // Kept so existing DB grants are not invalidated.
  {
    key: "dashboard",
    label: "AI Dashboard (Legacy)",
    group: "WoxSight Legacy",
    route: "/dashboard",
    api: ["/inference/summary", "/inference/stats", "/inference/health", "/inference/timeline"],
  },
  {
    key: "daily_briefing",
    label: "AI Daily Briefing",
    group: "WoxSight Legacy",
    route: "/daily-briefing",
    api: ["/dashboard/daily-briefing"],
  },
  {
    key: "monitoring_walkins",
    label: "Walk-ins (Inference)",
    group: "WoxSight Legacy",
    route: "/monitoring/walkins",
    api: ["/inference/walkins", "/inference/kpis/walkins", "/inference/analytics/walkins", "/inference/export/walkins"],
  },
  {
    key: "monitoring_loitering",
    label: "Crowd Gathering",
    group: "WoxSight Analytics",
    route: "/analytics/crowd-gathering",
    api: ["/meghavi/analytics/overcrowding", "/inference/loitering", "/inference/kpis/loitering", "/inference/analytics/loitering", "/inference/export/loitering"],
  },
  {
    key: "monitoring_intrusion",
    label: "Intrusion",
    group: "WoxSight Legacy",
    route: "/monitoring/intrusion",
    api: ["/inference/intrusion", "/inference/kpis/intrusion", "/inference/analytics/intrusion", "/inference/export/intrusion"],
  },
  {
    key: "monitoring_after_hours",
    label: "After Hours",
    group: "WoxSight Analytics",
    route: "/analytics/after-hours",
    api: ["/meghavi/analytics/after-hours", "/inference/after-hours", "/inference/kpis/after_hours", "/inference/analytics/after_hours", "/inference/export/after_hours"],
  },
  {
    key: "monitoring_kitchen",
    label: "Kitchen Unattended",
    group: "WoxSight Legacy",
    route: "/monitoring/kitchen-unattended",
    api: ["/inference/kitchen-unattended", "/inference/kpis/kitchen_unattended", "/inference/analytics/kitchen_unattended", "/inference/export/kitchen_unattended"],
  },
  {
    key: "monitoring_chef_absence",
    label: "Chef Absence",
    group: "WoxSight Legacy",
    route: "/monitoring/chef-absence",
    api: [
      "/inference/chef-absence",
      "/inference/kpis/chef_absence",
      "/inference/analytics/chef_absence",
      "/inference/export/chef_absence",
    ],
  },
  {
    key: "active_alerts",
    label: "Active Alerts (Legacy)",
    group: "WoxSight Legacy",
    route: "/alerts",
    api: ["/dashboard/crowds-range-stats", "/dashboard/crowds-report-events"],
  },
  {
    key: "cameras_online",
    label: "Cameras Online",
    group: "WoxSight Legacy",
    route: "/live",
    api: ["/streams"],
  },
  {
    key: "known_faces",
    label: "Known Faces",
    group: "WoxSight Legacy",
    route: "/known-faces",
    api: ["/walking-enroll"],
  },
  {
    key: "inference_viewer",
    label: "Inference Viewer",
    group: "WoxSight Legacy",
    route: "/inference",
    api: ["/inference/media", "/inference/facets", "/inference/cameras"],
  },
  {
    key: "settings",
    label: "Settings",
    group: "Administration",
    route: "/settings",
    api: ["/settings"],
  },
  {
    key: "access_control",
    label: "Roles & Access",
    group: "Administration",
    route: "/settings/access",
    api: ["/rbac"],
  },
  {
    key: "audit_logs",
    label: "Audit Logs",
    group: "Administration",
    route: "/audit",
    api: ["/audit"],
  },
];

const PAGE_KEYS = PAGES.map((p) => p.key);
const PAGE_BY_KEY = Object.fromEntries(PAGES.map((p) => [p.key, p]));

/**
 * Which page guards a given API path, if any.
 * Longest prefix wins so /meghavi/analytics/walkins resolves to meghavi_walkins,
 * not a shorter prefix that might also match.
 */
function pageForApiPath(path) {
  let best = null;
  for (const p of PAGES) {
    for (const prefix of p.api) {
      if (
        path === prefix ||
        path.startsWith(`${prefix}/`) ||
        path.startsWith(`${prefix}?`) ||
        path.startsWith(`${prefix}.`)
      ) {
        if (!best || prefix.length > best.prefix.length) best = { page: p, prefix };
      }
    }
  }
  return best ? best.page : null;
}

module.exports = { PAGES, PAGE_KEYS, PAGE_BY_KEY, pageForApiPath };
