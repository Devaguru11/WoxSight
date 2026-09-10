import { useState, useEffect, useCallback, useRef } from "react";
import { Box, Paper, Typography, IconButton, Dialog, DialogContent, CircularProgress } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import FullscreenRoundedIcon from "@mui/icons-material/FullscreenRounded";
import VideocamOffOutlinedIcon from "@mui/icons-material/VideocamOffOutlined";
import { useMeghaviCameras, type MeghaviCamera } from "../../../lib/meghaviApi";
import { ds } from "../../../lib/dsTokens";

const PER_PAGE = 4;
const AUTO_INTERVAL_MS = 30_000;

function CameraCell({ cam, onExpand }: { cam: MeghaviCamera; onExpand: (c: MeghaviCamera) => void }) {
  const isOnline = cam.status === "active";
  return (
    <Box
      sx={{
        position: "relative",
        borderRadius: "8px",
        overflow: "hidden",
        bgcolor: ds.primaryDark,
        cursor: "pointer",
        aspectRatio: "16/9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        "&:hover .expand-btn": { opacity: 1 },
      }}
      onClick={() => onExpand(cam)}
    >
      {cam.stream_url ? (
        <img src={cam.stream_url} alt={cam.display_name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} width={1280} height={960} />
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, opacity: 0.35 }}>
          <VideocamOffOutlinedIcon sx={{ fontSize: 28, color: "#FFFFFF" }} />
          <Typography sx={{ fontSize: "0.5625rem", color: "#FFFFFF", fontWeight: 600 }}>NO STREAM</Typography>
        </Box>
      )}

      {/* LIVE badge */}
      <Box
        sx={{
          position: "absolute", top: 7, left: 7,
          display: "flex", alignItems: "center", gap: 0.5,
          px: 0.75, py: 0.2, borderRadius: "5px",
          bgcolor: isOnline ? "rgba(92,146,112,0.92)" : "rgba(201,107,107,0.92)",
          color: "#FFFFFF", fontSize: "0.5625rem", fontWeight: 800, letterSpacing: "0.06em",
        }}
      >
        <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "#FFFFFF" }} />
        {isOnline ? "LIVE" : "OFFLINE"}
      </Box>

      {/* Camera name */}
      <Box
        sx={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          px: 1, py: 0.6,
          background: "linear-gradient(to top, rgba(11,73,100,0.85) 0%, transparent 100%)",
        }}
      >
        <Typography sx={{ color: "#FFFFFF", fontSize: "0.6875rem", fontWeight: 700, lineHeight: 1.2 }} noWrap>
          {cam.display_name}
        </Typography>
        <Typography sx={{ color: "rgba(183,205,211,0.90)", fontSize: "0.5625rem", fontWeight: 600 }} noWrap>
          {cam.location_name}
        </Typography>
      </Box>

      {/* Expand icon on hover */}
      <IconButton
        className="expand-btn"
        size="small"
        sx={{
          position: "absolute", top: 6, right: 6, opacity: 0,
          transition: "opacity 0.15s",
          bgcolor: "rgba(11,73,100,0.72)", color: "#FFFFFF",
          width: 24, height: 24,
          "&:hover": { bgcolor: "rgba(11,73,100,0.95)" },
        }}
      >
        <FullscreenRoundedIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Box>
  );
}

const STATIC_CAMERAS: MeghaviCamera[] = [
  { id: 101, camera_key: "stat-1", display_name: "Gachibowli",          location_name: "Gachibowli",   status: "active", stream_url: "/Streams_static/Gachibowli.jpeg",            location_id: 1, area: "Entrance" },
  { id: 102, camera_key: "stat-2", display_name: "Banjara Hills (Outside)", location_name: "Banjara Hills", status: "active", stream_url: "/Streams_static/Jublee Hills (Outside).jpeg", location_id: 2, area: "Outside" },
  { id: 104, camera_key: "stat-4", display_name: "Banjara Hills",         location_name: "Banjara Hills", status: "active", stream_url: "/Streams_static/Jublee Hills.jpeg",            location_id: 2, area: "General" },
];

export function MeghaviLiveOverview() {
  const { cameras: apiCameras, loading } = useMeghaviCameras();
  const [page, setPage] = useState(0);
  const [fullscreenCam, setFullscreenCam] = useState<MeghaviCamera | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const displayCameras = apiCameras.length > 0 && apiCameras.some(c => c.stream_url) ? apiCameras : STATIC_CAMERAS;
  const totalPages = Math.max(1, Math.ceil(displayCameras.length / PER_PAGE));

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setPage((p) => (p + 1) % Math.max(1, Math.ceil(displayCameras.length / PER_PAGE)));
    }, AUTO_INTERVAL_MS);
  }, [displayCameras.length]);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer]);

  const goTo = (idx: number) => { setPage(idx); startTimer(); };
  const prev = () => goTo((page - 1 + totalPages) % totalPages);
  const next = () => goTo((page + 1) % totalPages);

  const pageCams = displayCameras.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2, borderRadius: "14px", bgcolor: ds.cardBg,
        border: `1px solid ${ds.border}`, boxShadow: ds.cardShadow,
        display: "flex", flexDirection: "column", height: "100%", minHeight: 330,
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.25 }}>
        <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: ds.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          LIVE OVERVIEW
        </Typography>
        <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: ds.textSecondary }}>
          {displayCameras.length} cameras · auto-cycling 30s
        </Typography>
      </Box>

      {loading && (
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CircularProgress size={22} sx={{ color: ds.primary }} />
        </Box>
      )}

      {!loading && (
        <>
          {/* 2×2 Camera Grid */}
          <Box sx={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 1, minHeight: 0 }}>
            {pageCams.map((cam) => (
              <CameraCell key={cam.id} cam={cam} onExpand={setFullscreenCam} />
            ))}
            {Array.from({ length: PER_PAGE - pageCams.length }).map((_, i) => (
              <Box key={`empty-${i}`} sx={{ borderRadius: "8px", bgcolor: `${ds.primary}06`, border: `1px solid ${ds.border}` }} />
            ))}
          </Box>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, mt: 1.25 }}>
              <IconButton size="small" onClick={prev} sx={{ width: 26, height: 26, color: ds.textSecondary }}>
                <ChevronLeftRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>

              <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <Box
                    key={i}
                    onClick={() => goTo(i)}
                    sx={{ width: i === page ? 18 : 6, height: 6, borderRadius: "3px", bgcolor: i === page ? ds.primary : ds.border, cursor: "pointer", transition: "all 0.2s ease" }}
                  />
                ))}
              </Box>

              <IconButton size="small" onClick={next} sx={{ width: 26, height: 26, color: ds.textSecondary }}>
                <ChevronRightRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          )}
        </>
      )}

      {/* Fullscreen Dialog */}
      <Dialog
        open={!!fullscreenCam}
        onClose={() => setFullscreenCam(null)}
        maxWidth="lg"
        fullWidth
        slotProps={{ paper: { sx: { bgcolor: ds.primaryDark, borderRadius: 3, overflow: "hidden" } } }}
      >
        <DialogContent sx={{ p: 0, position: "relative" }}>
          <IconButton
            onClick={() => setFullscreenCam(null)}
            sx={{ position: "absolute", top: 12, right: 12, color: "#FFFFFF", bgcolor: "rgba(0,0,0,0.45)", zIndex: 10 }}
          >
            <CloseRoundedIcon />
          </IconButton>
          {fullscreenCam && (
            <Box sx={{ position: "relative" }}>
              {fullscreenCam.stream_url ? (
                <img src={fullscreenCam.stream_url} alt={fullscreenCam.display_name} style={{ width: "100%", display: "block" }} width={1280} height={960} />
              ) : (
                <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
                  <VideocamOffOutlinedIcon sx={{ fontSize: 52, color: "rgba(255,255,255,0.25)" }} />
                </Box>
              )}
              <Box sx={{ px: 2, py: 1.25 }}>
                <Typography sx={{ color: "#FFFFFF", fontWeight: 700, fontSize: "0.9375rem" }}>
                  {fullscreenCam.display_name}
                </Typography>
                <Typography sx={{ color: "rgba(183,205,211,0.80)", fontSize: "0.75rem" }}>
                  {fullscreenCam.location_name} · {fullscreenCam.area}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Paper>
  );
}
