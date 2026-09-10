import { useState, useMemo, useEffect } from "react";
import {
  Box, Paper, Typography, Select, MenuItem, FormControl, InputLabel,
  Button, IconButton, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow,
  CircularProgress,
} from "@mui/material";
import WorkOutlineOutlinedIcon from "@mui/icons-material/WorkOutlineOutlined";
import FingerprintOutlinedIcon from "@mui/icons-material/FingerprintOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import ViewListOutlinedIcon from "@mui/icons-material/ViewListOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import LinkOffOutlinedIcon from "@mui/icons-material/LinkOffOutlined";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
} from "recharts";
import { useFriskingBagAnalytics, todayIST, yesterdayIST, sevenDaysAgoIST } from "../../lib/meghaviApi";
import { MediaDialog } from "../../components/meghavi/MeghaviMediaViewer";

const KPI_COLORS = [
  { bg: "#F0F4FF", color: "#3B5BDB" },
  { bg: "#F0FDF4", color: "#16A34A" },
  { bg: "#FFF7ED", color: "#C2410C" },
  { bg: "#F0FDFA", color: "#0D9488" },
];

const PAGE_SIZE = 20;

const CARD_STYLE = {
  p: 0,
  borderRadius: "14px",
  bgcolor: "#FFFFFF",
  border: "1px solid #DCE7E8",
  boxShadow: "0 1px 4px rgba(11,73,100,0.05)",
  overflow: "hidden",
} as const;

const TOOLTIP_STYLE = {
  backgroundColor: "#1E2A35",
  borderRadius: 8,
  border: "none",
  color: "#FFFFFF",
  fontSize: 12,
};

export function FriskingBagAnalyticsPage() {
  const [rangeFilter, setRangeFilter] = useState<"today" | "yesterday" | "7d">("7d");
  const [tablePage, setTablePage]     = useState(0);
  const [viewMode, setViewMode]       = useState<"table" | "grid">("table");
  const [mediaOpen, setMediaOpen]     = useState(false);
  const [mediaIdx, setMediaIdx]       = useState(0);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());

  const today     = todayIST();
  const [filterFrom, setFilterFrom]   = useState(() => sevenDaysAgoIST());
  const [filterTo, setFilterTo]       = useState(today);
  const [filterCamera, setFilterCamera] = useState("all");
  const [filterClass, setFilterClass]   = useState("all");

  const fetchFrom = rangeFilter === "7d" ? sevenDaysAgoIST() : rangeFilter === "yesterday" ? yesterdayIST() : today;
  const fetchTo   = rangeFilter === "yesterday" ? yesterdayIST() : today;

  const { analytics, loading } = useFriskingBagAnalytics(filterFrom, filterTo);

  useEffect(() => {
    setFilterFrom(fetchFrom);
    setFilterTo(fetchTo);
    setTablePage(0);
  }, [rangeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const allEvents = analytics?.events ?? [];

  const cameraOptions = useMemo(
    () => [...new Set(allEvents.map((e) => e.camera_name))].sort(),
    [allEvents]
  );
  const classOptions = useMemo(
    () => [...new Set(allEvents.map((e) => e.class_name).filter(Boolean))].sort(),
    [allEvents]
  );

  const filteredEvents = useMemo(() => {
    return allEvents
      .filter((e) => {
        if (dismissedIds.has(e.id)) return false;
        if (filterCamera !== "all" && e.camera_name !== filterCamera) return false;
        if (filterClass  !== "all" && e.class_name  !== filterClass)  return false;
        return true;
      })
      .sort((a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime());
  }, [allEvents, filterCamera, filterClass, dismissedIds]);

  const mediaItems = useMemo(
    () => filteredEvents.map((e) => ({
      id: e.id,
      snapshot_url: e.thumbnail_url ?? e.snapshot_url,
      face_crop_url: null,
      video_url: e.video_url,
      label: e.camera_name,
    })),
    [filteredEvents]
  );

  const pagedEvents = filteredEvents.slice(tablePage * PAGE_SIZE, (tablePage + 1) * PAGE_SIZE);

  function resetFilters() {
    setFilterFrom(today); setFilterTo(today);
    setFilterCamera("all"); setFilterClass("all");
    setTablePage(0);
  }

  // Derive live count from the events array — it already excludes server-persisted dismissals,
  // and we subtract any newly dismissed IDs from the current session.
  const liveDetectionCount = allEvents.filter(e => !dismissedIds.has(e.id)).length;

  const kpis = [
    {
      label: "Total Detections",
      value: liveDetectionCount,
      delta: `${liveDetectionCount - (analytics?.prev_total_detections ?? 0) >= 0 ? "+" : ""}${liveDetectionCount - (analytics?.prev_total_detections ?? 0)}`,
      positive: liveDetectionCount >= (analytics?.prev_total_detections ?? 0),
      sub: "vs prev period",
      icon: <WorkOutlineOutlinedIcon />,
    },
    {
      label: "Unique Bag Track IDs",
      value: analytics?.unique_track_ids ?? 0,
      delta: "",
      positive: true,
      sub: "distinct objects tracked",
      icon: <FingerprintOutlinedIcon />,
    },
    {
      label: "Avg Confidence",
      value: analytics?.avg_confidence != null ? analytics.avg_confidence.toFixed(2) : "—",
      delta: "",
      positive: true,
      sub: "detection confidence score",
      icon: <InsightsOutlinedIcon />,
    },
    {
      label: "Owner Association Rate",
      value: `${analytics?.owner_association_rate ?? 0}%`,
      delta: `${(analytics?.owner_association_rate ?? 0) - (analytics?.prev_owner_association_rate ?? 0) >= 0 ? "+" : ""}${(analytics?.owner_association_rate ?? 0) - (analytics?.prev_owner_association_rate ?? 0)}%`,
      positive: (analytics?.owner_association_rate ?? 0) >= (analytics?.prev_owner_association_rate ?? 0),
      sub: "bags linked to an owner",
      icon: <LinkOutlinedIcon />,
    },
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, width: "100%", pb: 3 }}>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5 }}>
        <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0B4964", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          FRISKING BAG
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
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 1.5 }}>
        {kpis.map((kpi, idx) => (
          <Paper key={idx} elevation={0} sx={{ p: 2, borderRadius: "14px", bgcolor: "#FFFFFF", border: "1px solid #DCE7E8", boxShadow: "0 1px 4px rgba(11,73,100,0.05)", display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ width: 42, height: 42, borderRadius: "10px", display: "grid", placeItems: "center", bgcolor: KPI_COLORS[idx]?.bg, color: KPI_COLORS[idx]?.color, flexShrink: 0 }}>
              {kpi.icon}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.6875rem", fontWeight: 800, color: "#64748B", letterSpacing: "0.06em" }} noWrap>{kpi.label}</Typography>
              <Typography sx={{ fontSize: "1.375rem", fontWeight: 800, color: "#1E2A35", lineHeight: 1.2 }}>{kpi.value}</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.4, mt: 0.2 }}>
                {kpi.delta && <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: kpi.positive ? "#16A34A" : "#C96B6B" }}>{kpi.delta}</Typography>}
                <Typography sx={{ fontSize: "0.6875rem", color: "#94A3B8" }}>{kpi.sub}</Typography>
              </Box>
            </Box>
          </Paper>
        ))}
      </Box>

      {/* Charts Row */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.6fr 1fr" }, gap: 2.5 }}>
        {/* Detections over time */}
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: "14px", bgcolor: "#FFFFFF", border: "1px solid #DCE7E8", boxShadow: "0 1px 4px rgba(11,73,100,0.05)", display: "flex", flexDirection: "column", minHeight: 280 }}>
          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 800, color: "#64748B", letterSpacing: "0.08em", textTransform: "uppercase", mb: 2 }}>
            DETECTIONS OVER TIME
          </Typography>
          <Box sx={{ flex: 1, minHeight: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics?.hourly_trend ?? []} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="bagGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3B5BDB" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3B5BDB" stopOpacity={0.0}  />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="hour" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={{ stroke: "#DCE7E8" }} dy={6} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} dx={-4} />
                <ReTooltip contentStyle={TOOLTIP_STYLE} formatter={(val) => [`${val}`, "Detections"]} />
                <Area type="monotone" dataKey="detections" stroke="#3B5BDB" strokeWidth={2.5} fillOpacity={1} fill="url(#bagGrad)" dot={{ r: 3, fill: "#3B5BDB" }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Paper>

        {/* Detections by day */}
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: "14px", bgcolor: "#FFFFFF", border: "1px solid #DCE7E8", boxShadow: "0 1px 4px rgba(11,73,100,0.05)", display: "flex", flexDirection: "column", minHeight: 280 }}>
          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 800, color: "#64748B", letterSpacing: "0.08em", textTransform: "uppercase", mb: 2 }}>
            DETECTIONS BY DAY
          </Typography>
          <Box sx={{ flex: 1, minHeight: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.by_day ?? []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={{ stroke: "#DCE7E8" }} dy={6}
                  tickFormatter={(d: string) => new Date(d + "T00:00:00+05:30").toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} dx={-4} />
                <ReTooltip contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(d) => new Date(String(d) + "T00:00:00+05:30").toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}
                  formatter={(val) => [`${val}`, "Detections"]} />
                <Bar dataKey="detections" fill="#3B5BDB" radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Box>

      {/* Filter Bar */}
      <Paper elevation={0} sx={{ p: 2, borderRadius: "14px", bgcolor: "#FFFFFF", border: "1px solid #DCE7E8", boxShadow: "0 1px 4px rgba(11,73,100,0.05)" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <TextField
            label="From" type="date" size="small" value={filterFrom}
            onChange={(e) => { setFilterFrom(e.target.value); setTablePage(0); }}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 165, "& .MuiOutlinedInput-root": { borderRadius: "10px" }, "& .MuiOutlinedInput-notchedOutline": { borderColor: "#DCE7E8" } }}
          />
          <TextField
            label="To" type="date" size="small" value={filterTo}
            onChange={(e) => { setFilterTo(e.target.value); setTablePage(0); }}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 165, "& .MuiOutlinedInput-root": { borderRadius: "10px" }, "& .MuiOutlinedInput-notchedOutline": { borderColor: "#DCE7E8" } }}
          />
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel sx={{ fontSize: "0.875rem" }}>Camera</InputLabel>
            <Select value={filterCamera} label="Camera"
              onChange={(e) => { setFilterCamera(e.target.value); setTablePage(0); }}
              sx={{ borderRadius: "10px", "& .MuiOutlinedInput-notchedOutline": { borderColor: "#DCE7E8" } }}>
              <MenuItem value="all">All Cameras</MenuItem>
              {cameraOptions.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel sx={{ fontSize: "0.875rem" }}>Class</InputLabel>
            <Select value={filterClass} label="Class"
              onChange={(e) => { setFilterClass(e.target.value); setTablePage(0); }}
              sx={{ borderRadius: "10px", "& .MuiOutlinedInput-notchedOutline": { borderColor: "#DCE7E8" } }}>
              <MenuItem value="all">All Classes</MenuItem>
              {classOptions.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="outlined" size="small" onClick={resetFilters}
            sx={{ height: 40, borderColor: "#DCE7E8", color: "#64748B", fontWeight: 600, fontSize: "0.8125rem", borderRadius: "10px", textTransform: "none", px: 2, "&:hover": { borderColor: "#3B5BDB", color: "#3B5BDB", bgcolor: "#F0F4FF" } }}>
            Reset
          </Button>
        </Box>
      </Paper>

      {/* Detections Table / Grid */}
      <Paper elevation={0} sx={CARD_STYLE}>
        {/* Header */}
        <Box sx={{ px: 2.5, pt: 2, pb: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography sx={{ fontSize: "0.8125rem", fontWeight: 800, color: "#64748B", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              BAG DETECTIONS
            </Typography>
            {loading
              ? <CircularProgress size={14} sx={{ color: "#3B5BDB" }} />
              : <Typography sx={{ fontSize: "0.75rem", color: "#94A3B8" }}>{filteredEvents.length} events</Typography>
            }
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, bgcolor: "#F5F8F9", borderRadius: "10px", p: 0.4 }}>
            <IconButton size="small" onClick={() => setViewMode("table")}
              sx={{ borderRadius: "8px", color: viewMode === "table" ? "#0B4964" : "#94A3B8", bgcolor: viewMode === "table" ? "#FFFFFF" : "transparent", boxShadow: viewMode === "table" ? "0 1px 3px rgba(11,73,100,0.12)" : "none", transition: "all .15s" }}>
              <ViewListOutlinedIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => setViewMode("grid")}
              sx={{ borderRadius: "8px", color: viewMode === "grid" ? "#0B4964" : "#94A3B8", bgcolor: viewMode === "grid" ? "#FFFFFF" : "transparent", boxShadow: viewMode === "grid" ? "0 1px 3px rgba(11,73,100,0.12)" : "none", transition: "all .15s" }}>
              <GridViewOutlinedIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Table View */}
        {viewMode === "table" && (
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow>
                  {["Capture", "Camera", "Location", "Detected At", "Event Type", "View"].map((col, i) => (
                    <TableCell key={i} sx={{ fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.07em", textTransform: "uppercase", bgcolor: "#F5F8F9", borderBottom: "2px solid #DCE7E8", py: 1.25, "&:first-of-type": { pl: 2.5 }, "&:last-of-type": { pr: 2.5, width: 48 } }}>
                      {col}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={6} sx={{ py: 5, textAlign: "center", border: 0 }}><CircularProgress size={24} sx={{ color: "#3B5BDB" }} /></TableCell></TableRow>
                )}
                {!loading && filteredEvents.length === 0 && (
                  <TableRow><TableCell colSpan={6} sx={{ py: 5, textAlign: "center", border: 0 }}><Typography sx={{ color: "#94A3B8", fontSize: "0.875rem" }}>No bag detections for this period.</Typography></TableCell></TableRow>
                )}
                {!loading && pagedEvents.map((evt, idx) => {
                  const absIdx     = tablePage * PAGE_SIZE + idx;
                  const thumb      = evt.thumbnail_url ?? evt.snapshot_url;
                  const ownerLinked = !!evt.owner_id;
                  return (
                    <TableRow key={evt.id} sx={{ bgcolor: idx % 2 === 0 ? "#FFFFFF" : "#FAFCFC", "&:hover": { bgcolor: "#F0F4FF" }, "& td": { borderBottom: "1px solid #EEF3F4" } }}>
                      {/* Capture */}
                      <TableCell sx={{ width: 100, pl: 2.5, py: 1 }}>
                        {thumb ? (
                          <Box component="button" onClick={() => { setMediaIdx(absIdx); setMediaOpen(true); }}
                            sx={{ background: "none", border: "1px solid #DCE7E8", cursor: "pointer", p: 0, width: 90, height: 60, borderRadius: "6px", overflow: "hidden", display: "block", "&:hover": { borderColor: "#3B5BDB" } }}>
                            <img src={thumb} alt="bag" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          </Box>
                        ) : (
                          <Box sx={{ width: 90, height: 60, bgcolor: "#F1F5F9", borderRadius: "6px", display: "grid", placeItems: "center" }}>
                            <Typography sx={{ color: "#CBD5E1", fontSize: "0.75rem" }}>—</Typography>
                          </Box>
                        )}
                      </TableCell>
                      {/* Camera */}
                      <TableCell>
                        <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: "#1E293B" }}>{evt.camera_name}</Typography>
                      </TableCell>
                      {/* Location */}
                      <TableCell>
                        <Typography sx={{ fontSize: "0.8125rem", color: "#1E293B" }}>{evt.location_name || "—"}</Typography>
                      </TableCell>
                      {/* Detected At */}
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        <Typography sx={{ fontSize: "0.8125rem", color: "#1E293B" }}>
                          {new Date(evt.saved_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </Typography>
                      </TableCell>
                      {/* Event Type */}
                      <TableCell>
                        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1.25, py: 0.4, borderRadius: "20px", bgcolor: ownerLinked ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${ownerLinked ? "#BBF7D0" : "#FECACA"}` }}>
                          {ownerLinked
                            ? <LinkOutlinedIcon    sx={{ fontSize: 13, color: "#16A34A" }} />
                            : <LinkOffOutlinedIcon sx={{ fontSize: 13, color: "#DC2626" }} />
                          }
                          <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: ownerLinked ? "#16A34A" : "#DC2626", whiteSpace: "nowrap" }}>
                            {ownerLinked ? "Owner Linked" : "Owner Not Found"}
                          </Typography>
                        </Box>
                      </TableCell>
                      {/* View */}
                      <TableCell sx={{ pr: 2.5 }}>
                        <IconButton size="small" onClick={() => { setMediaIdx(absIdx); setMediaOpen(true); }}
                          sx={{ color: "#94A3B8", "&:hover": { color: "#3B5BDB", bgcolor: "#F0F4FF" }, borderRadius: "8px" }}>
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
          <Box sx={{ p: 2 }}>
            {loading && <Box sx={{ py: 5, display: "flex", justifyContent: "center" }}><CircularProgress size={28} sx={{ color: "#3B5BDB" }} /></Box>}
            {!loading && filteredEvents.length === 0 && (
              <Box sx={{ py: 5, textAlign: "center" }}><Typography sx={{ color: "#94A3B8", fontSize: "0.875rem" }}>No bag detections for this period.</Typography></Box>
            )}
            {!loading && filteredEvents.length > 0 && (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3,1fr)", md: "repeat(4,1fr)", lg: "repeat(5,1fr)" }, gap: 1.5 }}>
                {pagedEvents.map((evt, idx) => {
                  const absIdx      = tablePage * PAGE_SIZE + idx;
                  const thumb       = evt.thumbnail_url ?? evt.snapshot_url;
                  const ownerLinked = !!evt.owner_id;
                  return (
                    <Paper key={evt.id} elevation={0}
                      onClick={() => { setMediaIdx(absIdx); setMediaOpen(true); }}
                      sx={{ borderRadius: "12px", border: "1px solid #DCE7E8", overflow: "hidden", cursor: "pointer", transition: "box-shadow .15s", "&:hover": { boxShadow: "0 4px 16px rgba(59,91,219,0.14)", borderColor: "#3B5BDB" } }}>
                      <Box sx={{ width: "100%", paddingTop: "66%", position: "relative", bgcolor: "#F1F5F9" }}>
                        {thumb ? (
                          <img src={thumb} alt="bag" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                            <ImageOutlinedIcon sx={{ color: "#CBD5E1", fontSize: 32 }} />
                          </Box>
                        )}
                      </Box>
                      <Box sx={{ p: 1.25 }}>
                        <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: "#1E293B" }} noWrap>{evt.camera_name}</Typography>
                        <Typography sx={{ fontSize: "0.6875rem", color: "#64748B", mb: 0.75 }} noWrap>{evt.location_name || "—"}</Typography>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 0.5 }}>
                          <Typography sx={{ fontSize: "0.6875rem", color: "#94A3B8" }}>
                            {new Date(evt.saved_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}
                          </Typography>
                          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, px: 0.75, py: 0.2, borderRadius: "20px", bgcolor: ownerLinked ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${ownerLinked ? "#BBF7D0" : "#FECACA"}`, flexShrink: 0 }}>
                            {ownerLinked
                              ? <LinkOutlinedIcon    sx={{ fontSize: 11, color: "#16A34A" }} />
                              : <LinkOffOutlinedIcon sx={{ fontSize: 11, color: "#DC2626" }} />
                            }
                            <Typography sx={{ fontSize: "0.625rem", fontWeight: 700, color: ownerLinked ? "#16A34A" : "#DC2626" }}>
                              {ownerLinked ? "Owner Linked" : "Owner Not Found"}
                            </Typography>
                          </Box>
                        </Box>
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
            component="div"
            count={filteredEvents.length}
            page={tablePage}
            onPageChange={(_e, p) => setTablePage(p)}
            rowsPerPage={PAGE_SIZE}
            rowsPerPageOptions={[PAGE_SIZE]}
            sx={{ borderTop: "1px solid #DCE7E8", fontSize: "0.75rem", color: "#64748B" }}
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
            module="frisking_bag"
            onFalsePositive={(id) => setDismissedIds((prev) => new Set([...prev, Number(id)]))}
          />
        )}
      </Paper>
    </Box>
  );
}
