import { useState, useMemo } from "react";
import {
  Box, Paper, Typography, Select, MenuItem, FormControl, Chip,
} from "@mui/material";
import { MediaDialog } from "../../components/meghavi/MeghaviMediaViewer";
import NightsStayOutlinedIcon from "@mui/icons-material/NightsStayOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { ds } from "../../lib/dsTokens";
import { useAfterHoursData, todayIST, sevenDaysAgoIST } from "../../lib/meghaviApi";

const CARD_STYLE = {
  p: 0,
  borderRadius: "14px",
  bgcolor: "#FFFFFF",
  border: "1px solid #DCE7E8",
  boxShadow: "0 1px 4px rgba(11,73,100,0.05)",
  overflow: "hidden",
} as const;

const KPI_COLORS = [
  { bg: "#EDE9FE", color: "#7C3AED" },
  { bg: "#FEE2E2", color: "#DC2626" },
  { bg: "#EAF3F5", color: "#2E78A0" },
  { bg: "#F5EFE5", color: "#C9964A" },
];

export function AfterHoursPage() {
  const [rangeFilter, setRangeFilter] = useState<"today" | "yesterday" | "7d">("today");
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaIdx,  setMediaIdx]  = useState(0);

  const today = todayIST();
  const yesterday = new Date(new Date(today).getTime() - 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const sevenDaysAgo = sevenDaysAgoIST();

  const from = rangeFilter === "today" ? today : rangeFilter === "yesterday" ? yesterday : sevenDaysAgo;
  const to   = rangeFilter === "yesterday" ? yesterday : today;

  const { data } = useAfterHoursData(from, to);

  const total           = data?.total ?? 0;
  const prevTotal       = data?.prev_total ?? 0;
  const cameras         = data?.cameras_triggered ?? 0;
  const alertsSent      = data?.alerts_sent ?? 0;
  const hourlyTrend     = data?.hourly_trend ?? [];
  const events          = data?.events ?? [];

  const pctChange = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  const mediaItems = useMemo(() => events.map((ev) => ({
    id: ev.id, snapshot_url: ev.snapshot_url, video_url: null,
    label: ev.camera_name, sublabel: ev.business_hours ?? undefined,
  })), [events]);
  const maxCount = Math.max(...hourlyTrend.map(h => h.count), 1);

  const kpis = [
    { icon: <NightsStayOutlinedIcon />, label: "Total Incidents", value: total, sub: pctChange !== null ? `${pctChange > 0 ? "+" : ""}${pctChange}% vs prev` : "No prior data" },
    { icon: <NotificationsActiveOutlinedIcon />, label: "Alerts Sent", value: alertsSent, sub: "Notifications triggered" },
    { icon: <AccessTimeOutlinedIcon />, label: "Avg Duration", value: "—", sub: "Duration data pending" },
    { icon: <VideocamOutlinedIcon />, label: "Cameras Triggered", value: cameras, sub: "Unique cameras" },
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, width: "100%", pb: 3 }}>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5 }}>
        <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0B4964", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          AFTER HOURS
        </Typography>
        <FormControl size="small">
          <Select
            value={rangeFilter}
            onChange={(e) => setRangeFilter(e.target.value as "today" | "yesterday" | "7d")}
            sx={{ bgcolor: "#FFFFFF", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", borderRadius: "8px", height: 36, "& .MuiOutlinedInput-notchedOutline": { borderColor: "#DCE7E8" } }}
          >
            <MenuItem value="today">Today</MenuItem>
            <MenuItem value="yesterday">Yesterday</MenuItem>
            <MenuItem value="7d">Last 7 Days</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* KPI Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2 }}>
        {kpis.map((kpi, i) => (
          <Paper key={kpi.label} elevation={0} sx={CARD_STYLE}>
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: "10px", bgcolor: KPI_COLORS[i].bg, display: "grid", placeItems: "center", color: KPI_COLORS[i].color, "& svg": { fontSize: 20 } }}>
                  {kpi.icon}
                </Box>
                <Typography sx={{ fontSize: "0.75rem", color: ds.textSecondary, fontWeight: 600 }}>{kpi.label}</Typography>
              </Box>
              <Typography sx={{ fontSize: "1.75rem", fontWeight: 800, color: ds.text, lineHeight: 1 }}>{kpi.value}</Typography>
              <Typography sx={{ fontSize: "0.6875rem", color: ds.textMuted, mt: 0.5 }}>{kpi.sub}</Typography>
            </Box>
          </Paper>
        ))}
      </Box>

      {/* Hourly Trend Chart */}
      <Paper elevation={0} sx={{ ...CARD_STYLE, p: 2.5 }}>
        <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: ds.textSecondary, letterSpacing: "0.07em", textTransform: "uppercase", mb: 2 }}>
          After-Hours Activity by Hour
        </Typography>
        {hourlyTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourlyTrend} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke={ds.borderSubtle} vertical={false} />
              <XAxis dataKey="hour" fontSize={11} tickLine={false} axisLine={false} stroke={ds.textMuted} />
              <YAxis fontSize={10} tickLine={false} axisLine={false} stroke={ds.textMuted} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: ds.text, borderRadius: 8, border: "none", color: "#FFFFFF", fontSize: 12 }}
                itemStyle={{ color: "#FFFFFF" }}
                labelStyle={{ color: "#FFFFFF", fontWeight: 700, marginBottom: 4 }}
                cursor={{ fill: "#7C3AED0D" }}
                formatter={(v) => [v, "Incidents"]}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {hourlyTrend.map((d, i) => (
                  <Cell key={i} fill={d.count === maxCount ? "#7C3AED" : "#7C3AED70"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <NightsStayOutlinedIcon sx={{ fontSize: 36, color: ds.textMuted, opacity: 0.4 }} />
            <Typography sx={{ fontSize: "0.875rem", color: ds.textMuted, mt: 1 }}>
              No after-hours activity detected for the selected range.
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Events Grid */}
      {events.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: ds.text, mb: 1.5 }}>
            Incidents ({events.length})
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 2 }}>
            {events.map((ev, i) => (
              <Paper key={ev.id} elevation={0} onClick={() => { setMediaIdx(i); setMediaOpen(true); }}
                sx={{ borderRadius: "12px", overflow: "hidden", border: "1px solid #7C3AED44", boxShadow: "0 1px 4px rgba(11,73,100,0.06)", cursor: "pointer", transition: "box-shadow 0.15s", "&:hover": { boxShadow: "0 4px 16px rgba(124,58,237,0.18)" } }}>
                <Box sx={{ position: "relative", width: "100%", aspectRatio: "16/9", bgcolor: "#1A0A2E", overflow: "hidden" }}>
                  {ev.snapshot_url ? (
                    <Box component="img" src={ev.snapshot_url} alt={ev.camera_name}
                      sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  ) : (
                    <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Typography sx={{ color: "rgba(255,255,255,0.3)", fontSize: "2rem" }}>🌙</Typography>
                    </Box>
                  )}
                  <Box sx={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, bgcolor: "#7C3AED" }} />
                  <Box sx={{ position: "absolute", top: 6, left: 6 }}>
                    <Chip label={`${ev.person_count} detected`} size="small"
                      sx={{ bgcolor: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "0.625rem", fontWeight: 700, height: 20, "& .MuiChip-label": { px: 0.75 } }} />
                  </Box>
                  {ev.business_hours && (
                    <Box sx={{ position: "absolute", top: 6, right: 6 }}>
                      <Chip label={ev.business_hours} size="small"
                        sx={{ bgcolor: "rgba(124,58,237,0.75)", color: "#fff", fontSize: "0.5625rem", fontWeight: 600, height: 18, "& .MuiChip-label": { px: 0.75 } }} />
                    </Box>
                  )}
                </Box>
                <Box sx={{ p: 1.25 }}>
                  <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: ds.text }} noWrap>{ev.camera_name}</Typography>
                  <Typography sx={{ fontSize: "0.6875rem", color: ds.textMuted }} noWrap>{ev.location}</Typography>
                  <Typography sx={{ fontSize: "0.6875rem", color: ds.textSecondary, mt: 0.25 }}>
                    {new Date(ev.detected_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </Typography>
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>
      )}

      {mediaOpen && mediaItems.length > 0 && (
        <MediaDialog open={mediaOpen} onClose={() => setMediaOpen(false)}
          snapshot_url={mediaItems[mediaIdx]?.snapshot_url ?? null} video_url={null}
          label={mediaItems[mediaIdx]?.label} items={mediaItems} initialIndex={mediaIdx}
          module="after_hours" />
      )}
    </Box>
  );
}
