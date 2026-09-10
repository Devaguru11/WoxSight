import { Box, Paper, Typography } from "@mui/material";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { MeghaviKpiCard } from "./MeghaviKpiCard";
import { MeghaviLiveOverview } from "./MeghaviLiveOverview";
import { MeghaviTodaysTrend } from "./MeghaviTodaysTrend";
import { useDashboardSummary, useWalkinsAnalytics, useStaffAvailabilityAnalytics, useMeetGreetAnalytics, todayIST } from "../../../lib/meghaviApi";
import { ds } from "../../../lib/dsTokens";

const CHART_TOOLTIP_STYLE = {
  backgroundColor: ds.text,
  borderRadius: 8,
  border: "none",
  color: "#FFFFFF",
  fontSize: 12,
};
const CHART_TOOLTIP_ITEM_STYLE = { color: "#FFFFFF" };
const CHART_TOOLTIP_LABEL_STYLE = { color: "#FFFFFF", fontWeight: 700, marginBottom: 4 };

const SEVERITY_COLOR: Record<string, string> = {
  high:    ds.danger,
  warning: ds.warning,
  info:    ds.primary,
};

const CARD_SX = {
  p: 2,
  borderRadius: "16px",
  bgcolor: ds.cardBg,
  border: `1px solid ${ds.border}`,
  boxShadow: ds.cardShadow,
};

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper elevation={0} sx={{ ...CARD_SX, display: "flex", flexDirection: "column", minHeight: 220 }}>
      <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: ds.textSecondary, letterSpacing: "0.07em", textTransform: "uppercase", mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

export function MeghaviDashboardView({ from, to }: { from?: string; to?: string }) {
  const navigate = useNavigate();
  const today = todayIST();
  
  const queryFrom = from || today;
  const queryTo = to || today;

  const { summary } = useDashboardSummary(queryFrom, queryTo);
  const { analytics: walkinsData } = useWalkinsAnalytics(queryFrom, queryTo);
  const { analytics: staffData }   = useStaffAvailabilityAnalytics(queryFrom, queryTo);
  const { analytics: meetGreetData } = useMeetGreetAnalytics(queryFrom, queryTo);
  const totalAlerts  = summary?.total_alerts ?? 0;
  const prevAlerts   = summary?.prev_total_alerts ?? 0;
  const walkins      = summary?.walkins_today ?? 0;
  const prevWalkins  = summary?.prev_walkins_today ?? 0;
  const meetGreet    = summary?.meet_greet_total ?? 0;
  const prevMeetGreet = summary?.prev_meet_greet_total ?? 0;
  const unavailPct   = summary?.staff_unavailability_pct ?? 0;
  const prevUnavail  = summary?.prev_staff_unavailability_pct ?? 0;

  const recentAlerts = summary?.recent_alerts ?? [];
  const walkinsByDay = walkinsData?.by_day ?? [];
  const unavailByDay = staffData?.by_day ?? [];
  const meetGreetByDay = meetGreetData?.by_day ?? [];

  const MODULE_CFG: Record<string, { label: string; color: string; route: string }> = {
    staff_unavailability: { label: "Staff Unavailability", color: ds.warning,  route: "/analytics/staff-unavailability" },
    walkins:              { label: "Walk-ins",             color: ds.success,  route: "/analytics/walk-ins" },
    meet_greet:           { label: "Meet & Greet",         color: ds.primary,  route: "/analytics/meet-greet" },
    frisking_bag:         { label: "Frisking Bag",         color: "#7C3AED",   route: "/analytics/frisking-bag" },
  };

  const fmtDelta = (v: number) => v >= 0 ? `+${v}` : `${v}`;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, width: "100%", minWidth: 0 }}>

      {/* KPI Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 2.5 }}>
        <MeghaviKpiCard title="Total Alerts" value={totalAlerts} delta={totalAlerts - prevAlerts} deltaLabel={fmtDelta(totalAlerts - prevAlerts)} comparison="vs yesterday" icon={<NotificationsNoneOutlinedIcon />} iconBg={`${ds.danger}14`} iconColor={ds.danger} isPositiveGood={false} onClick={() => navigate("/alerts")} />
        <MeghaviKpiCard title="Walk-ins" value={walkins} delta={walkins - prevWalkins} deltaLabel={fmtDelta(walkins - prevWalkins)} comparison="vs yesterday" icon={<PeopleAltOutlinedIcon />} iconBg={`${ds.success}14`} iconColor={ds.success} isPositiveGood={true} onClick={() => navigate("/analytics/walk-ins")} />
        <MeghaviKpiCard title="Meet & Greet" value={meetGreet} delta={meetGreet - prevMeetGreet} deltaLabel={fmtDelta(meetGreet - prevMeetGreet)} comparison="vs yesterday" icon={<AccessTimeOutlinedIcon />} iconBg={`${ds.primary}14`} iconColor={ds.primary} isPositiveGood={true} onClick={() => navigate("/analytics/meet-greet")} />
        <MeghaviKpiCard title="Staff Unavailability" value={`${unavailPct.toFixed(1)}%`} delta={unavailPct - prevUnavail} deltaLabel={`${fmtDelta(Math.round((unavailPct - prevUnavail) * 10) / 10)}%`} comparison="vs yesterday" icon={<PersonOutlineOutlinedIcon />} iconBg={`${ds.warning}14`} iconColor={ds.warning} isPositiveGood={false} onClick={() => navigate("/analytics/staff-unavailability")} />
      </Box>

      {/* Live Overview + Trend */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1.15fr" }, gap: 2.5, alignItems: "stretch" }}>
        <MeghaviLiveOverview />
        <MeghaviTodaysTrend from={queryFrom} to={queryTo} />
      </Box>

      {/* Charts Row */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2.5 }}>
        <ChartPanel title="Walk-ins by Day">
          <Box sx={{ flex: 1, minHeight: 160 }}>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={walkinsByDay} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke={ds.borderSubtle} vertical={false} />
                <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} stroke={ds.textMuted} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} stroke={ds.textMuted} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} cursor={{ fill: `${ds.primary}0D` }} />
                <Bar dataKey="walkins" name="Walk-ins" radius={[4, 4, 0, 0]}>
                  {walkinsByDay.map((_, i) => <Cell key={i} fill={i === walkinsByDay.length - 1 ? ds.success : `${ds.success}70`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </ChartPanel>

        <ChartPanel title="Meet & Greet by Day">
          <Box sx={{ flex: 1, minHeight: 160 }}>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={meetGreetByDay} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke={ds.borderSubtle} vertical={false} />
                <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} stroke={ds.textMuted} tickFormatter={(d: string) => new Date(d + "T00:00:00+05:30").toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} stroke={ds.textMuted} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} cursor={{ fill: `${ds.primary}0D` }} labelFormatter={(d) => new Date(String(d) + "T00:00:00+05:30").toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })} />
                <Bar dataKey="total" name="Meet & Greet" radius={[4, 4, 0, 0]}>
                  {meetGreetByDay.map((_, i) => <Cell key={i} fill={i === meetGreetByDay.length - 1 ? "#4F8A8B" : "#4F8A8B70"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </ChartPanel>

        <ChartPanel title="Staff Unavailability by Day (%)">
          <Box sx={{ flex: 1, minHeight: 160 }}>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={unavailByDay} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke={ds.borderSubtle} vertical={false} />
                <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} stroke={ds.textMuted} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} stroke={ds.textMuted} unit="%" />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} cursor={{ fill: `${ds.warning}0D` }} formatter={(v) => [`${Number(v)}%`, "Unavailability"]} />
                <Bar dataKey="rate" name="Rate" radius={[4, 4, 0, 0]}>
                  {unavailByDay.map((_, i) => <Cell key={i} fill={i === unavailByDay.length - 1 ? ds.warning : `${ds.warning}70`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </ChartPanel>
      </Box>

      {/* Recent Alerts */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        <Paper elevation={0} sx={CARD_SX}>
          <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: ds.textSecondary, letterSpacing: "0.07em", textTransform: "uppercase", mb: 1.5 }}>
            Recent Alerts
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
            {recentAlerts.length === 0 && <Typography sx={{ fontSize: "0.8125rem", color: ds.textMuted, py: 2, textAlign: "center" }}>No alerts today.</Typography>}
            {recentAlerts.slice(0, 10).map((alert, i) => {
              const cfg = MODULE_CFG[alert.module] ?? { label: alert.module, color: ds.primary, route: "" };
              const sevColor = SEVERITY_COLOR[alert.severity] ?? ds.primary;
              return (
                <Box key={i} onClick={() => cfg.route && navigate(cfg.route)} sx={{ display: "flex", alignItems: "center", gap: 1.25, p: 1.25, borderRadius: "10px", border: `1px solid ${sevColor}22`, bgcolor: `${sevColor}08`, cursor: cfg.route ? "pointer" : "default", transition: "opacity 0.15s", "&:hover": cfg.route ? { opacity: 0.75 } : {} }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: cfg.color, flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: ds.text, lineHeight: 1.3 }} noWrap>{cfg.label}</Typography>
                    <Typography sx={{ fontSize: "0.6875rem", color: ds.textSecondary, lineHeight: 1.3 }} noWrap>{alert.camera_name}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: ds.textMuted, flexShrink: 0 }}>
                    {new Date(alert.occurred_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
