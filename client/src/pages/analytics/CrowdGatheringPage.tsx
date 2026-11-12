import { useState, useMemo } from "react";
import {
  Box, Paper, Typography, Select, MenuItem, FormControl, Chip,
} from "@mui/material";
import { MediaDialog } from "../../components/meghavi/MeghaviMediaViewer";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import CameraAltOutlinedIcon from "@mui/icons-material/CameraAltOutlined";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { ds } from "../../lib/dsTokens";
import { useOvercrowdingData, todayIST, sevenDaysAgoIST } from "../../lib/meghaviApi";

const CARD_STYLE = {
  p: 0,
  borderRadius: "14px",
  bgcolor: "#FFFFFF",
  border: "1px solid #DCE7E8",
  boxShadow: "0 1px 4px rgba(11,73,100,0.05)",
  overflow: "hidden",
} as const;

const KPI_COLORS = [
  { bg: "#E8F3EE", color: "#5C9270" },
  { bg: "#FEF3C7", color: "#D97706" },
  { bg: "#EAF3F5", color: "#2E78A0" },
  { bg: "#FEE2E2", color: "#DC2626" },
];

const SEV_COLOR: Record<string, string> = { high: "#DC2626", warning: "#D97706" };

export function CrowdGatheringPage() {
  const [rangeFilter, setRangeFilter] = useState<"today" | "yesterday" | "7d">("today");
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaIdx,  setMediaIdx]  = useState(0);

  const today = todayIST();
  const yesterday = new Date(new Date(today).getTime() - 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const sevenDaysAgo = sevenDaysAgoIST();

  const from = rangeFilter === "today" ? today : rangeFilter === "yesterday" ? yesterday : sevenDaysAgo;
  const to   = rangeFilter === "yesterday" ? yesterday : today;

  const { data } = useOvercrowdingData(from, to);

  const total         = data?.total ?? 0;
  const prevTotal     = data?.prev_total ?? 0;
  const cameras       = data?.cameras_active ?? 0;
  const alerts        = data?.alerts_triggered ?? 0;
  const peakHour      = data?.peak_hour ?? null;
  const hourlyTrend   = data?.hourly_trend ?? [];
  const events        = data?.events ?? [];

  const pctChange = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  const mediaItems = useMemo(() => events.map((ev) => ({
    id: ev.id, snapshot_url: ev.snapshot_url, video_url: null,
    label: ev.camera_name, sublabel: `${ev.person_count} persons`,
  })), [events]);

  const kpis = [
    { icon: <GroupsOutlinedIcon />, label: "Total Events", value: total, sub: pctChange !== null ? `${pctChange > 0 ? "+" : ""}${pctChange}% vs prev period` : "No prior data" },
    { icon: <WarningAmberOutlinedIcon />, label: "High-Severity", value: alerts, sub: "Person count ≥ 6" },
    { icon: <AccessTimeOutlinedIcon />, label: "Peak Hour", value: peakHour ?? "—", sub: "Most crowd events" },
    { icon: <CameraAltOutlinedIcon />, label: "Cameras Active", value: cameras, sub: "Triggered cameras" },
  ];

  const maxCount = Math.max(...hourlyTrend.map(h => h.count), 1);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, width: "100%", pb: 3 }}>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5 }}>
        <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0B4964", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          CROWD GATHERING
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
          Crowd Events by Hour
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
                cursor={{ fill: `${ds.warning}0D` }}
                formatter={(v) => [v, "Events"]}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {hourlyTrend.map((d, i) => (
                  <Cell key={i} fill={d.count === maxCount ? "#D97706" : `${ds.warning}70`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <GroupsOutlinedIcon sx={{ fontSize: 36, color: ds.textMuted, opacity: 0.4 }} />
            <Typography sx={{ fontSize: "0.875rem", color: ds.textMuted, mt: 1 }}>
              No crowd gathering events for the selected range.
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Events Grid */}
      {events.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: ds.text, mb: 1.5 }}>
            Events ({events.length})
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 2 }}>
            {events.map((ev, i) => (
              <Paper key={ev.id} elevation={0} onClick={() => { setMediaIdx(i); setMediaOpen(true); }}
                sx={{ borderRadius: "12px", overflow: "hidden", border: `1px solid ${SEV_COLOR[ev.severity] ?? ds.borderSubtle}44`, boxShadow: "0 1px 4px rgba(11,73,100,0.06)", cursor: "pointer", transition: "box-shadow 0.15s", "&:hover": { boxShadow: "0 4px 16px rgba(11,73,100,0.14)" } }}>
                <Box sx={{ position: "relative", width: "100%", aspectRatio: "16/9", bgcolor: "#0B2A3A", overflow: "hidden" }}>
                  {ev.snapshot_url ? (
                    <Box component="img" src={ev.snapshot_url} alt={ev.camera_name}
                      sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  ) : (
                    <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Typography sx={{ color: "rgba(255,255,255,0.3)", fontSize: "2rem" }}>📷</Typography>
                    </Box>
                  )}
                  <Box sx={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, bgcolor: SEV_COLOR[ev.severity] ?? ds.warning }} />
                  <Box sx={{ position: "absolute", top: 6, left: 6 }}>
                    <Chip label={`${ev.person_count} persons`} size="small"
                      sx={{ bgcolor: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "0.625rem", fontWeight: 700, height: 20, "& .MuiChip-label": { px: 0.75 } }} />
                  </Box>
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
          module="overcrowding" />
      )}
    </Box>
  );
}
