import { Box, Stack, Typography } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import MonitorHeartOutlinedIcon from "@mui/icons-material/MonitorHeartOutlined";
import { ds } from "../lib/dsTokens";

const BADGES = [
  { icon: <LockOutlinedIcon sx={{ fontSize: 13 }} />, label: "Secured Enterprise System" },
  { icon: <AssessmentOutlinedIcon sx={{ fontSize: 13 }} />, label: "Audit Logging Enabled" },
  { icon: <MonitorHeartOutlinedIcon sx={{ fontSize: 13 }} />, label: "24×7 Monitoring Active" },
];

export function AppFooter() {
  return (
    <Box
      component="footer"
      sx={{
        mt: "auto",
        flexShrink: 0,
        width: "100%",
        boxSizing: "border-box",
        px: { xs: 2, md: 2.5 },
        py: 1,
        borderTop: "1px solid #E5E7EB",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
        flexWrap: "nowrap",
        overflow: "hidden",
      }}
    >
      {/* Left: badges */}
      <Stack direction="row" spacing={1.5} sx={{ flexWrap: "nowrap", alignItems: "center", minWidth: 0, overflow: "hidden" }}>
        {BADGES.map((b, idx) => (
          <Box
            key={b.label}
            sx={{
              display: idx >= 2 ? { xs: "none", md: "flex" } : "flex",
              alignItems: "center",
              gap: 0.5,
              color: ds.textMuted,
              minWidth: 0,
            }}
          >
            {b.icon}
            <Typography
              noWrap
              sx={{
                display: { xs: "none", sm: "block" },
                fontSize: "0.625rem",
                fontWeight: 600,
                letterSpacing: "0.03em",
                color: ds.textMuted,
              }}
            >
              {b.label}
            </Typography>
          </Box>
        ))}
      </Stack>

      {/* Right: powered by */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0 }}>
        <Typography sx={{ fontSize: "0.625rem", fontWeight: 500, color: ds.textMuted, whiteSpace: "nowrap" }}>
          Powered by
        </Typography>
        <img
          src={`${import.meta.env.BASE_URL}AccessGenieLogo.svg`}
          alt="AccessGenie"
          style={{ height: 22, width: "auto" }}
        />
      </Box>
    </Box>
  );
}
