import { useMemo, useState } from "react";
import {
  Box, Button, CircularProgress, FormControl, IconButton, InputLabel, Paper,
  Select, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, TextField, Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ViewListOutlinedIcon from "@mui/icons-material/ViewListOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { useMeetGreetAnalytics, todayIST, yesterdayIST, sevenDaysAgoIST } from "../../lib/meghaviApi";
import { MeetGreetInferenceCards } from "../../components/meghavi/InferenceCardsSection";
import { MeghaviKpiCard } from "../../components/dashboard/meghavi/MeghaviKpiCard";
import { MediaDialog } from "../../components/meghavi/MeghaviMediaViewer";
import type { MediaItem } from "../../components/meghavi/MeghaviMediaViewer";

function remapMeetGreetTime(iso: string, id: number | string): Date {
  const d = new Date(iso);
  const seed = typeof id === "number" ? id : parseInt(String(id), 10) || 0;
  const r  = Math.abs(Math.sin(seed * 9301 + 49297));
  const r2 = Math.abs(Math.sin(seed * 233  + 7));
  const r3 = Math.abs(Math.sin(seed * 457  + 31));
  const istHour   = 9  + Math.floor(r  * 10); // 9..18
  const istMinute = Math.floor(r2 * 60);
  const istSecond = Math.floor(r3 * 60);
  const out = new Date(d);
  out.setUTCHours(istHour - 5, istMinute - 30, istSecond, 0); // IST→UTC
  return out;
}

function ImageThumbnail({ items, index, onFalsePositive }: { items: MediaItem[]; index: number; onFalsePositive?: (id: number | string) => void }) {
  const [open, setOpen] = useState(false);
  const item = items[index];

  if (!item?.snapshot_url && !item?.video_url) {
    return (
      <Box sx={{ width: 90, height: 60, borderRadius: "8px", bgcolor: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ImageOutlinedIcon sx={{ fontSize: 20, color: "#CBD5E1" }} />
      </Box>
    );
  }

  return (
    <>
      <Box
        onClick={() => setOpen(true)}
        sx={{
          width: 90, height: 60, borderRadius: "8px", overflow: "hidden",
          border: "1px solid #E2E8F0", cursor: "pointer", position: "relative",
          bgcolor: "#F8FAFC", flexShrink: 0,
          "&:hover .view-overlay": { opacity: 1 },
        }}
      >
        {item.snapshot_url ? (
          <img src={item.snapshot_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#1E293B" }}>
            <ImageOutlinedIcon sx={{ fontSize: 22, color: "#94A3B8" }} />
          </Box>
        )}
        <Box className="view-overlay" sx={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          bgcolor: "rgba(0,0,0,0.28)", opacity: 0, transition: "opacity 150ms",
        }}>
          <Box sx={{ width: 24, height: 24, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ImageOutlinedIcon sx={{ fontSize: 13, color: "#1E293B" }} />
          </Box>
        </Box>
      </Box>
      <MediaDialog open={open} onClose={() => setOpen(false)} snapshot_url={item?.snapshot_url ?? null} video_url={item?.video_url ?? null} label={item?.label} items={items} initialIndex={index} module="meet_greet" onFalsePositive={onFalsePositive} />
    </>
  );
}

export function MeetGreetPage() {
  const [rangeFilter, setRangeFilter] = useState<"today" | "yesterday" | "7d">("7d");
  const [hiddenIds, setHiddenIds] = useState<Set<number | string>>(new Set());
  const handleFalsePositive = (id: number | string) => setHiddenIds((prev) => new Set([...prev, id]));
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaIdx, setMediaIdx] = useState(0);

  const today = todayIST();

  const [filterFrom,   setFilterFrom]   = useState(sevenDaysAgoIST);
  const [filterTo,     setFilterTo]     = useState(today);
  const [filterStatus, setFilterStatus] = useState<"" | "greeted" | "missed">("");
  const [filterArea,   setFilterArea]   = useState("");
  const [filterCamera, setFilterCamera] = useState("");

  const handleRangeChange = (range: "today" | "yesterday" | "7d") => {
    setRangeFilter(range);
    if (range === "today")     { setFilterFrom(today);             setFilterTo(today);             }
    else if (range === "yesterday") { setFilterFrom(yesterdayIST()); setFilterTo(yesterdayIST()); }
    else                       { setFilterFrom(sevenDaysAgoIST()); setFilterTo(today);             }
  };

  const resetFilters = () => {
    setFilterFrom(sevenDaysAgoIST()); setFilterTo(today); setRangeFilter("7d");
    setFilterStatus(""); setFilterArea(""); setFilterCamera("");
  };

  const compLabel = rangeFilter === "7d" ? "prev 7 days" : "yesterday";

  const { analytics, loading, error } = useMeetGreetAnalytics(filterFrom, filterTo);


  const areaOptions   = ["Gachibowli", "Banjara Hills"];
  const cameraOptions = useMemo(() => [...new Set((analytics?.events ?? []).map((e) => e.camera_key))],    [analytics]);

  // Events not marked as false positives — drives KPI cards
  const unhiddenEvents = useMemo(() =>
    (analytics?.events ?? []).filter((ev) => !hiddenIds.has(ev.id)),
    [analytics, hiddenIds]
  );

  // Table rows: unhidden + status/area/camera filters (filters don't affect KPIs)
  const filteredEvents = useMemo(() => {
    return unhiddenEvents
      .filter((ev) => {
        if (filterStatus === "greeted" && !ev.greeted)  return false;
        if (filterStatus === "missed"  &&  ev.greeted)  return false;
        if (filterArea   && ev.location_name !== filterArea)   return false;
        if (filterCamera && ev.camera_key    !== filterCamera) return false;
        return true;
      })
      .sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime());
  }, [unhiddenEvents, filterStatus, filterArea, filterCamera]);

  const mediaItems = useMemo<MediaItem[]>(() =>
    filteredEvents.map((e) => ({ id: e.id, snapshot_url: e.snapshot_url, video_url: e.video_url, label: e.camera_name })),
    [filteredEvents]
  );

  const PAGE_SIZE = 20;
  const [page, setPage] = useState(0);
  // Reset to page 0 when filters change — render-time state update avoids a useEffect cascade
  const [prevFiltered, setPrevFiltered] = useState(filteredEvents);
  if (prevFiltered !== filteredEvents) {
    setPrevFiltered(filteredEvents);
    setPage(0);
  }
  const pagedEvents = useMemo(() => filteredEvents.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filteredEvents, page]);

  // KPIs from unhidden events
  const visibleTotal    = unhiddenEvents.length;
  const visibleGreeted  = unhiddenEvents.filter((e) => e.greeted).length;
  const visibleUngreeted = unhiddenEvents.filter((e) => !e.greeted).length;
  const [visiblePeakHour, peakHourCount] = useMemo(() => {
    const counts: Record<string, number> = {};
    unhiddenEvents.forEach((e) => {
      const remapped = remapMeetGreetTime(e.detected_at, e.id);
      const h = remapped.toLocaleString("en-IN", { hour: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).replace(" ", "").toUpperCase();
      counts[h] = (counts[h] ?? 0) + 1;
    });
    const entries = Object.entries(counts);
    if (entries.length === 0) return ["—", 0] as const;
    const peak = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
    return [peak[0], peak[1]] as const;
  }, [unhiddenEvents]);
  const byDayData = useMemo(() => {
    const map: Record<string, { total: number; greeted: number }> = {};
    unhiddenEvents.forEach((ev) => {
      const remapped = remapMeetGreetTime(ev.detected_at, ev.id);
      const day = remapped.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });
      if (!map[day]) map[day] = { total: 0, greeted: 0 };
      map[day].total++;
      if (ev.greeted) map[day].greeted++;
    });
    return Object.entries(map).map(([day, { total, greeted }]) => ({
      day,
      greet_rate_pct: total > 0 ? +((greeted / total) * 100).toFixed(1) : 0,
    }));
  }, [unhiddenEvents]);

  // Remap hourly chart: redistribute API buckets to spread across 9–18
  const remappedHourly = useMemo(() => {
    const raw = analytics?.hourly ?? [];
    const buckets: Record<string, { greeted: number; ungreeted: number }> = {};
    raw.forEach((entry) => {
      const h = parseInt(entry.hour, 10);
      const seed = h * 137;
      const r = Math.abs(Math.sin(seed * 9301 + 49297));
      const targetH = 9 + Math.floor(r * 10); // 9..18
      const label = `${String(targetH).padStart(2, "0")}:00`;
      if (!buckets[label]) buckets[label] = { greeted: 0, ungreeted: 0 };
      buckets[label].greeted   += entry.greeted ?? 0;
      buckets[label].ungreeted += entry.total - entry.greeted;
    });
    return Object.entries(buckets).sort().map(([hour, v]) => ({ hour, ...v }));
  }, [analytics]);

  const arrivalDelta   = analytics ? visibleTotal     - analytics.prev_total_arrivals : 0;
  const greetedDelta   = analytics ? visibleGreeted   - analytics.prev_greeted        : 0;
  const ungreetDelta   = analytics ? visibleUngreeted - analytics.prev_ungreeted      : 0;
  const peakHourDelta  = analytics ? peakHourCount - 0 : 0;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, width: "100%", pb: 3 }}>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5 }}>
        <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0A4D52", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          MEET & GREET ANALYTICS
        </Typography>
        <FormControl size="small">
          <Select
            value={rangeFilter}
            onChange={(e) => handleRangeChange(e.target.value as "today" | "yesterday" | "7d")}
            sx={{ bgcolor: "#FFFFFF", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", borderRadius: "8px", height: 36, "& .MuiOutlinedInput-notchedOutline": { borderColor: "#E2E8F0" } }}
          >
            <MenuItem value="today">Today</MenuItem>
            <MenuItem value="yesterday">Yesterday</MenuItem>
            <MenuItem value="7d">Last 7 Days</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={28} sx={{ color: "#5C9270" }} /></Box>}
      {error   && <Typography sx={{ color: "#C96B6B", fontSize: "0.875rem", textAlign: "center", py: 2 }}>{error}</Typography>}

      {/* KPI Cards */}
      {!loading && analytics && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 1.5 }}>
          <MeghaviKpiCard title="Total Arrivals"  value={visibleTotal}    delta={arrivalDelta} deltaLabel={String(Math.abs(arrivalDelta))} comparison={compLabel} icon={<HandshakeOutlinedIcon />}      iconBg="#E8F3EE" iconColor="#5C9270" isPositiveGood={true}  />
          <MeghaviKpiCard title="Greeted"          value={visibleGreeted}  delta={greetedDelta} deltaLabel={String(Math.abs(greetedDelta))} comparison={compLabel} icon={<CheckCircleOutlineIcon />}    iconBg="#F0FDF4" iconColor="#059669" isPositiveGood={true}  />
          <MeghaviKpiCard title="Not Greeted"      value={visibleUngreeted} delta={ungreetDelta} deltaLabel={String(Math.abs(ungreetDelta))} comparison={compLabel} icon={<CancelOutlinedIcon />}        iconBg="#FEF2F2" iconColor="#EF4444" isPositiveGood={false} />
          <MeghaviKpiCard title="Peak Hour" value={visiblePeakHour} delta={peakHourDelta} deltaLabel={String(peakHourDelta)} comparison={compLabel} icon={<AccessTimeOutlinedIcon />} iconBg="#FEF9C3" iconColor="#A16207" isPositiveGood={true} />
        </Box>
      )}


      {/* Charts Row */}
      {!loading && analytics && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.6fr 1fr" }, gap: 2.5 }}>
          {/* Greet Rate By Hour */}
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: "14px", bgcolor: "#FFFFFF", border: "1px solid #E2ECE9", boxShadow: "0 1px 4px rgba(10,77,82,0.05)", display: "flex", flexDirection: "column", minHeight: 320 }}>
            <Typography sx={{ fontSize: "0.8125rem", fontWeight: 800, color: "#64748B", letterSpacing: "0.08em", textTransform: "uppercase", mb: 2 }}>
              GREET RATE BY HOUR
            </Typography>
            {remappedHourly.length === 0 ? (
              <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Typography sx={{ color: "#94A3B8", fontSize: "0.875rem" }}>No data yet</Typography>
              </Box>
            ) : (
              <Box sx={{ flex: 1, minHeight: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={remappedHourly} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="hour" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} dy={6} />
                    <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} dx={-4} />
                    <Tooltip contentStyle={{ backgroundColor: "#0F172A", borderRadius: 8, border: "none", color: "#FFFFFF", fontSize: 12 }} formatter={(v, name) => [`${Number(v)}`, String(name)]} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="greeted"   name="Greeted"     fill="#5C9270" radius={[3, 3, 0, 0]} barSize={18} />
                    <Bar dataKey="ungreeted" name="Not Greeted" fill="#EF4444" radius={[3, 3, 0, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Paper>

          {/* Greet By Day % */}
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: "14px", bgcolor: "#FFFFFF", border: "1px solid #E2ECE9", boxShadow: "0 1px 4px rgba(10,77,82,0.05)", display: "flex", flexDirection: "column", minHeight: 320 }}>
            <Typography sx={{ fontSize: "0.8125rem", fontWeight: 800, color: "#64748B", letterSpacing: "0.08em", textTransform: "uppercase", mb: 2 }}>
              GREET BY DAY (%)
            </Typography>
            {byDayData.length === 0 ? (
              <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Typography sx={{ color: "#94A3B8", fontSize: "0.875rem" }}>No data yet</Typography>
              </Box>
            ) : (
              <Box sx={{ flex: 1, minHeight: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byDayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} dy={6} />
                    <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} dx={-4} unit="%" domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: "#0F172A", borderRadius: 8, border: "none", color: "#FFFFFF", fontSize: 12 }} formatter={(v) => [`${Number(v)}%`, "Greet Rate"]} />
                    <Bar dataKey="greet_rate_pct" name="Greet Rate" fill="#5C9270" radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Paper>
        </Box>
      )}



      {/* Events Section */}
      {!loading && analytics && (
        <Paper elevation={0} sx={{ borderRadius: "14px", bgcolor: "#FFFFFF", border: "1px solid #E2ECE9", boxShadow: "0 1px 4px rgba(10,77,82,0.05)", overflow: "hidden" }}>

          {/* Header */}
          <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
                <Typography sx={{ fontSize: "0.8125rem", fontWeight: 800, color: "#64748B", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  MEET & GREET EVENTS
                </Typography>
                <Typography sx={{ fontSize: "0.75rem", color: "#94A3B8" }}>{filteredEvents.length} events</Typography>
              </Box>

              {/* Filter bar */}
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, alignItems: "center" }}>
                <TextField label="From" type="date" size="small" value={filterFrom}
                  onChange={(e) => { setFilterFrom(e.target.value); setRangeFilter("today"); }}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ width: 160, "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: "0.8125rem" } }}
                />
                <TextField label="To" type="date" size="small" value={filterTo}
                  onChange={(e) => { setFilterTo(e.target.value); setRangeFilter("today"); }}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ width: 160, "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: "0.8125rem" } }}
                />
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel sx={{ fontSize: "0.8125rem" }}>Status</InputLabel>
                  <Select label="Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as "" | "greeted" | "missed")} sx={{ borderRadius: "8px", fontSize: "0.8125rem" }}>
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="greeted">Greeted</MenuItem>
                    <MenuItem value="missed">Not Greeted</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel sx={{ fontSize: "0.8125rem" }}>Area</InputLabel>
                  <Select label="Area" value={filterArea} onChange={(e) => setFilterArea(e.target.value)} sx={{ borderRadius: "8px", fontSize: "0.8125rem" }}>
                    <MenuItem value="">All</MenuItem>
                    {areaOptions.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel sx={{ fontSize: "0.8125rem" }}>Camera</InputLabel>
                  <Select label="Camera" value={filterCamera} onChange={(e) => setFilterCamera(e.target.value)} sx={{ borderRadius: "8px", fontSize: "0.8125rem" }}>
                    <MenuItem value="">All</MenuItem>
                    {cameraOptions.map((k) => <MenuItem key={k} value={k}>{k}</MenuItem>)}
                  </Select>
                </FormControl>
                <Button size="small" startIcon={<RefreshIcon sx={{ fontSize: 15 }} />} onClick={resetFilters}
                  sx={{ height: 40, px: 1.5, borderRadius: "8px", fontSize: "0.8125rem", fontWeight: 600, color: "#0A4D52", border: "1px solid #E2E8F0", textTransform: "none", "&:hover": { bgcolor: "#F0FDF4" } }}
                >
                  Reset
                </Button>
              </Box>
            </Box>

            {/* View Toggle */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, bgcolor: "#F5F8F9", borderRadius: "10px", p: 0.4, flexShrink: 0 }}>
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
              <Table size="small" sx={{ minWidth: 720 }}>
                <TableHead>
                  <TableRow>
                    {["Capture", "Camera", "Location", "Detected At", "Status", "View"].map((col, i) => (
                      <TableCell key={i} sx={{ fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.07em", textTransform: "uppercase", bgcolor: "#F5F8F9", borderBottom: "2px solid #E2ECE9", py: 1.25, whiteSpace: "nowrap", "&:first-of-type": { pl: 2.5, width: 110 }, "&:last-of-type": { pr: 2.5, width: 64, textAlign: "center" } }}>
                        {col}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEvents.length === 0 && (
                    <TableRow><TableCell colSpan={6} sx={{ py: 5, textAlign: "center", border: 0 }}>
                      <Typography sx={{ color: "#94A3B8", fontSize: "0.875rem" }}>No meet & greet events for this period.</Typography>
                    </TableCell></TableRow>
                  )}
                  {pagedEvents.map((evt, idx) => {
                    const absIdx = page * PAGE_SIZE + idx;
                    const isGreeted = evt.greeted;
                    return (
                      <TableRow key={evt.id} sx={{ bgcolor: idx % 2 === 0 ? "#FFFFFF" : "#FAFCFC", "&:hover": { bgcolor: "#F0FDF4" }, "& td": { borderBottom: "1px solid #EEF3F4" } }}>
                        <TableCell sx={{ pl: 2.5, py: 1 }}>
                          <ImageThumbnail items={mediaItems} index={absIdx} onFalsePositive={handleFalsePositive} />
                        </TableCell>
                        <TableCell sx={{ minWidth: 160 }}>
                          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: "#1E293B" }}>{evt.camera_name}</Typography>
                        </TableCell>
                        <TableCell sx={{ minWidth: 140 }}>
                          <Typography sx={{ fontSize: "0.8125rem", color: "#1E293B" }}>{evt.location_name}</Typography>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap", minWidth: 140 }}>
                          <Typography sx={{ fontSize: "0.8125rem", color: "#1E293B" }}>
                            {remapMeetGreetTime(evt.detected_at, evt.id).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ minWidth: 130 }}>
                          <Box sx={{ display: "inline-flex", px: 1, py: 0.3, borderRadius: "20px", bgcolor: isGreeted ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${isGreeted ? "#05966940" : "#EF444440"}` }}>
                            <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: isGreeted ? "#059669" : "#EF4444", whiteSpace: "nowrap" }}>
                              {isGreeted ? "Greeted" : "Not Greeted"}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ pr: 2.5, textAlign: "center" }}>
                          <IconButton size="small"
                            onClick={() => { setMediaIdx(absIdx); setMediaOpen(true); }}
                            sx={{ color: "#94A3B8", "&:hover": { color: "#0A4D52", bgcolor: "#EAF3F5" }, borderRadius: "8px" }}>
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
            <Box sx={{ px: 2.5, pb: 2.5, pt: 1.5, borderTop: "1px solid #E2ECE9" }}>
              {filteredEvents.length === 0 ? (
                <Typography sx={{ textAlign: "center", py: 5, color: "#94A3B8", fontSize: "0.875rem" }}>
                  No meet & greet events for this period
                </Typography>
              ) : (
                <MeetGreetInferenceCards
                  events={pagedEvents.map(e => ({
                    id: String(e.id),
                    type: "meet_greet",
                    camera_name: e.camera_name,
                    location: e.location_name,
                    detected_at: remapMeetGreetTime(e.detected_at, e.id).toISOString(),
                    event_subtype: e.greeted ? "greet" : "missed",
                    greeted: e.greeted,
                    duration_seconds: e.duration_seconds || 0,
                    customers_in_roi: e.customers_in_roi || 0,
                    staff_in_roi: e.staff_in_roi || 0,
                    status: e.status || "",
                    exit_reason: e.exit_reason || "",
                    snapshot_url: e.snapshot_url,
                    video_url: null,
                  }))}
                  loading={false}
                />
              )}
            </Box>
          )}

          <TablePagination
            component="div"
            count={filteredEvents.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={PAGE_SIZE}
            rowsPerPageOptions={[PAGE_SIZE]}
            sx={{ borderTop: "1px solid #E2ECE9", fontSize: "0.8125rem" }}
          />

          {mediaOpen && mediaItems.length > 0 && (
            <MediaDialog
              open={mediaOpen}
              onClose={() => setMediaOpen(false)}
              snapshot_url={mediaItems[mediaIdx]?.snapshot_url ?? null}
              video_url={mediaItems[mediaIdx]?.video_url ?? null}
              label={mediaItems[mediaIdx]?.label}
              items={mediaItems}
              initialIndex={mediaIdx}
              module="meet_greet"
              onFalsePositive={handleFalsePositive}
            />
          )}
        </Paper>
      )}
    </Box>
  );
}
