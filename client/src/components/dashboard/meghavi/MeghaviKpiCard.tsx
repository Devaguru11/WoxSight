
import React from "react";
import { Box, Typography } from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import { ds } from "../../../lib/dsTokens";

export interface MeghaviKpiCardProps {
  title: string;
  value: string | number;
  unit?: string;
  delta: number;
  deltaLabel: string;
  comparison: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  isPositiveGood?: boolean;
  onClick?: () => void;
}

export function MeghaviKpiCard({
  title,
  value,
  unit,
  delta,
  deltaLabel,
  comparison,
  icon,
  iconBg,
  iconColor,
  isPositiveGood = true,
  onClick,
}: MeghaviKpiCardProps) {
  const isUp = delta >= 0;
  const isGood = isPositiveGood ? isUp : !isUp;
  const trendColor = isGood ? ds.success : ds.danger;

  return (
    <Box
      onClick={onClick}
      sx={{
        p: 2,
        borderRadius: "12px",
        bgcolor: ds.cardBg,
        border: `1px solid ${iconColor}55`,
        boxShadow: ds.cardShadow,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        cursor: onClick ? "pointer" : "default",
        transition: "transform 150ms ease, box-shadow 150ms ease",
        "&:hover": onClick
          ? { transform: "translateY(-1px)", boxShadow: `0 6px 20px ${iconColor}25` }
          : undefined,
      }}
    >
      {/* Icon */}
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: "10px",
          bgcolor: iconBg,
          color: iconColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          "& svg": { fontSize: 22 },
        }}
      >
        {icon}
      </Box>

      {/* Content */}
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{ fontSize: "0.6875rem", fontWeight: 600, color: ds.textMuted, letterSpacing: "0.05em", textTransform: "uppercase" }}
          noWrap
        >
          {title}
        </Typography>

        <Typography sx={{ fontSize: "1.375rem", fontWeight: 800, color: ds.text, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
          {value}
          {unit && (
            <Box component="span" sx={{ fontSize: "0.9375rem", fontWeight: 600, color: ds.textSecondary, ml: 0.4 }}>
              {unit}
            </Box>
          )}
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.4, mt: 0.2 }}>
          {isUp
            ? <TrendingUpIcon sx={{ fontSize: 13, color: trendColor }} />
            : <TrendingDownIcon sx={{ fontSize: 13, color: trendColor }} />}
          <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: trendColor }}>
            {deltaLabel}
          </Typography>
          <Typography sx={{ fontSize: "0.6875rem", color: ds.textMuted }} noWrap>
            {comparison}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
