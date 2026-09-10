// Human-readable labels for audit event actions
export const ACTION_LABELS: Record<string, string> = {
  "user.login":                  "Logged in",
  "user.logout":                 "Logged out",
  "user.login_failed":           "Login failed",
  "user.password_changed":       "Changed password",
  "user.created":                "Created user",
  "user.updated":                "Updated user",
  "user.deleted":                "Deleted user",
  "user.role_changed":           "Changed role",
  "user.disabled":               "Disabled user",
  "user.enabled":                "Enabled user",
  "rbac.grant":                  "Granted page access",
  "rbac.revoke":                 "Revoked page access",
  "camera.created":              "Added camera",
  "camera.updated":              "Updated camera",
  "camera.deleted":              "Deleted camera",
  "camera.stream_opened":        "Opened stream",
  "settings.updated":            "Updated settings",
  "alert.dismissed":             "Dismissed alert",
  "alert.viewed":                "Viewed alert",
  "walkins.export":              "Exported walk-ins",
  "meet_greet.export":           "Exported meet & greet",
  "staff.export":                "Exported staff data",
  "frisking.export":             "Exported frisking data",
  "report.downloaded":           "Downloaded report",
  "report.emailed":              "Emailed report",
  "live.view_camera":            "Viewed live camera",
  "live.open_stream":            "Opened stream",
  "live.close_stream":           "Closed stream",
  "reports.download_pdf":        "Downloaded PDF report",
  "reports.send_email":          "Sent email report",
  "alerts.view_event":           "Viewed alert event",
  "alerts.dismiss_event":        "Dismissed alert event",
  "analytics.filter_applied":    "Applied analytics filter",
  "search.run":                  "Ran search",
  "event.false_positive":        "Marked as false positive",
  "event.confirmed":             "Confirmed detection",
};

export function actionLabel(action: string): string {
  // Longest-prefix match
  let best = "";
  let bestLen = 0;
  for (const [k, v] of Object.entries(ACTION_LABELS)) {
    if (action.startsWith(k) && k.length > bestLen) { best = v; bestLen = k.length; }
  }
  return best || action;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR   = 60 * MINUTE;
const DAY    = 24 * HOUR;

export function ago(ts: string | Date | null | undefined): string {
  if (!ts) return "never";
  const diff = Date.now() - new Date(ts).getTime();
  if (isNaN(diff)) return "—";
  if (diff < 2 * MINUTE)  return "just now";
  if (diff < HOUR)         return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < 2 * HOUR)    return "1 hour ago";
  if (diff < DAY)          return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 2 * DAY)     return "yesterday";
  return `${Math.floor(diff / DAY)} days ago`;
}

export function fmtWhen(ts: string | Date): string {
  return new Date(ts).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
}

export function fmtDate(ts: string | Date): string {
  return new Date(ts).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
  });
}

const TONES = [
  "#0B4964", "#5C9270", "#C9964A", "#7C3AED", "#C96B6B",
  "#2563EB", "#059669", "#D97706", "#7C3AED", "#DC2626",
];

export function avatarTone(email: string): string {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

export function avatarInitials(email: string): string {
  const parts = email.split("@")[0].split(/[._-]/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || email.slice(0, 2).toUpperCase();
}

export const MODULE_LABELS: Record<string, string> = {
  auth:       "Auth",
  users:      "Users",
  cameras:    "Cameras",
  walkins:    "Walk-ins",
  meet_greet: "Meet & Greet",
  frisking:   "Frisking",
  staff:      "Staff",
  alerts:     "Alerts",
  settings:   "Settings",
  rbac:       "Access Control",
  chat:       "Chat",
  live_view:  "Live View",
  reports:    "Reports",
  client:     "Client",
};

export const OUTCOME_COLOR: Record<string, string> = {
  success: "#5C9270",
  failure: "#C96B6B",
  denied:  "#C9964A",
};
