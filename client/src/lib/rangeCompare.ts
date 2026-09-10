export type RangeDelta = {
  pct: number | null;
  direction: "up" | "down" | "flat";
  label: string;
};

export function computeRangeDelta(
  current: number,
  previous: number,
  periodLabel = "vs prev period"
): RangeDelta {
  if (previous === 0 && current === 0) {
    return { pct: null, direction: "flat", label: "No change" };
  }
  if (previous === 0) {
    return { pct: null, direction: "up", label: periodLabel };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  const direction: RangeDelta["direction"] = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  return { pct: Math.abs(pct), direction, label: periodLabel };
}
