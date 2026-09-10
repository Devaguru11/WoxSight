import { Box, Stack, Typography } from "@mui/material";
import DirectionsWalkOutlinedIcon from "@mui/icons-material/DirectionsWalkOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import FaceRetouchingNaturalOutlinedIcon from "@mui/icons-material/FaceRetouchingNaturalOutlined";
import VideocamRoundedIcon from "@mui/icons-material/VideocamRounded";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import { SITE_BRANDING } from "../../i18n/lang";
import { loginPalette } from "./loginTheme";


const MODULES = [
  {
    icon: <DirectionsWalkOutlinedIcon />,
    title: "Walk-ins",
    body: "Track customer arrivals and peak lobby footfall patterns.",
  },
  {
    icon: <TimerOutlinedIcon />,
    title: "Customer Waiting Time",
    body: "Monitor dwell and queue duration across reception and therapy suites.",
  },
  {
    icon: <FaceRetouchingNaturalOutlinedIcon />,
    title: "Staff Unavailability",
    body: "Real-time visibility into therapist and consultant station coverage.",
  },
  {
    icon: <VideocamRoundedIcon />,
    title: "Cameras Online",
    body: "Live video surveillance feeds across wellness reception zones.",
  },
  {
    icon: <NotificationsNoneOutlinedIcon />,
    title: "Active Alerts",
    body: "Instant notifications for excessive wait times and staff shortages.",
  },
  {
    icon: <SmartToyOutlinedIcon />,
    title: "AI Daily Briefing",
    body: "A written summary of the day with actionable operational recommendations.",
  },
];

const STATS = [
  { value: "6", label: "Cameras" },
  { value: "24/7", label: "Monitoring" },
  { value: "AI", label: "Powered" },
];

function ModuleRow({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: "10px",
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          bgcolor: loginPalette.featureIconBg,
          border: `1px solid ${loginPalette.featureIconBorder}`,
          color: loginPalette.featureIconColor,
          "& svg": { fontSize: 18 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ pt: 0.1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: "0.875rem", color: loginPalette.featureTitle, lineHeight: 1.3 }}>
          {title}
        </Typography>
        <Typography sx={{ mt: 0.25, fontSize: "0.75rem", color: loginPalette.featureBody, lineHeight: 1.5 }}>
          {body}
        </Typography>
      </Box>
    </Box>
  );
}

export function LoginOperationalDashboard() {
  return (
    <Box
      sx={{
        display: { xs: "none", lg: "flex" },
        flexDirection: "column",
        background: loginPalette.panelGradient,
        position: "relative",
        overflow: "hidden",
        p: { lg: 5, xl: 6 },
        justifyContent: "space-between",
      }}
    >
      {/* Grid overlay */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(${loginPalette.gridColor} 1px, transparent 1px),
            linear-gradient(90deg, ${loginPalette.gridColor} 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 90% 90% at 30% 50%, #000 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 90% at 30% 50%, #000 30%, transparent 100%)",
          zIndex: 0,
        }}
      />
      {/* Orange glow top-left */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: "-20%",
          left: "-15%",
          width: "50%",
          paddingBottom: "50%",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${loginPalette.glowOrange}33 0%, transparent 65%)`,
          zIndex: 0,
          pointerEvents: "none",
        }}
      />
      {/* Blue glow bottom-right */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          bottom: "-20%",
          right: "-15%",
          width: "55%",
          paddingBottom: "55%",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${loginPalette.glowBlue}33 0%, transparent 65%)`,
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      <Box sx={{ position: "relative", zIndex: 1 }}>
        {/* Product logo */}
        <Box
          sx={{
            display: "inline-flex",
            bgcolor: "#FFFFFF",
            borderRadius: "10px",
            px: 1.25,
            py: 0.75,
            mb: 4,
            boxShadow: "0 2px 10px -2px rgba(0,0,0,0.35)",
          }}
        >
          <img
            src={`${import.meta.env.BASE_URL}meghavi.png`}
            alt="Meghavi Wellness"
            style={{ height: 52, width: "auto" }}
          />
        </Box>

        {/* Hero headline */}
        <Typography
          sx={{
            fontFamily: '"DM Sans", "Inter", sans-serif',
            fontSize: "2.75rem",
            fontWeight: 800,
            color: loginPalette.headlineWhite,
            lineHeight: 1.15,
            mb: 1.5,
          }}
        >
          Intelligent{" "}
          <Box
            component="span"
            sx={{ color: loginPalette.headlineAccent }}
          >
            Wellness
          </Box>{" "}
          Analytics
        </Typography>
        <Typography sx={{ fontSize: "1rem", color: loginPalette.featureBody, mb: 4, lineHeight: 1.6, maxWidth: 420 }}>
          {SITE_BRANDING.loginHeroBody ?? "Real-time AI-powered insights for smarter wellness center management."}
        </Typography>

        {/* Feature list */}
        <Stack spacing={2} sx={{ mb: 4 }}>
          {MODULES.map((m) => (
            <ModuleRow key={m.title} {...m} />
          ))}
        </Stack>

        {/* Stats row */}
        <Stack direction="row" spacing={4}>
          {STATS.map((s) => (
            <Box key={s.label}>
              <Typography sx={{ fontSize: "1.75rem", fontWeight: 800, color: loginPalette.statValue, lineHeight: 1 }}>
                {s.value}
              </Typography>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 500, color: loginPalette.statLabel, mt: 0.25 }}>
                {s.label}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>

      {/* Bottom partner logo */}
      <Box sx={{ position: "relative", zIndex: 1, mt: 4 }}>
        <img
          src={`${import.meta.env.BASE_URL}AccessGenieLogo.svg`}
          alt="AccessGenie"
          style={{ height: 40, width: "auto", display: "block" }}
        />
      </Box>
    </Box>
  );
}
