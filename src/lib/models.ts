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
    name: "Model 2: ECG Heartbeat Arrhythmia Classifier (MIT-BIH 5-Class 1D-CNN)",
    shortName: "ECG Arrhythmia",
    description:
      "1D Convolutional Neural Network that classifies 187-step single heartbeat ECG traces into 5 MIT-BIH arrhythmia categories.",
    modality: "Cardiology · 1D ECG",
    accepts: ".csv,.txt,text/csv,text/plain,application/json",
    inputHint: "Single ECG heartbeat of 187 time steps (normalized 0.0–1.0). Upload .csv/.txt or select a sample beat.",
    available: true,
    condition: "arrhythmia",
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
  const lines: string[] = [];

  if (model.id === "model_1") {
    const positive = model.positiveClass && predictedClass === model.positiveClass;
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
  } else if (model.id === "model_2") {
    const isNormal = predictedClass.startsWith("N");
    const isSVE = predictedClass.startsWith("S");
    const isPVC = predictedClass.startsWith("V");
    const isFusion = predictedClass.startsWith("F");

    if (isNormal) {
      lines.push(
        `The 1D-CNN classified this heartbeat as **Normal Sinus Rhythm (N)** with **${pct} confidence** (Risk: **${risk.toUpperCase()}**).`,
        "No acute ventricular ectopic triggers, premature atrial contractions, or aberrant conduction morphology were identified in this 187-step cardiac segment.",
        "**Clinical Recommendation:** Continue standard cardiovascular wellness. Maintain healthy blood pressure, balanced electrolyte intake, and regular aerobic exercise.",
        "If you experience intermittent palpitations, dizziness, or lightheadedness, request a continuous multi-lead ECG or 24-hour Holter monitor from your physician."
      );
    } else if (isPVC) {
      lines.push(
        `The 1D-CNN detected a **Premature Ventricular Contraction / Ventricular Ectopic Beat (V)** with **${pct} confidence** (Risk: **${risk.toUpperCase()}**).`,
        "This beat demonstrates premature ventricular depolarisation with broad QRS morphology and discordant repolarisation, bypassing the normal His-Purkinje conduction pathway.",
        risk === "critical"
          ? "**Urgent Clinical Attention Advised:** High-confidence ventricular ectopic rhythms carry elevated clinical risk. If you experience chest pain, shortness of breath, sudden sweating, or fainting, seek immediate emergency medical care."
          : "**Clinical Recommendation:** Schedule a cardiology consultation for resting 12-lead ECG and echocardiogram to evaluate PVC burden and underlying myocardium health.",
        "Minimize cardiac stimulants (excess caffeine, nicotine, pseudoephedrine) which can trigger ventricular ectopy."
      );
    } else if (isSVE) {
      lines.push(
        `The 1D-CNN identified a **Supraventricular Ectopic Beat (S)** with **${pct} confidence** (Risk: **${risk.toUpperCase()}**).`,
        "Ectopic pacemaker originates above the ventricles (premature atrial or junctional contraction). While often benign, frequent occurrences may trigger sustained supraventricular tachycardia (SVT) or atrial fibrillation.",
        "**Clinical Recommendation:** Keep a symptom diary noting episode triggers. Discuss with a physician whether a 24-to-48 hour ambulatory Holter monitor or thyroid/electrolyte panel is indicated.",
        "Reduce caffeine and alcohol intake, ensure adequate hydration and restorative sleep."
      );
    } else if (isFusion) {
      lines.push(
        `The 1D-CNN identified a **Fusion Beat (F)** with **${pct} confidence** (Risk: **${risk.toUpperCase()}**).`,
        "Concurrent cardiac activation occurred simultaneously from both the normal sinus pacemaker and an ectopic ventricular focus.",
        "**Clinical Recommendation:** Clinical review by a cardiologist is advised to evaluate for competing ventricular pacemaker foci.",
        "Recommend correlation with continuous ambulatory telemetry and 12-lead diagnostic electrocardiogram."
      );
    } else {
      lines.push(
        `The 1D-CNN classified this heartbeat as **Unclassifiable / Atypical Waveform (Q)** with **${pct} confidence** (Risk: **${risk.toUpperCase()}**).`,
        "The heartbeat trace presents atypical morphology, baseline wander, or electrode noise that diverges from canonical MIT-BIH morphological archetypes.",
        "**Clinical Recommendation:** Repeat the ECG recording ensuring skin preparation, solid electrode adhesion, and patient resting immobility.",
        "Consult your healthcare provider if irregular pulse or palpitations persist."
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
