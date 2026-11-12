import React, { useEffect, useState } from "react";
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { useShellHeader } from "../context/ShellHeaderContext";
import { ds } from "../lib/dsTokens";
import { useNavigate } from "react-router-dom";
import { EmailReportButton } from "./EmailReportButton";
import { useAuth } from "../auth/AuthContext";

type Props = {
  pageTitle: string;
  pageSubtitle?: string;
  userEmail?: string | null;
  userName?: string | null;
  onSignOut: () => void;
};

function initialsFromEmail(email?: string | null) {
  if (!email) return "OP";
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

function displayName(email?: string | null) {
  if (!email) return "Venue Operations";
  return email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function LiveClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <Typography
      sx={{
        fontFamily: ds.navFontFamily,
        fontSize: "0.8125rem",
        fontWeight: 600,
        color: ds.textSecondary,
        letterSpacing: "0.02em",
        minWidth: 68,
        userSelect: "none",
      }}
    >
      {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </Typography>
  );
}

export function AppMasthead({ pageTitle, pageSubtitle, userEmail, userName, onSignOut }: Props) {
  const { rightSlot, leftSlot } = useShellHeader();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const isAdmin = (user?.role ?? "").toLowerCase() === "admin";
  const subtitle = pageSubtitle?.trim() || undefined;

  return (
    <Box
      sx={{
        width: "100%",
        px: { xs: 1.5, sm: 2 },
        height: ds.mastheadHeight,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
      }}
    >
      {/* Left: toggle + title */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0, flex: "1 1 auto", overflow: "hidden" }}>
        {leftSlot}
        <Box sx={{ minWidth: 0, overflow: "hidden" }}>
          <Typography
            sx={{ fontSize: { xs: "1rem", md: "1.125rem" }, fontWeight: 700, color: ds.text, lineHeight: 1.2 }}
            noWrap
          >
            {pageTitle}
          </Typography>
          {subtitle && (
            <Typography
              sx={{ fontSize: "0.75rem", color: ds.textSecondary, mt: 0.2, lineHeight: 1.3 }}
              noWrap
            >
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Right: controls */}
      <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0.5, sm: 1 }, flexShrink: 0 }}>
        {/* rightSlot (date-range picker etc.) */}
        <Box sx={{ display: { xs: "none", lg: "flex" }, alignItems: "center", mr: 0.5 }}>
          {rightSlot}
        </Box>


        {/* Email report — admin only */}
        {isAdmin && <EmailReportButton />}

        {/* Settings */}
        <Tooltip title="Settings">
          <IconButton
            size="small"
            onClick={() => navigate("/settings")}
            sx={{
              width: 34,
              height: 34,
              border: `1px solid ${ds.border}`,
              borderRadius: "8px",
              color: ds.textSecondary,
              display: { xs: "none", sm: "inline-flex" },
            }}
          >
            <SettingsOutlinedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        {/* Notifications */}
        <Tooltip title="Notifications">
          <IconButton
            size="small"
            onClick={() => navigate("/alerts")}
            sx={{
              width: 34,
              height: 34,
              border: `1px solid ${ds.border}`,
              borderRadius: "8px",
              color: ds.textSecondary,
            }}
          >
            <NotificationsNoneOutlinedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        {/* Live clock */}
        <Box sx={{ display: { xs: "none", xl: "block" } }}>
          <LiveClock />
        </Box>

        <Divider orientation="vertical" flexItem sx={{ height: 24, alignSelf: "center", borderColor: ds.border, display: { xs: "none", sm: "block" } }} />

        {/* Partner logo */}
        <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center" }}>
          <img
            src={`${import.meta.env.BASE_URL}brand/woxsen-logo.png`}
            alt="Woxsen University"
            style={{ height: 28, width: "auto" }}
          />
        </Box>

        {/* User avatar pill */}
        <Box
          onClick={(e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            cursor: "pointer",
            borderRadius: "999px",
            px: 0.75,
            py: 0.5,
            border: `1px solid ${ds.border}`,
            bgcolor: ds.cardBg,
            "&:hover": { bgcolor: ds.pageBg },
            transition: "background 120ms",
            userSelect: "none",
          }}
        >
          <Avatar
            sx={{
              width: 28,
              height: 28,
              background: "linear-gradient(135deg, #1D4ED8, #3B82F6)",
              fontSize: "0.6875rem",
              fontWeight: 700,
            }}
          >
            {initialsFromEmail(userEmail)}
          </Avatar>
          <Typography
            sx={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: ds.text,
              display: { xs: "none", md: "block" },
              pr: 0.25,
            }}
          >
            {userName ?? displayName(userEmail)}
          </Typography>
        </Box>
      </Box>

      {/* Profile menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { mt: 1, minWidth: 200, borderRadius: `${ds.menuRadius}px` } } }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.875rem", color: ds.text }}>{userName ?? displayName(userEmail)}</Typography>
          <Typography sx={{ fontSize: "0.75rem", color: ds.textSecondary }}>{userEmail}</Typography>
        </Box>
        <Divider sx={{ borderColor: ds.border, mx: 1 }} />
        <MenuItem onClick={() => { setAnchorEl(null); navigate("/settings"); }}>
          <ListItemIcon><SettingsOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary={<Typography sx={{ fontSize: "0.875rem" }}>Settings</Typography>} />
        </MenuItem>
        <MenuItem
          onClick={() => { setAnchorEl(null); onSignOut(); }}
          sx={{ color: "error.main", mt: 0.5 }}
        >
          <ListItemIcon><LogoutIcon fontSize="small" sx={{ color: "error.main" }} /></ListItemIcon>
          <ListItemText primary={<Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: "error.main" }}>Sign Out</Typography>} />
        </MenuItem>
      </Menu>
    </Box>
  );
}
