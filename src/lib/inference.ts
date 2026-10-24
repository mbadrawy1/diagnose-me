import "server-only";

import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";
import sharp from "sharp";
import { MODELS, type ModelId, type RiskLevel } from "@/lib/models";
import { predictWithSpace, type HfPrediction } from "@/lib/hf";

// Minimal interface covering both onnxruntime-node and onnxruntime-web
interface GenericSession {
  inputNames: readonly string[];
  outputNames: readonly string[];
  run(feeds: Record<string, any>): Promise<Record<string, { data: Float32Array | number[] }>>;
}

interface GenericOrt {
  InferenceSession: {
    create(
      uriOrBuffer: string | Uint8Array | ArrayBufferLike,
      options?: any
    ): Promise<GenericSession>;
  };
  Tensor: new (
    type: "float32",
    data: Float32Array,
    dims: number[]
  ) => any;
  env?: {
    wasm?: {
      wasmPaths?: any;
    };
  };
}

let ortModule: GenericOrt | null = null;
const sessionCache = new Map<string, GenericSession>();

async function getOrt(): Promise<GenericOrt> {
  if (ortModule) return ortModule;

  // 1. Try native onnxruntime-node (high-performance C++ execution)
  try {
    const nodeOrt = await import("onnxruntime-node");
    if (nodeOrt?.InferenceSession && nodeOrt?.Tensor) {
      ortModule = nodeOrt as unknown as GenericOrt;
      return ortModule;
    }
  } catch (nodeErr) {
    console.warn("onnxruntime-node unavailable, attempting onnxruntime-web fallback:", nodeErr);
  }

  // 2. Fall back to onnxruntime-web (WASM)
  try {
    const webOrt = await import("onnxruntime-web");
    try {
      const wasmDir = path.join(process.cwd(), "node_modules", "onnxruntime-web", "dist");
      if (fs.existsSync(wasmDir)) {
        if (webOrt.env?.wasm) {
          webOrt.env.wasm.wasmPaths = pathToFileURL(wasmDir).href + "/";
        }
      } else if (webOrt.env?.wasm) {
        webOrt.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/";
      }
    } catch (wasmPathErr) {
      console.warn("Could not configure wasmPaths:", wasmPathErr);
    }

    ortModule = webOrt as unknown as GenericOrt;
    return ortModule;
  } catch (webErr) {
    console.error("Neither onnxruntime-node nor onnxruntime-web could be loaded:", webErr);
    throw new Error("No ONNX runtime library could be loaded on server");
  }
}

async function getOrLoadSession(
  modelId: ModelId
): Promise<{ session: GenericSession; ort: GenericOrt } | null> {
  const ort = await getOrt();

  if (sessionCache.has(modelId)) {
    return { session: sessionCache.get(modelId)!, ort };
  }

  // 1. Look for candidate local model files
  const candidates = [
    path.join(process.cwd(), "hf-space", "models", `${modelId}.int8.onnx`),
    path.join(process.cwd(), "public", "models", `${modelId}.int8.onnx`),
    path.join(process.cwd(), "models", `${modelId}.int8.onnx`),
    path.join(process.cwd(), "hf-space", "models", `${modelId}.onnx`),
    path.join(process.cwd(), "public", "models", `${modelId}.onnx`),
    path.join(process.cwd(), "models", `${modelId}.onnx`),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(/*turbopackIgnore: true*/ candidate)) {
      try {
        let session: GenericSession;
        try {
          // Native node runtime can load directly from file path
          session = await ort.InferenceSession.create(candidate);
        } catch {
          // Fall back to buffer loading
          const fileBuffer = fs.readFileSync(/*turbopackIgnore: true*/ candidate);
          session = await ort.InferenceSession.create(new Uint8Array(fileBuffer));
        }

        sessionCache.set(modelId, session);
        return { session, ort };
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
      return { session, ort };
    }
  } catch (err) {
    console.warn("Failed to download model from HF Hub:", err);
  }

  return null;
}

export function parseEcgFloats(input: string | Buffer | number[]): number[] {
  let numbers: number[] = [];
  if (Array.isArray(input)) {
    numbers = input.map(Number);
  } else {
    const text = (typeof input === "string" ? input : input.toString("utf-8")).trim();
    if (text.startsWith("[") || text.startsWith("{")) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          numbers = parsed.map(Number);
        } else if (parsed && Array.isArray(parsed.signal)) {
          numbers = parsed.signal.map(Number);
        }
      } catch {
        // Fallback to text parsing below
      }
    }
    if (numbers.length === 0) {
      const cleaned = text.replace(/,/g, " ").replace(/[\r\n]+/g, " ");
      numbers = cleaned.split(/\s+/).filter(Boolean).map(Number);
    }
  }

  // Filter out any NaN
  numbers = numbers.filter((n) => !isNaN(n));

  // If 188 values, MIT-BIH row includes the label at index 187; slice to 187
  if (numbers.length === 188) {
    numbers = numbers.slice(0, 187);
  } else if (numbers.length < 187) {
    numbers = [...numbers, ...new Array(187 - numbers.length).fill(0)];
  } else if (numbers.length > 187) {
    numbers = numbers.slice(0, 187);
  }

  return numbers;
}

const ECG_CLASSES = [
  "N - Normal",
  "S - Supraventricular ectopic",
  "V - Ventricular ectopic",
  "F - Fusion beat",
  "Q - Unknown/unclassifiable",
];

export async function runDiagnosticInference(
  modelId: ModelId,
  fileBytes: Buffer,
  filename: string,
  signalArray?: number[]
): Promise<HfPrediction> {
  const modelMeta = MODELS[modelId];
  if (!modelMeta) throw new Error(`Unknown model: ${modelId}`);

  // 1. If HF_SPACE_API_URL and secret are configured, try Hugging Face Space first
  if (process.env.HF_SPACE_API_URL && process.env.HF_API_SECRET) {
    try {
      const hfResult = await predictWithSpace(
        modelId,
        new Blob([new Uint8Array(fileBytes)]),
        filename,
        signalArray
      );
      return hfResult;
    } catch (spaceErr) {
      console.warn("HF Space inference unavailable, using on-device CPU ONNX fallback:", spaceErr);
    }
  }

  // 2. CPU ONNX Inference fallback
  const loaded = await getOrLoadSession(modelId);
  if (!loaded) {
    throw new Error(`Inference engine for ${modelId} could not be initialized`);
  }
  const { session, ort } = loaded;

  const t0 = performance.now();

  // Model 2: 1D ECG Arrhythmia Classifier
  if (modelId === "model_2") {
    const floats = signalArray && signalArray.length > 0
      ? parseEcgFloats(signalArray)
      : parseEcgFloats(fileBytes);

    const inputTensor = new ort.Tensor("float32", new Float32Array(floats), [1, 187, 1]);
    const inputName = session.inputNames[0];
    const outputName = session.outputNames[0];

    const results = await session.run({ [inputName]: inputTensor });
    const rawOutput = results[outputName].data;

    let probsList = Array.from(rawOutput).map(Number);
    // Apply softmax if logits
    const sum = probsList.reduce((acc, v) => acc + v, 0);
    if (Math.abs(sum - 1.0) > 0.05) {
      const maxVal = Math.max(...probsList);
      const expVals = probsList.map((v) => Math.exp(v - maxVal));
      const expSum = expVals.reduce((acc, v) => acc + v, 0);
      probsList = expVals.map((v) => v / expSum);
    }

    const probabilities: Record<string, number> = {};
    let maxIdx = 0;
    let maxProb = -1;

    ECG_CLASSES.forEach((cls, idx) => {
      const p = Math.max(0, Math.min(1, probsList[idx] || 0));
      probabilities[cls] = Math.round(p * 10000) / 10000;
      if (p > maxProb) {
        maxProb = p;
        maxIdx = idx;
      }
    });

    const predictedClass = ECG_CLASSES[maxIdx];
    const confidence = maxProb;
    let riskLevel: RiskLevel = "low";

    if (predictedClass.startsWith("N")) {
      riskLevel = "low";
    } else if (predictedClass.startsWith("S")) {
      riskLevel = confidence > 0.85 ? "high" : "medium";
    } else if (predictedClass.startsWith("V")) {
      riskLevel = confidence > 0.85 ? "critical" : "high";
    } else if (predictedClass.startsWith("F") || predictedClass.startsWith("Q")) {
      riskLevel = "medium";
    }

    const inferenceMs = performance.now() - t0;

    return {
      model_id: modelId,
      model_name: modelMeta.name,
      predicted_class: predictedClass,
      confidence: Math.round(confidence * 10000) / 10000,
      probabilities,
      risk_level: riskLevel,
      inference_ms: Math.round(inferenceMs * 10) / 10,
      signal_preview: floats,
    };
  }

  // Model 1: Malaria cell image classifier
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
