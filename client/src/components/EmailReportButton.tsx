import { useRef, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  Paper,
  Popover,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import SendIcon from "@mui/icons-material/Send";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import { ds } from "../lib/dsTokens";
import { api } from "../lib/api";
import { todayIST } from "../lib/meghaviApi";

const FIXED_RECIPIENT = "nvdevagurus@gmail.com";

type SendState = "idle" | "sending" | "success" | "error";

function prevDay(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function EmailReportButton() {
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);

  // Date range
  const today = todayIST();
  const yesterday = prevDay();
  const [from, setFrom] = useState(yesterday);
  const [to, setTo]     = useState(yesterday);

  // Recipients
  const [useFixed, setUseFixed]   = useState(true);
  const [useCustom, setUseCustom] = useState(false);
  const [customEmail, setCustomEmail] = useState("");

  // Send state
  const [sendState, setSendState] = useState<SendState>("idle");
  const [errorMsg, setErrorMsg]   = useState("");

  function buildRecipients(): string[] {
    const list: string[] = [];
    if (useFixed) list.push(FIXED_RECIPIENT);
    if (useCustom && customEmail.trim()) {
      customEmail.split(/[,;\s]+/).filter(e => /\S@\S/.test(e)).forEach(e => list.push(e.trim()));
    }
    return [...new Set(list)];
  }

  async function handleSend() {
    const recipients = buildRecipients();
    if (recipients.length === 0) return;
    setSendState("sending");
    setErrorMsg("");
    try {
      await api.post("/meghavi/email/send", { from, to, recipients });
      setSendState("success");
      setTimeout(() => { setSendState("idle"); setOpen(false); }, 2500);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to send. Check SMTP config.";
      setErrorMsg(msg);
      setSendState("error");
    }
  }

  function handleClose() {
    if (sendState === "sending") return;
    setOpen(false);
    setSendState("idle");
    setErrorMsg("");
  }

  const recipients = buildRecipients();
  const canSend = recipients.length > 0 && from && to && from <= to && sendState !== "sending";

  return (
    <>
      <Tooltip title="Email Analytics Report">
        <IconButton
          ref={anchorRef}
          size="small"
          onClick={() => setOpen(v => !v)}
          sx={{
            width: 34, height: 34,
            border: `1px solid ${open ? ds.primary : ds.border}`,
            borderRadius: "8px",
            color: open ? ds.primary : ds.textSecondary,
            bgcolor: open ? `${ds.primary}10` : "transparent",
            display: { xs: "none", sm: "inline-flex" },
          }}
        >
          <EmailOutlinedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { mt: 1, borderRadius: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.14)", border: `1px solid ${ds.border}` } } }}
      >
        <Paper elevation={0} sx={{ width: 340, p: 0, bgcolor: ds.cardBg }}>
          {/* Header */}
          <Box sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: `1px solid ${ds.border}` }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <EmailOutlinedIcon sx={{ fontSize: 20, color: ds.primary }} />
              <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: ds.text }}>
                Send Analytics Report
              </Typography>
            </Box>
            <Typography sx={{ fontSize: "0.75rem", color: ds.textSecondary, mt: 0.5 }}>
              PDF report covers Walk-ins, Meet & Greet, Staff Unavailability & Alerts.
            </Typography>
          </Box>

          <Box sx={{ px: 2.5, py: 2, display: "flex", flexDirection: "column", gap: 2 }}>

            {/* Date range */}
            <Box>
              <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: ds.textSecondary, textTransform: "uppercase", letterSpacing: "0.07em", mb: 0.75 }}>
                Report Period
              </Typography>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <TextField
                  type="date" size="small" label="From" value={from}
                  onChange={e => setFrom(e.target.value)}
                  slotProps={{ htmlInput: { max: today } }}
                  sx={{ flex: 1, "& input": { fontSize: "0.8125rem" } }}
                />
                <Typography sx={{ color: ds.textMuted, fontSize: "0.75rem" }}>to</Typography>
                <TextField
                  type="date" size="small" label="To" value={to}
                  onChange={e => setTo(e.target.value)}
                  slotProps={{ htmlInput: { min: from, max: today } }}
                  sx={{ flex: 1, "& input": { fontSize: "0.8125rem" } }}
                />
              </Box>
              <Box sx={{ display: "flex", gap: 0.75, mt: 0.75, flexWrap: "wrap" }}>
                {[
                  { label: "Yesterday", f: yesterday, t: yesterday },
                  { label: "Last 7 days", f: new Date(Date.now()-6*86400000).toISOString().slice(0,10), t: today },
                  { label: "Today", f: today, t: today },
                ].map(q => (
                  <Chip
                    key={q.label} label={q.label} size="small"
                    onClick={() => { setFrom(q.f); setTo(q.t); }}
                    variant={from === q.f && to === q.t ? "filled" : "outlined"}
                    sx={{ fontSize: "0.6875rem", height: 22, cursor: "pointer",
                      ...(from === q.f && to === q.t ? { bgcolor: ds.primary, color: "#fff", "& .MuiChip-label": { color: "#fff" } } : { borderColor: ds.border }) }}
                  />
                ))}
              </Box>
            </Box>

            <Divider sx={{ borderColor: ds.border }} />

            {/* Recipients */}
            <Box>
              <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: ds.textSecondary, textTransform: "uppercase", letterSpacing: "0.07em", mb: 0.5 }}>
                Recipients
              </Typography>
              <FormControlLabel
                control={<Checkbox checked={useFixed} onChange={e => setUseFixed(e.target.checked)} size="small" sx={{ color: ds.primary, "&.Mui-checked": { color: ds.primary } }} />}
                label={<Typography sx={{ fontSize: "0.8125rem", color: ds.text }}>{FIXED_RECIPIENT}</Typography>}
                sx={{ ml: 0 }}
              />
              <FormControlLabel
                control={<Checkbox checked={useCustom} onChange={e => setUseCustom(e.target.checked)} size="small" sx={{ color: ds.primary, "&.Mui-checked": { color: ds.primary } }} />}
                label={<Typography sx={{ fontSize: "0.8125rem", color: ds.text }}>Custom email address</Typography>}
                sx={{ ml: 0 }}
              />
              {useCustom && (
                <TextField
                  size="small" fullWidth placeholder="email@example.com, another@example.com"
                  value={customEmail} onChange={e => setCustomEmail(e.target.value)}
                  sx={{ mt: 0.75, "& input": { fontSize: "0.8125rem" } }}
                />
              )}
            </Box>

            <Divider sx={{ borderColor: ds.border }} />

            {/* Status / Send */}
            {sendState === "success" && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "#16a34a" }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
                <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>Report sent successfully!</Typography>
              </Box>
            )}
            {sendState === "error" && (
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, color: "#dc2626" }}>
                <ErrorOutlineIcon sx={{ fontSize: 18, mt: "1px" }} />
                <Typography sx={{ fontSize: "0.8125rem" }}>{errorMsg}</Typography>
              </Box>
            )}

            <Button
              variant="contained"
              fullWidth
              disabled={!canSend}
              onClick={handleSend}
              startIcon={sendState === "sending" ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : <SendIcon sx={{ fontSize: 16 }} />}
              sx={{
                bgcolor: ds.primary, "&:hover": { bgcolor: ds.primaryDark ?? ds.primary },
                borderRadius: "8px", textTransform: "none", fontWeight: 700, fontSize: "0.875rem", py: 1,
              }}
            >
              {sendState === "sending" ? "Sending…" : `Send to ${recipients.length} recipient${recipients.length !== 1 ? "s" : ""}`}
            </Button>

            <Typography sx={{ fontSize: "0.6875rem", color: ds.textMuted, textAlign: "center" }}>
              A daily report is also auto-sent every morning at 10:00 AM IST.
            </Typography>
          </Box>
        </Paper>
      </Popover>
    </>
  );
}
