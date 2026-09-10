import { useEffect, useMemo, useState } from "react";
import { Box } from "@mui/material";
import { MeghaviDashboardView } from "../components/dashboard/meghavi/MeghaviDashboardView";
import { MastheadDashboardToolbar } from "../components/MastheadDashboardToolbar";
import { useShellHeader } from "../context/ShellHeaderContext";
import { pageLayoutSx } from "../lib/uiSurfaces";
import {
  type DatePreset, datedRangeFromPreset, defaultLast7Range, normalizeCustomRange,
} from "../lib/dashboardRange";

export function DashboardPage() {
  const { setRightSlot } = useShellHeader();

  const [preset, setPreset] = useState<DatePreset>("last7");
  const initial = defaultLast7Range();
  const [customFrom, setCustomFrom] = useState(initial.from);
  const [customTo, setCustomTo] = useState(initial.to);

  const { from, to } = useMemo(() => {
    if (preset === "custom") return normalizeCustomRange(customFrom, customTo);
    return datedRangeFromPreset(preset, customFrom, customTo);
  }, [preset, customFrom, customTo]);

  useEffect(() => {
    setRightSlot(
      <MastheadDashboardToolbar
        preset={preset}
        onPresetChange={setPreset}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
        resolvedFrom={from}
        resolvedTo={to}
        onResetToToday={() => {
          const d = defaultLast7Range();
          setPreset("last7");
          setCustomFrom(d.from);
          setCustomTo(d.to);
        }}
      />
    );
    return () => setRightSlot(null);
  }, [setRightSlot, preset, customFrom, customTo, from, to]);

  return (
    <Box sx={pageLayoutSx}>
      <MeghaviDashboardView from={from} to={to} />
    </Box>
  );
}

