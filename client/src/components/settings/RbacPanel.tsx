import { useCallback, useEffect, useState } from "react";
import {
  Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControlLabel, IconButton,
  MenuItem, Paper, Select, Stack, Switch, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import PersonAddAltIcon from "@mui/icons-material/PersonAddAlt";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LockResetIcon from "@mui/icons-material/LockReset";
import { ds } from "../../lib/dsTokens";
import { api } from "../../lib/api";
import { useAuth } from "../../auth/AuthContext";

type Role = "admin" | "user";

interface RbacUser {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  disabledAt: string | null;
  mustChangePassword: boolean;
  pages: string[];
}

interface PageDef {
  key: string;
  label: string;
  group: string;
  route: string;
}

const ROLE_CFG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  admin: { label: "Admin",  color: ds.danger,   bg: ds.dangerSoft,  icon: <ShieldOutlinedIcon sx={{ fontSize: 16 }} /> },
  user:  { label: "Staff",  color: ds.success,  bg: ds.successSoft, icon: <PersonOutlinedIcon sx={{ fontSize: 16 }} /> },
};

function initials(name: string | null, email: string) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return (parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)).toUpperCase();
  }
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]/).filter(Boolean);
  return (parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : local.slice(0, 2)).toUpperCase();
}

const CELL_SX = { py: 1.25, fontSize: "0.8125rem", borderColor: ds.border };
const HEAD_SX = { py: 1, fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", bgcolor: ds.pageBg, color: ds.textSecondary, borderColor: ds.border };

export function RbacPanel() {
  const { user: me } = useAuth();
  const isAdmin = (me?.role ?? "").toLowerCase() === "admin";

  const [users, setUsers]   = useState<RbacUser[]>([]);
  const [pages, setPages]   = useState<PageDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  const [editing, setEditing]   = useState<RbacUser | null>(null);
  const [addOpen, setAddOpen]   = useState(false);
  const [newName,  setNewName]  = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPass,  setNewPass]  = useState("");
  const [newRole,  setNewRole]  = useState<Role>("user");
  const [newPages, setNewPages] = useState<string[]>([]);
  const [newBranch, setNewBranch] = useState("");
  const [saving, setSaving]     = useState(false);
  const [saveErr, setSaveErr]   = useState("");
  const [fieldErrs, setFieldErrs] = useState<Record<string, string>>({});

  const [resetOpen, setResetOpen] = useState<RbacUser | null>(null);
  const [resetPass, setResetPass] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [{ data: u }, { data: p }] = await Promise.all([
        api.get<{ users: RbacUser[] }>("/rbac/users"),
        api.get<{ pages: PageDef[] }>("/rbac/pages"),
      ]);
      setUsers(u.users);
      setPages(p.pages);
    } catch {
      setError("Failed to load users. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const meghaviPages = pages.filter((p) => p.group === "WoxSight Analytics");

  const grouped = meghaviPages.reduce<Record<string, PageDef[]>>((acc, p) => {
    (acc[p.group] ||= []).push(p);
    return acc;
  }, {});

  async function toggleActive(u: RbacUser) {
    const disabled = !u.disabledAt;
    try {
      await api.put(`/rbac/users/${u.id}/status`, { disabled });
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, disabledAt: disabled ? new Date().toISOString() : null } : x));
    } catch (e: unknown) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to update status.");
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true); setSaveErr("");
    try {
      await api.put(`/rbac/users/${editing.id}/pages`, { pages: editing.pages });
      if (editing.role !== users.find(u => u.id === editing.id)?.role) {
        await api.put(`/rbac/users/${editing.id}/role`, { role: editing.role });
      }
      setUsers((prev) => prev.map((u) => u.id === editing.id ? editing : u));
      setEditing(null);
    } catch (e: unknown) {
      setSaveErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function addUser() {
    const errs: Record<string, string> = {};
    if (!newName.trim()) errs.name = "Full name is required.";
    if (!newEmail.trim()) errs.email = "Email is required.";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail.trim())) errs.email = "Enter a valid email address.";
    if (!newPass) errs.pass = "Password is required.";
    else if (newPass.length < 8) errs.pass = "Password must be at least 8 characters.";
    if (newRole !== "admin" && newPages.length === 0) errs.pages = "Select at least one page.";
    if (newRole === "user" && !newBranch) errs.branch = "Branch is required for Staff.";
    setFieldErrs(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true); setSaveErr("");
    try {
      const { data } = await api.post<RbacUser & { ok: boolean }>("/rbac/users", {
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        password: newPass,
        role: newRole,
        pages: newRole === "admin" ? [] : newPages,
        branch: newRole === "user" ? newBranch : null,
        mustChangePassword: true,
      });
      setUsers((prev) => [...prev, { id: data.id, name: data.name, email: data.email, role: data.role, disabledAt: null, mustChangePassword: true, pages: data.pages }]);
      setAddOpen(false);
      setNewName(""); setNewEmail(""); setNewPass(""); setNewRole("user"); setNewPages([]); setNewBranch("");
    } catch (e: unknown) {
      setSaveErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to create user.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(u: RbacUser) {
    if (!window.confirm(`Permanently delete ${u.email}? This cannot be undone.`)) return;
    try {
      await api.delete(`/rbac/users/${u.id}`);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (e: unknown) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Delete failed.");
    }
  }

  async function resetPassword() {
    if (!resetOpen || resetPass.length < 8) return;
    setSaving(true); setSaveErr("");
    try {
      await api.put(`/rbac/users/${resetOpen.id}/password`, { password: resetPass });
      setResetOpen(null); setResetPass("");
    } catch (e: unknown) {
      setSaveErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Reset failed.");
    } finally {
      setSaving(false);
    }
  }

  function togglePage(key: string) {
    if (!editing) return;
    const has = editing.pages.includes(key);
    setEditing({ ...editing, pages: has ? editing.pages.filter((p) => p !== key) : [...editing.pages, key] });
  }

  if (!isAdmin) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography sx={{ color: ds.textSecondary }}>Administrator access required.</Typography>
      </Box>
    );
  }

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress size={28} /></Box>;
  if (error)   return <Box sx={{ p: 3 }}><Typography color="error">{error}</Typography><Button onClick={reload} sx={{ mt: 1 }}>Retry</Button></Box>;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5 }}>
        <Box>
          <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: ds.text }}>Role-Based Access Control</Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: ds.textSecondary, mt: 0.25 }}>Manage users, roles and page-level permissions.</Typography>
        </Box>
        <Button variant="contained" startIcon={<PersonAddAltIcon />} onClick={() => { setSaveErr(""); setFieldErrs({}); setNewName(""); setNewEmail(""); setNewPass(""); setNewRole("user"); setNewPages([]); setNewBranch(""); setAddOpen(true); }} sx={{ borderRadius: "10px", fontWeight: 600 }}>
          Add User
        </Button>
      </Box>

      {/* Role legend */}
      <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }}>
        {Object.entries(ROLE_CFG).map(([role, cfg]) => (
          <Box key={role} sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.5, py: 0.75, borderRadius: "10px", bgcolor: cfg.bg, border: `1px solid ${cfg.color}33` }}>
            {cfg.icon}
            <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: cfg.color }}>{cfg.label}</Typography>
            <Typography sx={{ fontSize: "0.75rem", color: ds.textSecondary }}>
              {role === "admin" ? "— Full access" : "— Page-level access (staff)"}
            </Typography>
          </Box>
        ))}
      </Stack>

      {/* Users table */}
      <Paper elevation={0} sx={{ borderRadius: "14px", border: `1px solid ${ds.border}`, overflow: "hidden" }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={HEAD_SX}>User</TableCell>
                <TableCell sx={HEAD_SX}>Role</TableCell>
                <TableCell sx={{ ...HEAD_SX, display: { xs: "none", md: "table-cell" } }}>Pages</TableCell>
                <TableCell sx={HEAD_SX} align="center">Active</TableCell>
                <TableCell sx={HEAD_SX} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => {
                const rc = ROLE_CFG[u.role] ?? ROLE_CFG.user;
                const active = !u.disabledAt;
                return (
                  <TableRow key={u.id} sx={{ "&:hover": { bgcolor: ds.pageBg }, opacity: active ? 1 : 0.5 }}>
                    <TableCell sx={CELL_SX}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: `${rc.color}22`, color: rc.color, fontSize: "0.75rem", fontWeight: 700 }}>
                          {initials(u.name, u.email)}
                        </Avatar>
                        <Box>
                          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: ds.text, lineHeight: 1.2 }}>{u.name || u.email.split("@")[0]}</Typography>
                          <Typography sx={{ fontSize: "0.6875rem", color: ds.textSecondary }}>{u.email}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={CELL_SX}>
                      <Chip label={rc.label} size="small" sx={{ bgcolor: rc.bg, color: rc.color, fontWeight: 700, fontSize: "0.6875rem", height: 22 }} />
                    </TableCell>
                    <TableCell sx={{ ...CELL_SX, display: { xs: "none", md: "table-cell" } }}>
                      {u.role === "admin"
                        ? <Typography sx={{ fontSize: "0.75rem", color: ds.textMuted, fontStyle: "italic" }}>All pages</Typography>
                        : (() => {
                            const meghaviKeys = new Set(meghaviPages.map((p) => p.key));
                            const count = u.pages.filter((k) => meghaviKeys.has(k)).length;
                            return <Typography sx={{ fontSize: "0.75rem", color: ds.textSecondary }}>{count} / {meghaviPages.length} pages</Typography>;
                          })()
                      }
                    </TableCell>
                    <TableCell sx={CELL_SX} align="center">
                      <Switch size="small" checked={active} onChange={() => toggleActive(u)} disabled={u.id === me?.id} sx={{ "& .MuiSwitch-thumb": { boxShadow: "none" } }} />
                    </TableCell>
                    <TableCell sx={CELL_SX} align="right">
                      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.5 }}>
                        <Tooltip title="Edit permissions">
                          <IconButton size="small" onClick={() => { setSaveErr(""); setEditing({ ...u }); }} sx={{ color: ds.textSecondary, "&:hover": { color: ds.primary } }}>
                            <EditOutlinedIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reset password">
                          <IconButton size="small" onClick={() => { setResetPass(""); setSaveErr(""); setResetOpen(u); }} sx={{ color: ds.textSecondary, "&:hover": { color: ds.warning } }}>
                            <LockResetIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Tooltip>
                        {u.id !== me?.id && (
                          <Tooltip title="Delete user">
                            <IconButton size="small" onClick={() => deleteUser(u)} sx={{ color: ds.textSecondary, "&:hover": { color: ds.danger } }}>
                              <DeleteOutlinedIcon sx={{ fontSize: 17 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Edit dialog */}
      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: "1rem" }}>Edit Permissions — {editing?.email}</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          {editing && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box>
                <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: ds.textSecondary, mb: 1 }}>Role</Typography>
                <Stack direction="row" spacing={1}>
                  {(["admin", "user"] as Role[]).map((r) => {
                    const cfg = ROLE_CFG[r];
                    const sel = editing.role === r;
                    return (
                      <Box key={r} onClick={() => setEditing({ ...editing, role: r, pages: r === "admin" ? meghaviPages.map(p => p.key) : editing.pages })}
                        sx={{ flex: 1, textAlign: "center", py: 1.25, borderRadius: "10px", cursor: "pointer", border: `2px solid ${sel ? cfg.color : ds.border}`, bgcolor: sel ? cfg.bg : "transparent", transition: "all 150ms" }}>
                        <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: sel ? cfg.color : ds.textSecondary }}>{cfg.label}</Typography>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>

              {editing.role !== "admin" ? (
                <Box>
                  <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: ds.textSecondary, mb: 1 }}>Page Access</Typography>
                  {Object.entries(grouped).map(([group, gPages]) => (
                    <Box key={group} sx={{ mb: 1.5 }}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                        <Typography sx={{ fontSize: "0.625rem", fontWeight: 800, color: ds.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{group}</Typography>
                        <Button size="small" sx={{ fontSize: "0.6875rem", py: 0, minWidth: 0, color: ds.primary }}
                          onClick={() => {
                            const keys = gPages.map((p) => p.key);
                            const allOn = keys.every((k) => editing.pages.includes(k));
                            setEditing({ ...editing, pages: allOn ? editing.pages.filter((k) => !keys.includes(k)) : [...new Set([...editing.pages, ...keys])] });
                          }}>
                          {gPages.every((p) => editing.pages.includes(p.key)) ? "Clear all" : "Select all"}
                        </Button>
                      </Box>
                      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.25 }}>
                        {gPages.map((p) => (
                          <FormControlLabel key={p.key}
                            control={<Switch size="small" checked={editing.pages.includes(p.key)} onChange={() => togglePage(p.key)} />}
                            label={<Box><Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: ds.text }}>{p.label}</Typography><Typography sx={{ fontSize: "0.6875rem", color: ds.textMuted }}>{p.route}</Typography></Box>}
                            sx={{ alignItems: "flex-start", mr: 0, py: 0.5 }} />
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.5, borderRadius: "10px", bgcolor: `${ds.success}0D`, border: `1px solid ${ds.success}26` }}>
                  <CheckCircleOutlineIcon sx={{ fontSize: 18, color: ds.success }} />
                  <Typography sx={{ fontSize: "0.8125rem", color: ds.success, fontWeight: 600 }}>Admins have access to all pages automatically.</Typography>
                </Box>
              )}
              {saveErr && <Typography sx={{ fontSize: "0.8125rem", color: ds.danger }}>{saveErr}</Typography>}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditing(null)} sx={{ color: ds.textSecondary }}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit} disabled={saving} sx={{ borderRadius: "10px" }}>
            {saving ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add user dialog */}
      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setFieldErrs({}); setSaveErr(""); }} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: "1rem" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}><LockOutlinedIcon sx={{ fontSize: 20, color: ds.primary }} />Add New User</Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField label="Full Name *" size="small" fullWidth value={newName}
              onChange={(e) => { setNewName(e.target.value); setFieldErrs((p) => ({ ...p, name: "" })); }}
              error={!!fieldErrs.name} helperText={fieldErrs.name} placeholder="e.g. Priya Sharma" />
            <TextField label="Email Address *" size="small" fullWidth type="email" value={newEmail}
              onChange={(e) => { setNewEmail(e.target.value); setFieldErrs((p) => ({ ...p, email: "" })); }}
              error={!!fieldErrs.email} helperText={fieldErrs.email} />
            <TextField label="Temporary Password *" size="small" fullWidth type="password" value={newPass}
              onChange={(e) => { setNewPass(e.target.value); setFieldErrs((p) => ({ ...p, pass: "" })); }}
              error={!!fieldErrs.pass} helperText={fieldErrs.pass || "Min 8 characters. User must change on first login."} />
            <Box>
              <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: ds.textSecondary, mb: 1 }}>Role *</Typography>
              <Stack direction="row" spacing={1}>
                {(["admin", "user"] as Role[]).map((r) => {
                  const cfg = ROLE_CFG[r];
                  const sel = newRole === r;
                  return (
                    <Box key={r} onClick={() => { setNewRole(r); setNewPages([]); setFieldErrs((p) => ({ ...p, pages: "" })); }}
                      sx={{ flex: 1, textAlign: "center", py: 1, borderRadius: "10px", cursor: "pointer", border: `2px solid ${sel ? cfg.color : ds.border}`, bgcolor: sel ? cfg.bg : "transparent", transition: "all 150ms" }}>
                      <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: sel ? cfg.color : ds.textSecondary }}>{cfg.label}</Typography>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
            {newRole === "user" && (
              <Box>
                <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: fieldErrs.branch ? ds.danger : ds.textSecondary, mb: 0.75 }}>
                  Branch / Area *
                </Typography>
                <Select size="small" fullWidth displayEmpty value={newBranch}
                  onChange={(e) => { setNewBranch(e.target.value); setFieldErrs((fe) => ({ ...fe, branch: "" })); }}
                  error={!!fieldErrs.branch}
                  sx={{ fontSize: "0.875rem" }}>
                  <MenuItem value="" disabled><em style={{ color: "#94A3B8" }}>Select branch…</em></MenuItem>
                  <MenuItem value="Woxsen">Woxsen</MenuItem>
                </Select>
                {fieldErrs.branch && <Typography sx={{ fontSize: "0.75rem", color: ds.danger, mt: 0.5 }}>{fieldErrs.branch}</Typography>}
              </Box>
            )}
            {newRole !== "admin" && meghaviPages.length > 0 && (
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
                  <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: fieldErrs.pages ? ds.danger : ds.textSecondary }}>
                    Page Access *
                  </Typography>
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    <Button size="small" sx={{ fontSize: "0.6875rem", py: 0, minWidth: 0, color: ds.primary }}
                      onClick={() => { setNewPages(meghaviPages.map((p) => p.key)); setFieldErrs((p) => ({ ...p, pages: "" })); }}>
                      Select All
                    </Button>
                    <Button size="small" sx={{ fontSize: "0.6875rem", py: 0, minWidth: 0, color: ds.textSecondary }}
                      onClick={() => setNewPages([])}>
                      Clear
                    </Button>
                  </Box>
                </Box>
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                  {meghaviPages.map((p) => (
                    <Chip key={p.key} label={p.label} size="small"
                      onClick={() => { setNewPages((prev) => prev.includes(p.key) ? prev.filter((k) => k !== p.key) : [...prev, p.key]); setFieldErrs((fe) => ({ ...fe, pages: "" })); }}
                      color={newPages.includes(p.key) ? "primary" : "default"}
                      sx={{ fontSize: "0.6875rem", cursor: "pointer" }} />
                  ))}
                </Box>
                {fieldErrs.pages && <Typography sx={{ fontSize: "0.75rem", color: ds.danger, mt: 0.5 }}>{fieldErrs.pages}</Typography>}
              </Box>
            )}
            {saveErr && <Typography sx={{ fontSize: "0.8125rem", color: ds.danger }}>{saveErr}</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setAddOpen(false); setFieldErrs({}); setSaveErr(""); }} sx={{ color: ds.textSecondary }}>Cancel</Button>
          <Button variant="contained" onClick={addUser} disabled={saving} sx={{ borderRadius: "10px" }}>
            {saving ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Add User"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetOpen} onClose={() => setResetOpen(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: "1rem" }}>Reset Password — {resetOpen?.email}</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField label="New Password" size="small" fullWidth type="password" value={resetPass} onChange={(e) => setResetPass(e.target.value)} helperText="Min 8 characters." />
            {saveErr && <Typography sx={{ fontSize: "0.8125rem", color: ds.danger }}>{saveErr}</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setResetOpen(null)} sx={{ color: ds.textSecondary }}>Cancel</Button>
          <Button variant="contained" onClick={resetPassword} disabled={saving || resetPass.length < 8} sx={{ borderRadius: "10px" }}>
            {saving ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Reset Password"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
