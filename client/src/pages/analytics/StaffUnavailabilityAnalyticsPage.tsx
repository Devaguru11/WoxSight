import { useState, useMemo } from "react";
import {
  Box, Paper, Typography, Select, MenuItem, FormControl, InputLabel,
  Button, IconButton, TextField, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow,
  CircularProgress,
} from "@mui/material";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import DomainOutlinedIcon from "@mui/icons-material/DomainOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import ViewListOutlinedIcon from "@mui/icons-material/ViewListOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { useStaffAvailabilityAnalytics, useInferences, todayIST, yesterdayIST, sevenDaysAgoIST } from "../../lib/meghaviApi";
import { MediaDialog } from "../../components/meghavi/MeghaviMediaViewer";

const PAGE_SIZE = 20;

function fmtDuration(secs: number) {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

const CARD_STYLE = { p: 0, borderRadius: "14px", bgcolor: "#FFFFFF", border: "1px solid #E2ECE9", boxShadow: "0 1px 4px rgba(10,77,82,0.05)", overflow: "hidden" } as const;

export function StaffUnavailabilityAnalyticsPage() {
  const [rangeFilter, setRangeFilter] = useState<"today" | "yesterday" | "7d">("7d");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaIdx, setMediaIdx] = useState(0);
  const [tablePage, setTablePage] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<Set<number | string>>(new Set());

  const today = todayIST();
  const fetchFrom = rangeFilter === "7d" ? sevenDaysAgoIST() : rangeFilter === "yesterday" ? yesterdayIST() : today;
  const fetchTo   = rangeFilter === "yesterday" ? yesterdayIST() : today;

  const [filterFrom, setFilterFrom] = useState(fetchFrom);
  const [filterTo,   setFilterTo]   = useState(fetchTo);
  const [filterCamera, setFilterCamera] = useState("all");

  // KPI cards + charts driven by top range filter
  const { analytics: kpiData } = useStaffAvailabilityAnalytics(fetchFrom, fetchTo);

  // Inferences section — reads inference_log.json directly (has video_url populated)
  const { data: inferences, loading: eventsLoading } = useInferences();

  const allInferences = useMemo(
    () => inferences?.staff_unavailability ?? [],
    [inferences]
  );

  const cameraOptions = useMemo(
    () => [...new Set(allInferences.map((e) => e.camera_name))].sort(),
    [allInferences]
  );

  // Filter by date range and camera (client-side)
  const filteredEvents = useMemo(() => {
    return allInferences
      .filter((e) => {
        if (dismissedIds.has(e.id)) return false;
        if (!e.detected_at) return false;
        const evtDate = new Date(e.detected_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
        if (evtDate < filterFrom || evtDate > filterTo) return false;
        if (filterCamera !== "all" && e.camera_name !== filterCamera) return false;
        return true;
      })
      .sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime());
  }, [allInferences, filterFrom, filterTo, filterCamera, dismissedIds]);

  const mediaItems = useMemo(
    () => filteredEvents.map((e) => ({ id: Number(e.id), snapshot_url: e.snapshot_url, video_url: e.video_url, label: e.camera_name })),
    [filteredEvents]
  );

  const pagedEvents = filteredEvents.slice(tablePage * PAGE_SIZE, (tablePage + 1) * PAGE_SIZE);

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
        <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0A4D52", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          STAFF UNAVAILABILITY ANALYTICS
        </Typography>
        <FormControl size="small">
          <Select
            value={rangeFilter}
            onChange={(e) => {
              const v = e.target.value as "today" | "yesterday" | "7d";
              const from = v === "7d" ? sevenDaysAgoIST() : v === "yesterday" ? yesterdayIST() : today;
              const to   = v === "yesterday" ? yesterdayIST() : today;
              setRangeFilter(v);
              setFilterFrom(from);
              setFilterTo(to);
              setTablePage(0);
            }}
            sx={{ bgcolor: "#FFFFFF", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", borderRadius: "8px", height: 36, "& .MuiOutlinedInput-notchedOutline": { borderColor: "#E2E8F0" } }}
          >
            <MenuItem value="today">Today</MenuItem>
            <MenuItem value="yesterday">Yesterday</MenuItem>
            <MenuItem value="7d">Last 7 Days</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* KPI Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 2 }}>
        {[
          { label: "Absences Detected", value: kpiData?.total_absence_events ?? 0, delta: `${(kpiData?.total_absence_events ?? 0) - (kpiData?.prev_total_absence_events ?? 0) >= 0 ? "+" : ""}${(kpiData?.total_absence_events ?? 0) - (kpiData?.prev_total_absence_events ?? 0)}`, positive: (kpiData?.total_absence_events ?? 0) <= (kpiData?.prev_total_absence_events ?? 0), sub: "vs prev period", icon: <PersonOffOutlinedIcon />, bg: "#FFF7ED", color: "#EA580C" },
          { label: "Unavailability %",  value: `${(kpiData?.unavailability_pct ?? 0).toFixed(1)}%`, delta: `${((kpiData?.unavailability_pct ?? 0) - (kpiData?.prev_unavailability_pct ?? 0)).toFixed(1)}%`, positive: (kpiData?.unavailability_pct ?? 0) <= (kpiData?.prev_unavailability_pct ?? 0), sub: "vs prev period", icon: <DomainOutlinedIcon />,      bg: "#F0FDF4", color: "#059669" },
          { label: "Total Absent Mins", value: kpiData?.total_absent_minutes ?? 0,   delta: `${(kpiData?.total_absent_minutes ?? 0) - (kpiData?.prev_total_absent_minutes ?? 0) >= 0 ? "+" : ""}${(kpiData?.total_absent_minutes ?? 0) - (kpiData?.prev_total_absent_minutes ?? 0)}`,   positive: (kpiData?.total_absent_minutes ?? 0) <= (kpiData?.prev_total_absent_minutes ?? 0),   sub: "vs prev period", icon: <AccessTimeOutlinedIcon />, bg: "#EEF2FF", color: "#4F46E5" },
          { label: "Cameras Affected",  value: kpiData?.affected_cameras ?? 0,       delta: `${(kpiData?.affected_cameras ?? 0) - (kpiData?.prev_affected_cameras ?? 0) >= 0 ? "+" : ""}${(kpiData?.affected_cameras ?? 0) - (kpiData?.prev_affected_cameras ?? 0)}`,       positive: (kpiData?.affected_cameras ?? 0) <= (kpiData?.prev_affected_cameras ?? 0),       sub: "vs prev period", icon: <GroupOutlinedIcon />,      bg: "#FEF2F2", color: "#EF4444" },
        ].map((kpi, idx) => (
          <Paper key={idx} elevation={0} sx={{ p: 2, borderRadius: "14px", bgcolor: "#FFFFFF", border: "1px solid #E2ECE9", boxShadow: "0 1px 4px rgba(10,77,82,0.05)", display: "flex", alignItems: "center", gap: 2 }}>
            <Box sx={{ width: 46, height: 46, borderRadius: "12px", display: "grid", placeItems: "center", bgcolor: kpi.bg, color: kpi.color }}>{kpi.icon}</Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.6875rem", fontWeight: 800, color: "#64748B", letterSpacing: "0.06em" }}>{kpi.label}</Typography>
              <Typography sx={{ fontSize: "1.375rem", fontWeight: 800, color: "#0F172A", lineHeight: 1.2 }}>{kpi.value}</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25 }}>
                <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: kpi.positive ? "#10B981" : "#EF4444" }}>{kpi.delta}</Typography>
                <Typography sx={{ fontSize: "0.6875rem", color: "#94A3B8" }}>{kpi.sub}</Typography>
              </Box>
            </Box>
          </Paper>
        ))}
      </Box>

      {/* Charts Row */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.6fr 1fr" }, gap: 2.5 }}>
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: "14px", bgcolor: "#FFFFFF", border: "1px solid #E2ECE9", boxShadow: "0 1px 4px rgba(10,77,82,0.05)", display: "flex", flexDirection: "column", minHeight: 320 }}>
          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 800, color: "#64748B", letterSpacing: "0.08em", textTransform: "uppercase", mb: 2 }}>
            UNAVAILABILITY OVER TIME (%)
          </Typography>
          <Box sx={{ flex: 1, minHeight: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={kpiData?.hourly_rate ?? []} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="hour" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} dy={6} />
                <YAxis domain={[0, 16]} ticks={[0, 4, 8, 12, 16]} stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} dx={-4} />
                <Tooltip contentStyle={{ backgroundColor: "#0F172A", borderRadius: 8, border: "none", color: "#FFFFFF", fontSize: 12 }} formatter={(val) => [`${val}% Unavailability`, ""]} />
                <Line type="monotone" dataKey="rate" stroke="#EA580C" strokeWidth={2.5} dot={{ r: 3, fill: "#EA580C" }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ p: 2.5, borderRadius: "14px", bgcolor: "#FFFFFF", border: "1px solid #E2ECE9", boxShadow: "0 1px 4px rgba(10,77,82,0.05)", display: "flex", flexDirection: "column" }}>
          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 800, color: "#64748B", letterSpacing: "0.08em", textTransform: "uppercase", mb: 2 }}>
            UNAVAILABILITY BY DAY (%)
          </Typography>
          <Box sx={{ flex: 1, minHeight: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kpiData?.by_day ?? []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} dy={6} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} dx={-4} />
                <Tooltip contentStyle={{ backgroundColor: "#0F172A", borderRadius: 8, border: "none", color: "#FFFFFF", fontSize: 12 }} formatter={(val) => [`${val}%`, "Unavailability"]} />
                <Bar dataKey="rate" fill="#EA580C" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Box>

      {/* Filter Bar */}
      <Paper elevation={0} sx={{ p: 2, borderRadius: "14px", bgcolor: "#FFFFFF", border: "1px solid #E2ECE9", boxShadow: "0 1px 4px rgba(10,77,82,0.05)" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <TextField
            label="From" type="date" size="small" value={filterFrom}
            onChange={(e) => { setFilterFrom(e.target.value); setTablePage(0); }}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 165, "& .MuiOutlinedInput-root": { borderRadius: "10px" }, "& .MuiOutlinedInput-notchedOutline": { borderColor: "#E2ECE9" } }}
          />
          <TextField
            label="To" type="date" size="small" value={filterTo}
            onChange={(e) => { setFilterTo(e.target.value); setTablePage(0); }}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 165, "& .MuiOutlinedInput-root": { borderRadius: "10px" }, "& .MuiOutlinedInput-notchedOutline": { borderColor: "#E2ECE9" } }}
          />
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel sx={{ fontSize: "0.875rem" }}>Camera</InputLabel>
            <Select value={filterCamera} label="Camera"
              onChange={(e) => { setFilterCamera(e.target.value); setTablePage(0); }}
              sx={{ borderRadius: "10px", "& .MuiOutlinedInput-notchedOutline": { borderColor: "#E2ECE9" } }}
            >
              <MenuItem value="all">All Cameras</MenuItem>
              {cameraOptions.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="outlined" size="small" onClick={resetFilters}
            sx={{ height: 40, borderColor: "#E2ECE9", color: "#64748B", fontWeight: 600, fontSize: "0.8125rem", borderRadius: "10px", textTransform: "none", px: 2, "&:hover": { borderColor: "#EA580C", color: "#EA580C", bgcolor: "#FFF7ED" } }}
          >
            Reset
          </Button>
        </Box>
      </Paper>

      {/* Staff Absence Inferences — Table / Grid */}
      <Paper elevation={0} sx={CARD_STYLE}>
        {/* Header */}
        <Box sx={{ px: 2.5, pt: 2, pb: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography sx={{ fontSize: "0.8125rem", fontWeight: 800, color: "#64748B", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              STAFF ABSENCE INFERENCES
            </Typography>
            {eventsLoading
              ? <CircularProgress size={14} sx={{ color: "#EA580C" }} />
              : <Typography sx={{ fontSize: "0.75rem", color: "#94A3B8" }}>{filteredEvents.length} events</Typography>
            }
          </Box>
          {/* View Toggle */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, bgcolor: "#F5F8F9", borderRadius: "10px", p: 0.4 }}>
            <IconButton size="small" onClick={() => setViewMode("table")}
              sx={{ borderRadius: "8px", color: viewMode === "table" ? "#0A4D52" : "#94A3B8", bgcolor: viewMode === "table" ? "#FFFFFF" : "transparent", boxShadow: viewMode === "table" ? "0 1px 3px rgba(10,77,82,0.12)" : "none", transition: "all .15s" }}>
              <ViewListOutlinedIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => setViewMode("grid")}
              sx={{ borderRadius: "8px", color: viewMode === "grid" ? "#0A4D52" : "#94A3B8", bgcolor: viewMode === "grid" ? "#FFFFFF" : "transparent", boxShadow: viewMode === "grid" ? "0 1px 3px rgba(10,77,82,0.12)" : "none", transition: "all .15s" }}>
              <GridViewOutlinedIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Table View */}
        {viewMode === "table" && (
          <TableContainer sx={{ overflowX: "auto", borderTop: "1px solid #E2ECE9" }}>
            <Table size="small" sx={{ minWidth: 700 }}>
              <TableHead>
                <TableRow>
                  {["Capture", "Camera", "Location", "Detected At", "Absent Duration", "View"].map((col, i) => (
                    <TableCell key={i} sx={{ fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.07em", textTransform: "uppercase", bgcolor: "#F5F8F9", borderBottom: "2px solid #E2ECE9", py: 1.25, whiteSpace: "nowrap", "&:first-of-type": { pl: 2.5, width: 110 }, "&:last-of-type": { pr: 2.5, width: 64, textAlign: "center" } }}>
                      {col}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {eventsLoading && (
                  <TableRow><TableCell colSpan={6} sx={{ py: 5, textAlign: "center", border: 0 }}><CircularProgress size={24} sx={{ color: "#EA580C" }} /></TableCell></TableRow>
                )}
                {!eventsLoading && filteredEvents.length === 0 && (
                  <TableRow><TableCell colSpan={6} sx={{ py: 5, textAlign: "center", border: 0 }}><Typography sx={{ color: "#94A3B8", fontSize: "0.875rem" }}>No absence events for this period.</Typography></TableCell></TableRow>
                )}
                {!eventsLoading && pagedEvents.map((evt, idx) => {
                  const absIdx = tablePage * PAGE_SIZE + idx;
                  return (
                    <TableRow key={evt.id} sx={{ bgcolor: idx % 2 === 0 ? "#FFFFFF" : "#FAFCFC", "&:hover": { bgcolor: "#FFF7ED" }, "& td": { borderBottom: "1px solid #EEF3F4" } }}>
                      {/* Capture — video if available, else snapshot */}
                      <TableCell sx={{ pl: 2.5, py: 1 }}>
                        <Box
                          onClick={() => { setMediaIdx(absIdx); setMediaOpen(true); }}
                          sx={{ width: 90, height: 60, borderRadius: "6px", overflow: "hidden", cursor: "pointer", border: "1px solid #E2ECE9", bgcolor: "#0D1117", flexShrink: 0, "&:hover": { borderColor: "#EA580C" } }}
                        >
                          {evt.video_url ? (
                            <Box component="video"
                              src={`${window.location.origin}${evt.video_url}`}
                              preload="metadata" muted
                              sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            />
                          ) : evt.snapshot_url ? (
                            <img src={evt.snapshot_url} alt="capture" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          ) : (
                            <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Typography sx={{ fontSize: "1.5rem", opacity: 0.3 }}>📹</Typography>
                            </Box>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ minWidth: 160 }}>
                        <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: "#1E293B" }}>{evt.camera_name}</Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 140 }}>
                        <Typography sx={{ fontSize: "0.8125rem", color: "#1E293B" }}>{evt.location}</Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap", minWidth: 140 }}>
                        <Typography sx={{ fontSize: "0.8125rem", color: "#1E293B" }}>
                          {new Date(evt.detected_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 130 }}>
                        <Chip label={fmtDuration(evt.absent_duration_seconds)} size="small" sx={{ fontWeight: 700, bgcolor: "#FFF7ED", color: "#EA580C", fontSize: "0.6875rem" }} />
                      </TableCell>
                      <TableCell sx={{ pr: 2.5, textAlign: "center" }}>
                        <IconButton size="small"
                          onClick={() => { setMediaIdx(absIdx); setMediaOpen(true); }}
                          sx={{ color: "#94A3B8", "&:hover": { color: "#EA580C", bgcolor: "#FFF7ED" }, borderRadius: "8px" }}>
                          <ImageOutlinedIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Grid View */}
        {viewMode === "grid" && (
          <Box sx={{ p: 2, borderTop: "1px solid #E2ECE9" }}>
            {eventsLoading && (
              <Box sx={{ py: 5, display: "flex", justifyContent: "center" }}><CircularProgress size={28} sx={{ color: "#EA580C" }} /></Box>
            )}
            {!eventsLoading && filteredEvents.length === 0 && (
              <Box sx={{ py: 5, textAlign: "center" }}><Typography sx={{ color: "#94A3B8", fontSize: "0.875rem" }}>No absence events for this period.</Typography></Box>
            )}
            {!eventsLoading && filteredEvents.length > 0 && (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3,1fr)", md: "repeat(4,1fr)", lg: "repeat(5,1fr)" }, gap: 1.5 }}>
                {pagedEvents.map((e, idx) => {
                  const absIdx = tablePage * PAGE_SIZE + idx;
                  return (
                    <Paper key={e.id} elevation={0}
                      onClick={() => { setMediaIdx(absIdx); setMediaOpen(true); }}
                      sx={{ borderRadius: "12px", overflow: "hidden", border: "1.5px solid #EA580C44", cursor: "pointer", transition: "box-shadow 0.15s, transform 0.15s", "&:hover": { boxShadow: "0 6px 20px #EA580C30", transform: "translateY(-2px)" } }}
                    >
                      <Box sx={{ position: "relative", width: "100%", paddingTop: "60%", bgcolor: "#1a1a2e", overflow: "hidden" }}>
                        {e.video_url ? (
                          <Box component="video"
                            src={`${window.location.origin}${e.video_url}`}
                            preload="metadata" muted
                            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : e.snapshot_url ? (
                          <Box component="img" src={e.snapshot_url} alt="absence"
                            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Typography sx={{ fontSize: "2rem", opacity: 0.3 }}>📹</Typography>
                          </Box>
                        )}
                      </Box>
                      <Box sx={{ p: 1.25 }}>
                        <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: "#1E2A35", lineHeight: 1.3 }} noWrap>{e.camera_name}</Typography>
                        <Typography sx={{ fontSize: "0.625rem", color: "#64748B", mb: 0.5 }} noWrap>
                          {new Date(e.detected_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </Typography>
                        <Chip label={`Absent: ${fmtDuration(e.absent_duration_seconds)}`} size="small" sx={{ bgcolor: "#FFF7ED", color: "#EA580C", fontSize: "0.5625rem", fontWeight: 700, height: 16 }} />
                      </Box>
                    </Paper>
                  );
                })}
              </Box>
            )}
          </Box>
        )}

        {filteredEvents.length > PAGE_SIZE && (
          <TablePagination
            component="div" count={filteredEvents.length} page={tablePage}
            onPageChange={(_e, p) => setTablePage(p)}
            rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]}
            sx={{ borderTop: "1px solid #E2ECE9", fontSize: "0.75rem", color: "#64748B" }}
          />
        )}

        {mediaOpen && mediaItems.length > 0 && (
          <MediaDialog
            open={mediaOpen}
            onClose={() => setMediaOpen(false)}
            snapshot_url={mediaItems[mediaIdx]?.snapshot_url ?? null}
            video_url={mediaItems[mediaIdx]?.video_url ?? null}
            label={mediaItems[mediaIdx]?.label}
            items={mediaItems}
            initialIndex={mediaIdx}
            module="staff_unavailability"
            onFalsePositive={(id) => setDismissedIds((prev) => new Set([...prev, id]))}
          />
        )}
      </Paper>
    </Box>
  );
}
