import { Box } from "@mui/material";
import { loginPalette } from "./loginTheme";

export function LoginHeroBackdrop() {
  return (
    <>
      {/* Grid overlay */}
      <Box
        aria-hidden
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, #000 40%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, #000 40%, transparent 100%)",
        }}
      />
      {/* Orange glow — top-left */}
      <Box
        aria-hidden
        sx={{
          position: "fixed",
          top: "-15%",
          left: "-10%",
          width: "45%",
          paddingBottom: "45%",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${loginPalette.glowOrange}33 0%, transparent 70%)`,
          zIndex: 0,
          pointerEvents: "none",
        }}
      />
      {/* Blue glow — bottom-right */}
      <Box
        aria-hidden
        sx={{
          position: "fixed",
          bottom: "-15%",
          right: "-10%",
          width: "45%",
          paddingBottom: "45%",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${loginPalette.glowBlue}33 0%, transparent 70%)`,
          zIndex: 0,
          pointerEvents: "none",
        }}
      />
    </>
  );
}
