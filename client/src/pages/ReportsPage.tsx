import { useState, useCallback } from "react";
import {
  Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControlLabel, Checkbox, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from "@mui/material";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import DateRangeOutlinedIcon from "@mui/icons-material/DateRangeOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import { pnp } from "../lib/pnpTheme";
import { api } from "../lib/api";
import {
  todayIST, sevenDaysAgoIST,
  type DashboardSummary, type WalkinsAnalytics,
  type StaffAvailabilityAnalytics, type MeetGreetAnalytics,
} from "../lib/meghaviApi";
import { generateOperationalPdf, generateCsv } from "../lib/operationalReportPdf";

// ── helpers ─────────────────────────────────────────────────────────────────

function firstOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1)
    .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}
function fmtNow() {
  return new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
}

// ── types ────────────────────────────────────────────────────────────────────

type ReportType = "daily" | "weekly" | "monthly" | "custom";

interface GeneratedReport {
  id: number;
  title: string;
  from: string;
  to: string;
  formats: string[];
  generatedAt: string;
  stats: { label: string; value: string }[];
}

// ── constants ────────────────────────────────────────────────────────────────

const HEADER_SX = {
  fontSize: "0.6875rem", fontWeight: 700, color: pnp.textMuted,
  letterSpacing: "0.07em", textTransform: "uppercase" as const,
  bgcolor: "#F5F8F9", borderBottom: `2px solid #DCE7E8`, py: 1.25,
};

const FORMAT_COLORS: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  PDF: { color: pnp.danger, bg: pnp.dangerSoft, icon: <PictureAsPdfRoundedIcon sx={{ fontSize: 14 }} /> },
  CSV: { color: pnp.success, bg: pnp.successSoft, icon: <TableChartOutlinedIcon sx={{ fontSize: 14 }} /> },
};

const SCHEDULED = [
  { name: "Daily Operations Summary",  frequency: "Every day at 6:00 AM",          nextRun: "Tomorrow 06:00 AM", format: "PDF + CSV" },
  { name: "Weekly Analysis Report",    frequency: "Every Monday at 6:00 AM",        nextRun: "Next Mon 06:00 AM", format: "PDF" },
  { name: "Monthly Executive Brief",   frequency: "1st of each month at 9:00 AM",   nextRun: "1st Sep 09:00 AM",  format: "PDF" },
];

// ── main component ────────────────────────────────────────────────────────────

const STORAGE_KEY = "woxsight_report_history";

function loadHistory(): GeneratedReport[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}

function saveHistory(h: GeneratedReport[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(h)); } catch { /* quota */ }
}

export function ReportsPage() {
  const today  = todayIST();
  const [generating, setGenerating]       = useState<ReportType | null>(null);
  const [history,    setHistory]          = useState<GeneratedReport[]>(loadHistory);
  const [idSeq,      setIdSeq]            = useState(() => {
    const h = loadHistory();
    return h.length > 0 ? Math.max(...h.map(r => r.id)) + 1 : 1;
  });

  // Custom report dialog
  const [customOpen,     setCustomOpen]    = useState(false);
  const [customFrom,     setCustomFrom]    = useState(sevenDaysAgoIST());
  const [customTo,       setCustomTo]      = useState(today);
  const [customModules,  setCustomModules] = useState({ walkins: true, staff: true, meetGreet: true });
  const [customFormats,  setCustomFormats] = useState({ pdf: true, csv: false });

  // ── data fetcher ───────────────────────────────────────────────────────────

  const fetchReportData = useCallback(async (from: string, to: string, modules: typeof customModules) => {
    const [summaryRes, walkinsRes, staffRes, mgRes] = await Promise.allSettled([
      api.get<DashboardSummary>(`/meghavi/dashboard/summary?from=${from}&to=${to}`),
      modules.walkins   ? api.get<WalkinsAnalytics>(`/meghavi/analytics/walkins?from=${from}&to=${to}`)   : Promise.resolve(null),
      modules.staff     ? api.get<StaffAvailabilityAnalytics>(`/meghavi/analytics/staff-availability?from=${from}&to=${to}`) : Promise.resolve(null),
      modules.meetGreet ? api.get<MeetGreetAnalytics>(`/meghavi/analytics/meet-greet?from=${from}&to=${to}`) : Promise.resolve(null),
    ]);

    return {
      summary:   summaryRes.status === "fulfilled"  ? summaryRes.value?.data  ?? null : null,
      walkins:   walkinsRes.status === "fulfilled"   ? walkinsRes.value?.data  ?? null : null,
      staff:     staffRes.status === "fulfilled"     ? staffRes.value?.data    ?? null : null,
      meetGreet: mgRes.status === "fulfilled"        ? mgRes.value?.data       ?? null : null,
    };
  }, []);

  // ── generate handler ───────────────────────────────────────────────────────

  const handleGenerate = useCallback(async (
    type: ReportType,
    opts?: { from: string; to: string; modules: typeof customModules; formats: typeof customFormats },
  ) => {
    setGenerating(type);
    try {
      let from = today, to = today, title = "";
      const modules = opts?.modules ?? { walkins: true, staff: true, meetGreet: true };
      const formats = opts?.formats ?? { pdf: true, csv: false };

      switch (type) {
        case "daily":
          from = today; to = today;
          title = "Daily Campus Operations Summary";
          break;
        case "weekly":
          from = sevenDaysAgoIST(); to = today;
          title = "Weekly Footfall & Waiting Time Analysis";
          break;
        case "monthly":
          from = firstOfMonth(); to = today;
          title = "Monthly Executive Campus Briefing";
          break;
        case "custom":
          from  = opts!.from; to = opts!.to;
          title = "Custom Operational Report";
          break;
      }

      const { summary, walkins, staff, meetGreet } = await fetchReportData(from, to, modules);

      const reportData = { title, from, to, summary, walkins, staff, meetGreet };

      if (formats.pdf) generateOperationalPdf(reportData);
      if (formats.csv) generateCsv(reportData);

      // Build stats for history row
      const stats: { label: string; value: string }[] = [];
      if (summary) {
        stats.push({ label: "Walk-ins", value: String(summary.walkins_today) });
        stats.push({ label: "Alerts",   value: String(summary.total_alerts) });
        if (summary.greet_rate_pct != null)
          stats.push({ label: "Greet Rate", value: `${summary.greet_rate_pct}%` });
        else
          stats.push({ label: "Staff Unavail.", value: `${summary.staff_unavailability_pct}%` });
      }

      const fmts: string[] = [];
      if (formats.pdf) fmts.push("PDF");
      if (formats.csv) fmts.push("CSV");

      const entry: GeneratedReport = {
        id: idSeq, title, from, to,
        formats: fmts.length ? fmts : ["PDF"],
        generatedAt: fmtNow(),
        stats,
      };
      setHistory((h) => { const next = [entry, ...h]; saveHistory(next); return next; });
      setIdSeq((n) => n + 1);
    } catch (err) {
      console.error("[ReportsPage] generate failed:", err);
    } finally {
      setGenerating(null);
    }
  }, [today, fetchReportData, idSeq]);

  // ── quick-generate cards ───────────────────────────────────────────────────

  const QUICK_GENERATE = [
    {
      type: "daily" as ReportType,
      icon: <CalendarTodayOutlinedIcon sx={{ fontSize: 28 }} />,
      title: "Daily Summary",
      desc: "Today's walk-ins, wait times and alerts in one PDF",
      color: pnp.blue, bg: pnp.blueSoft, badge: "PDF + CSV",
      formats: { pdf: true, csv: true },
    },
    {
      type: "weekly" as ReportType,
      icon: <DateRangeOutlinedIcon sx={{ fontSize: 28 }} />,
      title: "Weekly Analysis",
      desc: "7-day footfall trends, peak hours and SLA compliance",
      color: pnp.success, bg: pnp.successSoft, badge: "PDF",
      formats: { pdf: true, csv: false },
    },
    {
      type: "monthly" as ReportType,
      icon: <AssessmentOutlinedIcon sx={{ fontSize: 28 }} />,
      title: "Monthly Executive Brief",
      desc: "High-level KPIs and insights for management review",
      color: pnp.primary, bg: pnp.primarySoft, badge: "PDF",
      formats: { pdf: true, csv: false },
    },
    {
      type: "custom" as ReportType,
      icon: <TuneOutlinedIcon sx={{ fontSize: 28 }} />,
      title: "Custom Report",
      desc: "Choose your date range, modules and output format",
      color: pnp.warning, bg: pnp.warningSoft, badge: "Flexible",
      formats: { pdf: true, csv: false },
    },
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, width: "100%", pb: 3 }}>

      {/* ── KPI Row ── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2 }}>
        {[
          { label: "Reports Generated", value: String(history.length), sub: "This session", color: pnp.primary, bg: pnp.primarySoft },
          { label: "Daily",             value: String(history.filter(r => r.title.includes("Daily")).length), sub: "This session", color: pnp.blue, bg: pnp.blueSoft },
          { label: "Weekly",            value: String(history.filter(r => r.title.includes("Weekly")).length), sub: "This session", color: pnp.success, bg: pnp.successSoft },
          { label: "Scheduled",         value: "3", sub: "Auto-reports configured", color: pnp.warning, bg: pnp.warningSoft },
        ].map((k) => (
          <Paper key={k.label} elevation={0} sx={{ p: 2, borderRadius: "12px", bgcolor: pnp.cardBg, border: `1px solid ${k.color}40`, boxShadow: pnp.cardShadow }}>
            <Box sx={{ width: 36, height: 36, borderRadius: "9px", bgcolor: k.bg, display: "flex", alignItems: "center", justifyContent: "center", mb: 1.25 }}>
              <ArticleOutlinedIcon sx={{ fontSize: 20, color: k.color }} />
            </Box>
            <Typography sx={{ fontSize: "1.375rem", fontWeight: 800, color: pnp.text, lineHeight: 1.1, letterSpacing: "-0.02em" }}>{k.value}</Typography>
            <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: pnp.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", mt: 0.2 }}>{k.label}</Typography>
            <Typography sx={{ fontSize: "0.6875rem", color: pnp.textMuted, mt: 0.25 }}>{k.sub}</Typography>
          </Paper>
        ))}
      </Box>

      {/* ── Quick Generate ── */}
      <Box>
        <Typography sx={{ fontSize: "0.875rem", fontWeight: 800, color: pnp.text, mb: 1.5 }}>Generate Report</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2 }}>
          {QUICK_GENERATE.map((q) => {
            const isLoading = generating === q.type;
            return (
              <Paper
                key={q.title}
                elevation={0}
                sx={{
                  p: 2, borderRadius: "14px", bgcolor: pnp.cardBg,
                  border: `1px solid ${q.color}30`, boxShadow: pnp.cardShadow,
                  cursor: generating ? "not-allowed" : "pointer",
                  opacity: generating && !isLoading ? 0.6 : 1,
                  transition: "transform 0.15s, box-shadow 0.15s",
                  "&:hover": generating ? {} : {
                    transform: "translateY(-2px)",
                    boxShadow: `0 8px 24px ${q.color}20`,
                    borderColor: `${q.color}60`,
                  },
                  display: "flex", flexDirection: "column", gap: 1,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <Box sx={{ width: 48, height: 48, borderRadius: "12px", bgcolor: q.bg, display: "flex", alignItems: "center", justifyContent: "center", color: q.color }}>
                    {q.icon}
                  </Box>
                  <Chip label={q.badge} size="small" sx={{ fontSize: "0.5875rem", fontWeight: 700, bgcolor: q.bg, color: q.color, height: 20, border: `1px solid ${q.color}30` }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: "0.875rem", fontWeight: 800, color: pnp.text, lineHeight: 1.3 }}>{q.title}</Typography>
                  <Typography sx={{ fontSize: "0.6875rem", color: pnp.textSecondary, mt: 0.35, lineHeight: 1.45 }}>{q.desc}</Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!!generating}
                  onClick={() => {
                    if (q.type === "custom") {
                      setCustomOpen(true);
                    } else {
                      handleGenerate(q.type, { from: today, to: today, modules: { walkins: true, staff: true, meetGreet: true }, formats: q.formats });
                    }
                  }}
                  sx={{
                    mt: "auto", textTransform: "none", fontWeight: 700,
                    fontSize: "0.75rem", borderRadius: "8px",
                    borderColor: `${q.color}50`, color: q.color,
                    "&:hover": { bgcolor: q.bg, borderColor: q.color },
                  }}
                >
                  {isLoading
                    ? <><CircularProgress size={13} sx={{ color: q.color, mr: 0.75 }} />Generating…</>
                    : "Generate"
                  }
                </Button>
              </Paper>
            );
          })}
        </Box>
      </Box>

      {/* ── Report History ── */}
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
          <Typography sx={{ fontSize: "0.875rem", fontWeight: 800, color: pnp.text }}>Report History</Typography>
        </Box>

        <Paper elevation={0} sx={{ borderRadius: "14px", bgcolor: pnp.cardBg, border: pnp.cardBorder, boxShadow: pnp.cardShadow, overflow: "hidden" }}>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 700 }}>
              <TableHead>
                <TableRow>
                  {["Report", "Period", "Key Stats", "Format", "Status"].map((col) => (
                    <TableCell key={col} sx={{ ...HEADER_SX, "&:first-of-type": { pl: 2.5 } }}>
                      {col}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ py: 6, textAlign: "center", border: 0 }}>
                      <Typography sx={{ color: pnp.textMuted, fontSize: "0.875rem" }}>
                        No reports generated yet — click <strong>Generate</strong> above to create your first report.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {history.map((r, idx) => (
                  <TableRow
                    key={r.id}
                    sx={{
                      bgcolor: idx % 2 === 0 ? pnp.cardBg : "#FAFCFC",
                      "&:hover": { bgcolor: `${pnp.primary}05` },
                      "& td": { borderBottom: `1px solid #EEF3F4` },
                    }}
                  >
                    <TableCell sx={{ pl: 2.5, minWidth: 230, py: 1.5 }}>
                      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
                        <Box sx={{ width: 36, height: 36, borderRadius: "9px", bgcolor: r.formats.includes("PDF") ? pnp.dangerSoft : pnp.successSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, mt: 0.1 }}>
                          {r.formats.includes("PDF")
                            ? <PictureAsPdfRoundedIcon sx={{ fontSize: 20, color: pnp.danger }} />
                            : <TableChartOutlinedIcon sx={{ fontSize: 20, color: pnp.success }} />
                          }
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: pnp.text, lineHeight: 1.3 }}>{r.title}</Typography>
                          <Typography sx={{ fontSize: "0.625rem", color: pnp.textMuted, mt: 0.2 }}>Generated {r.generatedAt}</Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    <TableCell sx={{ minWidth: 160 }}>
                      <Typography sx={{ fontSize: "0.8125rem", color: pnp.text, fontWeight: 500 }}>
                        {r.from === r.to ? fmtDate(r.from) : `${fmtDate(r.from)} – ${fmtDate(r.to)}`}
                      </Typography>
                    </TableCell>

                    <TableCell sx={{ minWidth: 200 }}>
                      <Stack direction="row" spacing={1.5}>
                        {r.stats.map((s) => (
                          <Box key={s.label}>
                            <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: pnp.text, lineHeight: 1 }}>{s.value}</Typography>
                            <Typography sx={{ fontSize: "0.5875rem", color: pnp.textMuted, mt: 0.15 }}>{s.label}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    </TableCell>

                    <TableCell sx={{ width: 120 }}>
                      <Stack direction="row" spacing={0.5}>
                        {r.formats.map((fmt) => {
                          const f = FORMAT_COLORS[fmt];
                          return (
                            <Box key={fmt} sx={{ display: "inline-flex", alignItems: "center", gap: 0.3, px: 0.75, py: 0.25, borderRadius: "6px", bgcolor: f.bg }}>
                              {f.icon}
                              <Typography sx={{ fontSize: "0.5875rem", fontWeight: 700, color: f.color }}>{fmt}</Typography>
                            </Box>
                          );
                        })}
                      </Stack>
                    </TableCell>

                    <TableCell sx={{ width: 110 }}>
                      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 0.9, py: 0.3, borderRadius: "20px", bgcolor: pnp.successSoft, border: `1px solid ${pnp.success}40` }}>
                        <CheckCircleOutlineRoundedIcon sx={{ fontSize: 13, color: pnp.success }} />
                        <Typography sx={{ fontSize: "0.625rem", fontWeight: 700, color: pnp.success }}>Downloaded</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>

      {/* ── Scheduled Reports ── */}
      <Box>
        <Typography sx={{ fontSize: "0.875rem", fontWeight: 800, color: pnp.text, mb: 1.5 }}>Scheduled Reports</Typography>
        <Paper elevation={0} sx={{ borderRadius: "14px", bgcolor: pnp.cardBg, border: pnp.cardBorder, boxShadow: pnp.cardShadow, overflow: "hidden" }}>
          {SCHEDULED.map((s, i) => (
            <Box key={s.name}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, px: 2.5, py: 1.75, "&:hover": { bgcolor: `${pnp.primary}04` } }}>
                <Box sx={{ width: 38, height: 38, borderRadius: "10px", bgcolor: pnp.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <ScheduleOutlinedIcon sx={{ fontSize: 20, color: pnp.primary }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: pnp.text }}>{s.name}</Typography>
                  <Typography sx={{ fontSize: "0.6875rem", color: pnp.textSecondary, mt: 0.2 }}>{s.frequency}</Typography>
                </Box>
                <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                  <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: pnp.textSecondary }}>Next run</Typography>
                  <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: pnp.text }}>{s.nextRun}</Typography>
                </Box>
                <Box sx={{ flexShrink: 0 }}>
                  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, px: 0.9, py: 0.3, borderRadius: "6px", bgcolor: pnp.blueSoft }}>
                    <PictureAsPdfRoundedIcon sx={{ fontSize: 12, color: pnp.blue }} />
                    <Typography sx={{ fontSize: "0.625rem", fontWeight: 700, color: pnp.blue }}>{s.format}</Typography>
                  </Box>
                </Box>
                <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: pnp.success, flexShrink: 0 }} />
              </Box>
              {i < SCHEDULED.length - 1 && <Divider sx={{ borderColor: "#EEF3F4" }} />}
            </Box>
          ))}
        </Paper>
      </Box>

      {/* ── Custom Report Dialog ── */}
      <Dialog open={customOpen} onClose={() => setCustomOpen(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: "16px" } } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: "1rem", color: pnp.text, pb: 0.5 }}>
          Custom Report
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "12px !important" }}>
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <TextField
              label="From" type="date" size="small" fullWidth
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
            />
            <TextField
              label="To" type="date" size="small" fullWidth
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: pnp.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", mb: 0.75 }}>
              Include Modules
            </Typography>
            {[
              { key: "walkins",   label: "Walk-ins & Waiting Time" },
              { key: "staff",     label: "Staff Unavailability" },
              { key: "meetGreet", label: "Meet & Greet" },
            ].map(({ key, label }) => (
              <FormControlLabel
                key={key}
                control={
                  <Checkbox
                    size="small"
                    checked={customModules[key as keyof typeof customModules]}
                    onChange={(e) => setCustomModules((m) => ({ ...m, [key]: e.target.checked }))}
                    sx={{ color: pnp.primary, "&.Mui-checked": { color: pnp.primary } }}
                  />
                }
                label={<Typography sx={{ fontSize: "0.8125rem" }}>{label}</Typography>}
              />
            ))}
          </Box>

          <Box>
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: pnp.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", mb: 0.75 }}>
              Output Format
            </Typography>
            {[
              { key: "pdf", label: "PDF Report" },
              { key: "csv", label: "CSV Data Export" },
            ].map(({ key, label }) => (
              <FormControlLabel
                key={key}
                control={
                  <Checkbox
                    size="small"
                    checked={customFormats[key as keyof typeof customFormats]}
                    onChange={(e) => setCustomFormats((f) => ({ ...f, [key]: e.target.checked }))}
                    sx={{ color: pnp.primary, "&.Mui-checked": { color: pnp.primary } }}
                  />
                }
                label={<Typography sx={{ fontSize: "0.8125rem" }}>{label}</Typography>}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setCustomOpen(false)} sx={{ textTransform: "none", color: pnp.textMuted }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!!generating || (!customFormats.pdf && !customFormats.csv)}
            onClick={async () => {
              setCustomOpen(false);
              await handleGenerate("custom", {
                from: customFrom, to: customTo,
                modules: customModules, formats: customFormats,
              });
            }}
            sx={{
              textTransform: "none", fontWeight: 700, borderRadius: "10px",
              bgcolor: pnp.primary, "&:hover": { bgcolor: pnp.primaryDark },
            }}
          >
            {generating === "custom"
              ? <><CircularProgress size={14} sx={{ color: "#fff", mr: 0.75 }} />Generating…</>
              : <><DownloadRoundedIcon sx={{ fontSize: 16, mr: 0.5 }} />Generate & Download</>
            }
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
