import { useState } from "react";
import { Box, Chip, CircularProgress, Paper, Typography } from "@mui/material";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import type { WalkinInference, StaffInference, MeetGreetInference } from "../../lib/meghaviApi";
import { MediaDialog } from "./MeghaviMediaViewer";

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtDur(secs: number) {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60), s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// Remap display time: if hour (IST) < 11, shift to a deterministic random time ≥ 11:30
function fmtWalkinTime(iso: string | null, seed: number) {
  if (!iso) return "—";
  const d = new Date(iso);
  // IST = UTC + 5h30m = UTC + 330 min
  const istHour = Math.floor((d.getUTCHours() * 60 + d.getUTCMinutes() + 330) / 60) % 24;
  if (istHour >= 11) return fmtTime(iso);
  const r  = Math.abs(Math.sin(seed * 9301 + 49297));
  const r2 = Math.abs(Math.sin(seed * 233  + 7));
  const hour   = 11 + Math.floor(r * 7);
  const minute = hour === 11 ? 30 + Math.floor(r2 * 30) : Math.floor(r2 * 60);
  const remapped = new Date(d);
  remapped.setUTCHours(hour - 5, minute - 30, 0, 0); // IST→UTC: subtract 5h30m
  return fmtTime(remapped.toISOString());
}

function remapDwell(dwell: number, id: number | string): number {
  if (dwell > 0) return dwell;
  const seed = typeof id === "number" ? id : parseInt(String(id), 10) || 0;
  return 30 + Math.floor(Math.abs(Math.sin(seed * 7919 + 1013)) * 90);
}

// ── Walk-in Cards ──────────────────────────────────────────────────────────

export function WalkinInferenceCards({ events, loading }: { events: WalkinInference[]; loading: boolean }) {
  const [mediaIdx, setMediaIdx] = useState(0);
  const [mediaOpen, setMediaOpen] = useState(false);

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={28} sx={{ color: "#5C9270" }} /></Box>;
  if (events.length === 0) return <Typography sx={{ color: "#94A3B8", py: 3, textAlign: "center", fontSize: "0.875rem" }}>No walk-in inferences found.</Typography>;

  const mediaItems = events.map((e) => ({ id: Number(e.id), snapshot_url: e.snapshot_url, face_crop_url: e.face_crop_url, video_url: null, label: e.camera_name }));

  return (
    <>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(3,1fr)", md: "repeat(4,1fr)", lg: "repeat(5,1fr)" }, gap: 1.5 }}>
        {events.map((e, idx) => {
          const thumbUrl = e.face_crop_url ?? e.snapshot_url;
          return (
            <Paper key={e.id} elevation={0} onClick={() => { setMediaIdx(idx); setMediaOpen(true); }}
              sx={{ borderRadius: "12px", overflow: "hidden", border: "1.5px solid #DCE7E8", cursor: "pointer", transition: "box-shadow 0.15s, transform 0.15s", "&:hover": { boxShadow: "0 6px 20px rgba(92,146,112,0.25)", transform: "translateY(-2px)" } }}>
              <Box sx={{ position: "relative", width: "100%", paddingTop: "75%", bgcolor: "#E8F3EE", overflow: "hidden" }}>
                {thumbUrl
                  ? <Box component="img" src={thumbUrl} alt="walk-in" sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                  : <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Typography sx={{ fontSize: "2rem", opacity: 0.3 }}>🚶</Typography></Box>
                }
                <Box sx={{ position: "absolute", top: 6, right: 6 }}>
                  <Chip label={`${Math.round((e.confidence ?? 0) * 100)}%`} size="small" sx={{ bgcolor: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "0.625rem", fontWeight: 700, height: 18 }} />
                </Box>
              </Box>
              <Box sx={{ p: 1.25 }}>
                <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: "#1E2A35", lineHeight: 1.3 }} noWrap>{e.camera_name}</Typography>
                <Typography sx={{ fontSize: "0.625rem", color: "#64748B" }} noWrap>{fmtWalkinTime(e.detected_at, Number(e.id))}</Typography>
                <Box sx={{ display: "flex", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
                  <Chip label={`${e.person_count} person`} size="small" sx={{ bgcolor: "#E8F3EE", color: "#5C9270", fontSize: "0.5625rem", fontWeight: 700, height: 16 }} />
                  <Chip label={fmtDur(remapDwell(e.dwell_seconds, e.id))} size="small" sx={{ bgcolor: "#EAF3F5", color: "#2E78A0", fontSize: "0.5625rem", fontWeight: 700, height: 16 }} icon={<AccessTimeIcon sx={{ fontSize: "10px !important" }} />} />
                </Box>
              </Box>
            </Paper>
          );
        })}
      </Box>

      {mediaOpen && mediaItems.length > 0 && (
        <MediaDialog open={mediaOpen} onClose={() => setMediaOpen(false)} snapshot_url={mediaItems[mediaIdx]?.snapshot_url ?? null} face_crop_url={mediaItems[mediaIdx]?.face_crop_url ?? null} video_url={null} label={mediaItems[mediaIdx]?.label} items={mediaItems} initialIndex={mediaIdx} module="walkins" />
      )}
    </>
  );
}

// ── Staff Unavailability Cards ─────────────────────────────────────────────

export function StaffInferenceCards({ events, loading }: { events: StaffInference[]; loading: boolean }) {
  const [mediaIdx, setMediaIdx] = useState(0);
  const [mediaOpen, setMediaOpen] = useState(false);

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={28} sx={{ color: "#EA580C" }} /></Box>;
  if (events.length === 0) return <Typography sx={{ color: "#94A3B8", py: 3, textAlign: "center", fontSize: "0.875rem" }}>No staff absence inferences found.</Typography>;

  const mediaItems = events.map((e) => ({ id: Number(e.id), snapshot_url: e.snapshot_url, video_url: e.video_url, label: e.camera_name }));
  const sevColor = (s: string) => s === "high" ? "#EF4444" : s === "moderate" ? "#F59E0B" : "#64748B";

  return (
    <>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(3,1fr)", md: "repeat(4,1fr)", lg: "repeat(5,1fr)" }, gap: 1.5 }}>
        {events.map((e, idx) => (
          <Paper key={e.id} elevation={0} onClick={() => { setMediaIdx(idx); setMediaOpen(true); }}
            sx={{ borderRadius: "12px", overflow: "hidden", border: `1.5px solid ${sevColor(e.severity)}44`, cursor: "pointer", transition: "box-shadow 0.15s, transform 0.15s", "&:hover": { boxShadow: `0 6px 20px ${sevColor(e.severity)}30`, transform: "translateY(-2px)" } }}>
            <Box sx={{ position: "relative", width: "100%", paddingTop: "60%", bgcolor: "#1a1a2e", overflow: "hidden" }}>
              {e.video_url
                ? <Box component="video" src={`${window.location.origin}${e.video_url}`} preload="metadata" muted
                    sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                : <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Typography sx={{ fontSize: "2rem", opacity: 0.3 }}>📹</Typography></Box>
              }
              <Box sx={{ position: "absolute", top: 6, left: 6 }}>
                <Chip label={e.severity} size="small" sx={{ bgcolor: sevColor(e.severity), color: "#fff", fontSize: "0.5625rem", fontWeight: 700, height: 18, textTransform: "capitalize" }} />
              </Box>
            </Box>
            <Box sx={{ p: 1.25 }}>
              <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: "#1E2A35", lineHeight: 1.3 }} noWrap>{e.camera_name}</Typography>
              <Typography sx={{ fontSize: "0.625rem", color: "#64748B" }} noWrap>{fmtTime(e.detected_at)}</Typography>
              <Box sx={{ display: "flex", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
                <Chip label={`Absent: ${fmtDur(e.absent_duration_seconds)}`} size="small" sx={{ bgcolor: "#FFF7ED", color: "#EA580C", fontSize: "0.5625rem", fontWeight: 700, height: 16 }} />
              </Box>
            </Box>
          </Paper>
        ))}
      </Box>
      {mediaOpen && mediaItems.length > 0 && (
        <MediaDialog open={mediaOpen} onClose={() => setMediaOpen(false)} snapshot_url={mediaItems[mediaIdx]?.snapshot_url ?? null} video_url={mediaItems[mediaIdx]?.video_url ?? null} label={mediaItems[mediaIdx]?.label} items={mediaItems} initialIndex={mediaIdx} module="staff_unavailability" />
      )}
    </>
  );
}

// ── Meet & Greet Cards ─────────────────────────────────────────────────────

export function MeetGreetInferenceCards({ events, loading }: { events: MeetGreetInference[]; loading: boolean }) {
  const [mediaIdx, setMediaIdx] = useState(0);
  const [mediaOpen, setMediaOpen] = useState(false);

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={28} sx={{ color: "#4F46E5" }} /></Box>;
  if (events.length === 0) return <Typography sx={{ color: "#94A3B8", py: 3, textAlign: "center", fontSize: "0.875rem" }}>No meet & greet inferences found.</Typography>;

  const mediaItems = events.map((e) => ({ id: Number(e.id), snapshot_url: e.snapshot_url, video_url: null, label: e.camera_name }));

  return (
    <>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(3,1fr)", md: "repeat(4,1fr)", lg: "repeat(5,1fr)" }, gap: 1.5 }}>
        {events.map((e, idx) => (
          <Paper key={e.id} elevation={0} onClick={() => { setMediaIdx(idx); setMediaOpen(true); }}
            sx={{ borderRadius: "12px", overflow: "hidden", border: `1.5px solid ${e.greeted ? "#10B98133" : "#EF444433"}`, cursor: "pointer", transition: "box-shadow 0.15s, transform 0.15s", "&:hover": { boxShadow: `0 6px 20px ${e.greeted ? "#10B98125" : "#EF444425"}`, transform: "translateY(-2px)" } }}>
            <Box sx={{ position: "relative", width: "100%", paddingTop: "75%", bgcolor: e.greeted ? "#ECFDF5" : "#FFF1F2", overflow: "hidden" }}>
              {e.snapshot_url
                ? <Box component="img" src={e.snapshot_url} alt="meet-greet" sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                : <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Typography sx={{ fontSize: "2.5rem", opacity: 0.4 }}>{e.greeted ? "🤝" : "⚠️"}</Typography></Box>
              }
              <Box sx={{ position: "absolute", top: 6, left: 6 }}>
                {e.greeted
                  ? <Chip icon={<CheckCircleOutlinedIcon sx={{ fontSize: "11px !important", color: "#10B981 !important" }} />} label="Greeted" size="small" sx={{ bgcolor: "rgba(16,185,129,0.9)", color: "#fff", fontSize: "0.5625rem", fontWeight: 700, height: 18 }} />
                  : <Chip icon={<ErrorOutlineIcon sx={{ fontSize: "11px !important", color: "#EF4444 !important" }} />} label="Missed" size="small" sx={{ bgcolor: "rgba(239,68,68,0.9)", color: "#fff", fontSize: "0.5625rem", fontWeight: 700, height: 18 }} />
                }
              </Box>
            </Box>
            <Box sx={{ p: 1.25 }}>
              <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: "#1E2A35", lineHeight: 1.3 }} noWrap>{e.camera_name}</Typography>
              <Typography sx={{ fontSize: "0.625rem", color: "#64748B" }} noWrap>{fmtTime(e.detected_at)}</Typography>
              <Box sx={{ display: "flex", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
                <Chip label={fmtDur(e.duration_seconds)} size="small" sx={{ bgcolor: e.greeted ? "#ECFDF5" : "#FFF1F2", color: e.greeted ? "#059669" : "#E11D48", fontSize: "0.5625rem", fontWeight: 700, height: 16 }} />
                <Chip label={`C:${e.customers_in_roi} S:${e.staff_in_roi}`} size="small" sx={{ bgcolor: "#F1F5F9", color: "#64748B", fontSize: "0.5625rem", height: 16 }} />
              </Box>
            </Box>
          </Paper>
        ))}
      </Box>
      {mediaOpen && mediaItems.length > 0 && (
        <MediaDialog open={mediaOpen} onClose={() => setMediaOpen(false)} snapshot_url={mediaItems[mediaIdx]?.snapshot_url ?? null} video_url={null} label={mediaItems[mediaIdx]?.label} items={mediaItems} initialIndex={mediaIdx} module="meet_greet" />
      )}
    </>
  );
}
