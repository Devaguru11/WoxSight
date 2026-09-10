
export const pnp = {
  navy: "#0B4964",
  navySidebar: "#0B4964",
  navyMuted: "#073B55",
  pageBg: "#F7F9F8",
  headerBg: "#FFFFFF",
  footerBg: "#073B55",

  cardBg: "#FFFFFF",
  cardRadius: 12,
  cardBorder: "1px solid #DCE7E8",
  cardShadow: "0 1px 3px rgba(11, 73, 100, 0.06), 0 4px 16px rgba(11, 73, 100, 0.04)",

  primary: "#0B4964",
  primaryDark: "#073B55",
  primaryLight: "#2E78A0",
  primarySoft: "#EAF3F5",
  teal: "#4F8A8B",
  tealAccent: "#4F8A8B",
  cyan: "#2E78A0",
  success: "#5C9270",
  successSoft: "#E8F3EE",
  danger: "#C96B6B",
  dangerSoft: "#FAEAEA",
  warning: "#C9964A",
  warningSoft: "#F5EFE5",
  orange: "#C9964A",
  orangeSoft: "#F5EFE5",
  blue: "#2E78A0",
  blueSoft: "#EAF3F5",
  purple: "#4F8A8B",
  purpleSoft: "#EAF3F5",
  amber: "#C9964A",
  amberSoft: "#F5EFE5",

  text: "#18323D",
  textSecondary: "#647B83",
  textMuted: "#8A9AA0",

  navActiveGradient: "linear-gradient(90deg, #145D78 0%, #1A6E8C 100%)",
  navActiveBar: "#145D78",
  navText: "rgba(255, 255, 255, 0.92)",
  navTextMuted: "rgba(183, 205, 211, 0.80)",

  loginBg: "#073B55",
  mapDark: "#073B55",

  kpiBlue: "#2E78A0",
  kpiGreen: "#5C9270",
  kpiRed: "#C96B6B",
  kpiPurple: "#4F8A8B",
  kpiOrange: "#C9964A",
} as const;

export const pnpSidebarBg = pnp.navySidebar;

export const pnpFont = {
  family: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  heading: '"Playfair Display", "Cinzel", Georgia, serif',
  kpiLabel: { fontSize: "0.8125rem", fontWeight: 600, lineHeight: 1.35, color: pnp.textSecondary },
  kpiValue: { fontSize: "1.75rem", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em", color: pnp.text },
  kpiTrend: { fontSize: "0.75rem", fontWeight: 600, lineHeight: 1.3 },
  cardTitle: { fontSize: "0.9375rem", fontWeight: 700, lineHeight: 1.35, color: pnp.text },
  cardSubtitle: { fontSize: "0.75rem", fontWeight: 500, lineHeight: 1.4, color: pnp.textSecondary },
  pageTitle: { fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2, color: pnp.text },
  pageSubtitle: { fontSize: "0.8125rem", fontWeight: 500, lineHeight: 1.45, color: pnp.textSecondary },
} as const;

export const pnpNavItemSx = (selected: boolean) => ({
  position: "relative" as const,
  borderRadius: "10px",
  mb: 0.5,
  minHeight: 42,
  px: 1.5,
  py: 1,
  bgcolor: selected ? "#145D78" : "transparent",
  background: selected ? "#145D78" : "transparent",
  color: selected ? "#FFFFFF" : pnp.navText,
  boxShadow: selected ? "0 2px 8px rgba(0, 0, 0, 0.20)" : "none",
  "&:hover": {
    bgcolor: selected ? "#145D78" : "rgba(255, 255, 255, 0.07)",
  },
  "& .MuiListItemIcon-root": {
    color: "inherit",
    minWidth: 38,
  },
});
