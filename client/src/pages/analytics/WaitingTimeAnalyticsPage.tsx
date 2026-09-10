import { useState, useMemo, useEffect } from "react";
import {
  Box, Paper, Typography, Select, MenuItem, FormControl,
  Button, IconButton, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow,
  CircularProgress,
} from "@mui/material";
import HourglassTopOutlinedIcon from "@mui/icons-material/HourglassTopOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import ViewListOutlinedIcon from "@mui/icons-material/ViewListOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useWalkinsAnalytics, todayIST, yesterdayIST, sevenDaysAgoIST } from "../../lib/meghaviApi";
import { MediaDialog } from "../../components/meghavi/MeghaviMediaViewer";

const PAGE_SIZE = 20;
const DWELL_THRESHOLD = 120; // seconds — events above this are "waiting"

const KPI_COLORS = [
  { bg: "#FFF7ED", color: "#EA580C" },
  { bg: "#FEF3C7", color: "#D97706" },
  { bg: "#FEE2E2", color: "#DC2626" },
  { bg: "#FFF7ED", color: "#C2410C" },
];

const CARD_STYLE = {
  p: 0, borderRadius: "14px", bgcolor: "#FFFFFF",
  border: "1px solid #FDE8D3", boxShadow: "0 1px 4px rgba(194,65,12,0.06)", overflow: "hidden",
} as const;

function fmtDuration(s: number) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  return r > 0 ? `${m}m ${r}s` : `${m}m`;
}

export function WaitingTimeAnalyticsPage() {
  const [rangeFilter, setRangeFilter] = useState<"today" | "yesterday" | "7d">("7d");
  const [tablePage, setTablePage]     = useState(0);
  const [mediaOpen, setMediaOpen]     = useState(false);
  const [mediaIdx, setMediaIdx]       = useState(0);
  const [viewMode, setViewMode]       = useState<"table" | "grid">("table");
  const [dismissedIds, setDismissedIds] = useState<Set<number | string>>(new Set());

  const today = todayIST();
  const [filterFrom, setFilterFrom] = useState(sevenDaysAgoIST());
  const [filterTo,   setFilterTo]   = useState(today);
  const [filterCamera, setFilterCamera] = useState("all");

  const fetchFrom = rangeFilter === "7d" ? sevenDaysAgoIST() : rangeFilter === "yesterday" ? yesterdayIST() : today;
  const fetchTo   = rangeFilter === "yesterday" ? yesterdayIST() : today;

  const { analytics: walkinsData, loading: eventsLoading } = useWalkinsAnalytics(filterFrom, filterTo);

  useEffect(() => {
    setFilterFrom(fetchFrom);
    setFilterTo(fetchTo);
    setTablePage(0);
  }, [rangeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const allWaiting = useMemo(
    () => (walkinsData?.events ?? []).filter((e) => e.dwell_seconds > DWELL_THRESHOLD),
    [walkinsData]
  );

  const cameraOptions = useMemo(
    () => [...new Set(allWaiting.map((e) => e.camera_name))].sort(),
    [allWaiting]
  );

  const filteredEvents = useMemo(() => {
    return allWaiting
      .filter((e) => {
        if (dismissedIds.has(e.id)) return false;
        if (filterCamera !== "all" && e.camera_name !== filterCamera) return false;
        return true;
      })
      .sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime());
  }, [allWaiting, filterCamera, dismissedIds]);

  const mediaItems = useMemo(
    () => filteredEvents.map((e) => ({ id: Number(e.id), snapshot_url: e.snapshot_url, face_crop_url: e.face_crop_url, video_url: e.video_url, label: e.camera_name, sublabel: fmtDuration(e.dwell_seconds) })),
    [filteredEvents]
  );

  const pagedEvents = filteredEvents.slice(tablePage * PAGE_SIZE, (tablePage + 1) * PAGE_SIZE);

  // KPIs derived from filtered events
  const avgWait = filteredEvents.length
    ? Math.round(filteredEvents.reduce((s, e) => s + e.dwell_seconds, 0) / filteredEvents.length)
    : 0;
  const maxWait = filteredEvents.length
    ? Math.max(...filteredEvents.map((e) => e.dwell_seconds))
    : 0;

  // Hourly bar chart
  const hourlyData = useMemo(() => {
    const hMap: Record<string, number> = {};
    for (const e of filteredEvents) {
      const h = new Date(e.detected_at).toLocaleString("en-CA", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).replace(/,.*/, "").padStart(2, "0") + ":00";
      hMap[h] = (hMap[h] ?? 0) + 1;
    }
    return Object.entries(hMap).sort().map(([hour, count]) => ({ hour, count }));
  }, [filteredEvents]);

  // Daily bar chart
  const dailyData = useMemo(() => {
    const dMap: Record<string, number> = {};
    for (const e of filteredEvents) {
      const d = new Date(e.detected_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      dMap[d] = (dMap[d] ?? 0) + 1;
    }
    return Object.entries(dMap).sort().map(([day, count]) => ({ day: day.slice(5), count }));
  }, [filteredEvents]);

  function resetFilters() {
    setFilterFrom(fetchFrom);
    setFilterTo(fetchTo);
    setFilterCamera("all");
    setTablePage(0);
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, width: "100%", pb: 3 }}>

      {/* Header & Range Filter */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5 }}>
        <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#7C2D12", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          CUSTOMER WAITING TIME
        </Typography>
        <FormControl size="small">
          <Select
            value={rangeFilter}
            onChange={(e) => setRangeFilter(e.target.value as "today" | "yesterday" | "7d")}
            sx={{ bgcolor: "#FFFFFF", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", borderRadius: "8px", height: 36, "& .MuiOutlinedInput-notchedOutline": { borderColor: "#FDE8D3" } }}
          >
            <MenuItem value="today">Today</MenuItem>
            <MenuItem value="yesterday">Yesterday</MenuItem>
            <MenuItem value="7d">Last 7 Days</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* KPI Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", md: "repeat(4,1fr)" }, gap: 1.5 }}>
        {[
          { label: "Waiting Customers", value: filteredEvents.length, delta: "", positive: true, sub: "exceeded 2 min threshold", icon: <HourglassTopOutlinedIcon /> },
          { label: "Avg Wait Time",     value: avgWait ? fmtDuration(avgWait) : "—",   delta: "", positive: false, sub: "average dwell",       icon: <AccessTimeOutlinedIcon /> },
          { label: "Longest Wait",      value: maxWait ? fmtDuration(maxWait) : "—",   delta: "", positive: false, sub: "single session",       icon: <TimerOutlinedIcon /> },
          { label: "Cameras",           value: cameraOptions.length || "—",             delta: "", positive: true,  sub: "with waiting events",  icon: <VideocamOutlinedIcon /> },
        ].map((kpi, idx) => (
          <Paper key={idx} elevation={0} sx={{ p: 2, borderRadius: "14px", bgcolor: "#FFFFFF", border: "1px solid #FDE8D3", boxShadow: "0 1px 4px rgba(194,65,12,0.06)", display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ width: 42, height: 42, borderRadius: "10px", display: "grid", placeItems: "center", bgcolor: KPI_COLORS[idx].bg, color: KPI_COLORS[idx].color, flexShrink: 0 }}>{kpi.icon}</Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.6875rem", fontWeight: 800, color: "#64748B", letterSpacing: "0.06em" }} noWrap>{kpi.label}</Typography>
              <Typography sx={{ fontSize: "1.375rem", fontWeight: 800, color: "#1E2A35", lineHeight: 1.2 }}>{kpi.value}</Typography>
              <Typography sx={{ fontSize: "0.6875rem", color: "#94A3B8", mt: 0.2 }}>{kpi.sub}</Typography>
            </Box>
          </Paper>
        ))}
      </Box>

      {/* Charts Row: By Hour + By Day */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: "14px", bgcolor: "#FFFFFF", border: "1px solid #FDE8D3", boxShadow: "0 1px 4px rgba(194,65,12,0.06)", minHeight: 260 }}>
          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 800, color: "#64748B", letterSpacing: "0.08em", textTransform: "uppercase", mb: 2 }}>
            WAITING EVENTS BY HOUR
          </Typography>
          {hourlyData.length === 0 && !eventsLoading ? (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
              <Typography sx={{ color: "#94A3B8", fontSize: "0.875rem" }}>No data for this period.</Typography>
            </Box>
          ) : (
            <Box sx={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData} margin={{ top: 4, right: 12, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#FEF3C7" vertical={false} />
                  <XAxis dataKey="hour" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={{ stroke: "#FDE8D3" }} dy={6} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#1E2A35", borderRadius: 8, border: "none", color: "#FFFFFF", fontSize: 12 }} formatter={(val) => { const n = Number(val); return [`${n} event${n !== 1 ? "s" : ""}`, "Waiting"]; }} />
                  <Bar dataKey="count" fill="#F97316" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Paper>

        <Paper elevation={0} sx={{ p: 2.5, borderRadius: "14px", bgcolor: "#FFFFFF", border: "1px solid #FDE8D3", boxShadow: "0 1px 4px rgba(194,65,12,0.06)", minHeight: 260 }}>
          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 800, color: "#64748B", letterSpacing: "0.08em", textTransform: "uppercase", mb: 2 }}>
            WAITING EVENTS BY DAY
          </Typography>
          {dailyData.length === 0 && !eventsLoading ? (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
              <Typography sx={{ color: "#94A3B8", fontSize: "0.875rem" }}>No data for this period.</Typography>
            </Box>
          ) : (
            <Box sx={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ top: 4, right: 12, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#FEF3C7" vertical={false} />
                  <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={{ stroke: "#FDE8D3" }} dy={6} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#1E2A35", borderRadius: 8, border: "none", color: "#FFFFFF", fontSize: 12 }} formatter={(val) => { const n = Number(val); return [`${n} event${n !== 1 ? "s" : ""}`, "Waiting"]; }} />
                  <Bar dataKey="count" fill="#FB923C" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Paper>
      </Box>

      {/* Events Table / Grid */}
      <Paper elevation={0} sx={CARD_STYLE}>
        {/* Toolbar */}
        <Box sx={{ px: 2.5, pt: 2, pb: 1.5, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", borderBottom: "1px solid #FDE8D3" }}>
          {/* Date range pickers */}
          <TextField
            label="From" type="date" size="small" value={filterFrom}
            onChange={(e) => { setFilterFrom(e.target.value); setTablePage(0); }}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: 145, "& .MuiOutlinedInput-root": { borderRadius: "10px" }, "& .MuiOutlinedInput-notchedOutline": { borderColor: "#FDE8D3" } }}
          />
          <TextField
            label="To" type="date" size="small" value={filterTo}
            onChange={(e) => { setFilterTo(e.target.value); setTablePage(0); }}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: 145, "& .MuiOutlinedInput-root": { borderRadius: "10px" }, "& .MuiOutlinedInput-notchedOutline": { borderColor: "#FDE8D3" } }}
          />

          {/* Camera filter */}
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <Select
              value={filterCamera}
              onChange={(e) => { setFilterCamera(e.target.value); setTablePage(0); }}
              displayEmpty
              sx={{ borderRadius: "10px", fontSize: "0.8125rem", "& .MuiOutlinedInput-notchedOutline": { borderColor: "#FDE8D3" } }}
            >
              <MenuItem value="all">All Cameras</MenuItem>
              {cameraOptions.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>

          <Button
            size="small" variant="outlined"
            onClick={resetFilters}
            sx={{ height: 40, borderColor: "#FDE8D3", color: "#94A3B8", fontWeight: 600, fontSize: "0.8125rem", borderRadius: "10px", textTransform: "none", px: 2, "&:hover": { borderColor: "#EA580C", color: "#EA580C", bgcolor: "#FFF7ED" } }}
          >
            Reset
          </Button>

          <Box sx={{ flex: 1 }} />

          {eventsLoading
            ? <CircularProgress size={18} sx={{ color: "#EA580C" }} />
            : <Typography sx={{ fontSize: "0.75rem", color: "#94A3B8" }}>{filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}</Typography>
          }

          {/* View toggle */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, bgcolor: "#FFF7ED", borderRadius: "10px", p: 0.4 }}>
            <IconButton size="small" onClick={() => setViewMode("table")} sx={{ borderRadius: "8px", color: viewMode === "table" ? "#EA580C" : "#94A3B8", bgcolor: viewMode === "table" ? "#FFFFFF" : "transparent", boxShadow: viewMode === "table" ? "0 1px 3px rgba(194,65,12,0.15)" : "none", transition: "all .15s" }}>
              <ViewListOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton size="small" onClick={() => setViewMode("grid")} sx={{ borderRadius: "8px", color: viewMode === "grid" ? "#EA580C" : "#94A3B8", bgcolor: viewMode === "grid" ? "#FFFFFF" : "transparent", boxShadow: viewMode === "grid" ? "0 1px 3px rgba(194,65,12,0.15)" : "none", transition: "all .15s" }}>
              <GridViewOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>

        {/* Table View */}
        {viewMode === "table" && (
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 580 }}>
              <TableHead>
                <TableRow>
                  {["Capture", "Camera", "Location", "Detected At", "Wait Time"].map((col, i) => (
                    <TableCell key={i} sx={{ fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.07em", textTransform: "uppercase", bgcolor: "#FFF7ED", borderBottom: "2px solid #FDE8D3", py: 1.25, "&:first-of-type": { pl: 2.5 }, "&:last-of-type": { pr: 2.5 } }}>
                      {col}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {eventsLoading && (
                  <TableRow><TableCell colSpan={5} sx={{ py: 5, textAlign: "center", border: 0 }}><CircularProgress size={24} sx={{ color: "#EA580C" }} /></TableCell></TableRow>
                )}
                {!eventsLoading && filteredEvents.length === 0 && (
                  <TableRow><TableCell colSpan={5} sx={{ py: 5, textAlign: "center", border: 0 }}><Typography sx={{ color: "#94A3B8", fontSize: "0.875rem" }}>No waiting-time events for this period.</Typography></TableCell></TableRow>
                )}
                {!eventsLoading && pagedEvents.map((evt, idx) => {
                  const absIdx = tablePage * PAGE_SIZE + idx;
                  return (
                    <TableRow key={evt.id} sx={{ bgcolor: idx % 2 === 0 ? "#FFFFFF" : "#FFFAF7", "&:hover": { bgcolor: "#FFF3E8" }, "& td": { borderBottom: "1px solid #FEF0E4" } }}>
                      {/* Capture thumbnail */}
                      <TableCell sx={{ width: 110, pl: 2.5, py: 1 }}>
                        {(evt.face_crop_url ?? evt.snapshot_url) ? (
                          <Box component="button"
                            onClick={() => { setMediaIdx(absIdx); setMediaOpen(true); }}
                            sx={{ background: "none", border: "1px solid #FDE8D3", cursor: "pointer", p: 0, width: 90, height: 60, borderRadius: "6px", overflow: "hidden", display: "block", "&:hover": { borderColor: "#EA580C" } }}
                          >
                            <img src={evt.face_crop_url ?? evt.snapshot_url!} alt="capture" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          </Box>
                        ) : (
                          <Box sx={{ width: 90, height: 60, bgcolor: "#FFF7ED", borderRadius: "6px", display: "grid", placeItems: "center", border: "1px solid #FDE8D3" }}>
                            <ImageOutlinedIcon sx={{ fontSize: 20, color: "#FCA58A" }} />
                          </Box>
                        )}
                      </TableCell>
                      <TableCell><Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: "#1E2A35" }}>{evt.camera_name}</Typography></TableCell>
                      <TableCell><Typography sx={{ fontSize: "0.8125rem", color: "#475569" }}>{evt.location_name}</Typography></TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        <Typography sx={{ fontSize: "0.8125rem", color: "#475569" }}>
                          {new Date(evt.detected_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ pr: 2.5 }}>
                        <Box sx={{ display: "inline-flex", px: 1.25, py: 0.4, borderRadius: "20px", bgcolor: evt.dwell_seconds >= 600 ? "#FEE2E2" : "#FFF7ED", border: `1px solid ${evt.dwell_seconds >= 600 ? "#FCA5A5" : "#FDBA74"}` }}>
                          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: evt.dwell_seconds >= 600 ? "#DC2626" : "#EA580C", whiteSpace: "nowrap" }}>
                            {fmtDuration(evt.dwell_seconds)}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Grid View */}
        {viewMode === "grid" && !eventsLoading && (
          <Box sx={{ p: 2.5 }}>
            {filteredEvents.length === 0 ? (
              <Typography sx={{ color: "#94A3B8", fontSize: "0.875rem", textAlign: "center", py: 4 }}>No waiting-time events for this period.</Typography>
            ) : (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", md: "repeat(3,1fr)", lg: "repeat(4,1fr)" }, gap: 1.5 }}>
                {pagedEvents.map((e, idx) => {
                  const absIdx = tablePage * PAGE_SIZE + idx;
                  return (
                    <Paper key={e.id} elevation={0} sx={{ borderRadius: "12px", border: "1px solid #FDE8D3", overflow: "hidden", cursor: "pointer", transition: "box-shadow .15s", "&:hover": { boxShadow: "0 4px 16px rgba(194,65,12,0.14)", borderColor: "#EA580C" } }}
                      onClick={() => { setMediaIdx(absIdx); setMediaOpen(true); }}>
                      {/* Image */}
                      <Box sx={{ width: "100%", height: 140, bgcolor: "#FFF7ED", position: "relative", overflow: "hidden" }}>
                        {(e.face_crop_url ?? e.snapshot_url)
                          ? <img src={e.face_crop_url ?? e.snapshot_url!} alt="capture" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          : <Box sx={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}><ImageOutlinedIcon sx={{ fontSize: 32, color: "#FCA58A" }} /></Box>
                        }
                      </Box>
                      {/* Info */}
                      <Box sx={{ p: 1.25 }}>
                        <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#1E2A35" }} noWrap>{e.camera_name}</Typography>
                        <Typography sx={{ fontSize: "0.6875rem", color: "#94A3B8", mt: 0.25 }}>
                          {new Date(e.detected_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </Typography>
                        <Box sx={{ mt: 0.75, display: "inline-flex", px: 1, py: 0.3, borderRadius: "20px", bgcolor: e.dwell_seconds >= 600 ? "#FEE2E2" : "#FFF7ED", border: `1px solid ${e.dwell_seconds >= 600 ? "#FCA5A5" : "#FDBA74"}` }}>
                          <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: e.dwell_seconds >= 600 ? "#DC2626" : "#EA580C" }}>
                            {fmtDuration(e.dwell_seconds)}
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  );
                })}
              </Box>
            )}
          </Box>
        )}

        {eventsLoading && viewMode === "grid" && (
          <Box sx={{ py: 5, display: "grid", placeItems: "center" }}><CircularProgress size={28} sx={{ color: "#EA580C" }} /></Box>
        )}

        {filteredEvents.length > PAGE_SIZE && (
          <TablePagination
            component="div" count={filteredEvents.length} page={tablePage}
            onPageChange={(_e, p) => setTablePage(p)}
            rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]}
            sx={{ borderTop: "1px solid #FDE8D3", fontSize: "0.75rem", color: "#64748B", "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontSize: "0.75rem" }, "& .MuiIconButton-root": { color: "#EA580C" }, "& .MuiIconButton-root.Mui-disabled": { color: "#FDE8D3" } }}
          />
        )}
      </Paper>

      {mediaOpen && mediaItems.length > 0 && (
        <MediaDialog
          open={mediaOpen} onClose={() => setMediaOpen(false)}
          snapshot_url={mediaItems[mediaIdx]?.snapshot_url ?? null}
          face_crop_url={mediaItems[mediaIdx]?.face_crop_url ?? null}
          video_url={mediaItems[mediaIdx]?.video_url ?? null}
          label={mediaItems[mediaIdx]?.label}
          items={mediaItems} initialIndex={mediaIdx}
          module="waiting_time"
          onFalsePositive={(id) => setDismissedIds((prev) => new Set([...prev, id]))}
        />
      )}
    </Box>
  );
}
