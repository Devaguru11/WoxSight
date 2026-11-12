import { useEffect, useState } from "react";
import {
  Avatar, Box, Chip, CircularProgress, InputAdornment,
  Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import BlockIcon from "@mui/icons-material/Block";
import { api } from "../lib/api";

interface StaffUser {
  id: number;
  email: string;
  name: string | null;
  role: string;
  branch: string | null;
  disabledAt: string | null;
  createdAt: string;
  pages: string[];
}

function deriveName(email: string) {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function avatarLetters(name: string | null, email: string) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return (parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)).toUpperCase();
  }
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  return (parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : local.slice(0, 2)).toUpperCase();
}


const HEAD_SX = { fontWeight: 700, color: "#475569", fontSize: "0.75rem", textTransform: "uppercase" as const, letterSpacing: "0.05em" };
const CELL_SX = { fontSize: "0.8125rem", py: 1.5, borderColor: "#E2ECE9" };

export function StaffPage() {
  const [staff, setStaff]       = useState<StaffUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");

  useEffect(() => {
    api.get<{ staff: StaffUser[] }>("/rbac/staff")
      .then(({ data }) => setStaff(data.staff))
      .catch(() => setError("Failed to load staff directory."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = staff.filter((s) => {
    const q = search.toLowerCase();
    const displayName = s.name || deriveName(s.email);
    return (
      s.email.toLowerCase().includes(q) ||
      displayName.toLowerCase().includes(q) ||
      (s.branch ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, width: "100%", pb: 3 }}>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5 }}>
        <Box>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0A4D52" }}>
            Staff Directory & Roster
          </Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "#64748B", mt: 0.25 }}>
            System accounts for faculty, security staff, and administrators
          </Typography>
        </Box>
        <TextField
          size="small"
          placeholder="Search by name, email or area…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ fontSize: 18, color: "#94A3B8" }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ bgcolor: "#FFFFFF", borderRadius: "8px", width: { xs: "100%", sm: 280 } }}
        />
      </Box>

      {/* Summary chips */}
      {!loading && !error && (
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          <Chip label={`${staff.length} Staff Members`} size="small" sx={{ bgcolor: "#F0FDF4", color: "#059669", fontWeight: 700, border: "1px solid #BBF7D0" }} />
          <Chip label={`${staff.filter((s) => !s.disabledAt).length} Active`} size="small" sx={{ bgcolor: "#EFF6FF", color: "#2563EB", fontWeight: 700, border: "1px solid #BFDBFE" }} />
          {staff.filter((s) => s.disabledAt).length > 0 && (
            <Chip label={`${staff.filter((s) => s.disabledAt).length} Inactive`} size="small" sx={{ bgcolor: "#FEF2F2", color: "#DC2626", fontWeight: 700, border: "1px solid #FECACA" }} />
          )}
        </Box>
      )}

      {/* Table */}
      <Paper elevation={0} sx={{ borderRadius: "14px", bgcolor: "#FFFFFF", border: "1px solid #E2ECE9", boxShadow: "0 1px 4px rgba(10,77,82,0.05)", overflow: "hidden" }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: "#F8FAFC" }}>
              <TableRow>
                <TableCell sx={HEAD_SX}>Staff Member</TableCell>
                <TableCell sx={HEAD_SX}>Role</TableCell>
                <TableCell sx={{ ...HEAD_SX, display: { xs: "none", md: "table-cell" } }}>Branch</TableCell>
                <TableCell sx={{ ...HEAD_SX, display: { xs: "none", sm: "table-cell" } }}>Pages Access</TableCell>
                <TableCell sx={{ ...HEAD_SX, display: { xs: "none", lg: "table-cell" } }}>Member Since</TableCell>
                <TableCell sx={HEAD_SX} align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: "center", py: 6 }}>
                    <CircularProgress size={24} sx={{ color: "#0D9488" }} />
                  </TableCell>
                </TableRow>
              )}
              {error && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: "center", py: 6, color: "#DC2626", fontSize: "0.875rem" }}>
                    {error}
                  </TableCell>
                </TableRow>
              )}
              {!loading && !error && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: "center", py: 6, color: "#94A3B8", fontSize: "0.875rem" }}>
                    {search ? "No staff match your search." : "No staff accounts found. Add staff members in Settings → Roles & Access."}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((s) => {
                const active = !s.disabledAt;
                const name   = s.name || deriveName(s.email);
                const area   = s.branch || "—";
                return (
                  <TableRow key={s.id} sx={{ "&:hover": { bgcolor: "#F8FAFB" }, opacity: active ? 1 : 0.6 }}>
                    <TableCell sx={CELL_SX}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Avatar sx={{ bgcolor: active ? "#0D9488" : "#94A3B8", color: "#fff", fontWeight: 700, fontSize: "0.8125rem", width: 36, height: 36 }}>
                          {avatarLetters(s.name, s.email)}
                        </Avatar>
                        <Box>
                          <Typography sx={{ fontWeight: 700, fontSize: "0.875rem", color: "#1E293B", lineHeight: 1.2 }}>{name}</Typography>
                          <Typography sx={{ fontSize: "0.75rem", color: "#64748B" }}>{s.email}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={CELL_SX}>
                      <Chip label="Staff" size="small" sx={{ bgcolor: "#F0FDF4", color: "#059669", fontWeight: 700, fontSize: "0.6875rem", height: 22 }} />
                    </TableCell>
                    <TableCell sx={{ ...CELL_SX, display: { xs: "none", md: "table-cell" } }}>
                      <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "#334155" }}>{area}</Typography>
                    </TableCell>
                    <TableCell sx={{ ...CELL_SX, display: { xs: "none", sm: "table-cell" } }}>
                      <Tooltip title={s.pages.join(", ") || "No pages assigned"} placement="top">
                        <Typography sx={{ fontSize: "0.8125rem", color: s.pages.length ? "#334155" : "#94A3B8", cursor: "default" }}>
                          {s.pages.length > 0 ? `${s.pages.length} page${s.pages.length !== 1 ? "s" : ""}` : "None assigned"}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ ...CELL_SX, display: { xs: "none", lg: "table-cell" } }}>
                      <Typography sx={{ fontSize: "0.8125rem", color: "#64748B" }}>
                        {s.createdAt ? new Date(s.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </Typography>
                    </TableCell>
                    <TableCell sx={CELL_SX} align="center">
                      {active ? (
                        <Chip icon={<CheckCircleOutlineIcon sx={{ fontSize: "14px !important" }} />} label="Active" size="small"
                          sx={{ bgcolor: "#ECFDF5", color: "#059669", fontWeight: 700, border: "1px solid #A7F3D0", "& .MuiChip-icon": { color: "#059669" } }} />
                      ) : (
                        <Chip icon={<BlockIcon sx={{ fontSize: "14px !important" }} />} label="Inactive" size="small"
                          sx={{ bgcolor: "#FEF2F2", color: "#DC2626", fontWeight: 700, border: "1px solid #FECACA", "& .MuiChip-icon": { color: "#DC2626" } }} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
