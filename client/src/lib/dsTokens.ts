// Design system tokens — WoxSight / Woxsen University coral + charcoal palette.
export const ds = {
  // Page surfaces
  pageBg: "#F4F4F5",
  cardBg: "#FFFFFF",

  // Sidebar — charcoal gradient
  sidebarBgBase: "#414042",
  sidebarBg: "linear-gradient(180deg, #414042 0%, #2E2D2F 100%)",

  // Primary (coral red)
  primary: "#EE4860",
  primaryDark: "#C93049",
  primaryLight: "#FDE8EB",
  primarySoft: "#FDE8EB",

  // Accent (charcoal)
  accent: "#414042",
  accentDark: "#2E2D2F",

  // Status — kept distinct from brand coral
  success: "#2E7D32",
  successSoft: "#E8F5E9",
  warning: "#ED6C02",
  warningSoft: "#FFF3E0",
  danger: "#D32F2F",
  dangerSoft: "#FDECEA",
  info: "#0288D1",
  infoSoft: "#E1F5FE",

  // Borders
  border: "#E4E4E6",
  borderSubtle: "#F0F0F1",

  // Text
  text: "#414042",
  textSecondary: "#6B6B6E",
  textMuted: "#9E9EA1",

  // Shadows (coral-tinted)
  cardShadow:
    "0 1px 3px rgba(65,64,66,0.07), 0 1px 2px -1px rgba(65,64,66,0.04)",
  hoverShadow:
    "0 4px 12px -2px rgba(238,72,96,0.12), 0 2px 6px -2px rgba(65,64,66,0.06)",
  largeShadow:
    "0 12px 28px -6px rgba(65,64,66,0.14), 0 4px 10px -4px rgba(65,64,66,0.07)",
  focusRing: "0 0 0 3px rgba(238,72,96,0.22)",
  navActiveShadow: "0 4px 14px -2px rgba(238,72,96,0.40)",

  // Recharts palette — coral, charcoal + tints
  chartPalette: ["#EE4860", "#414042", "#F58A9A", "#8A8A8D", "#C93049", "#BDBDBF"],

  // Radii (px numbers for MUI)
  cardRadius: 16,
  buttonRadius: 10,
  dialogRadius: 18,
  chipRadius: 999,
  inputRadius: 10,
  tooltipRadius: 8,
  menuRadius: 12,

  // Layout
  drawerExpanded: 272,
  drawerCollapsed: 68,
  mastheadHeight: 64,

  // Nav (charcoal sidebar)
  navActive: "#EE4860",
  navActiveText: "#FFFFFF",
  navInactiveText: "rgba(255,255,255,0.80)",
  navHoverBg: "rgba(255,255,255,0.08)",
  navSectionLabel: "rgba(200,200,202,0.55)",
  navDivider: "rgba(255,255,255,0.10)",
  navActiveBar: "#EE4860",

  // Typography
  fontFamily: '"Poppins", "Inter", -apple-system, sans-serif',
  navFontFamily: '"Poppins", system-ui, sans-serif',
} as const;
