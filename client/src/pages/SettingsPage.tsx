import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Box, Button, Chip, Divider, Grid, MenuItem, Paper,
  Snackbar, Stack, Switch, Tab, Tabs, TextField, Tooltip, Typography,
} from "@mui/material";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import DirectionsWalkOutlinedIcon from "@mui/icons-material/DirectionsWalkOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { api } from "../lib/api";
import { contentCardSx, pageLayoutSx } from "../lib/uiSurfaces";
import { RbacPanel } from "../components/settings/RbacPanel";
import { pnp } from "../lib/pnpTheme";

type Scope = string;
type SettingEntry = {
  value: Record<string, any>;
  version: number;
  updatedBy: string | null;
  updatedAt: string;
  appliedBy: "web-app" | "inference-host";
};
type SettingsResponse = {
  settings: Record<Scope, SettingEntry>;
  publishedConfig: { version: number; publishedAt: string; key: string } | null;
};

type Field =
  | { k: string; label: string; type: "number"; min?: number; max?: number; step?: number; help?: string }
  | { k: string; label: string; type: "text"; help?: string }
  | { k: string; label: string; type: "bool"; help?: string }
  | { k: string; label: string; type: "select"; options: { v: any; label: string }[]; help?: string };

const SECTIONS: { scope: Scope; title: string; blurb: string; icon: React.ReactNode; half?: boolean; fields: Field[] }[] = [
  {
    scope: "general",
    title: "General",
    blurb: "Site-wide settings applied immediately to the web application.",
    icon: <SettingsOutlinedIcon sx={{ fontSize: 18, color: pnp.primary }} />,
    fields: [
      { k: "siteName",            label: "Site name",                        type: "text" },
      { k: "timezone",            label: "Timezone",                         type: "text",   help: "IANA zone — e.g. Asia/Kolkata" },
      { k: "defaultReportDays",   label: "Default report duration (days)",    type: "number", min: 1,  max: 365 },
      { k: "dateFormat",          label: "Date format",                       type: "text" },
      { k: "timeFormat",          label: "Time format",                       type: "text" },
      { k: "autoRefreshSeconds",  label: "Auto-refresh interval (seconds)",   type: "number", min: 10, max: 3600,
        help: "Controls how often Live Overview and Monitoring pages refresh." },
      { k: "notifyEmail",         label: "Alert notification email",          type: "text" },
    ],
  },
  {
    scope: "walkins",
    title: "Walk-ins Detection",
    blurb: "Customer arrival detection at wellness centre entrances.",
    icon: <DirectionsWalkOutlinedIcon sx={{ fontSize: 18, color: pnp.success }} />,
    half: true,
    fields: [
      { k: "enabled",          label: "Module enabled",                         type: "bool" },
      { k: "confidence",       label: "Detection confidence",                   type: "number", min: 0, max: 1, step: 0.05 },
      { k: "minPersonSize",    label: "Minimum person size (px)",               type: "number", min: 1, max: 5000 },
      { k: "cooldownSeconds",  label: "Cooldown between detections (s)",        type: "number", min: 0, max: 3600 },
      { k: "surgeThreshold",   label: "Surge alert threshold (persons / 5 min)", type: "number", min: 5, max: 100,
        help: "Raise an alert when this many walk-ins occur within 5 minutes." },
    ],
  },
  {
    scope: "waiting_time",
    title: "Customer Waiting Time",
    blurb: "SLA thresholds for queue and wait-time monitoring.",
    icon: <AccessTimeOutlinedIcon sx={{ fontSize: 18, color: pnp.blue }} />,
    half: true,
    fields: [
      { k: "enabled",                   label: "Module enabled",                   type: "bool" },
      { k: "warningThresholdMinutes",    label: "Warning threshold (minutes)",       type: "number", min: 1, max: 120,
        help: "Raise a warning alert when a customer waits this long." },
      { k: "criticalThresholdMinutes",   label: "Critical threshold (minutes)",      type: "number", min: 1, max: 120,
        help: "Escalate to critical at this wait duration." },
      { k: "maxQueueLength",             label: "Max queue length (persons)",        type: "number", min: 1, max: 100,
        help: "Alert when the queue exceeds this many people." },
      { k: "cooldownSeconds",            label: "Alert cooldown (s)",               type: "number", min: 0, max: 3600 },
    ],
  },
  {
    scope: "staff_unavailability",
    title: "Staff Unavailability",
    blurb: "Unattended station and therapist break-time monitoring.",
    icon: <PersonOutlineOutlinedIcon sx={{ fontSize: 18, color: pnp.warning }} />,
    half: true,
    fields: [
      { k: "enabled",                label: "Module enabled",                      type: "bool" },
      { k: "maxUnattendedSeconds",   label: "Max unattended duration (s)",          type: "number", min: 10, max: 7200,
        help: "Alert when a station has been unmanned longer than this." },
      { k: "breakOverrunMinutes",    label: "Break overrun threshold (minutes)",    type: "number", min: 1,  max: 60,
        help: "Alert when a staff break exceeds this duration." },
      { k: "alertCooldownSeconds",   label: "Alert cooldown (s)",                  type: "number", min: 0,  max: 7200 },
      { k: "confidence",             label: "Detection confidence",                 type: "number", min: 0,  max: 1,  step: 0.05 },
    ],
  },
  {
    scope: "cameras",
    title: "Cameras & Video",
    blurb: "Camera polling intervals, clip retention and live-feed settings.",
    icon: <VideocamOutlinedIcon sx={{ fontSize: 18, color: pnp.teal }} />,
    half: true,
    fields: [
      { k: "liveRefreshSeconds",  label: "Live feed refresh interval (s)",   type: "number", min: 5,  max: 120,
        help: "How often the Live Overview panel polls for new frames." },
      { k: "retentionDays",       label: "Clip retention (days)",            type: "number", min: 1,  max: 365 },
      { k: "recordOnAlert",       label: "Auto-record on alert",             type: "bool",
        help: "Save a video clip automatically when an alert fires." },
      { k: "clipDurationSeconds", label: "Alert clip duration (s)",          type: "number", min: 10, max: 300 },
    ],
  },
  {
    scope: "notifications",
    title: "Alerts & Notifications",
    blurb: "Control how and when alert notifications are delivered to staff.",
    icon: <NotificationsNoneOutlinedIcon sx={{ fontSize: 18, color: pnp.danger }} />,
    half: true,
    fields: [
      { k: "emailAlertsEnabled",   label: "Email alerts enabled",         type: "bool" },
      { k: "emailRecipients",      label: "Email recipients",              type: "text",
        help: "Comma-separated list of addresses to receive alert emails." },
      { k: "highSeverityOnly",     label: "High severity alerts only",    type: "bool",
        help: "Only send notifications for critical/high severity alerts." },
      { k: "dailyDigestEnabled",   label: "Daily digest report",          type: "bool",
        help: "Send a daily summary email at 8:00 AM each morning." },
      { k: "dailyDigestEmail",     label: "Daily digest email address",   type: "text" },
    ],
  },
];

function SectionCard({
  section, entry, onSaved, onToast,
}: {
  section: (typeof SECTIONS)[number];
  entry?: SettingEntry;
  onSaved: () => void;
  onToast: (m: string) => void;
}) {
  const [draft, setDraft] = useState<Record<string, any>>(entry?.value ?? {});
  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => setDraft(entry?.value ?? {}), [entry]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(entry?.value ?? {});
  const detectorScope = entry?.appliedBy === "inference-host";

  const save = useMutation({
    mutationFn: async () => (await api.put(`/settings/${section.scope}`, { value: draft })).data,
    onSuccess: (d: any) => {
      setErrors([]);
      onToast(d.pendingDelivery ? `Saved and queued for delivery (v${d.version}).` : "Saved. Applied immediately.");
      onSaved();
    },
    onError: (e: any) => setErrors(e?.response?.data?.errors ?? [e?.message ?? "Save failed"]),
  });

  const set = (k: string, v: any) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <Paper
      sx={{
        ...contentCardSx,
        height: "100%",
        border: `1px solid ${pnp.cardBorder.replace("1px solid ", "")}`,
        borderTop: `3px solid transparent`,
        backgroundImage: `linear-gradient(white, white), linear-gradient(90deg, ${pnp.primary}22, transparent)`,
        backgroundOrigin: "border-box",
        backgroundClip: "padding-box, border-box",
      }}
    >
      <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ width: 32, height: 32, borderRadius: "8px", bgcolor: pnp.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {section.icon}
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: pnp.text }}>{section.title}</Typography>
            <Typography variant="caption" color="text.secondary">{section.blurb}</Typography>
          </Box>
        </Box>
        {detectorScope && (
          <Tooltip title="This setting is picked up by the on-device detection service on its next configuration poll.">
            <Chip size="small" variant="outlined" icon={<InfoOutlinedIcon />}
                  label="Applied by detection service"
                  sx={{ height: 22, fontSize: 10, borderColor: pnp.primary, color: pnp.primary }} />
          </Tooltip>
        )}
      </Stack>

      <Divider sx={{ my: 1.5, borderColor: "#DCE7E8" }} />

      <Grid container spacing={1.5}>
        {section.fields.map((f) => (
          <Grid key={f.k} size={{ xs: 12, sm: 6 }}>
            {f.type === "bool" ? (
              <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", py: 0.5 }}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: pnp.text }}>{f.label}</Typography>
                  {f.help && <Typography variant="caption" color="text.secondary">{f.help}</Typography>}
                </Box>
                <Switch
                  checked={Boolean(draft[f.k])}
                  onChange={(e) => set(f.k, e.target.checked)}
                  sx={{
                    "& .MuiSwitch-switchBase.Mui-checked": { color: pnp.primary },
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: pnp.primaryLight },
                  }}
                />
              </Stack>
            ) : f.type === "select" ? (
              <TextField
                select fullWidth size="small" label={f.label} helperText={f.help}
                value={draft[f.k] ?? ""} onChange={(e) => set(f.k, Number(e.target.value))}
                sx={{ "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: pnp.primary } }}
              >
                {f.options.map((o) => <MenuItem key={String(o.v)} value={o.v}>{o.label}</MenuItem>)}
              </TextField>
            ) : (
              <TextField
                fullWidth size="small" label={f.label} helperText={f.help}
                type={f.type === "number" ? "number" : "text"}
                value={draft[f.k] ?? ""}
                onChange={(e) => set(f.k, f.type === "number" ? Number(e.target.value) : e.target.value)}
                slotProps={f.type === "number" ? { htmlInput: { min: (f as any).min, max: (f as any).max, step: (f as any).step ?? 1 } } : undefined}
                sx={{ "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: pnp.primary } }}
              />
            )}
          </Grid>
        ))}
      </Grid>

      {errors.length > 0 && (
        <Alert severity="error" sx={{ mt: 1.5, borderRadius: "8px" }}>
          {errors.map((e) => <div key={e}>{e}</div>)}
        </Alert>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 2, alignItems: "center" }}>
        <Button
          variant="contained"
          size="small"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate()}
          sx={{
            bgcolor: pnp.primary,
            backgroundImage: `linear-gradient(180deg, ${pnp.primaryLight} 0%, ${pnp.primary} 100%)`,
            color: "#fff",
            boxShadow: dirty ? `0 2px 8px ${pnp.primary}40` : "none",
            "&:hover": { bgcolor: pnp.primaryDark, backgroundImage: "none" },
            "&.Mui-disabled": {
              bgcolor: pnp.primary,
              backgroundImage: `linear-gradient(180deg, ${pnp.primaryLight} 0%, ${pnp.primary} 100%)`,
              color: "rgba(255,255,255,0.45)",
              opacity: 0.55,
            },
            textTransform: "none",
            fontWeight: 700,
            borderRadius: "8px",
          }}
        >
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
        <Button
          size="small"
          disabled={!dirty}
          onClick={() => setDraft(entry?.value ?? {})}
          sx={{ textTransform: "none", color: pnp.textSecondary, borderRadius: "8px" }}
        >
          Discard
        </Button>
        <Box sx={{ flex: 1 }} />
        {entry && (
          <Typography variant="caption" color="text.secondary">
            v{entry.version}
            {entry.updatedBy ? ` · ${entry.updatedBy}` : ""}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}

export function SettingsPage() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const nav = useNavigate();
  const loc = useLocation();

  const tab = loc.pathname.endsWith("/access") ? "rbac" : "config";

  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await api.get("/settings")).data as SettingsResponse,
  });

  return (
    <Box sx={pageLayoutSx}>
      <Paper sx={{ ...contentCardSx, p: 0, border: pnp.cardBorder, boxShadow: pnp.cardShadow }}>
        <Tabs
          value={tab}
          onChange={(_e, v) => nav(v === "rbac" ? "/settings/access" : "/settings")}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: "0.875rem" },
            "& .MuiTab-root.Mui-selected": { color: pnp.primary },
            "& .MuiTabs-indicator": { bgcolor: pnp.primary },
          }}
        >
          <Tab value="config" label="Configuration" icon={<TuneOutlinedIcon />} iconPosition="start" sx={{ minHeight: 48 }} />
          <Tab value="rbac" label="RBAC" icon={<AdminPanelSettingsOutlinedIcon />} iconPosition="start" sx={{ minHeight: 48 }} />
        </Tabs>
      </Paper>

      {tab === "rbac" ? <RbacPanel /> : (
        <Grid container spacing={1.5}>
          {SECTIONS.map((sec) => (
            <Grid key={sec.scope} size={{ xs: 12, lg: sec.half ? 6 : 12 }}>
              <SectionCard
                section={sec}
                entry={data?.settings[sec.scope]}
                onSaved={() => qc.invalidateQueries({ queryKey: ["settings"] })}
                onToast={setToast}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <Snackbar
        open={Boolean(toast)} autoHideDuration={6000} onClose={() => setToast(null)}
        message={toast ?? ""} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
