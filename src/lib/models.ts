import type { Enums } from "@/types/supabase";

export type ModelId = Enums<"model_type">;
export type RiskLevel = Enums<"risk_level">;

export interface ModelInfo {
  id: ModelId;
  name: string;
  shortName: string;
  description: string;
  modality: string;
  accepts: string;
  inputHint: string;
  available: boolean;
  /** Class considered "disease" for recommendation wording. */
  positiveClass?: string;
  condition?: string;
}

/**
 * Model registry. To enable model_2 / model_3: deploy weights to the HF Space,
 * then flip `available` and fill in the metadata here. No API/DB changes needed.
 */
export const MODELS: Record<ModelId, ModelInfo> = {
  model_1: {
    id: "model_1",
    name: "Malaria Cell Classifier",
    shortName: "Malaria",
    description:
      "CNN that detects Plasmodium parasites in segmented red-blood-cell images from thin blood smears.",
    modality: "Microscopy · Blood smear",
    accepts: "image/png,image/jpeg,image/webp,image/bmp",
    inputHint: "Single-cell crop from a Giemsa-stained thin smear (any size; resized to 128×128).",
    available: true,
    positiveClass: "Parasitized",
    condition: "malaria",
  },
  model_2: {
    id: "model_2",
    name: "Model 2",
    shortName: "Coming soon",
    description: "Reserved slot for the next diagnostic model (e.g. chest X-ray).",
    modality: "Radiology",
    accepts: "image/png,image/jpeg,image/webp",
    inputHint: "",
    available: false,
  },
  model_3: {
    id: "model_3",
    name: "Model 3",
    shortName: "Coming soon",
    description: "Reserved slot for the third diagnostic model (e.g. brain MRI).",
    modality: "Radiology",
    accepts: "image/png,image/jpeg,image/webp",
    inputHint: "",
    available: false,
  },
};

export const MODEL_IDS = Object.keys(MODELS) as ModelId[];

export function isModelId(v: string): v is ModelId {
  return (MODEL_IDS as string[]).includes(v);
}

export function buildRecommendations(
  model: ModelInfo,
  predictedClass: string,
  confidence: number,
  risk: RiskLevel,
): string {
  const pct = `${(confidence * 100).toFixed(1)}%`;
  const positive = model.positiveClass && predictedClass === model.positiveClass;
  const lines: string[] = [];

  if (model.id === "model_1") {
    if (positive) {
      lines.push(
        `The AI detected features consistent with **malaria parasites** (${pct} confidence).`,
        risk === "critical" || risk === "high"
          ? "**Seek medical care today.** Malaria can progress quickly — especially in children, pregnant women, and travellers."
          : "Book a clinical review soon to confirm the result.",
        "A clinician should confirm with **microscopy by a trained technician** and/or a **rapid diagnostic test (RDT)** before treatment.",
        "Go to emergency care immediately if you have confusion, seizures, difficulty breathing, dark urine, or persistent vomiting.",
      );
    } else {
      lines.push(
        `No parasites were detected in this cell image (${pct} confidence).`,
        risk === "medium"
          ? "The model was not fully certain — consider re-testing with additional cells or a rapid diagnostic test."
          : "If you still have fever, chills, or recent travel to a malaria-endemic area, ask a clinician about further testing — a single cell cannot rule out infection.",
      );
    }
  } else {
    lines.push(`Predicted **${predictedClass}** with ${pct} confidence (risk: ${risk}).`);
  }
  lines.push("_This AI result is decision support only and must be validated by a licensed doctor._");
  return lines.join("\n\n");
}

export const RISK_STYLES: Record<RiskLevel, { label: string; className: string; dot: string }> = {
  low: { label: "Low", className: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  medium: { label: "Medium", className: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  high: { label: "High", className: "bg-orange-50 text-orange-700 ring-orange-200", dot: "bg-orange-500" },
  critical: { label: "Critical", className: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
};
