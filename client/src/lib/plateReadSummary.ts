export type PlateReadTrust = "high" | "medium" | "low";

export interface PlateReadFields {
  ocr_confidence?: number | null;
  detection_confidence?: number | null;
  num_photos?: number | null;
  is_partial?: boolean | null;
  is_night?: boolean | null;
  manual_override?: boolean | null;
  plate_text?: string | null;
}

export interface PlateReadSummary {
  trust: PlateReadTrust | null;
  trustLabel: string;
  expectedAccuracy: string | null;
  riskChips: { code: string; label: string }[];
  ocrPct: number | null;
  photoLabel: string;
  reasons: string[];
  showWhy: boolean;
}

export function buildPlateReadSummary(row: PlateReadFields): PlateReadSummary | null {
  const ocr = row.ocr_confidence ?? null;
  const det = row.detection_confidence ?? null;
  const photos = row.num_photos ?? null;
  const isPartial = row.is_partial ?? false;
  const isNight = row.is_night ?? false;
  const manual = row.manual_override ?? false;

  if (ocr == null && det == null) return null;

  const ocrPct = ocr != null ? Math.round(ocr > 1 ? ocr : ocr * 100) : null;
  const detPct = det != null ? Math.round(det > 1 ? det : det * 100) : null;

  const riskChips: { code: string; label: string }[] = [];
  const reasons: string[] = [];

  if (isPartial) riskChips.push({ code: "partial", label: "Partial plate" });
  if (isNight)   riskChips.push({ code: "night",   label: "Low light"    });
  if (manual)    riskChips.push({ code: "manual",  label: "Manual entry" });

  let trust: PlateReadTrust;
  let trustLabel: string;
  let expectedAccuracy: string | null = null;

  const score = ocrPct ?? detPct ?? 0;

  if (manual) {
    trust = "high";
    trustLabel = "Manually verified";
    reasons.push("Plate was manually confirmed by an operator.");
  } else if (score >= 85 && !isPartial) {
    trust = "high";
    trustLabel = "High confidence";
    expectedAccuracy = "Expected accuracy: >95%";
    reasons.push("OCR and detection scores are strong.");
  } else if (score >= 60) {
    trust = "medium";
    trustLabel = "Medium confidence";
    expectedAccuracy = "Expected accuracy: 70–94%";
    if (ocrPct != null && ocrPct < 85) reasons.push(`OCR confidence is ${ocrPct}% — moderate.`);
    if (isPartial) reasons.push("Plate may be partially obscured.");
    if (isNight)   reasons.push("Low-light image reduces read quality.");
  } else {
    trust = "low";
    trustLabel = "Low confidence";
    expectedAccuracy = "Expected accuracy: <70%";
    if (ocrPct != null) reasons.push(`OCR confidence is only ${ocrPct}%.`);
    if (isPartial) reasons.push("Plate is not fully visible.");
    if (isNight)   reasons.push("Poor lighting conditions.");
    if (!reasons.length) reasons.push("Confidence scores are low.");
  }

  const photoLabel =
    photos == null
      ? "Plate photo: unknown"
      : photos === 0
      ? "Plate photo: none"
      : isPartial
      ? `Plate photo: Hard to read (${photos} frame${photos !== 1 ? "s" : ""})`
      : `Plate photo: Clear (${photos} frame${photos !== 1 ? "s" : ""})`;

  return {
    trust,
    trustLabel,
    expectedAccuracy,
    riskChips,
    ocrPct,
    photoLabel,
    reasons,
    showWhy: trust !== "high" || riskChips.length > 0,
  };
}

export function trustChipColors(trust: PlateReadTrust | null): {
  bgcolor: string;
  color: string;
  borderColor: string;
} {
  if (trust === "high")   return { bgcolor: "rgba(22,163,74,0.10)",   color: "#15803D", borderColor: "rgba(22,163,74,0.25)"   };
  if (trust === "medium") return { bgcolor: "rgba(245,158,11,0.10)",  color: "#92400E", borderColor: "rgba(245,158,11,0.28)"  };
  if (trust === "low")    return { bgcolor: "rgba(220,38,38,0.10)",   color: "#B91C1C", borderColor: "rgba(220,38,38,0.25)"   };
  return                         { bgcolor: "rgba(148,163,184,0.10)", color: "#475569", borderColor: "rgba(148,163,184,0.25)" };
}
