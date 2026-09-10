import { Box } from "@mui/material";
import { LoginOperationalDashboard } from "../components/login/LoginOperationalDashboard";
import { LoginSecureSignIn } from "../components/login/LoginSecureSignIn";
import { loginPalette } from "../components/login/loginTheme";

export function LoginPage() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        height: "100vh",
        overflow: { xs: "auto", lg: "hidden" },
        display: "grid",
        gridTemplateColumns: { xs: "1fr", lg: "1.1fr 0.9fr" },
        bgcolor: loginPalette.panelBg,
      }}
    >
      <LoginOperationalDashboard />
      <LoginSecureSignIn />
    </Box>
  );
}
