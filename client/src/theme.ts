import { createTheme } from "@mui/material/styles";
import { ds } from "./lib/dsTokens";

const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
const reducedMotion = "@media (prefers-reduced-motion: reduce)";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: ds.primary, light: ds.primaryLight, dark: ds.primaryDark, contrastText: "#FFFFFF" },
    secondary: { main: ds.accent, dark: ds.accentDark, contrastText: "#FFFFFF" },
    success: { main: ds.success, light: ds.successSoft, contrastText: "#FFFFFF" },
    error: { main: ds.danger, light: ds.dangerSoft, contrastText: "#FFFFFF" },
    warning: { main: ds.warning, light: ds.warningSoft, contrastText: "#FFFFFF" },
    info: { main: ds.info, light: ds.infoSoft, contrastText: "#FFFFFF" },
    background: { default: ds.pageBg, paper: ds.cardBg },
    text: { primary: ds.text, secondary: ds.textSecondary },
    divider: ds.border,
  },
  shape: { borderRadius: ds.cardRadius },
  typography: {
    fontFamily: ds.fontFamily,
    fontSize: 13,
    body1: { fontSize: "0.875rem", lineHeight: 1.5 },
    body2: { fontSize: "0.8125rem", lineHeight: 1.45 },
    h1: { fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.02em" },
    h2: { fontSize: "1.625rem", fontWeight: 700, letterSpacing: "-0.02em" },
    h3: { fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.015em" },
    h4: { fontSize: "1.125rem", fontWeight: 700, letterSpacing: "-0.01em" },
    h5: { fontSize: "0.9375rem", fontWeight: 700 },
    h6: { fontSize: "0.875rem", fontWeight: 700 },
    subtitle1: { fontSize: "0.9375rem", fontWeight: 600 },
    subtitle2: { fontSize: "0.8125rem", fontWeight: 600 },
    button: { fontSize: "0.875rem", fontWeight: 600, textTransform: "none" },
    overline: { fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" },
    caption: { fontSize: "0.75rem", fontWeight: 500 },
  },
  transitions: {
    duration: { standard: 180, enteringScreen: 220, leavingScreen: 140 },
    easing: { easeOut: ease, sharp: "cubic-bezier(0.4, 0, 0.6, 1)" },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: ds.pageBg,
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        },
        [reducedMotion]: {
          "*": {
            animationDuration: "0.01ms !important",
            transitionDuration: "0.01ms !important",
          },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: "none",
          borderRadius: ds.cardRadius,
          border: `1px solid ${ds.border}`,
          boxShadow: ds.cardShadow,
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: "none",
          borderRadius: ds.cardRadius,
          border: `1px solid ${ds.border}`,
          boxShadow: ds.cardShadow,
          "&:hover": { boxShadow: ds.hoverShadow },
          transition: "box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1), transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: ds.buttonRadius,
          fontWeight: 600,
          fontSize: "0.875rem",
          textTransform: "none",
          "&:active": { transform: "translateY(0.5px)" },
        },
        contained: {
          "&.MuiButton-containedPrimary": {
            boxShadow: `0 1px 2px rgba(238,72,96,0.25)`,
            "&:hover": { boxShadow: `0 6px 16px -4px rgba(238,72,96,0.35)` },
          },
          "&.MuiButton-containedSecondary": {
            boxShadow: `0 1px 2px rgba(65,64,66,0.25)`,
            "&:hover": { boxShadow: `0 6px 16px -4px rgba(65,64,66,0.35)` },
          },
        },
        outlined: {
          borderColor: ds.border,
          "&:hover": { borderColor: "#CBD5E1", backgroundColor: ds.pageBg },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: ds.chipRadius,
          fontWeight: 600,
          fontSize: "0.75rem",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: ds.inputRadius,
          backgroundColor: ds.cardBg,
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: ds.primary,
            boxShadow: ds.focusRing,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { fontSize: "0.875rem", fontWeight: 500 },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { borderRadius: ds.tooltipRadius, fontSize: "0.75rem" },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { borderRadius: ds.menuRadius },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: ds.dialogRadius },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontSize: "0.6875rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          backgroundColor: ds.pageBg,
          color: ds.textSecondary,
        },
        root: { borderColor: ds.border },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 12, border: "none" },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: { padding: 8 },
        track: { borderRadius: 999 },
        thumb: { boxShadow: "0 1px 4px rgba(0,0,0,0.2)" },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 999, height: 6 },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          "&:focus-visible": { boxShadow: ds.focusRing },
        },
      },
    },
  },
});
