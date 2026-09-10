import { ds } from "./dsTokens";

export const rail = {
  bg: ds.sidebarBg,
  bgSolid: ds.sidebarBgBase,
  border: "rgba(255,255,255,0.06)",
  divider: ds.navDivider,

  // Active nav row
  activeFill: ds.navActive,
  activeShadow: ds.navActiveShadow,
  activeText: ds.navActiveText,
  activeIcon: ds.navActiveText,
  activeBar: ds.navActiveBar,

  hover: ds.navHoverBg,
  text: ds.navInactiveText,
  textMuted: "rgba(255,255,255,0.45)",
  caption: ds.navSectionLabel,
  icon: "rgba(255,255,255,0.65)",
  cream: "#FFFFFF",

  // Kept for backward compat
  gold: ds.primaryLight,
} as const;

export const railSidebarBg = rail.bgSolid;

export const railNavItemSx = (selected: boolean) => ({
  position: "relative" as const,
  borderRadius: "10px",
  mb: 0.5,
  minHeight: 40,
  px: 1.5,
  py: 0.875,
  bgcolor: "transparent",
  background: selected ? rail.activeFill : "transparent",
  color: selected ? rail.activeText : rail.text,
  boxShadow: selected ? rail.activeShadow : "none",
  "&::before": selected
    ? {
        content: '""',
        position: "absolute",
        left: 0,
        top: "22%",
        height: "56%",
        width: 3,
        borderRadius: "0 3px 3px 0",
        bgcolor: rail.activeBar,
      }
    : {},
  "&:hover": {
    background: selected ? rail.activeFill : rail.hover,
  },
  "& .MuiListItemIcon-root": {
    color: selected ? rail.activeIcon : rail.icon,
    minWidth: 38,
  },
});
