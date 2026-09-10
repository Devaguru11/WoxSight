// Design system tokens — Meghavi Wellness navy + teal palette.
export const ds = {
  // Page surfaces
  pageBg: "#F4F7F8",
  cardBg: "#FFFFFF",

  // Sidebar — navy gradient
  sidebarBgBase: "#0B4964",
  sidebarBg: "linear-gradient(180deg, #0B4964 0%, #073B55 100%)",

  // Primary (navy)
  primary: "#0B4964",
  primaryDark: "#073B55",
  primaryLight: "#2E78A0",
  primarySoft: "#EAF3F5",

  // Accent (teal)
  accent: "#4F8A8B",
  accentDark: "#3D6E70",

  // Status
  success: "#5C9270",
  successSoft: "#E8F3EE",
  warning: "#C9964A",
  warningSoft: "#F5EFE5",
  danger: "#C96B6B",
  dangerSoft: "#FAEAEA",
  info: "#2E78A0",
  infoSoft: "#EAF3F5",

  // Borders
  border: "#DCE7E8",
  borderSubtle: "#EEF4F5",

  // Text
  text: "#1E2A35",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",

  // Shadows
  cardShadow:
    "0 1px 3px rgba(11,73,100,0.06), 0 1px 2px -1px rgba(11,73,100,0.04)",
  hoverShadow:
    "0 4px 12px -2px rgba(11,73,100,0.10), 0 2px 6px -2px rgba(11,73,100,0.06)",
  largeShadow:
    "0 12px 28px -6px rgba(11,73,100,0.14), 0 4px 10px -4px rgba(11,73,100,0.07)",
  focusRing: "0 0 0 3px rgba(11,73,100,0.18)",
  navActiveShadow: "0 4px 14px -2px rgba(11,73,100,0.40)",

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

  // Nav
  navActive: "#145D78",
  navActiveText: "#FFFFFF",
  navInactiveText: "rgba(255,255,255,0.82)",
  navHoverBg: "rgba(255,255,255,0.07)",
  navSectionLabel: "rgba(183,205,211,0.60)",
  navDivider: "rgba(255,255,255,0.08)",
  navActiveBar: "#4F8A8B",

  // Typography
  fontFamily: '"DM Sans", "Inter", -apple-system, sans-serif',
  navFontFamily: '"Inter", system-ui, sans-serif',
} as const;
