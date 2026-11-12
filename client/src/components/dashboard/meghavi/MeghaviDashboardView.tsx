import { useMemo } from "react";
import { Box, Paper, Typography } from "@mui/material";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import NightsStayOutlinedIcon from "@mui/icons-material/NightsStayOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { MeghaviKpiCard } from "./MeghaviKpiCard";
import { MeghaviLiveOverview } from "./MeghaviLiveOverview";
import { MeghaviTodaysTrend } from "./MeghaviTodaysTrend";
import {
  useDashboardSummary, useWalkinsAnalytics,
  useOvercrowdingData, useAfterHoursData, todayIST,
} from "../../../lib/meghaviApi";
import { ds } from "../../../lib/dsTokens";

const TT = {
  contentStyle: { backgroundColor: ds.text, borderRadius: 8, border: "none", color: "#FFFFFF", fontSize: 12 },
  itemStyle: { color: "#FFFFFF" },
  labelStyle: { color: "#FFFFFF", fontWeight: 700, marginBottom: 4 },
};

const SEVERITY_COLOR: Record<string, string> = {
  high: ds.danger,
  warning: ds.warning,
  info: ds.primary,
};

const CARD_SX = {
  p: 2, borderRadius: "16px", bgcolor: ds.cardBg,
  border: `1px solid ${ds.border}`, boxShadow: ds.cardShadow,
};

const MODULE_CFG: Record<string, { label: string; color: string; route: string }> = {
  walkins: { label: "Walk-Ins", color: ds.success, route: "/analytics/walk-ins" },
  overcrowding: { label: "Crowd Gathering", color: "#D97706", route: "/analytics/crowd-gathering" },
  crowd_gathering: { label: "Crowd Gathering", color: "#D97706", route: "/analytics/crowd-gathering" },
  after_hours: { label: "After Hours", color: "#7C3AED", route: "/analytics/after-hours" },
  staff_unavailability: { label: "Staff Absence", color: ds.warning, route: "/analytics/staff-unavailability" },
  meet_greet: { label: "Meet & Greet", color: ds.primary, route: "/analytics/meet-greet" },
  frisking_bag: { label: "Security Screen", color: "#7C3AED", route: "/alerts" },
};

type HourEntry = { hour: string;[key: string]: number | string };

function HourBar({
  data, dataKey, color, name,
}: {
  data: HourEntry[]; dataKey: string; color: string; name: string;
}) {
  const maxVal = useMemo(
    () => Math.max(...data.map((d) => Number(d[dataKey]) || 0), 1),
    [data, dataKey],
  );
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const customShape = (props: any) => {
    const val = Number(props[dataKey]) || 0;
    const fill = val === maxVal && maxVal > 0 ? color : `${color}70`;
    const w = Math.max(Number(props.width) || 0, 0);
    const h = Math.max(Number(props.height) || 0, 0);
    return <rect x={props.x} y={props.y} width={w} height={h} fill={fill} rx={4} ry={4} />;
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barSize={14}>
        <CartesianGrid strokeDasharray="3 3" stroke={ds.borderSubtle} vertical={false} />
        <XAxis dataKey="hour" fontSize={10} tickLine={false} axisLine={false} stroke={ds.textMuted} />
        <YAxis fontSize={10} tickLine={false} axisLine={false} stroke={ds.textMuted} allowDecimals={false} />
        <Tooltip
          {...TT}
          cursor={{ fill: `${color}14` }}
          formatter={(v: number) => [v, name] as [number, string]}
        />
        <Bar dataKey={dataKey} name={name} isAnimationActive={false} shape={customShape as any} />
      </BarChart>
    </ResponsiveContainer>
  );
}

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
  const { data: crowdData } = useOvercrowdingData(queryFrom, queryTo);
  const { data: ahData } = useAfterHoursData(queryFrom, queryTo);

  const walkins = walkinsData?.total ?? summary?.walkins_today ?? 0;
  const prevWalkins = walkinsData?.prev_total ?? summary?.prev_walkins_today ?? 0;
  const crowdEvents = crowdData?.total ?? summary?.crowd_events_today ?? 0;
  const prevCrowdEvents = crowdData?.prev_total ?? 0;
  const afterHours = ahData?.total ?? summary?.after_hours_today ?? 0;
  const prevAfterHours = ahData?.prev_total ?? 0;
  const totalAlerts = summary?.total_alerts ?? 0;
  const prevTotalAlerts = summary?.prev_total_alerts ?? 0;

  const recentAlerts = summary?.recent_alerts ?? [];
  const walkinsByHour = (walkinsData?.hourly_trend ?? []) as HourEntry[];
  const crowdByHour = (crowdData?.hourly_trend ?? []) as HourEntry[];
  const ahByHour = (ahData?.hourly_trend ?? []) as HourEntry[];

  const fmtDelta = (v: number) => v >= 0 ? `+${v}` : `${v}`;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, width: "100%", minWidth: 0 }}>

      {/* KPI Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 2.5 }}>
        <MeghaviKpiCard
          title="Total Alerts" value={totalAlerts}
          delta={totalAlerts - prevTotalAlerts} deltaLabel={fmtDelta(totalAlerts - prevTotalAlerts)}
          comparison="vs yesterday"
          icon={<NotificationsActiveOutlinedIcon />} iconBg={`${ds.danger}14`} iconColor={ds.danger}
          isPositiveGood={false} onClick={() => navigate("/alerts")}
        />
        <MeghaviKpiCard
          title="Walk-ins" value={walkins}
          delta={walkins - prevWalkins} deltaLabel={fmtDelta(walkins - prevWalkins)}
          comparison="vs yesterday"
          icon={<PeopleAltOutlinedIcon />} iconBg={`${ds.success}14`} iconColor={ds.success}
          isPositiveGood={true} onClick={() => navigate("/analytics/walk-ins")}
        />
        <MeghaviKpiCard
          title="Crowd Gathering" value={crowdEvents}
          delta={crowdEvents - prevCrowdEvents} deltaLabel={fmtDelta(crowdEvents - prevCrowdEvents)}
          comparison="vs yesterday"
          icon={<GroupsOutlinedIcon />} iconBg="#D9770614" iconColor="#D97706"
          isPositiveGood={false} onClick={() => navigate("/analytics/crowd-gathering")}
        />
        <MeghaviKpiCard
          title="After Hours" value={afterHours}
          delta={afterHours - prevAfterHours} deltaLabel={fmtDelta(afterHours - prevAfterHours)}
          comparison="vs yesterday"
          icon={<NightsStayOutlinedIcon />} iconBg="#7C3AED14" iconColor="#7C3AED"
          isPositiveGood={false} onClick={() => navigate("/analytics/after-hours")}
        />
      </Box>

      {/* Live Overview + Trend */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1.15fr" }, gap: 2.5, alignItems: "stretch" }}>
        <MeghaviLiveOverview />
        <MeghaviTodaysTrend from={queryFrom} to={queryTo} />
      </Box>

      {/* Charts Row */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2.5 }}>
        <ChartPanel title="Walk-ins by Hour">
          <Box sx={{ flex: 1, minHeight: 160 }}>
            <HourBar data={walkinsByHour} dataKey="walkins" color={ds.success} name="Walk-ins" />
          </Box>
        </ChartPanel>
        <ChartPanel title="Crowd Gathering by Hour">
          <Box sx={{ flex: 1, minHeight: 160 }}>
            <HourBar data={crowdByHour} dataKey="count" color="#D97706" name="Events" />
          </Box>
        </ChartPanel>
        <ChartPanel title="After Hours by Hour">
          <Box sx={{ flex: 1, minHeight: 160 }}>
            <HourBar data={ahByHour} dataKey="count" color="#7C3AED" name="Incidents" />
          </Box>
        </ChartPanel>
      </Box>

      {/* Recent Alerts */}
      <Paper elevation={0} sx={CARD_SX}>
        <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: ds.textSecondary, letterSpacing: "0.07em", textTransform: "uppercase", mb: 1.5 }}>
          Recent Alerts
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          {recentAlerts.length === 0 && (
            <Typography sx={{ fontSize: "0.8125rem", color: ds.textMuted, py: 2, textAlign: "center" }}>No alerts today.</Typography>
          )}
          {recentAlerts.slice(0, 10).map((alert, i) => {
            const cfg = MODULE_CFG[alert.module] ?? { label: alert.module, color: ds.primary, route: "" };
            const sevColor = SEVERITY_COLOR[alert.severity] ?? ds.primary;
            return (
              <Box key={i} onClick={() => cfg.route && navigate(cfg.route)}
                sx={{ display: "flex", alignItems: "center", gap: 1.25, p: 1.25, borderRadius: "10px", border: `1px solid ${sevColor}22`, bgcolor: `${sevColor}08`, cursor: cfg.route ? "pointer" : "default", transition: "opacity 0.15s", "&:hover": cfg.route ? { opacity: 0.75 } : {} }}>
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
  );
}
