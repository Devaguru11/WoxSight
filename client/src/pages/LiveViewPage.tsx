import { useState, useEffect, useCallback, useRef } from "react";
import { Box, CircularProgress, Dialog, DialogContent, IconButton, Typography } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import FullscreenRoundedIcon from "@mui/icons-material/FullscreenRounded";
import VideocamOffOutlinedIcon from "@mui/icons-material/VideocamOffOutlined";
import { useMeghaviCameras, type MeghaviCamera } from "../lib/meghaviApi";
import { ds } from "../lib/dsTokens";

const PER_PAGE = 4;
const AUTO_INTERVAL_MS = 30_000;

function CameraCell({ cam, onExpand }: { cam: MeghaviCamera; onExpand: (c: MeghaviCamera) => void }) {
  const isOnline = cam.status === "active";
  return (
    <Box
      onClick={() => onExpand(cam)}
      sx={{
        position: "relative",
        borderRadius: "10px",
        overflow: "hidden",
        bgcolor: ds.primaryDark,
        cursor: "pointer",
        aspectRatio: "16/9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        "&:hover .expand-btn": { opacity: 1 },
        transition: "transform 150ms ease, box-shadow 150ms ease",
        "&:hover": { transform: "scale(1.01)", boxShadow: ds.hoverShadow },
      }}
    >
      {cam.stream_url ? (
        <img src={cam.stream_url} alt={cam.display_name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} width={1280} height={960} />
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, opacity: 0.3 }}>
          <VideocamOffOutlinedIcon sx={{ fontSize: 32, color: "#FFFFFF" }} />
          <Typography sx={{ fontSize: "0.5625rem", color: "#FFFFFF", fontWeight: 600 }}>NO STREAM</Typography>
        </Box>
      )}

      {/* LIVE / OFFLINE badge */}
      <Box
        sx={{
          position: "absolute", top: 8, left: 8,
          display: "flex", alignItems: "center", gap: 0.5,
          px: 0.75, py: 0.25, borderRadius: "5px",
          bgcolor: isOnline ? "rgba(92,146,112,0.92)" : "rgba(201,107,107,0.92)",
          color: "#FFFFFF", fontSize: "0.5625rem", fontWeight: 800, letterSpacing: "0.06em",
        }}
      >
        <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "#FFFFFF" }} />
        {isOnline ? "LIVE" : "OFFLINE"}
      </Box>

      {/* Expand icon */}
      <IconButton
        className="expand-btn"
        size="small"
        sx={{
          position: "absolute", top: 6, right: 6, opacity: 0,
          transition: "opacity 0.15s",
          bgcolor: "rgba(11,73,100,0.72)", color: "#FFFFFF",
          width: 26, height: 26,
          "&:hover": { bgcolor: "rgba(11,73,100,0.95)" },
        }}
      >
        <FullscreenRoundedIcon sx={{ fontSize: 15 }} />
      </IconButton>

      {/* Name overlay */}
      <Box
        sx={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          px: 1, py: 0.75,
          background: "linear-gradient(to top, rgba(7,59,85,0.88) 0%, transparent 100%)",
        }}
      >
        <Typography sx={{ color: "#FFFFFF", fontSize: "0.75rem", fontWeight: 700, lineHeight: 1.2 }} noWrap>
          {cam.display_name}
        </Typography>
        <Typography sx={{ color: "rgba(183,205,211,0.85)", fontSize: "0.625rem", fontWeight: 600 }} noWrap>
          {cam.location_name}
        </Typography>
      </Box>
    </Box>
  );
}

export function LiveViewPage() {
  const { cameras, loading } = useMeghaviCameras();
  const [page, setPage] = useState(0);
  const [fullscreenCam, setFullscreenCam] = useState<MeghaviCamera | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalPages = Math.max(1, Math.ceil(cameras.length / PER_PAGE));
  const onlineCount = cameras.filter((c) => c.status === "active").length;

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setPage((p) => (p + 1) % Math.max(1, Math.ceil(cameras.length / PER_PAGE)));
    }, AUTO_INTERVAL_MS);
  }, [cameras.length]);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer]);

  const goTo = (idx: number) => { setPage(idx); startTimer(); };
  const prev = () => goTo((page - 1 + totalPages) % totalPages);
  const next = () => goTo((page + 1) % totalPages);

  const pageCams = cameras.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}>
      {/* Page title */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography sx={{ fontSize: "1.125rem", fontWeight: 700, color: ds.text, letterSpacing: "-0.01em" }}>
            Live Camera Feeds
          </Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: ds.textSecondary, mt: 0.25 }}>
            {cameras.length} cameras · auto-cycling every 30s
          </Typography>
        </Box>
        {cameras.length > 0 && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1.25, py: 0.5, borderRadius: "8px", bgcolor: `${ds.success}14`, border: `1px solid ${ds.success}33` }}>
            <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: ds.success }} />
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: ds.success }}>
              {onlineCount} / {cameras.length} Active
            </Typography>
          </Box>
        )}
      </Box>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={28} sx={{ color: ds.primary }} />
        </Box>
      )}

      {!loading && cameras.length === 0 && (
        <Box sx={{ py: 8, textAlign: "center" }}>
          <Typography sx={{ fontSize: "0.875rem", color: ds.textMuted }}>No cameras registered yet.</Typography>
        </Box>
      )}

      {!loading && cameras.length > 0 && (
        <>
          {/* Camera grid — 2×2 */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gridTemplateRows: "repeat(2, 1fr)",
              gap: 1.5,
            }}
          >
            {pageCams.map((cam) => (
              <CameraCell key={cam.id} cam={cam} onExpand={setFullscreenCam} />
            ))}
            {Array.from({ length: PER_PAGE - pageCams.length }).map((_, i) => (
              <Box
                key={`empty-${i}`}
                sx={{ borderRadius: "10px", bgcolor: `${ds.primary}08`, border: `1px solid ${ds.border}`, aspectRatio: "16/9" }}
              />
            ))}
          </Box>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
              <IconButton size="small" onClick={prev} sx={{ width: 28, height: 28, color: ds.textSecondary, border: `1px solid ${ds.border}`, borderRadius: "8px" }}>
                <ChevronLeftRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>

              <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <Box
                    key={i}
                    onClick={() => goTo(i)}
                    sx={{
                      width: i === page ? 20 : 7,
                      height: 7,
                      borderRadius: "4px",
                      bgcolor: i === page ? ds.primary : ds.border,
                      cursor: "pointer",
                      transition: "all 220ms cubic-bezier(0.22,1,0.36,1)",
                    }}
                  />
                ))}
              </Box>

              <IconButton size="small" onClick={next} sx={{ width: 28, height: 28, color: ds.textSecondary, border: `1px solid ${ds.border}`, borderRadius: "8px" }}>
                <ChevronRightRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>

              <Typography sx={{ fontSize: "0.75rem", color: ds.textMuted, ml: 1 }}>
                Auto-cycling every 30s
              </Typography>
            </Box>
          )}
        </>
      )}

      {/* Fullscreen dialog */}
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
              <Box sx={{ position: "absolute", bottom: 0, left: 0, right: 0, px: 2.5, py: 2, background: "linear-gradient(to top, rgba(7,59,85,0.9) 0%, transparent 100%)" }}>
                <Typography sx={{ color: "#FFFFFF", fontWeight: 700, fontSize: "0.9375rem" }}>{fullscreenCam.display_name}</Typography>
                <Typography sx={{ color: "rgba(183,205,211,0.80)", fontSize: "0.75rem", mt: 0.25 }}>{fullscreenCam.location_name} · {fullscreenCam.area}</Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
