import { useMemo } from "react";
import { Box, CircularProgress, Paper, Typography } from "@mui/material";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { useWalkinsAnalytics, useOvercrowdingData, useAfterHoursData } from "../../../lib/meghaviApi";
import { pnp } from "../../../lib/pnpTheme";

const COLORS = {
  walkins:    "#5C9270",
  crowd:      "#D97706",
  afterHours: "#7C3AED",
};

const LEGEND = [
  { color: COLORS.walkins,    label: "Walk-ins" },
  { color: COLORS.crowd,      label: "Crowd Gathering" },
  { color: COLORS.afterHours, label: "After Hours" },
];

interface Props { from: string; to: string; }

type TrendRow = { hour: string; walkins: number; crowd: number; after_hours: number };

export function MeghaviTodaysTrend({ from, to }: Props) {
  const { analytics: walkinsData, loading: wLoading } = useWalkinsAnalytics(from, to);
  const { data: crowdData,  loading: cLoading } = useOvercrowdingData(from, to);
  const { data: ahData,     loading: aLoading } = useAfterHoursData(from, to);

  const loading = wLoading || cLoading || aLoading;

  const trend: TrendRow[] = useMemo(() => {
    const map: Record<string, TrendRow> = {};
    const ensure = (h: string) => {
      if (!map[h]) map[h] = { hour: h, walkins: 0, crowd: 0, after_hours: 0 };
    };
    for (const d of walkinsData?.hourly_trend ?? []) {
      ensure(d.hour); map[d.hour].walkins = d.walkins;
    }
    for (const d of crowdData?.hourly_trend ?? []) {
      ensure(d.hour); map[d.hour].crowd = d.count;
    }
    for (const d of ahData?.hourly_trend ?? []) {
      ensure(d.hour); map[d.hour].after_hours = d.count;
    }
    return Object.values(map)
      .filter((d) => d.walkins > 0 || d.crowd > 0 || d.after_hours > 0)
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }, [walkinsData, crowdData, ahData]);

  const title = from === to ? "TODAY'S TRENDS" : "ACTIVITY TRENDS";

  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: "14px", bgcolor: pnp.cardBg, border: pnp.cardBorder, boxShadow: pnp.cardShadow, display: "flex", flexDirection: "column", height: "100%", minHeight: 380 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
        <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: pnp.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {title}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          {LEGEND.map((l) => (
            <Box key={l.label} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "2px", bgcolor: l.color }} />
              <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: pnp.textSecondary }}>{l.label}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ flex: 1, width: "100%", minHeight: 250 }}>
        {loading && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 250 }}>
            <CircularProgress size={24} sx={{ color: pnp.primary }} />
          </Box>
        )}
        {!loading && trend.length === 0 && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 250 }}>
            <Typography sx={{ fontSize: "0.875rem", color: pnp.textMuted }}>No activity data for this period.</Typography>
          </Box>
        )}
        {!loading && trend.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ top: 10, right: 8, left: -20, bottom: 0 }} barCategoryGap="30%" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DCE7E8" vertical={false} />
              <XAxis dataKey="hour" stroke={pnp.textMuted} fontSize={11} tickLine={false} axisLine={{ stroke: "#DCE7E8" }} dy={6} />
              <YAxis stroke={pnp.textMuted} fontSize={11} tickLine={false} axisLine={false} dx={-4} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: pnp.primary, borderRadius: 8, border: "none", color: "#FFFFFF", fontSize: 12 }}
                itemStyle={{ color: "#FFFFFF" }}
                labelStyle={{ color: "#FFFFFF", fontWeight: 700, marginBottom: 4 }}
                cursor={{ fill: `${pnp.primary}0D` }}
              />
              <Bar dataKey="walkins"     name="Walk-ins"        fill={COLORS.walkins}    radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="crowd"       name="Crowd Gathering" fill={COLORS.crowd}      radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="after_hours" name="After Hours"     fill={COLORS.afterHours} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Box>
    </Paper>
  );
}
