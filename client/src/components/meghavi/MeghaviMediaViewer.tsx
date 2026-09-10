import { useCallback, useEffect, useState } from "react";
import { Box, CircularProgress, Dialog, DialogContent, IconButton, Tooltip, Typography } from "@mui/material";
import CloseIcon             from "@mui/icons-material/Close";
import ChevronLeftIcon       from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon      from "@mui/icons-material/ChevronRight";
import ThumbUpAltIcon        from "@mui/icons-material/ThumbUpAlt";
import ThumbDownAltIcon      from "@mui/icons-material/ThumbDownAlt";
import ThumbUpOutlinedIcon   from "@mui/icons-material/ThumbUpOutlined";
import ThumbDownOutlinedIcon from "@mui/icons-material/ThumbDownOutlined";
import ImageIcon             from "@mui/icons-material/ImageOutlined";
import VideocamIcon          from "@mui/icons-material/VideocamOutlined";
import PortraitOutlinedIcon  from "@mui/icons-material/PortraitOutlined";
import { api } from "../../lib/api";

export interface MediaItem {
  id: number | string;
  snapshot_url: string | null;
  face_crop_url?: string | null;
  video_url: string | null;
  label?: string;
  sublabel?: string;
}

interface MediaDialogProps {
  open: boolean;
  onClose: () => void;
  snapshot_url: string | null;
  face_crop_url?: string | null;
  video_url: string | null;
  label?: string;
  items?: MediaItem[];
  initialIndex?: number;
  module?: string;
  onFalsePositive?: (id: number | string) => void;
}

export function MediaDialog({
  open, onClose,
  snapshot_url, face_crop_url, video_url, label,
  items, initialIndex = 0, module: mod, onFalsePositive,
}: MediaDialogProps) {
  const [idx,      setIdx]      = useState(initialIndex);
  const [tab,      setTab]      = useState<"image" | "face" | "video">("image");
  const [feedback, setFeedback] = useState<Record<number | string, "up" | "down">>({});
  const [saving,   setSaving]   = useState(false);

  useEffect(() => { if (open) setIdx(initialIndex); }, [open, initialIndex]);

  const go = useCallback((dir: -1 | 1) => setIdx((i) => i + dir), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft"  && items && idx > 0)                go(-1);
      if (e.key === "ArrowRight" && items && idx < items.length - 1) go(1);
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, idx, items, onClose, go]);

  const current: MediaItem = items
    ? (items[idx] ?? { id: -1, snapshot_url: null, face_crop_url: null, video_url: null })
    : { id: -1, snapshot_url, face_crop_url, video_url, label };

  const curLabel = items ? (current.label ?? label) : label;
  const hasImage = Boolean(current.snapshot_url);
  const hasFace  = Boolean(current.face_crop_url);
  const hasVideo = Boolean(current.video_url);
  const hasPrev  = Boolean(items && idx > 0);
  const hasNext  = Boolean(items && idx < (items.length - 1));
  const curFb    = current.id !== -1 ? feedback[current.id] : undefined;

  // Reset to snapshot view when switching items
  useEffect(() => {
    setTab(hasImage ? "image" : hasVideo ? "video" : "face");
  }, [idx, hasImage, hasVideo]);

  const giveFeedback = async (fb: "up" | "down") => {
    if (current.id === -1 || curFb === fb) return;
    const savedId = current.id;
    setFeedback((prev) => ({ ...prev, [savedId]: fb }));
    setSaving(true);
    try {
      await api.post("/meghavi/feedback", {
        event_id:     savedId,
        module:       mod ?? "unknown",
        feedback:     fb === "down" ? "thumbs_down" : "thumbs_up",
        snapshot_url: current.snapshot_url,
        video_url:    current.video_url,
      });
      if (fb === "down") {
        setTimeout(() => {
          onFalsePositive?.(savedId);
          onClose();
        }, 600);
      }
    } catch {
      setFeedback((prev) => { const n = { ...prev }; delete n[savedId]; return n; });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 2, overflow: "hidden", bgcolor: "#0B1220" } } }}
    >
      {/* ── Header ── */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, py: 1.5, bgcolor: "#0F172A" }}>
        {/* Left: label + counter */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {curLabel && (
            <Typography sx={{ fontSize: "0.75rem", color: "#94A3B8" }}>{curLabel}</Typography>
          )}
          {items && (
            <Typography sx={{ fontSize: "0.75rem", color: "#475569" }}>
              {idx + 1} / {items.length}
            </Typography>
          )}
        </Box>

        {/* Right: view toggles + feedback + close */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {current.sublabel && (
            <Box sx={{ px: 1.25, py: 0.35, borderRadius: "6px", bgcolor: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.35)", mr: 0.5 }}>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#F97316", letterSpacing: "0.03em" }}>⏱ {current.sublabel}</Typography>
            </Box>
          )}

          {/* Video toggle icon (for staff / video clips) */}
          {hasVideo && (
            <Tooltip title="View video">
              <IconButton
                size="small"
                onClick={() => setTab(tab === "video" ? (hasImage ? "image" : "face") : "video")}
                sx={{
                  borderRadius: "8px",
                  color: tab === "video" ? "#FFFFFF" : "#64748B",
                  bgcolor: tab === "video" ? "rgba(255,255,255,0.15)" : "transparent",
                  "&:hover": { color: "#FFFFFF", bgcolor: "rgba(255,255,255,0.1)" },
                }}
              >
                <VideocamIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}

          {/* Thumbs up */}
          <Tooltip title={curFb === "up" ? "Marked as correct" : "Mark as correct"}>
            <span>
              <IconButton
                size="small"
                disabled={saving || curFb === "down"}
                onClick={() => giveFeedback("up")}
                sx={{ color: curFb === "up" ? "#22C55E" : "#64748B", "&:hover": { color: "#22C55E" }, "&.Mui-disabled": { opacity: 0.35 } }}
              >
                {curFb === "up" ? <ThumbUpAltIcon sx={{ fontSize: 18 }} /> : <ThumbUpOutlinedIcon sx={{ fontSize: 18 }} />}
              </IconButton>
            </span>
          </Tooltip>

          {/* Thumbs down */}
          <Tooltip title={curFb === "down" ? "Saved as false positive" : "Mark as false positive"}>
            <span>
              <IconButton
                size="small"
                disabled={saving || curFb === "up"}
                onClick={() => giveFeedback("down")}
                sx={{ color: curFb === "down" ? "#EF4444" : "#64748B", "&:hover": { color: "#EF4444" }, "&.Mui-disabled": { opacity: 0.35 } }}
              >
                {curFb === "down" ? <ThumbDownAltIcon sx={{ fontSize: 18 }} /> : <ThumbDownOutlinedIcon sx={{ fontSize: 18 }} />}
              </IconButton>
            </span>
          </Tooltip>

          {saving && <CircularProgress size={14} sx={{ color: "#64748B", ml: 0.5 }} />}

          {curFb === "down" && (
            <Typography sx={{ fontSize: "0.625rem", color: "#EF4444", fontWeight: 700, ml: 0.25 }}>
              Saved
            </Typography>
          )}

          <IconButton size="small" onClick={onClose} sx={{ ml: 0.5, color: "#94A3B8", "&:hover": { color: "#FFFFFF" } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* ── Content ── */}
      <Box sx={{ position: "relative" }}>
        <DialogContent sx={{ p: 0, bgcolor: "#000", display: "flex", flexDirection: "column", minHeight: 200 }}>
          {tab === "image" && current.snapshot_url && (
            <img src={current.snapshot_url} alt="Snapshot" style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", display: "block" }} />
          )}
          {tab === "face" && current.face_crop_url && (
            <img src={current.face_crop_url} alt="Face crop" style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", display: "block" }} />
          )}
          {tab === "video" && current.video_url && (
            <video
              key={current.video_url}
              src={current.video_url.startsWith("/") ? `${window.location.origin}${current.video_url}` : current.video_url}
              controls autoPlay muted playsInline preload="auto"
              style={{ width: "100%", maxHeight: "80vh", display: "block", outline: "none", background: "#000", aspectRatio: "16/9" }}
            />
          )}
          {tab === "image" && !current.snapshot_url && (
            <Box sx={{ p: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography sx={{ color: "#64748B", fontSize: "0.875rem" }}>No snapshot available</Typography>
            </Box>
          )}
          {tab === "face" && !current.face_crop_url && (
            <Box sx={{ p: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography sx={{ color: "#64748B", fontSize: "0.875rem" }}>No face crop available</Typography>
            </Box>
          )}
        </DialogContent>

        {/* Face crop toggle — bottom-right corner of frame */}
        {hasFace && (
          <Tooltip title={tab === "face" ? "View snapshot" : "View face crop"} placement="top">
            <IconButton
              onClick={() => setTab(tab === "face" ? (hasImage ? "image" : "video") : "face")}
              sx={{
                position: "absolute", bottom: 16, right: 16,
                width: 38, height: 38,
                bgcolor: tab === "face" ? "rgba(92,146,112,0.9)" : "rgba(15,23,42,0.72)",
                color: "#FFFFFF",
                borderRadius: "14px",
                backdropFilter: "blur(6px)",
                border: tab === "face" ? "1.5px solid rgba(92,146,112,0.8)" : "1.5px solid rgba(255,255,255,0.15)",
                "&:hover": { bgcolor: tab === "face" ? "rgba(92,146,112,1)" : "rgba(15,23,42,0.92)", transform: "scale(1.07)" },
                transition: "all 0.15s",
                zIndex: 2,
              }}
            >
              <PortraitOutlinedIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        )}

        {hasPrev && (
          <IconButton
            onClick={() => go(-1)}
            sx={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", bgcolor: "rgba(255,255,255,0.12)", color: "#FFFFFF", "&:hover": { bgcolor: "rgba(255,255,255,0.22)" } }}
          >
            <ChevronLeftIcon />
          </IconButton>
        )}

        {hasNext && (
          <IconButton
            onClick={() => go(1)}
            sx={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", bgcolor: "rgba(255,255,255,0.12)", color: "#FFFFFF", "&:hover": { bgcolor: "rgba(255,255,255,0.22)" } }}
          >
            <ChevronRightIcon />
          </IconButton>
        )}
      </Box>
    </Dialog>
  );
}

// ── Icon-button viewer (used in table "View" column) ──────────────────────────

interface MeghaviMediaViewerProps {
  snapshot_url: string | null;
  video_url?:   string | null;
  label?:       string;
  iconSize?:    number;
  items?:       MediaItem[];
  initialIndex?: number;
  module?:      string;
  onFalsePositive?: (id: number | string) => void;
}

export function MeghaviMediaViewer({
  snapshot_url, video_url = null, label,
  iconSize = 18, items, initialIndex = 0, module: mod, onFalsePositive,
}: MeghaviMediaViewerProps) {
  const [open, setOpen] = useState(false);
  const hasImage = Boolean(snapshot_url);
  const hasVideo = Boolean(video_url);
  if (!hasImage && !hasVideo) return null;

  return (
    <>
      <Tooltip title={hasVideo ? "View video clip" : "View snapshot"}>
        <IconButton size="small" onClick={() => setOpen(true)} sx={{ p: 0.5, color: "#64748B", "&:hover": { color: "#0A4D52" } }}>
          {hasVideo ? <VideocamIcon sx={{ fontSize: iconSize }} /> : <ImageIcon sx={{ fontSize: iconSize }} />}
        </IconButton>
      </Tooltip>
      {open && (
        <MediaDialog
          open={open} onClose={() => setOpen(false)}
          snapshot_url={snapshot_url} video_url={video_url} label={label}
          items={items} initialIndex={initialIndex} module={mod}
          onFalsePositive={onFalsePositive}
        />
      )}
    </>
  );
}

// ── Small thumbnail (for legacy uses) ────────────────────────────────────────

interface MediaPayload {
  snapshot_url: string | null;
  video_url:    string | null;
  label?:       string;
}

export function MeghaviThumbnail({ snapshot_url, video_url = null, label }: MediaPayload) {
  const [open, setOpen] = useState(false);
  const hasImage = Boolean(snapshot_url);
  const hasVideo = Boolean(video_url);

  if (!hasImage && !hasVideo) {
    return (
      <Box sx={{ width: 48, height: 36, bgcolor: "#F1F5F9", borderRadius: "4px", display: "grid", placeItems: "center" }}>
        <ImageIcon sx={{ fontSize: 16, color: "#CBD5E1" }} />
      </Box>
    );
  }

  return (
    <>
      <Box
        component="button"
        onClick={() => setOpen(true)}
        sx={{ background: "none", border: "1px solid #E2E8F0", cursor: "pointer", p: 0, width: 56, height: 40, borderRadius: "6px", overflow: "hidden", display: "block", "&:hover": { borderColor: "#0A4D52" } }}
      >
        {hasImage ? (
          <img src={snapshot_url!} alt="Snapshot" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <Box sx={{ width: "100%", height: "100%", bgcolor: "#1E293B", display: "grid", placeItems: "center" }}>
            <VideocamIcon sx={{ fontSize: 18, color: "#94A3B8" }} />
          </Box>
        )}
      </Box>
      {open && (
        <MediaDialog open={open} onClose={() => setOpen(false)} snapshot_url={snapshot_url} video_url={video_url} label={label} />
      )}
    </>
  );
}
