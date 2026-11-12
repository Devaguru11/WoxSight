import { useState } from "react";
import { isAxiosError } from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { useAuth } from "../../auth/AuthContext";
import { SITE_BRANDING, SITE_LABELS } from "../../i18n/lang";
import { ds } from "../../lib/dsTokens";
import { loginPalette } from "./loginTheme";


const fieldSx = {
  "& .MuiInputLabel-root": { fontSize: "0.875rem", fontWeight: 500, color: ds.textSecondary },
  "& .MuiOutlinedInput-root": {
    borderRadius: `${ds.inputRadius}px`,
    bgcolor: ds.cardBg,
    fontSize: "0.875rem",
    "& fieldset": { borderColor: ds.border },
    "&:hover fieldset": { borderColor: "#CBD5E1" },
    "&.Mui-focused fieldset": { borderColor: ds.primary, borderWidth: "2px" },
    "&.Mui-focused": { boxShadow: ds.focusRing },
  },
};

const ROLE_OPTIONS = [
  { role: "admin" as const, label: "Admin",    description: "Full system access",        color: ds.primary,  bg: `${ds.primary}10`,  border: `${ds.primary}30`  },
  { role: "staff" as const, label: "Staff",    description: "Assigned pages only",       color: "#059669",   bg: "#F0FDF4",          border: "#BBF7D0"          },
];

export function LoginSecureSignIn() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [selectedRole, setSelectedRole] = useState<"admin" | "staff">("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activeRole = ROLE_OPTIONS.find((r) => r.role === selectedRole)!;

  const submit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      const dest = loc.state?.from && loc.state.from !== "/login" ? loc.state.from : "/dashboard";
      navigate(dest, { replace: true });
    } catch (e: unknown) {
      if (isAxiosError(e)) {
        const msg =
          (e.response?.data as { message?: string })?.message ||
          (e.response?.data as { error?: string })?.error ||
          e.message;
        setErr(typeof msg === "string" ? msg : SITE_LABELS.signInFailed);
      } else {
        setErr(SITE_LABELS.signInFailed);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      sx={{
        bgcolor: loginPalette.rightBg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        px: { xs: 2, sm: 4, lg: 6 },
        py: 4,
        minHeight: { xs: "100vh", lg: "auto" },
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 380 }}>
        {/* Logo for mobile (hidden on lg+, shown on left panel there) */}
        <Box
          sx={{
            display: { xs: "flex", lg: "none" },
            justifyContent: "center",
            mb: 3,
          }}
        >
          <Box
            sx={{
              bgcolor: "#FFFFFF",
              borderRadius: "10px",
              px: 2,
              py: 1.25,
              boxShadow: ds.cardShadow,
              border: `1px solid ${ds.border}`,
            }}
          >
            <img
              src={`${import.meta.env.BASE_URL}brand/woxsen-logo.png`}
              alt="Woxsen University"
              style={{ height: 32, width: "auto" }}
            />
          </Box>
        </Box>

        {/* Role selector */}
        <Stack direction="row" spacing={1.25} sx={{ mb: 3 }}>
          {ROLE_OPTIONS.map((opt) => {
            const sel = selectedRole === opt.role;
            return (
              <Box
                key={opt.role}
                onClick={() => { setSelectedRole(opt.role); setEmail(""); setPassword(""); setErr(null); }}
                sx={{
                  flex: 1,
                  p: 1.5,
                  borderRadius: "12px",
                  border: `2px solid ${sel ? opt.color : ds.border}`,
                  bgcolor: sel ? opt.bg : "transparent",
                  cursor: "pointer",
                  transition: "all 150ms",
                  userSelect: "none",
                  "&:hover": { borderColor: opt.color, bgcolor: opt.bg },
                }}
              >
                <Typography sx={{ fontSize: "0.875rem", fontWeight: 800, color: sel ? opt.color : ds.textSecondary, lineHeight: 1.2 }}>
                  {opt.label}
                </Typography>
                <Typography sx={{ fontSize: "0.6875rem", color: sel ? opt.color : ds.textMuted, mt: 0.25, opacity: 0.85 }}>
                  {opt.description}
                </Typography>
              </Box>
            );
          })}
        </Stack>

        {/* Heading */}
        <Typography sx={{ fontSize: "1.75rem", fontWeight: 800, color: ds.text, mb: 0.5, lineHeight: 1.2 }}>
          {activeRole.label} Sign In
        </Typography>
        <Typography sx={{ fontSize: "0.875rem", color: ds.textSecondary, mb: 3 }}>
          {selectedRole === "admin" ? "Full access to all modules and settings" : "Sign in to access your assigned pages"}
        </Typography>

        {/* Error alert */}
        {err && <Alert severity="error" sx={{ mb: 2, borderRadius: "10px" }}>{err}</Alert>}

        {/* Form */}
        <Box component="form" onSubmit={submit}>
          <Stack spacing={2.5}>
            <TextField
              label="Email Address"
              type="email"
              autoComplete="username"
              placeholder="you@woxsen.edu.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutlinedIcon sx={{ fontSize: 18, color: ds.textMuted }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={fieldSx}
            />

            <TextField
              label={SITE_LABELS.password}
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlinedIcon sx={{ fontSize: 18, color: ds.textMuted }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        type="button"
                        aria-label={showPw ? "Hide password" : "Show password"}
                        onClick={() => setShowPw((v) => !v)}
                        edge="end"
                        size="small"
                      >
                        {showPw ? <VisibilityOffOutlinedIcon sx={{ fontSize: 18 }} /> : <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              sx={fieldSx}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  size="small"
                  sx={{ color: ds.border, "&.Mui-checked": { color: ds.primary } }}
                />
              }
              label={
                <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: ds.textSecondary }}>
                  {SITE_BRANDING.loginRememberDevice ?? "Remember this device"}
                </Typography>
              }
            />

            <Button
              type="submit"
              variant="contained"
              disabled={busy}
              fullWidth
              sx={{
                py: 1.5,
                fontSize: "0.9375rem",
                fontWeight: 700,
                borderRadius: `${ds.buttonRadius}px`,
                bgcolor: activeRole.color,
                boxShadow: `0 4px 16px ${activeRole.color}55`,
                "&:hover": {
                  bgcolor: activeRole.color,
                  filter: "brightness(0.9)",
                  boxShadow: `0 8px 24px ${activeRole.color}66`,
                },
              }}
            >
              {busy ? SITE_LABELS.signingIn : `Sign In as ${activeRole.label}`}
            </Button>
          </Stack>
        </Box>

      </Box>
    </Box>
  );
}
