import { ds } from "../../lib/dsTokens";

export const loginNavy = "#073B55";

export const loginPalette = {
  // Dark panel
  panelBg: "#0B4964",
  panelGradient: "linear-gradient(160deg, #0B4964 0%, #073B55 100%)",
  gridColor: "rgba(255,255,255,0.05)",
  glowOrange: "#C9964A",       // amber accent
  glowBlue: "#4F8A8B",         // teal
  headlineWhite: "#FFFFFF",
  headlineAccent: "#4F8A8B",   // teal
  featureIconBg: "rgba(255,255,255,0.10)",
  featureIconBorder: "rgba(255,255,255,0.18)",
  featureIconColor: "#A8D4D5",
  featureTitle: "#F1F5F9",
  featureBody: "#94A3B8",
  statValue: "#FFFFFF",
  statLabel: "#64748B",

  // Right panel
  rightBg: "#F4F7F8",

  // Form
  fieldBg: "#FFFFFF",
  fieldBorder: ds.border,
  fieldBorderFocus: ds.primary,

  // Shared refs
  accent: ds.primary,
  accentDeep: ds.primaryDark,
  accentMid: ds.primaryLight,
  goldBright: "#D4A017",
  goldDeep: "#B8860B",
  cream: "#F1F5F9",
  creamMuted: "#94A3B8",
  creamFaint: "rgba(241, 245, 249, 0.55)",
  tint: "rgba(11,73,100,0.08)",
  hairline: "rgba(11,73,100,0.18)",
};

export const loginPanelBg = loginPalette.panelBg;

export const loginHeroBackground = {
  background: loginPalette.panelBg,
};

export const loginGlassCard = {
  bgcolor: "rgba(255,255,255,0.05)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.1)",
};

export const loginFutureControlSx = { opacity: 0.5 };
export const loginFutureLabelSx = { color: "#64748B" };
export const loginFutureLinkSx = {
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "#64748B",
  cursor: "not-allowed",
  userSelect: "none" as const,
};
export const loginFutureMuted = "#64748B";
export const loginFutureButtonSx = {
  flex: 1,
  borderRadius: "8px",
  borderColor: ds.border,
  color: "#64748B",
  fontSize: "0.8125rem",
  fontWeight: 600,
  textTransform: "none" as const,
};
