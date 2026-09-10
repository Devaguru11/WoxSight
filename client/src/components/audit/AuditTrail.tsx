import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, TextField,
  MenuItem, IconButton, Tooltip, CircularProgress,
  Pagination, InputAdornment,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import DownloadIcon from "@mui/icons-material/Download";
import FilterListIcon from "@mui/icons-material/FilterList";
import { api } from "../../lib/api";
import { ds } from "../../lib/dsTokens";
import { contentCardSx } from "../../lib/uiSurfaces";
import { actionLabel, fmtWhen, ago, OUTCOME_COLOR, MODULE_LABELS, avatarTone, avatarInitials } from "../../lib/auditActions";

interface AuditEvent {
  id: number;
  occurred_at: string;
  actor_id: number;
  actor_email: string;
  actor_role: string;
  session_id: string;
  module: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  outcome: string;
  ip_address: string | null;
  changes: Record<string, unknown> | null;
}

interface Facets {
  modules: string[];
  actors: { actor_id: number; actor_email: string }[];
}

const PAGE_SIZE = 50;

interface Props {
  actorId?: number;
}

export function AuditTrail({ actorId }: Props) {
  const [events, setEvents]     = useState<AuditEvent[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [facets, setFacets]     = useState<Facets>({ modules: [], actors: [] });

  const [filterModule,  setFilterModule]  = useState("");
  const [filterOutcome, setFilterOutcome] = useState("");
  const [filterFrom,    setFilterFrom]    = useState("");
  const [filterTo,      setFilterTo]      = useState("");
  const [filterAction,  setFilterAction]  = useState("");

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: PAGE_SIZE, offset: (p - 1) * PAGE_SIZE };
      if (actorId)       params.actor_id = actorId;
      if (filterModule)  params.module   = filterModule;
      if (filterOutcome) params.outcome  = filterOutcome;
      if (filterFrom)    params.from     = filterFrom + "T00:00:00+05:30";
      if (filterTo)      params.to       = filterTo   + "T23:59:59+05:30";
      if (filterAction)  params.action   = filterAction;

      const { data } = await api.get("/audit/events", { params });
      setEvents(data.events ?? []);
      setTotal(data.total ?? 0);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [actorId, filterModule, filterOutcome, filterFrom, filterTo, filterAction]);

  useEffect(() => { setPage(1); }, [filterModule, filterOutcome, filterFrom, filterTo, filterAction, actorId]);
  useEffect(() => { load(page); }, [load, page]);

  useEffect(() => {
    api.get("/audit/facets").then(({ data }) => setFacets(data)).catch(() => {});
  }, []);

  const exportCsv = () => {
    const params = new URLSearchParams();
    if (actorId)       params.set("actor_id", String(actorId));
    if (filterModule)  params.set("module",   filterModule);
    if (filterOutcome) params.set("outcome",  filterOutcome);
    if (filterFrom)    params.set("from",     filterFrom + "T00:00:00+05:30");
    if (filterTo)      params.set("to",       filterTo   + "T23:59:59+05:30");
    const base = (import.meta.env.VITE_API_BASE ?? `${window.location.origin}/api`).replace(/\/$/, "");
    window.open(`${base}/audit/events/export?${params}`, "_blank");
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Filters */}
      <Paper elevation={0} sx={{ ...contentCardSx, p: 2 }}>
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          <FilterListIcon sx={{ color: ds.textMuted, fontSize: 18 }} />
          <TextField
            select size="small" value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            sx={{ minWidth: 140 }}
            slotProps={{ select: { displayEmpty: true } }}
          >
            <MenuItem value=""><em style={{ fontStyle: "normal", color: "#94a3b8" }}>All Modules</em></MenuItem>
            {facets.modules.map((m) => <MenuItem key={m} value={m}>{MODULE_LABELS[m] ?? m}</MenuItem>)}
          </TextField>
          <TextField
            select size="small" value={filterOutcome}
            onChange={(e) => setFilterOutcome(e.target.value)}
            sx={{ minWidth: 120 }}
            slotProps={{ select: { displayEmpty: true } }}
          >
            <MenuItem value=""><em style={{ fontStyle: "normal", color: "#94a3b8" }}>All Outcomes</em></MenuItem>
            <MenuItem value="success">Success</MenuItem>
            <MenuItem value="failure">Failure</MenuItem>
            <MenuItem value="denied">Denied</MenuItem>
          </TextField>
          <TextField size="small" placeholder="Action contains"
            value={filterAction} onChange={(e) => setFilterAction(e.target.value)}
            sx={{ minWidth: 160 }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16 }} /></InputAdornment> } }}
          />
          <TextField size="small" type="date" label="From" value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)} sx={{ minWidth: 140 }}
            slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" type="date" label="To" value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)} sx={{ minWidth: 140 }}
            slotProps={{ inputLabel: { shrink: true } }} />
          <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>
            <Tooltip title="Export CSV">
              <IconButton size="small" onClick={exportCsv} sx={{ border: `1px solid ${ds.border}`, borderRadius: "8px" }}>
                <DownloadIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        <Typography sx={{ mt: 1, fontSize: "0.75rem", color: ds.textMuted }}>
          {loading ? "Loading…" : `${total.toLocaleString()} events`}
        </Typography>
      </Paper>

      {/* Table */}
      <Paper elevation={0} sx={{ ...contentCardSx, p: 0, overflow: "hidden" }}>
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 780 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: `${ds.primary}08` }}>
                {["When", "Actor", "Module", "Action", "Resource", "Outcome", "IP"].map((h) => (
                  <TableCell key={h} sx={{ fontSize: "0.6875rem", fontWeight: 700, color: ds.textSecondary, letterSpacing: "0.06em", textTransform: "uppercase", py: 1.25, borderBottom: `1px solid ${ds.border}` }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && events.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: "center", py: 4 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              )}
              {!loading && events.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: "center", py: 4, color: ds.textMuted, fontSize: "0.8125rem" }}>
                    No events found for the selected filters.
                  </TableCell>
                </TableRow>
              )}
              {events.map((ev) => (
                <TableRow key={ev.id} sx={{ "&:hover": { bgcolor: `${ds.primary}06` } }}>
                  {/* When */}
                  <TableCell sx={{ fontSize: "0.75rem", color: ds.textSecondary, whiteSpace: "nowrap", py: 1, width: 90 }}>
                    <Tooltip title={fmtWhen(ev.occurred_at)}>
                      <span>{ago(ev.occurred_at)}</span>
                    </Tooltip>
                  </TableCell>
                  {/* Actor */}
                  <TableCell sx={{ py: 1, maxWidth: 180, width: 180 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                      <Box sx={{ width: 26, height: 26, borderRadius: "50%", bgcolor: avatarTone(ev.actor_email ?? ""), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Typography sx={{ fontSize: "0.625rem", fontWeight: 700, color: "#fff" }}>
                          {avatarInitials(ev.actor_email ?? "?")}
                        </Typography>
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Tooltip title={ev.actor_email ?? ""}>
                          <Typography noWrap sx={{ fontSize: "0.75rem", fontWeight: 600, color: ds.text, lineHeight: 1.2 }}>{ev.actor_email ?? "—"}</Typography>
                        </Tooltip>
                        <Typography sx={{ fontSize: "0.6875rem", color: ds.textMuted, lineHeight: 1.2 }}>{ev.actor_role ?? ""}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  {/* Module */}
                  <TableCell sx={{ py: 1, width: 110, whiteSpace: "nowrap" }}>
                    <Chip label={MODULE_LABELS[ev.module] ?? ev.module} size="small" sx={{ fontSize: "0.6875rem", height: 20, bgcolor: `${ds.primary}12`, color: ds.primary, fontWeight: 600 }} />
                  </TableCell>
                  {/* Action */}
                  <TableCell sx={{ fontSize: "0.8125rem", color: ds.text, py: 1, maxWidth: 160 }}>
                    <Tooltip title={ev.action}>
                      <Typography noWrap sx={{ fontSize: "0.8125rem", color: ds.text }}>{actionLabel(ev.action)}</Typography>
                    </Tooltip>
                  </TableCell>
                  {/* Resource */}
                  <TableCell sx={{ py: 1, maxWidth: 130 }}>
                    <Tooltip title={`${ev.resource_type ?? ""} ${ev.resource_id ?? ""}`.trim()}>
                      <Box sx={{ overflow: "hidden" }}>
                        {ev.resource_type && <Typography component="span" sx={{ color: ds.textMuted, fontSize: "0.6875rem" }}>{ev.resource_type} </Typography>}
                        <Typography component="span" noWrap sx={{ fontSize: "0.75rem", color: ds.textSecondary, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.resource_id ?? "—"}</Typography>
                      </Box>
                    </Tooltip>
                  </TableCell>
                  {/* Outcome */}
                  <TableCell sx={{ py: 1, width: 80, whiteSpace: "nowrap" }}>
                    <Chip
                      label={ev.outcome}
                      size="small"
                      sx={{ fontSize: "0.6875rem", height: 20, fontWeight: 700, bgcolor: `${OUTCOME_COLOR[ev.outcome] ?? ds.textMuted}1A`, color: OUTCOME_COLOR[ev.outcome] ?? ds.textMuted }}
                    />
                  </TableCell>
                  {/* IP */}
                  <TableCell sx={{ fontSize: "0.6875rem", color: ds.textMuted, py: 1, fontFamily: "monospace", whiteSpace: "nowrap", width: 110 }}>{ev.ip_address ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {totalPages > 1 && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 1.5, borderTop: `1px solid ${ds.border}` }}>
            <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} size="small" />
          </Box>
        )}
      </Paper>
    </Box>
  );
}
