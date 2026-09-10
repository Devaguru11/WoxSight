import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import Hls from "hls.js";
import { apiBase } from "../lib/api";
import { getAccessToken } from "../auth/tokenStore";

type Props = { streamId: string; compact?: boolean };

export function LiveStreamPlayer({ streamId }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const src = `${apiBase}/streams/${encodeURIComponent(streamId)}/hls/index.m3u8`;
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls({
        xhrSetup(xhr) {
          const token = getAccessToken();
          if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        },
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.play().catch(() => {});
    }

    return () => { hls?.destroy(); };
  }, [streamId]);

  return (
    <Box
      component="video"
      ref={videoRef}
      muted
      playsInline
      autoPlay
      sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
    />
  );
}
