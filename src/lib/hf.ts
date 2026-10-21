import "server-only";

import type { ModelId, RiskLevel } from "@/lib/models";

export interface HfPrediction {
  model_id: string;
  model_name?: string;
  predicted_class: string;
  confidence: number;
  probabilities: Record<string, number>;
  risk_level: RiskLevel;
  inference_ms?: number;
}

export class HfError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Forwards an image to the HF Space inference API with the shared bearer secret. */
export async function predictWithSpace(modelId: ModelId, file: Blob, filename: string): Promise<HfPrediction> {
  const base = process.env.HF_SPACE_API_URL;
  const secret = process.env.HF_API_SECRET;
  if (!base || !secret) throw new HfError("AI service is not configured", 503);

  const form = new FormData();
  form.append("file", file, filename);

  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/$/, "")}/predict/${modelId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(55_000),
    });
  } catch (e) {
    const timeout = e instanceof Error && e.name === "TimeoutError";
    throw new HfError(timeout ? "AI service timed out (it may be waking up — retry in a minute)" : "AI service unreachable", 504);
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail ?? j);
    } catch {}
    throw new HfError(`AI service error: ${detail}`, res.status === 503 ? 503 : 502);
  }
  return (await res.json()) as HfPrediction;
}
