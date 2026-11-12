import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, IconButton, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow, Tooltip, Typography,
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import ViewListOutlinedIcon from "@mui/icons-material/ViewListOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import PlayCircleFilledOutlinedIcon from "@mui/icons-material/PlayCircleFilledOutlined";
import {
  Bar, BarChart, CartesianGrid, Cell, PieChart, Pie,
  ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import AccessTimeFilledIcon from "@mui/icons-material/AccessTimeFilled";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import PeopleIcon from "@mui/icons-material/People";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import WorkOutlineOutlinedIcon from "@mui/icons-material/WorkOutlineOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import { pageLayoutSx } from "../lib/uiSurfaces";
import { pnp } from "../lib/pnpTheme";
import { useAlertsData, todayIST, sevenDaysAgoIST } from "../lib/meghaviApi";

import { MediaDialog } from "../components/meghavi/MeghaviMediaViewer";

const PAGE_SIZE = 20;

const CATEGORY_CFG: Record<string, { label: string; color: string; icon: React.ReactNode; route: string }> = {
  walkins:              { label: "Walk-ins",             color: pnp.success, icon: <PeopleIcon              sx={{ fontSize: 13 }} />, route: "/analytics/walk-ins" },
  waiting_time:         { label: "Customer Waiting Time", color: pnp.danger,  icon: <AccessTimeFilledIcon    sx={{ fontSize: 13 }} />, route: "/analytics/walk-ins" },
  staff_unavailability: { label: "Staff Unavailability",  color: pnp.warning, icon: <PersonOffIcon           sx={{ fontSize: 13 }} />, route: "/analytics/staff-unavailability" },
  meet_greet:           { label: "Meet & Greet",          color: pnp.blue,    icon: <AccessTimeFilledIcon    sx={{ fontSize: 13 }} />, route: "/analytics/meet-greet" },
  frisking_bag:         { label: "Frisking Bag",          color: "#7C3AED",   icon: <WorkOutlineOutlinedIcon sx={{ fontSize: 13 }} />, route: "/analytics/frisking-bag" },
  overcrowding:         { label: "Crowd Gathering",       color: "#D97706",   icon: <PeopleIcon              sx={{ fontSize: 13 }} />, route: "/analytics/crowd-gathering" },
  after_hours:          { label: "After Hours",           color: "#7C3AED",   icon: <PersonOffIcon           sx={{ fontSize: 13 }} />, route: "/analytics/after-hours" },
};

const SEVERITY_COLOR: Record<string, string> = { high: pnp.danger, warning: pnp.warning, info: pnp.blue };

const DONUT_COLORS = [pnp.success, pnp.danger, pnp.warning];
const CHART_TOOLTIP = { backgroundColor: pnp.primary, borderRadius: 8, border: "none", color: "#FFFFFF", fontSize: 12 };
const CHART_ITEM_STYLE = { color: "#FFFFFF" };
const CHART_LABEL_STYLE = { color: "#FFFFFF", fontWeight: 700, marginBottom: 4 };

function KpiCard({ icon, label, value, sub, iconColor, iconBg, onClick }: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; iconColor: string; iconBg: string; onClick?: () => void;
}) {
  return (
    <Paper elevation={0} onClick={onClick} sx={{ p: 2, borderRadius: "12px", bgcolor: pnp.cardBg, border: `1px solid ${iconColor}55`, boxShadow: pnp.cardShadow, display: "flex", alignItems: "center", gap: 1.5, cursor: onClick ? "pointer" : "default", transition: "transform 0.15s, box-shadow 0.15s", "&:hover": onClick ? { transform: "translateY(-1px)", boxShadow: `0 6px 20px ${iconColor}25` } : {}, flex: 1, minWidth: 0 }}>
      <Box sx={{ width: 40, height: 40, borderRadius: "10px", bgcolor: iconBg, color: iconColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, "& svg": { fontSize: 22 } }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: pnp.textMuted, letterSpacing: "0.05em", textTransform: "uppercase" }} noWrap>{label}</Typography>
        <Typography sx={{ fontSize: "1.375rem", fontWeight: 800, color: pnp.text, lineHeight: 1.15 }}>{value}</Typography>
        {sub && <Typography sx={{ fontSize: "0.6875rem", color: pnp.textMuted }} noWrap>{sub}</Typography>}
      </Box>
    </Paper>
  );
}

export function ActiveAlertsPage() {
  const navigate = useNavigate();
  const today = todayIST();

  const fromDate = sevenDaysAgoIST();
  const [tablePage, setTablePage]         = useState(0);
  const [mediaOpen, setMediaOpen]         = useState(false);
  const [mediaIdx, setMediaIdx]           = useState(0);
  const [viewMode, setViewMode]           = useState<"table" | "grid">("table");
  const [dismissedIds, setDismissedIds]   = useState<Set<number | string>>(new Set());

  const { data: alertsData } = useAlertsData(fromDate, today);

  const allEventsRaw = alertsData?.events ?? [];
  const allEvents = allEventsRaw.map(e => {
    if (e.category === "walkins" && (e.dwell_seconds ?? 0) > 120) {
      return { ...e, category: "waiting_time" };
    }
    return e;
  });
  const breakdown = alertsData?.breakdown ?? [];
  const byHour    = alertsData?.by_hour ?? [];
  const statusSummary = alertsData?.status_summary ?? [];
  const totalAll  = allEvents.length;

  const filtered = useMemo(() => allEvents
    .filter((e) => !dismissedIds.has(e.id))
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()),
  [allEvents, dismissedIds]);

  const activeCount = allEvents.filter((e) => e.status === "active").length;
  const pagedEvents = filtered.slice(tablePage * PAGE_SIZE, (tablePage + 1) * PAGE_SIZE);

  const mediaItems = filtered.map((e) => ({ id: Number(e.id), snapshot_url: e.snapshot_url, video_url: e.video_url, label: e.camera }));

  const categoryBarData = breakdown.map((b) => ({
    name:  CATEGORY_CFG[b.category]?.label ?? b.category,
    count: b.count,
    color: CATEGORY_CFG[b.category]?.color ?? pnp.primary,
  }));

  return (
    <Box sx={{ ...pageLayoutSx, gap: 2.5 }}>

      {/* KPI Row */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ flexWrap: "wrap" }}>
        <KpiCard icon={<NotificationsNoneOutlinedIcon />} label="Total Alerts" value={totalAll} sub={`${activeCount} currently active`} iconColor={pnp.danger} iconBg={pnp.dangerSoft} />
        <KpiCard icon={<PeopleAltOutlinedIcon />} label="Walk-ins" value={breakdown.find((b) => b.category === "walkins")?.count ?? 0} sub={`${breakdown.find((b) => b.category === "walkins")?.percentage ?? 0}% of total`} iconColor={pnp.success} iconBg={pnp.successSoft} onClick={() => navigate("/analytics/walk-ins")} />
        <KpiCard icon={<PersonOutlineOutlinedIcon />} label="Crowd Gathering" value={breakdown.find((b) => b.category === "overcrowding")?.count ?? 0} sub={`${breakdown.find((b) => b.category === "overcrowding")?.percentage ?? 0}% of total`} iconColor="#D97706" iconBg="#D9770614" onClick={() => navigate("/analytics/crowd-gathering")} />
        <KpiCard icon={<AccessTimeOutlinedIcon />} label="After Hours" value={breakdown.find((b) => b.category === "after_hours")?.count ?? 0} sub={`${breakdown.find((b) => b.category === "after_hours")?.percentage ?? 0}% of total`} iconColor="#7C3AED" iconBg="#7C3AED14" onClick={() => navigate("/analytics/after-hours")} />
      </Stack>

      {/* Charts Row */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.1fr 1fr 0.8fr" }, gap: 2.5 }}>
        <Paper elevation={0} sx={{ p: 2, borderRadius: "14px", bgcolor: pnp.cardBg, border: pnp.cardBorder, boxShadow: pnp.cardShadow }}>
          <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: pnp.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", mb: 1.5 }}>Alerts by Category</Typography>
          <Box sx={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryBarData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DCE7E8" vertical={false} />
                <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} stroke={pnp.textMuted} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} stroke={pnp.textMuted} />
                <RTooltip contentStyle={CHART_TOOLTIP} itemStyle={CHART_ITEM_STYLE} labelStyle={CHART_LABEL_STYLE} cursor={{ fill: `${pnp.primary}0D` }} formatter={(v) => [v, "Alerts"]} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]} onClick={(d) => { const cat = Object.values(CATEGORY_CFG).find((c) => c.label === d.name); if (cat) navigate(cat.route); }} style={{ cursor: "pointer" }}>
                  {categoryBarData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, borderRadius: "14px", bgcolor: pnp.cardBg, border: pnp.cardBorder, boxShadow: pnp.cardShadow }}>
          <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: pnp.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", mb: 1.5 }}>Alerts by Hour</Typography>
          <Box sx={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byHour} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DCE7E8" vertical={false} />
                <XAxis dataKey="hour" fontSize={10} tickLine={false} axisLine={false} stroke={pnp.textMuted} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} stroke={pnp.textMuted} />
                <RTooltip contentStyle={CHART_TOOLTIP} itemStyle={CHART_ITEM_STYLE} labelStyle={CHART_LABEL_STYLE} cursor={{ fill: `${pnp.primary}0D` }} formatter={(v) => [v, "Alerts"]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {byHour.map((d, i) => {
                    const maxCount = Math.max(...byHour.map((x) => x.count));
                    return <Cell key={i} fill={d.count === maxCount ? pnp.danger : `${pnp.primary}80`} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, borderRadius: "14px", bgcolor: pnp.cardBg, border: pnp.cardBorder, boxShadow: pnp.cardShadow, display: "flex", flexDirection: "column" }}>
          <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: pnp.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", mb: 1 }}>Alert Status</Typography>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
            <Box sx={{ position: "relative", width: 120, height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusSummary} dataKey="count" cx="50%" cy="50%" innerRadius={38} outerRadius={56} paddingAngle={3} strokeWidth={0}>
                    {statusSummary.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: pnp.text, lineHeight: 1 }}>{totalAll}</Typography>
                <Typography sx={{ fontSize: "0.5rem", fontWeight: 600, color: pnp.textMuted, letterSpacing: "0.05em" }}>TOTAL</Typography>
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6, mt: 1 }}>
            {statusSummary.map((item, i) => (
              <Box key={item.status} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: "2px", bgcolor: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
                  <Typography sx={{ fontSize: "0.6875rem", fontWeight: 500, color: pnp.textSecondary }}>{item.status}</Typography>
                </Box>
                <Box sx={{ display: "flex", gap: 0.75 }}>
                  <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: pnp.text }}>{item.count}</Typography>
                  <Typography sx={{ fontSize: "0.6875rem", color: pnp.textMuted }}>({item.percentage}%)</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Paper>
      </Box>

      {/* Events header with view toggle */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: pnp.text }}>Alert Events</Typography>
        <Box sx={{ px: 1, py: 0.25, borderRadius: "6px", bgcolor: pnp.dangerSoft }}><Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: pnp.danger }}>{activeCount} Active</Typography></Box>
        <Typography sx={{ fontSize: "0.75rem", color: pnp.textMuted }}>{filtered.length} records</Typography>
        <Box sx={{ ml: "auto", display: "flex", gap: 0.5 }}>
          <IconButton size="small" onClick={() => setViewMode("table")} sx={{ borderRadius: "8px", bgcolor: viewMode === "table" ? pnp.primarySoft : "transparent", color: viewMode === "table" ? pnp.primary : pnp.textSecondary }}><ViewListOutlinedIcon sx={{ fontSize: 20 }} /></IconButton>
          <IconButton size="small" onClick={() => setViewMode("grid")} sx={{ borderRadius: "8px", bgcolor: viewMode === "grid" ? pnp.primarySoft : "transparent", color: viewMode === "grid" ? pnp.primary : pnp.textSecondary }}><GridViewOutlinedIcon sx={{ fontSize: 20 }} /></IconButton>
        </Box>
      </Box>

      {viewMode === "table" ? (
        /* Events Table */
        <Paper elevation={0} sx={{ borderRadius: "14px", bgcolor: pnp.cardBg, border: pnp.cardBorder, boxShadow: pnp.cardShadow, overflow: "hidden" }}>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "#F8FAFC" }}>
                  {["Media", "Event Type", "Camera", "Location", "Timestamp", "Details", "View"].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 700, color: pnp.textSecondary, fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `2px solid ${pnp.cardBorder.split(" ")[2]}`, py: 1.25, "&:first-of-type": { pl: 2 } }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ textAlign: "center", py: 5, border: 0 }}>
                      <Typography sx={{ fontSize: "0.875rem", color: pnp.textMuted }}>No alerts match the selected filters.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedEvents.map((alert, idx) => {
                    const cat      = CATEGORY_CFG[alert.category] ?? CATEGORY_CFG.meet_greet;
                    const sevColor = SEVERITY_COLOR[alert.severity] ?? pnp.primary;
                    return (
                      <TableRow key={alert.id} sx={{ bgcolor: idx % 2 === 0 ? pnp.cardBg : "#FAFCFC", "&:hover": { bgcolor: `${pnp.primary}06` }, "& td": { borderBottom: `1px solid #EEF3F4` } }}>
                        <TableCell sx={{ width: 96, pl: 2, py: 1 }}>
                          <Box sx={{ width: 72, height: 46, borderRadius: "8px", overflow: "hidden", bgcolor: pnp.primaryDark, position: "relative", border: `2px solid ${sevColor}55` }}>
                            {alert.snapshot_url ? (
                              <Box component="img" src={alert.snapshot_url} alt={alert.camera} sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                            ) : alert.video_url ? (
                              <Box component="video" src={alert.video_url} sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} muted />
                            ) : (
                              <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: "1rem" }}>—</Typography>
                              </Box>
                            )}
                            <Box sx={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, bgcolor: sevColor }} />
                          </Box>
                        </TableCell>
                        <TableCell sx={{ width: 170 }}>
                          <Box onClick={() => navigate(cat.route)} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.35, borderRadius: "20px", bgcolor: `${cat.color}14`, border: `1px solid ${cat.color}40`, cursor: "pointer", "&:hover": { bgcolor: `${cat.color}25` }, transition: "background 0.15s" }}>
                            {cat.icon}
                            <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: cat.color, whiteSpace: "nowrap" }}>{cat.label}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ width: 110 }}>
                          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: pnp.text }}>{alert.camera}</Typography>
                        </TableCell>
                        <TableCell sx={{ width: 110 }}>
                          <Typography sx={{ fontSize: "0.6875rem", color: pnp.textMuted }}>{alert.location}</Typography>
                        </TableCell>
                        <TableCell sx={{ width: 160, whiteSpace: "nowrap" }}>
                          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: pnp.text }}>
                            {new Date(alert.occurred_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ width: 160 }}>
                          <Typography sx={{ fontSize: "0.8125rem", color: pnp.text }}>{alert.title}</Typography>
                          <Typography sx={{ fontSize: "0.6875rem", color: pnp.textMuted }}>{alert.description}</Typography>
                          {alert.status === "active" && alert.occurred_at && (
                            <Typography sx={{ fontSize: "0.625rem", color: pnp.danger, fontWeight: 700, mt: 0.25 }}>
                              {Math.floor((Date.now() - new Date(alert.occurred_at).getTime()) / 60000)}m waiting
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ width: 60, pr: 2, textAlign: "center" }}>
                          <Tooltip title="View media">
                            <IconButton size="small" onClick={() => { setMediaIdx(tablePage * PAGE_SIZE + idx); setMediaOpen(true); }} sx={{ color: pnp.textSecondary, "&:hover": { color: pnp.primary, bgcolor: pnp.primarySoft }, borderRadius: "8px" }}>
                              <VisibilityOutlinedIcon sx={{ fontSize: 20 }} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={filtered.length} page={tablePage} onPageChange={(_e, p) => setTablePage(p)} rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]} sx={{ borderTop: `1px solid #DCE7E8`, fontSize: "0.75rem", color: pnp.textSecondary, "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontSize: "0.75rem", color: pnp.textSecondary }, "& .MuiIconButton-root": { color: pnp.primary }, "& .MuiIconButton-root.Mui-disabled": { color: "#DCE7E8" } }} />
        </Paper>
      ) : (
        /* Grid view */
        <>
          {filtered.length === 0 ? (
            <Paper elevation={0} sx={{ p: 5, borderRadius: "14px", bgcolor: pnp.cardBg, border: pnp.cardBorder, textAlign: "center" }}>
              <Typography sx={{ fontSize: "0.875rem", color: pnp.textMuted }}>No alerts match the selected filters.</Typography>
            </Paper>
          ) : (
            <>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 2 }}>
                {pagedEvents.map((alert, idx) => {
                  const cat      = CATEGORY_CFG[alert.category] ?? CATEGORY_CFG.meet_greet;
                  const sevColor = SEVERITY_COLOR[alert.severity] ?? pnp.primary;
                  return (
                    <Paper key={alert.id} elevation={0} sx={{ borderRadius: "12px", bgcolor: pnp.cardBg, border: `1px solid ${sevColor}33`, boxShadow: pnp.cardShadow, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                      {/* Media area */}
                      <Box sx={{ position: "relative", width: "100%", aspectRatio: "16/9", bgcolor: pnp.primaryDark, flexShrink: 0 }}>
                        {alert.snapshot_url ? (
                          <Box component="img" src={alert.snapshot_url} alt={alert.camera} sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        ) : alert.video_url ? (
                          <Box component="video" src={alert.video_url} sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} muted />
                        ) : (
                          <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Typography sx={{ color: "rgba(255,255,255,0.25)", fontSize: "2rem" }}>📷</Typography>
                          </Box>
                        )}
                        {alert.video_url && (
                          <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <PlayCircleFilledOutlinedIcon sx={{ fontSize: 32, color: "rgba(255,255,255,0.8)" }} />
                          </Box>
                        )}
                        <Box sx={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, bgcolor: sevColor }} />
                        <Box sx={{ position: "absolute", top: 6, right: 6 }}>
                          <IconButton size="small" onClick={() => { setMediaIdx(tablePage * PAGE_SIZE + idx); setMediaOpen(true); }} sx={{ bgcolor: "rgba(0,0,0,0.55)", color: "#fff", borderRadius: "8px", p: 0.5, "&:hover": { bgcolor: "rgba(0,0,0,0.75)" } }}>
                            <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      </Box>
                      {/* Info area */}
                      <Box sx={{ p: 1.25, display: "flex", flexDirection: "column", gap: 0.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, px: 0.75, py: 0.2, borderRadius: "20px", bgcolor: `${cat.color}14`, border: `1px solid ${cat.color}40` }}>
                            {cat.icon}
                            <Typography sx={{ fontSize: "0.625rem", fontWeight: 700, color: cat.color }}>{cat.label}</Typography>
                          </Box>
                          <Box sx={{ px: 0.75, py: 0.2, borderRadius: "20px", bgcolor: `${sevColor}14`, border: `1px solid ${sevColor}40` }}>
                            <Typography sx={{ fontSize: "0.625rem", fontWeight: 700, color: sevColor, textTransform: "capitalize" }}>{alert.severity}</Typography>
                          </Box>
                        </Box>
                        <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: pnp.text }} noWrap>{alert.camera}</Typography>
                        <Typography sx={{ fontSize: "0.6875rem", color: pnp.textMuted }} noWrap>{alert.location}</Typography>
                        <Typography sx={{ fontSize: "0.6875rem", color: pnp.textSecondary }}>
                          {new Date(alert.occurred_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </Typography>
                      </Box>
                    </Paper>
                  );
                })}
              </Box>
              <TablePagination component="div" count={filtered.length} page={tablePage} onPageChange={(_e, p) => setTablePage(p)} rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]} sx={{ borderTop: `1px solid #DCE7E8`, fontSize: "0.75rem", color: pnp.textSecondary, "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontSize: "0.75rem", color: pnp.textSecondary }, "& .MuiIconButton-root": { color: pnp.primary }, "& .MuiIconButton-root.Mui-disabled": { color: "#DCE7E8" } }} />
            </>
          )}
        </>
      )}

      {mediaOpen && mediaItems.length > 0 && (
        <MediaDialog open={mediaOpen} onClose={() => setMediaOpen(false)} snapshot_url={mediaItems[mediaIdx]?.snapshot_url ?? null} video_url={mediaItems[mediaIdx]?.video_url ?? null} label={mediaItems[mediaIdx]?.label} items={mediaItems} initialIndex={mediaIdx} module="alerts" onFalsePositive={(id) => { setDismissedIds((prev) => new Set([...prev, id])); setMediaOpen(false); }} />
      )}
    </Box>
  );
}
