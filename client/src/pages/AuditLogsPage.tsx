import { useState } from "react";
import { Box, Typography, Button, Dialog, DialogContent, DialogTitle, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import { pageLayoutSx } from "../lib/uiSurfaces";
import { ds } from "../lib/dsTokens";
import { UserAuditExplorer } from "../components/audit/UserAuditExplorer";
import { AuditTrail } from "../components/audit/AuditTrail";

export function AuditLogsPage() {
  const [trailOpen, setTrailOpen] = useState(false);

  return (
    <Box sx={pageLayoutSx}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5, flexWrap: "wrap", gap: 1 }}>
        <Box>
          <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: ds.text }}>Audit Logs</Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: ds.textSecondary, mt: 0.25 }}>
            Per-user activity history, session breakdown, and cross-user audit trail.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<ManageSearchIcon />}
          onClick={() => setTrailOpen(true)}
          sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 600, fontSize: "0.8125rem" }}
        >
          Full Audit Trail
        </Button>
      </Box>

      <UserAuditExplorer />

      {/* Full trail dialog */}
      <Dialog open={trailOpen} onClose={() => setTrailOpen(false)} maxWidth="xl" fullWidth PaperProps={{ sx: { borderRadius: "16px", maxHeight: "90vh" } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1, borderBottom: `1px solid ${ds.border}` }}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: ds.text }}>Full Audit Trail</Typography>
          <IconButton size="small" onClick={() => setTrailOpen(false)}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2, overflowY: "auto" }}>
          <AuditTrail />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
