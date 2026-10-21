import "server-only";

import path from "path";
import fs from "fs";
import sharp from "sharp";
import * as ort from "onnxruntime-node";
import { MODELS, type ModelId, type RiskLevel } from "@/lib/models";
import { predictWithSpace, type HfPrediction } from "@/lib/hf";

// Cache ONNX sessions in memory across serverless warm invocations
const sessionCache = new Map<string, ort.InferenceSession>();

async function getOrLoadSession(modelId: ModelId): Promise<ort.InferenceSession | null> {
  if (sessionCache.has(modelId)) {
    return sessionCache.get(modelId)!;
  }

  // 1. Try local model files
  const candidates = [
    path.join(process.cwd(), "hf-space", "models", `${modelId}.int8.onnx`),
    path.join(process.cwd(), "hf-space", "models", `${modelId}.onnx`),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(/*turbopackIgnore: true*/ candidate)) {
      try {
        const session = await ort.InferenceSession.create(candidate);
        sessionCache.set(modelId, session);
        return session;
      } catch (err) {
        console.warn(`Failed to load candidate ${candidate}:`, err);
      }
    }
  }

  // 2. Fetch from Hugging Face Hub repository if not found locally
  try {
    const hfModelUrl = `https://huggingface.co/mbadrawy/diagnose-me-models/resolve/main/${modelId}.int8.onnx`;
    const res = await fetch(hfModelUrl, { cache: "force-cache" });
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const session = await ort.InferenceSession.create(new Uint8Array(buffer));
      sessionCache.set(modelId, session);
      return session;
    }
  } catch (err) {
    console.warn("Failed to download model from HF Hub:", err);
  }

  return null;
}

export async function runDiagnosticInference(
  modelId: ModelId,
  fileBytes: Buffer,
  filename: string
): Promise<HfPrediction> {
  const modelMeta = MODELS[modelId];
  if (!modelMeta) throw new Error(`Unknown model: ${modelId}`);

  // 1. If HF_SPACE_API_URL is configured, try the Hugging Face Space first
  if (process.env.HF_SPACE_API_URL && process.env.HF_API_SECRET) {
    try {
      const hfResult = await predictWithSpace(
        modelId,
        new Blob([new Uint8Array(fileBytes)]),
        filename
      );
      return hfResult;
    } catch (spaceErr) {
      console.warn("HF Space inference unavailable, using on-device CPU ONNX fallback:", spaceErr);
    }
  }

  // 2. CPU ONNX Inference fallback
  const session = await getOrLoadSession(modelId);
  if (!session) {
    throw new Error(`Inference engine for ${modelId} could not be initialized`);
  }

  const t0 = performance.now();

  // Resize and preprocess image to 128x128 RGB
  const { data } = await sharp(fileBytes)
    .resize(128, 128, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const float32Array = new Float32Array(1 * 128 * 128 * 3);
  for (let i = 0; i < data.length; i++) {
    float32Array[i] = data[i] / 255.0;
  }

  const inputTensor = new ort.Tensor("float32", float32Array, [1, 128, 128, 3]);
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];

  const results = await session.run({ [inputName]: inputTensor });
  const rawOutput = results[outputName].data;
  const sigmoidVal = Math.max(0, Math.min(1, Number(rawOutput[0])));

  const pParasitized = sigmoidVal;
  const pUninfected = 1.0 - sigmoidVal;

  let predictedClass = "Uninfected";
  let confidence = pUninfected;
  let riskLevel: RiskLevel = "low";

  if (pParasitized >= 0.5) {
    predictedClass = "Parasitized";
    confidence = pParasitized;
  }

  // Risk thresholds
  if (pParasitized >= 0.8) {
    riskLevel = "critical";
  } else if (pParasitized >= 0.5) {
    riskLevel = "high";
  } else if (pParasitized >= 0.25) {
    riskLevel = "medium";
  } else {
    riskLevel = "low";
  }

  const inferenceMs = performance.now() - t0;

  return {
    model_id: modelId,
    model_name: modelMeta.name,
    predicted_class: predictedClass,
    confidence: Math.round(confidence * 10000) / 10000,
    probabilities: {
      Uninfected: Math.round(pUninfected * 10000) / 10000,
      Parasitized: Math.round(pParasitized * 10000) / 10000,
    },
    risk_level: riskLevel,
    inference_ms: Math.round(inferenceMs * 10) / 10,
  };
}
