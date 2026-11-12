import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import DashboardIcon from "@mui/icons-material/Dashboard";
import VideocamRoundedIcon from "@mui/icons-material/VideocamRounded";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import DirectionsWalkOutlinedIcon from "@mui/icons-material/DirectionsWalkOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import NightsStayOutlinedIcon from "@mui/icons-material/NightsStayOutlined";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import MenuIcon from "@mui/icons-material/Menu";
import { Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { usePermissions, type PageKey } from "../lib/permissions";
import { ShellHeaderProvider, useShellHeader } from "../context/ShellHeaderContext";
import { AppMasthead } from "./AppMasthead";
import { SITE_BRANDING } from "../i18n/lang";
import { ds } from "../lib/dsTokens";
import { rail, railNavItemSx, railSidebarBg } from "../lib/railTheme";
import { AppFooter } from "./AppFooter";

const DRAWER_WIDTH = 250;
const DRAWER_COLLAPSED = 140;
const SIDEBAR_STORAGE_KEY = "pragati.sidebar.collapsed";

type NavItem = {
  label: string;
  path: string | null;
  icon: ReactNode;
  section?: boolean;
  /** Collapsible group header — clicking it toggles the group open/closed. */
  groupHeader?: boolean;
  groupId?: string;
  /** When set, the item is hidden unless the user has this page grant. */
  page?: PageKey;
};

const ANALYTICS_GROUP = "analytics";

const NAV: NavItem[] = [
  { label: "OPERATIONS", path: null, icon: null, section: true },
  { label: "Dashboard",  path: "/dashboard", icon: <DashboardIcon />, page: "meghavi_dashboard" },
  // Analytics collapsible group
  { label: "Analytics",        path: null, icon: <BarChartOutlinedIcon />, groupHeader: true, groupId: ANALYTICS_GROUP },
  { label: "Walk-Ins",         path: "/analytics/walk-ins",         icon: <DirectionsWalkOutlinedIcon />, page: "meghavi_walkins",       groupId: ANALYTICS_GROUP },
  { label: "Crowd Gathering",  path: "/analytics/crowd-gathering",  icon: <GroupsOutlinedIcon />,         page: "monitoring_loitering",  groupId: ANALYTICS_GROUP },
  { label: "After Hours",      path: "/analytics/after-hours",      icon: <NightsStayOutlinedIcon />,     page: "monitoring_after_hours", groupId: ANALYTICS_GROUP },
  // Monitoring
  { label: "Cameras", path: "/live",    icon: <VideocamRoundedIcon />,          page: "meghavi_cameras" },
  { label: "Alerts",  path: "/alerts",  icon: <NotificationsNoneOutlinedIcon />, page: "meghavi_alerts" },
  { label: "Reports", path: "/reports", icon: <DescriptionOutlinedIcon />,       page: "meghavi_reports" },
  { label: "ADMINISTRATION", path: null, icon: null, section: true },
  { label: "Staff",        path: "/staff",        icon: <PeopleOutlinedIcon /> },
  { label: "Settings",     path: "/settings",     icon: <SettingsOutlinedIcon />, page: "settings" },
  { label: "Audit Logs",   path: "/audit",        icon: <ManageSearchIcon />,     page: "audit_logs" },
  { label: "Integrations", path: "/integrations", icon: <HubOutlinedIcon /> },
];

const navPageTitle: Record<string, string> = {
  "/dashboard": "Video Analytics Dashboard",
  "/live": "Cameras Online",
  "/analytics/walk-ins": "Walk-Ins",
  "/analytics/crowd-gathering": "Crowd Gathering",
  "/analytics/after-hours": "After Hours",
  "/reports": "Operational Reports",
  "/alerts": "Active Alerts",
  "/staff": "Staff Directory & Roster",
  "/settings": "System Settings",
  "/audit": "Audit Logs",
  "/integrations": "Integrations & Cameras",
};

const navPageSubtitle: Record<string, string> = {
  "/dashboard": "Real-time AI-powered insights for smarter campus management",
  "/live": "Live video surveillance feeds across campus entry points and facilities",
  "/analytics/walk-ins": "Track and analyse campus footfall patterns across all monitored zones",
  "/analytics/crowd-gathering": "Detect and review crowd gathering anomalies across monitored zones",
  "/analytics/after-hours": "Monitor activity detected outside permitted hours across all cameras",
  "/reports": "Automated PDF summaries, daily briefings, and raw analytics exports",
  "/alerts": "Real-time alerts for crowd surges, staff shortages, and security events",
  "/staff": "System accounts for faculty, security staff, and administrators",
  "/settings": "Manage alert thresholds, occupancy limits, and notification preferences",
  "/audit": "Per-user activity history, session breakdown, and cross-user audit trail",
  "/integrations": "Manage connected cameras, inference models, and campus alerting webhooks",
};

function readCollapsed(): boolean {
  try { return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1"; } catch { return false; }
}

function isActive(path: string | null, pathname: string) {
  if (!path) return false;
  return pathname === path || (path !== "/dashboard" && pathname.startsWith(path + "/"));
}

function AppShellInner() {
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("md"));
  const loc = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { can, isAdmin } = usePermissions();
  const { setLeftSlot } = useShellHeader();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [collapsed, setCollapsed] = useState(readCollapsed);

  // Open analytics group by default when on an analytics path
  const [openGroups, setOpenGroups] = useState<Set<string>>(() =>
    new Set(typeof window !== "undefined" && window.location.pathname.startsWith("/analytics") ? [ANALYTICS_GROUP] : [])
  );

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  };

  // Auto-open when navigating into /analytics, auto-close when leaving
  const analyticsActive = loc.pathname.startsWith("/analytics");
  const prevAnalyticsActive = useRef(analyticsActive);
  useEffect(() => {
    if (analyticsActive && !prevAnalyticsActive.current) {
      setOpenGroups((prev) => new Set([...prev, ANALYTICS_GROUP]));
    } else if (!analyticsActive && prevAnalyticsActive.current) {
      setOpenGroups((prev) => {
        const next = new Set(prev);
        next.delete(ANALYTICS_GROUP);
        return next;
      });
    }
    prevAnalyticsActive.current = analyticsActive;
  }, [analyticsActive]);

  // Filter nav items by permission, then drop group children whose group header is invisible.
  const visibleNav = useMemo(() => {
    const filtered = NAV.filter((item) => {
      if (!item.page) return true;
      if (isAdmin) return true;
      return can(item.page);
    });
    // Remove section headers with nothing following them before the next section
    return filtered.filter((item, idx) => {
      if (!item.section) return true;
      for (let i = idx + 1; i < filtered.length; i++) {
        if (!filtered[i].section) return true;
        if (filtered[i].section) return false;
      }
      return false;
    });
  }, [can, isAdmin]);

  // Mobile is always expanded; desktop respects collapsed state
  const expanded = isMobile ? true : !collapsed;
  const drawerWidth = expanded ? DRAWER_WIDTH : DRAWER_COLLAPSED;

  const toggleSidebar = useCallback(() => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0"); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);

  // Place the collapse toggle in the masthead left slot
  useEffect(() => {
    setLeftSlot(
      <IconButton
        aria-label="Toggle navigation"
        onClick={toggleSidebar}
        size="small"
        sx={{
          width: 36,
          height: 36,
          border: `1px solid ${ds.border}`,
          borderRadius: "8px",
          color: ds.textSecondary,
          "& svg": { transition: "transform 260ms cubic-bezier(0.22,1,0.36,1)", transform: collapsed ? "rotate(180deg)" : "rotate(0deg)" },
        }}
      >
        {collapsed ? <MenuIcon sx={{ fontSize: 18 }} /> : <ChevronLeftIcon sx={{ fontSize: 18 }} />}
      </IconButton>
    );
    return () => setLeftSlot(null);
  }, [setLeftSlot, toggleSidebar, collapsed]);

  // Scroll to top on every route change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [loc.pathname]);

  const navItemSx = useCallback(
    (selected: boolean) => ({
      ...railNavItemSx(selected),
      justifyContent: expanded ? ("flex-start" as const) : ("center" as const),
      px: 1.5,
      // In collapsed mode force the icon container to shrink to its natural size
      ...(!expanded && {
        "& .MuiListItemIcon-root": {
          minWidth: 0,
          color: selected ? rail.activeIcon : rail.icon,
        },
      }),
    }),
    [expanded]
  );

  const renderItem = useCallback(
    (item: NavItem) => {
      // Top-level section label
      if (item.section) {
        if (!expanded) {
          return <Box key={item.label} sx={{ height: 1, bgcolor: rail.divider, mx: 1.5, my: 1 }} />;
        }
        return (
          <Typography key={item.label} sx={{ px: 2, pt: 1.5, pb: 0.5, fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: rail.caption }}>
            {item.label}
          </Typography>
        );
      }

      // Collapsible group header
      if (item.groupHeader && item.groupId) {
        const groupOpen  = openGroups.has(item.groupId);
        const groupActive = loc.pathname.startsWith("/analytics");
        if (!expanded) {
          return (
            <Tooltip key={item.label} title={item.label} placement="right" arrow>
              <span style={{ display: "block" }}>
                <Box onClick={() => toggleGroup(item.groupId!)}
                  sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 44, borderRadius: "10px", mb: 0.5, cursor: "pointer",
                    color: groupActive ? rail.activeText : rail.icon,
                    background: groupActive ? rail.activeFill : "transparent",
                    "&:hover": { background: groupActive ? rail.activeFill : rail.hover },
                    "& svg": { fontSize: 22 } }}>
                  {item.icon}
                </Box>
              </span>
            </Tooltip>
          );
        }
        return (
          <ListItemButton key={item.label} onClick={() => toggleGroup(item.groupId!)}
            sx={{ ...navItemSx(groupActive), justifyContent: "flex-start", px: 1.5 }}>
            <ListItemIcon sx={{ minWidth: 40, display: "flex", alignItems: "center", justifyContent: "center", "& .MuiSvgIcon-root": { fontSize: 20 } }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={
              <Typography sx={{ fontWeight: groupActive ? 700 : 500, fontSize: "0.875rem", color: groupActive ? rail.activeText : rail.text }} noWrap>
                {item.label}
              </Typography>
            } />
            <ExpandMoreIcon sx={{ fontSize: 16, color: rail.icon, transform: groupOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms ease", flexShrink: 0 }} />
          </ListItemButton>
        );
      }

      // Group children — hide when group is closed (in expanded mode) or render as icon in collapsed
      if (item.groupId && !item.groupHeader) {
        const groupOpen = openGroups.has(item.groupId);
        if (expanded && !groupOpen) return null;
        const selected = isActive(item.path, loc.pathname);
        if (!expanded) {
          return (
            <Tooltip key={item.label} title={item.label} placement="right" arrow>
              <span style={{ display: "block" }}>
                <Box component={Link} to={item.path!} aria-current={selected ? "page" : undefined}
                  sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 36, borderRadius: "8px", mb: 0.25, position: "relative", cursor: "pointer",
                    color: selected ? rail.activeText : rail.icon,
                    background: selected ? rail.activeFill : "transparent",
                    textDecoration: "none",
                    "&:hover": { background: selected ? rail.activeFill : rail.hover },
                    "& svg": { fontSize: 18 },
                    ...(selected && { "&::before": { content: '""', position: "absolute", left: 0, top: "22%", height: "56%", width: 3, borderRadius: "0 3px 3px 0", bgcolor: rail.activeBar } }) }}>
                  {item.icon}
                </Box>
              </span>
            </Tooltip>
          );
        }
        return (
          <ListItemButton key={item.label} component={Link} to={item.path!} selected={selected}
            aria-current={selected ? "page" : undefined}
            sx={{ ...navItemSx(selected), justifyContent: "flex-start", pl: 4, pr: 1.5, minHeight: 36 }}>
            <ListItemIcon sx={{ minWidth: 32, display: "flex", alignItems: "center", justifyContent: "center", "& .MuiSvgIcon-root": { fontSize: 17 } }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={
              <Typography sx={{ fontWeight: selected ? 700 : 400, fontSize: "0.8125rem", color: selected ? rail.activeText : rail.text }} noWrap>
                {item.label}
              </Typography>
            } />
          </ListItemButton>
        );
      }

      const selected = isActive(item.path, loc.pathname);

      // Collapsed mode — plain centered Box
      if (!expanded) {
        return (
          <Tooltip key={item.label} title={item.label} placement="right" arrow>
            <span style={{ display: "block" }}>
              <Box
                component={Link}
                to={item.path!}
                aria-current={selected ? "page" : undefined}
                sx={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  height: 44, borderRadius: "10px", mb: 0.5, position: "relative",
                  color: selected ? rail.activeText : rail.icon,
                  background: selected ? rail.activeFill : "transparent",
                  boxShadow: selected ? rail.activeShadow : "none",
                  textDecoration: "none",
                  "&:hover": { background: selected ? rail.activeFill : rail.hover },
                  "& svg": { fontSize: 22 },
                  ...(selected && {
                    "&::before": { content: '""', position: "absolute", left: 0, top: "22%", height: "56%", width: 3, borderRadius: "0 3px 3px 0", bgcolor: rail.activeBar },
                  }),
                }}
              >
                {item.icon}
              </Box>
            </span>
          </Tooltip>
        );
      }

      // Expanded mode — full ListItemButton
      return (
        <ListItemButton
          key={item.label}
          component={Link}
          to={item.path!}
          selected={selected}
          aria-current={selected ? "page" : undefined}
          sx={navItemSx(selected)}
        >
          <ListItemIcon sx={{ minWidth: 40, display: "flex", alignItems: "center", justifyContent: "center", "& .MuiSvgIcon-root": { fontSize: 20 } }}>
            {item.icon}
          </ListItemIcon>
          <ListItemText
            primary={
              <Typography sx={{ fontWeight: selected ? 700 : 500, fontSize: "0.875rem", color: selected ? rail.activeText : rail.text }} noWrap>
                {item.label}
              </Typography>
            }
          />
        </ListItemButton>
      );
    },
    [expanded, loc.pathname, navItemSx, openGroups, toggleGroup]
  );

  const drawerPaperSx = {
    width: drawerWidth,
    boxSizing: "border-box" as const,
    borderRight: "none",
    bgcolor: railSidebarBg,
    backgroundImage: rail.bg,
    overflowX: "hidden" as const,
    overflowY: "auto" as const,
    scrollbarWidth: "none" as const,
    "&::-webkit-scrollbar": { display: "none" },
    transition: muiTheme.transitions.create("width", {
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      duration: 260,
    }),
  };

  const drawerBody = (
    <Box sx={{ p: expanded ? 1.5 : 1, minHeight: "100%", display: "flex", flexDirection: "column" }}>
      {/* Logo plate */}
      <Tooltip title={expanded ? "" : SITE_BRANDING.productName} placement="right" arrow disableHoverListener={expanded}>
        <Box
          sx={{
            mb: 1.5,
            pb: 1.5,
            borderBottom: `1px solid ${rail.divider}`,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Box
            sx={{
              bgcolor: "#FFFFFF",
              borderRadius: "10px",
              px: expanded ? 2 : 0.75,
              py: expanded ? 1.5 : 0.75,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 10px -2px rgba(0,0,0,0.35)",
              overflow: "hidden",
              width: expanded ? "100%" : 44,
              minHeight: expanded ? 64 : 44,
              height: expanded ? "auto" : 44,
              transition: "all 260ms cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <img
              src={`${import.meta.env.BASE_URL}brand/woxsen-logo.png`}
              alt="Woxsen University"
              style={{
                width: expanded ? "100%" : "auto",
                maxWidth: expanded ? 200 : undefined,
                height: expanded ? "auto" : 36,
                display: "block",
                objectFit: "contain",
                transition: "all 260ms cubic-bezier(0.22,1,0.36,1)",
              }}
            />
          </Box>
        </Box>
      </Tooltip>

      {/* Nav list */}
      <List dense sx={{ flex: 1, py: 0 }}>
        {visibleNav.map((item) => renderItem(item))}
      </List>
    </Box>
  );

  const pageTitle = useMemo(() => navPageTitle[loc.pathname] ?? SITE_BRANDING.productShort, [loc.pathname]);
  const pageSubtitle = useMemo(() => navPageSubtitle[loc.pathname], [loc.pathname]);

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar — always permanent, full 100vh */}
      <Box
        component="nav"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          transition: muiTheme.transitions.create("width", {
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            duration: 260,
          }),
        }}
      >
        <Drawer
          variant="permanent"
          open
          sx={{ [`& .MuiDrawer-paper`]: drawerPaperSx }}
        >
          {drawerBody}
        </Drawer>
      </Box>

      {/* Main content column */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          bgcolor: ds.pageBg,
        }}
      >
        {/* Masthead — non-fixed, part of the flex column */}
        <Box
          sx={{
            flexShrink: 0,
            height: ds.mastheadHeight,
            bgcolor: "rgba(255,255,255,0.86)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderBottom: `1px solid ${ds.border}`,
            zIndex: muiTheme.zIndex.appBar,
          }}
        >
          <AppMasthead
            pageTitle={pageTitle}
            pageSubtitle={pageSubtitle}
            userEmail={user?.email}
            userName={user?.name}
            onSignOut={() => { logout(); navigate("/login", { replace: true }); }}
          />
        </Box>

        {/* Scrollable content */}
        <Box
          component="section"
          ref={scrollRef}
          data-scroll-container
          sx={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            display: "flex",
            flexDirection: "column",
            pt: 2,
            px: { xs: 2, md: 3.5 },
            pb: 3.5,
          }}
        >
          <Box sx={{ flex: 1, maxWidth: 1440, width: "100%", mx: "auto" }}>
            <Outlet />
          </Box>
          <AppFooter />
        </Box>
      </Box>
    </Box>
  );
}

export function AppShell() {
  return (
    <ShellHeaderProvider>
      <AppShellInner />
    </ShellHeaderProvider>
  );
}
