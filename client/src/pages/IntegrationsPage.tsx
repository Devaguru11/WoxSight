import { Box, Paper, Typography, Chip, Button, Switch } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";

export function IntegrationsPage() {
  const integrations = [
    {
      title: "Hikvision / Dahua RTSP Streams",
      category: "Video Ingest",
      desc: "Live RTSP and ONVIF camera video feeds with hardware H.264/H.265 hardware decoding.",
      status: "Connected (4 Cameras)",
      icon: <VideocamOutlinedIcon sx={{ fontSize: 24, color: "#0D9488" }} />,
      enabled: true,
    },
    {
      title: "Campus ERP & Attendance System",
      category: "Appointment Sync",
      desc: "Synchronises walk-in queue and campus scheduling data to detect service delays automatically.",
      status: "Active",
      icon: <HubOutlinedIcon sx={{ fontSize: 24, color: "#0284C7" }} />,
      enabled: true,
    },
    {
      title: "WoxSight CV Edge Inference",
      category: "AI Analytics Engine",
      desc: "Real-time tripwire detection, visitor dwell time calculation, and staff coverage tracking.",
      status: "Operational · 12ms Latency",
      icon: <StorageOutlinedIcon sx={{ fontSize: 24, color: "#10B981" }} />,
      enabled: true,
    },
    {
      title: "SMS & WhatsApp Dispatcher",
      category: "Alert Notification",
      desc: "Instant notifications sent to campus security when waiting times or crowd thresholds are exceeded.",
      status: "Configured",
      icon: <NotificationsActiveOutlinedIcon sx={{ fontSize: 24, color: "#F97316" }} />,
      enabled: true,
    },
  ];

  return (
    <Box sx={{ position: "relative", width: "100%", pb: 3 }}>
      {/* Blurred content */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2.5,
          filter: "blur(4px)",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        <Box>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0A4D52" }}>
            Integrations & Connected Systems
          </Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "#64748B", mt: 0.25 }}>
            Manage connected cameras, inference models, and campus alerting webhooks
          </Typography>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2.5 }}>
          {integrations.map((item) => (
            <Paper
              key={item.title}
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: "14px",
                bgcolor: "#FFFFFF",
                border: "1px solid #E2ECE9",
                boxShadow: "0 1px 4px rgba(10, 77, 82, 0.05)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 1.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: "10px",
                        bgcolor: "#F4F9F8",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {item.icon}
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#1E293B" }}>
                        {item.title}
                      </Typography>
                      <Typography sx={{ fontSize: "0.75rem", color: "#64748B" }}>
                        {item.category}
                      </Typography>
                    </Box>
                  </Box>
                  <Switch defaultChecked={item.enabled} color="primary" />
                </Box>

                <Typography sx={{ fontSize: "0.8125rem", color: "#64748B", lineHeight: 1.5, mb: 2 }}>
                  {item.desc}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pt: 1.5, borderTop: "1px solid #F1F5F9" }}>
                <Chip
                  label={item.status}
                  size="small"
                  sx={{ bgcolor: "#ECFDF5", color: "#059669", fontWeight: 700, fontSize: "0.75rem" }}
                />
                <Button size="small" sx={{ textTransform: "none", fontWeight: 700, color: "#0A4D52" }}>
                  Configure →
                </Button>
              </Box>
            </Paper>
          ))}
        </Box>
      </Box>

      {/* Coming Soon overlay */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1.5,
            px: 5,
            py: 4,
            borderRadius: "20px",
            bgcolor: "rgba(255, 255, 255, 0.92)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 8px 32px rgba(10, 77, 82, 0.18)",
            border: "1px solid rgba(10, 77, 82, 0.12)",
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: "14px",
              bgcolor: "#F0FAF9",
              border: "1px solid #C7E4E1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LockOutlinedIcon sx={{ fontSize: 28, color: "#0A4D52" }} />
          </Box>
          <Typography sx={{ fontSize: "1.375rem", fontWeight: 800, color: "#0A4D52", letterSpacing: "-0.01em" }}>
            Coming Soon
          </Typography>
          <Typography sx={{ fontSize: "0.875rem", color: "#64748B", textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
            Integrations & camera management is under development and will be available in a future release.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
