import { useState, useEffect } from "react";
import {
  Box, Typography, Paper, List, ListItemButton,
  CircularProgress, Chip, Tab, Tabs, Divider,
  Table, TableBody, TableCell, TableHead, TableRow,
  TableContainer, Tooltip, IconButton,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { api } from "../../lib/api";
import { ds } from "../../lib/dsTokens";
import { contentCardSx } from "../../lib/uiSurfaces";
import { actionLabel, fmtWhen, ago, OUTCOME_COLOR, MODULE_LABELS, avatarTone, avatarInitials } from "../../lib/auditActions";
import { AuditTrail } from "./AuditTrail";

interface AuditUser {
  id: number;
  email: string;
  role: string;
  disabled: boolean;
  event_count: number;
  last_seen: string | null;
  last_login: string | null;
  failure_count: number;
}

interface TimelineEvent {
  id: number;
  occurred_at: string;
  kind: "audit" | "login";
  module: string;
  action: string;
  outcome: string;
  ip_address: string | null;
  session_id: string | null;
  resource_type: string | null;
  resource_id: string | null;
  changes: unknown;
}

interface Session {
  session_id: string;
  started_at: string;
  last_active: string;
  event_count: number;
  ip_address: string | null;
}

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  return <Box hidden={value !== index} sx={{ pt: 2 }}>{value === index && children}</Box>;
}

function UserDetail({ user }: { user: AuditUser }) {
  const [tab, setTab]           = useState(0);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/audit/users/${user.id}/timeline`, { params: { limit: 50 } }),
      api.get(`/audit/users/${user.id}/sessions`),
    ]).then(([t, s]) => {
      setTimeline(t.data.events ?? []);
      setSessions(s.data.sessions ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user.id]);

  const exportUser = () => {
    const base = (import.meta.env.VITE_API_BASE ?? `${window.location.origin}/api`).replace(/\/$/, "");
    window.open(`${base}/audit/users/${user.id}/export`, "_blank");
  };

  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      {/* User header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Box sx={{ width: 44, height: 44, borderRadius: "50%", bgcolor: avatarTone(user.email), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: "#fff" }}>
            {avatarInitials(user.email)}
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: ds.text }}>{user.email}</Typography>
            {user.disabled && <Chip label="Disabled" size="small" sx={{ fontSize: "0.625rem", height: 18, bgcolor: "#fee2e2", color: "#dc2626", fontWeight: 700 }} />}
          </Box>
          <Typography sx={{ fontSize: "0.75rem", color: ds.textSecondary }}>
            {user.role} · {Number(user.event_count).toLocaleString()} event{Number(user.event_count) !== 1 ? "s" : ""}
            {user.last_seen ? ` · last action ${ago(user.last_seen)}` : user.last_login ? ` · last login ${ago(user.last_login)}` : " · no activity yet"}
            {user.failure_count > 0 && <span style={{ color: OUTCOME_COLOR.failure, marginLeft: 8 }}>· {user.failure_count} failure{Number(user.failure_count) !== 1 ? "s" : ""}</span>}
          </Typography>
        </Box>
        <Tooltip title="Export CSV">
          <IconButton size="small" onClick={exportUser} sx={{ border: `1px solid ${ds.border}`, borderRadius: "8px" }}>
            <DownloadIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: `1px solid ${ds.border}`, minHeight: 38, "& .MuiTab-root": { fontSize: "0.8125rem", minHeight: 38, py: 0 } }}>
        <Tab label="Timeline" />
        <Tab label="Sessions" />
        <Tab label="All Events" />
      </Tabs>

      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={22} /></Box>}

      {/* Timeline tab */}
      <TabPanel value={tab} index={0}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, maxHeight: 420, overflowY: "auto" }}>
          {timeline.length === 0 && !loading && (
            <Typography sx={{ fontSize: "0.8125rem", color: ds.textMuted, textAlign: "center", py: 3 }}>No events found.</Typography>
          )}
          {timeline.map((ev) => (
            <Box key={`${ev.kind}-${ev.id}`} sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, p: 1.25, borderRadius: "8px", border: `1px solid ${ds.border}`, bgcolor: ev.kind === "login" ? `${ds.primary}06` : "transparent" }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", mt: "4px", flexShrink: 0, bgcolor: ev.kind === "login" ? ds.primary : (OUTCOME_COLOR[ev.outcome] ?? ds.textMuted) }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                  <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: ds.text }}>{actionLabel(ev.action)}</Typography>
                  <Chip label={MODULE_LABELS[ev.module] ?? ev.module} size="small" sx={{ fontSize: "0.625rem", height: 18, bgcolor: `${ds.primary}10`, color: ds.primary }} />
                  <Chip label={ev.outcome} size="small" sx={{ fontSize: "0.625rem", height: 18, bgcolor: `${OUTCOME_COLOR[ev.outcome] ?? ds.textMuted}1A`, color: OUTCOME_COLOR[ev.outcome] ?? ds.textMuted }} />
                </Box>
                {(ev.resource_type || ev.resource_id) && (
                  <Typography sx={{ fontSize: "0.6875rem", color: ds.textMuted, mt: 0.25 }}>
                    {ev.resource_type ?? ""} {ev.resource_id ?? ""}
                  </Typography>
                )}
              </Box>
              <Tooltip title={fmtWhen(ev.occurred_at)}>
                <Typography sx={{ fontSize: "0.6875rem", color: ds.textMuted, whiteSpace: "nowrap", flexShrink: 0 }}>
                  {ago(ev.occurred_at)}
                </Typography>
              </Tooltip>
            </Box>
          ))}
        </Box>
      </TabPanel>

      {/* Sessions tab */}
      <TabPanel value={tab} index={1}>
        <TableContainer sx={{ maxHeight: 420, overflowY: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {["Session", "Started", "Last active", "Events", "IP"].map((h) => (
                  <TableCell key={h} sx={{ fontSize: "0.6875rem", fontWeight: 700, color: ds.textSecondary, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.length === 0 && !loading && (
                <TableRow><TableCell colSpan={5} sx={{ textAlign: "center", py: 3, color: ds.textMuted, fontSize: "0.8125rem" }}>No sessions found.</TableCell></TableRow>
              )}
              {sessions.map((s) => (
                <TableRow key={s.session_id} sx={{ "&:hover": { bgcolor: `${ds.primary}06` } }}>
                  <TableCell sx={{ fontSize: "0.6875rem", fontFamily: "monospace", color: ds.textSecondary }}>{s.session_id}</TableCell>
                  <TableCell sx={{ fontSize: "0.75rem", color: ds.text, whiteSpace: "nowrap" }}>{fmtWhen(s.started_at)}</TableCell>
                  <TableCell sx={{ fontSize: "0.75rem", color: ds.textSecondary, whiteSpace: "nowrap" }}><Tooltip title={fmtWhen(s.last_active)}><span>{ago(s.last_active)}</span></Tooltip></TableCell>
                  <TableCell sx={{ fontSize: "0.8125rem", fontWeight: 600, color: ds.text }}>{s.event_count}</TableCell>
                  <TableCell sx={{ fontSize: "0.6875rem", fontFamily: "monospace", color: ds.textMuted }}>{s.ip_address ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* All Events tab */}
      <TabPanel value={tab} index={2}>
        <AuditTrail actorId={user.id} />
      </TabPanel>
    </Box>
  );
}

export function UserAuditExplorer() {
  const [users, setUsers]       = useState<AuditUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<AuditUser | null>(null);

  useEffect(() => {
    api.get("/audit/users")
      .then(({ data }) => { setUsers(data.users ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", minHeight: 480 }}>
      {/* Left: user roster */}
      <Paper elevation={0} sx={{ ...contentCardSx, width: 260, flexShrink: 0, p: 0, overflow: "hidden" }}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${ds.border}` }}>
          <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: ds.textSecondary, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Users
          </Typography>
        </Box>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={22} /></Box>
        ) : (
          <List dense sx={{ py: 0, maxHeight: 520, overflowY: "auto" }}>
            {users.length === 0 && (
              <Typography sx={{ fontSize: "0.8125rem", color: ds.textMuted, textAlign: "center", py: 3 }}>No users found.</Typography>
            )}
            {users.map((u) => (
              <ListItemButton
                key={u.id}
                selected={selected?.id === u.id}
                onClick={() => setSelected(u)}
                sx={{ px: 1.5, py: 1, borderBottom: `1px solid ${ds.border}`, opacity: u.disabled ? 0.6 : 1, "&.Mui-selected": { bgcolor: `${ds.primary}10` } }}
              >
                <Box sx={{ width: 32, height: 32, borderRadius: "50%", bgcolor: avatarTone(u.email), display: "flex", alignItems: "center", justifyContent: "center", mr: 1.25, flexShrink: 0 }}>
                  <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: "#fff" }}>{avatarInitials(u.email)}</Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: ds.text }} noWrap>{u.email.split("@")[0]}</Typography>
                  <Typography sx={{ fontSize: "0.6875rem", color: ds.textMuted }} noWrap>
                    {u.role}{u.disabled ? " · disabled" : ""}
                    {(u.last_seen || u.last_login) ? ` · ${ago(u.last_seen ?? u.last_login)}` : " · never active"}
                  </Typography>
                </Box>
                <Chip label={u.event_count} size="small" sx={{ fontSize: "0.625rem", height: 18, bgcolor: Number(u.event_count) === 0 ? ds.border : undefined }} />
              </ListItemButton>
            ))}
          </List>
        )}
      </Paper>

      {/* Right: detail */}
      <Paper elevation={0} sx={{ ...contentCardSx, flex: 1, minWidth: 0, p: 2 }}>
        {selected ? (
          <UserDetail user={selected} />
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 300 }}>
            <Typography sx={{ fontSize: "0.875rem", color: ds.textMuted }}>Select a user to view their audit history.</Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
