import { ds } from "../../lib/dsTokens";

export const loginNavy = "#2E2D2F";

export const loginPalette = {
  // Dark panel — charcoal with coral accent
  panelBg: "#414042",
  panelGradient: "linear-gradient(160deg, #414042 0%, #2E2D2F 100%)",
  gridColor: "rgba(255,255,255,0.05)",
  glowOrange: "#EE4860",       // coral primary
  glowBlue: "#C93049",         // coral dark
  headlineWhite: "#FFFFFF",
  headlineAccent: "#EE4860",   // coral
  featureIconBg: "rgba(238,72,96,0.15)",
  featureIconBorder: "rgba(238,72,96,0.30)",
  featureIconColor: "#F58A9A",
  featureTitle: "#F1F5F9",
  featureBody: "#9E9EA1",
  statValue: "#FFFFFF",
  statLabel: "#6B6B6E",

  // Right panel
  rightBg: "#F4F4F5",

  // Form
  fieldBg: "#FFFFFF",
  fieldBorder: ds.border,
  fieldBorderFocus: ds.primary,

  // Shared refs
  accent: ds.primary,
  accentDeep: ds.primaryDark,
  accentMid: "#F58A9A",
  goldBright: "#EE4860",
  goldDeep: "#C93049",
  cream: "#F1F5F9",
  creamMuted: "#9E9EA1",
  creamFaint: "rgba(241, 245, 249, 0.55)",
  tint: "rgba(238,72,96,0.08)",
  hairline: "rgba(238,72,96,0.20)",
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
export const loginFutureLabelSx = { color: "#6B6B6E" };
export const loginFutureLinkSx = {
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "#6B6B6E",
  cursor: "not-allowed",
  userSelect: "none" as const,
};
export const loginFutureMuted = "#6B6B6E";
export const loginFutureButtonSx = {
  flex: 1,
  borderRadius: "8px",
  borderColor: ds.border,
  color: "#6B6B6E",
  fontSize: "0.8125rem",
  fontWeight: 600,
  textTransform: "none" as const,
};
