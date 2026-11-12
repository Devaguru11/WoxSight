import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { DashboardSummary, WalkinsAnalytics, StaffAvailabilityAnalytics, MeetGreetAnalytics } from "./meghaviApi";

type Doc = jsPDF & { lastAutoTable?: { finalY: number } };

const TEAL:   [number, number, number] = [238,  72,  96];  // coral primary
const TEAL_L: [number, number, number] = [253, 232, 235];  // coral light
const INK:    [number, number, number] = [65,   64,  66];  // charcoal
const MUTED:  [number, number, number] = [107, 107, 110];
const WHITE:  [number, number, number] = [255, 255, 255];
const RULE:   [number, number, number] = [228, 228, 230];

const M = 14;          // page margin
const W = 210 - M * 2; // content width
const TOP = 30;        // content top after running header
const BOT = 272;       // content bottom before footer

function fmt(n: number | null | undefined, unit = "") {
  if (n == null) return "—";
  return `${n}${unit}`;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return iso; }
}

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata", day: "2-digit", month: "short",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function header(doc: Doc, title: string, subtitle: string) {
  // Teal header bar
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, 210, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text("WoxSight", M, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Woxsen University — Campus Video Analytics", M, 15.5);
  // right side: title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(title, 210 - M, 10, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEAL_L);
  doc.text(subtitle, 210 - M, 15.5, { align: "right" });
}

function footer(doc: Doc, pageNum: number, total: number) {
  doc.setFillColor(...TEAL);
  doc.rect(0, 287, 210, 10, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...WHITE);
  doc.text("Confidential — WoxSight Campus Video Analytics | Woxsen University", M, 293.5);
  doc.text(`Page ${pageNum} of ${total}`, 210 - M, 293.5, { align: "right" });
}

function decorateAll(doc: Doc, title: string, subtitle: string) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    header(doc, title, subtitle);
    footer(doc, i, total);
  }
}

function sectionTitle(doc: Doc, text: string, y: number): number {
  doc.setFillColor(...TEAL_L);
  doc.rect(M, y, W, 7, "F");
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.4);
  doc.line(M, y, M, y + 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEAL);
  doc.text(text.toUpperCase(), M + 3, y + 4.8);
  return y + 10;
}

function kpiRow(doc: Doc, items: { label: string; value: string }[], y: number): number {
  const cellW = W / items.length;
  items.forEach(({ label, value }, i) => {
    const x = M + i * cellW;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.rect(x + 0.5, y, cellW - 1, 18, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...TEAL);
    doc.text(value, x + cellW / 2, y + 10, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(label, x + cellW / 2, y + 15.5, { align: "center" });
  });
  return y + 22;
}

export interface ReportData {
  title: string;
  from: string;
  to: string;
  summary?: DashboardSummary | null;
  walkins?: WalkinsAnalytics | null;
  staff?: StaffAvailabilityAnalytics | null;
  meetGreet?: MeetGreetAnalytics | null;
}

export function generateOperationalPdf(data: ReportData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }) as Doc;

  const dateRange = data.from === data.to
    ? fmtDate(data.from)
    : `${fmtDate(data.from)} – ${fmtDate(data.to)}`;
  const generated = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  // ── Cover page ──────────────────────────────────────────────────────────────
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, 210, 297, "F");

  doc.setFillColor(...WHITE);
  doc.roundedRect(M, 60, W, 140, 4, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...TEAL);
  doc.text("WoxSight — Woxsen University", 105, 85, { align: "center" });

  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(data.title, 105, 98, { align: "center" });

  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.8);
  doc.line(M + 20, 103, 210 - M - 20, 103);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text("Reporting Period", 105, 115, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(dateRange, 105, 123, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Generated: ${generated}`, 105, 134, { align: "center" });
  doc.text("Woxsen Centre", 105, 141, { align: "center" });

  // ── Summary page ────────────────────────────────────────────────────────────
  doc.addPage();
  let y = TOP;

  y = sectionTitle(doc, "Executive Summary", y);

  const s = data.summary;
  const kpis = [
    { label: "Walk-ins",          value: fmt(s?.walkins_today) },
    { label: "Staff Unavail.",    value: fmt(s?.staff_unavailability_pct, "%") },
    { label: "Meet & Greet",      value: fmt(s?.meet_greet_total) },
    { label: "Total Alerts",      value: fmt(s?.total_alerts) },
  ];
  y = kpiRow(doc, kpis, y);

  if (s?.greet_rate_pct != null) {
    const kpis2 = [
      { label: "Greet Rate",        value: `${s.greet_rate_pct}%` },
      { label: "Not Greeted",       value: fmt(s.meet_greet_ungreeted) },
      { label: "Absent (min)",      value: fmt(s.total_absent_minutes) },
      { label: "Prev. Walk-ins",    value: fmt(s.prev_walkins_today) },
    ];
    y = kpiRow(doc, kpis2, y);
  }

  // Walk-ins hourly trend table
  if (data.walkins?.hourly_trend && data.walkins.hourly_trend.length > 0) {
    y += 2;
    y = sectionTitle(doc, "Walk-ins — Hourly Trend", y);
    const rows = data.walkins.hourly_trend
      .filter(h => h.walkins > 0)
      .map(h => [h.hour, String(h.walkins)]);
    if (rows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Hour (IST)", "Walk-ins"]],
        body: rows,
        margin: { left: M, right: M },
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: TEAL, textColor: WHITE, fontStyle: "bold", fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 40 } },
      });
      y = (doc as Doc).lastAutoTable?.finalY ?? y;
      y += 4;
    }
  }

  // Walk-ins event list
  if (data.walkins?.events && data.walkins.events.length > 0) {
    if (y > BOT - 30) { doc.addPage(); y = TOP; }
    y = sectionTitle(doc, "Walk-in Events", y);
    const rows = data.walkins.events.slice(0, 50).map(e => [
      fmtDateTime(e.detected_at),
      e.camera_name,
      e.location_name,
      e.dwell_seconds > 0 ? `${e.dwell_seconds}s` : "—",
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Detected At", "Camera", "Location", "Dwell"]],
      body: rows,
      margin: { left: M, right: M },
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: TEAL, textColor: WHITE, fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    y = (doc as Doc).lastAutoTable?.finalY ?? y;
    y += 4;
  }

  // Staff unavailability
  if (data.staff?.events && data.staff.events.length > 0) {
    if (y > BOT - 30) { doc.addPage(); y = TOP; }
    y = sectionTitle(doc, "Staff Unavailability Events", y);
    const rows = data.staff.events.slice(0, 40).map(e => [
      fmtDateTime(e.detected_at),
      e.camera_name,
      e.location_name,
      e.absent_duration_seconds != null ? `${Math.round(e.absent_duration_seconds / 60)}m` : "—",
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Detected At", "Camera", "Location", "Duration"]],
      body: rows,
      margin: { left: M, right: M },
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: TEAL, textColor: WHITE, fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    y = (doc as Doc).lastAutoTable?.finalY ?? y;
    y += 4;
  }

  // Meet & Greet
  if (data.meetGreet?.events && data.meetGreet.events.length > 0) {
    if (y > BOT - 30) { doc.addPage(); y = TOP; }
    y = sectionTitle(doc, "Meet & Greet Events", y);
    const rows = data.meetGreet.events.slice(0, 40).map(e => [
      fmtDateTime(e.detected_at),
      e.camera_name,
      e.location_name,
      e.greeted ? "Greeted" : "Not Greeted",
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Detected At", "Camera", "Location", "Status"]],
      body: rows,
      margin: { left: M, right: M },
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: TEAL, textColor: WHITE, fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 3: { fontStyle: "bold" } },
    });
  }

  decorateAll(doc as Doc, data.title, dateRange);

  const safeTitle = data.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  doc.save(`${safeTitle}_${data.from}_${data.to}.pdf`);
}

export function generateCsv(data: ReportData): void {
  const lines: string[] = [];

  const addSection = (title: string) => {
    lines.push("");
    lines.push(`"${title}"`);
  };

  if (data.summary) {
    addSection("Summary");
    lines.push("Metric,Value");
    lines.push(`Walk-ins,${data.summary.walkins_today}`);
    lines.push(`Staff Unavailability %,${data.summary.staff_unavailability_pct}`);
    lines.push(`Staff Absent Minutes,${data.summary.total_absent_minutes}`);
    lines.push(`Meet & Greet Total,${data.summary.meet_greet_total}`);
    lines.push(`Meet & Greet Ungreeted,${data.summary.meet_greet_ungreeted}`);
    lines.push(`Greet Rate %,${data.summary.greet_rate_pct ?? ""}`);
    lines.push(`Total Alerts,${data.summary.total_alerts}`);
  }

  if (data.walkins?.events?.length) {
    addSection("Walk-in Events");
    lines.push("Detected At,Camera,Location,Dwell Seconds");
    for (const e of data.walkins.events) {
      lines.push(`"${e.detected_at}","${e.camera_name}","${e.location_name}",${e.dwell_seconds}`);
    }
  }

  if (data.staff?.events?.length) {
    addSection("Staff Unavailability Events");
    lines.push("Detected At,Camera,Location,Absent Duration (s)");
    for (const e of data.staff.events) {
      lines.push(`"${e.detected_at}","${e.camera_name}","${e.location_name}",${e.absent_duration_seconds ?? ""}`);
    }
  }

  if (data.meetGreet?.events?.length) {
    addSection("Meet & Greet Events");
    lines.push("Detected At,Camera,Location,Greeted");
    for (const e of data.meetGreet.events) {
      lines.push(`"${e.detected_at}","${e.camera_name}","${e.location_name}",${e.greeted}`);
    }
  }

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeTitle = data.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  a.download = `${safeTitle}_${data.from}_${data.to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
