import { Box, CircularProgress, Paper, Typography } from "@mui/material";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { useDashboardSummary } from "../../../lib/meghaviApi";
import { pnp } from "../../../lib/pnpTheme";

const COLORS = {
  walkins:     "#0B4964",
  meetGreet:   "#4F8A8B",
  staffUnavail:"#C9964A",
};

interface Props { from: string; to: string; }

export function MeghaviTodaysTrend({ from, to }: Props) {
  const { summary, loading } = useDashboardSummary(from, to);

  // Filter to business hours with at least one non-zero value
  const trend = (summary?.trend ?? []).filter(
    (d) => d.walkins > 0 || d.meet_greet > 0 || d.staff_unavail_pct > 0
  );

  const isSingleDay = from === to;
  const title = isSingleDay ? "TODAY'S TRENDS" : "ACTIVITY TRENDS";

  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: "14px", bgcolor: pnp.cardBg, border: pnp.cardBorder, boxShadow: pnp.cardShadow, display: "flex", flexDirection: "column", height: "100%", minHeight: 380 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
        <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: pnp.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {title}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          {[
            { color: COLORS.walkins,      label: "Walk-ins" },
            { color: COLORS.meetGreet,    label: "Meet & Greet" },
            { color: COLORS.staffUnavail, label: "Staff Unavailability (%)" },
          ].map((l) => (
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
            <BarChart data={trend} margin={{ top: 10, right: 36, left: -20, bottom: 0 }} barCategoryGap="30%" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DCE7E8" vertical={false} />
              <XAxis dataKey="hour" stroke={pnp.textMuted} fontSize={11} tickLine={false} axisLine={{ stroke: "#DCE7E8" }} dy={6} />
              {/* Left axis: meet_greet + staff_unavail_pct */}
              <YAxis yAxisId="left"  stroke={pnp.textMuted} fontSize={11} tickLine={false} axisLine={false} dx={-4} />
              {/* Right axis: walkins (own scale so small counts are visible) */}
              <YAxis yAxisId="right" orientation="right" stroke={COLORS.walkins} fontSize={10} tickLine={false} axisLine={false} dx={4} width={28} tickFormatter={(v) => `${v}w`} />
              <Tooltip
                contentStyle={{ backgroundColor: pnp.primary, borderRadius: 8, border: "none", color: "#FFFFFF", fontSize: 12 }}
                itemStyle={{ color: "#FFFFFF" }}
                labelStyle={{ color: "#FFFFFF", fontWeight: 700, marginBottom: 4 }}
                cursor={{ fill: `${pnp.primary}0D` }}
              />
              <Bar yAxisId="left"  dataKey="meet_greet"        name="Meet & Greet"      fill={COLORS.meetGreet}    radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar yAxisId="left"  dataKey="staff_unavail_pct" name="Staff Unavailability (%)" fill={COLORS.staffUnavail} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar yAxisId="right" dataKey="walkins"            name="Walk-ins"          fill={COLORS.walkins}      radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Box>
    </Paper>
  );
}
