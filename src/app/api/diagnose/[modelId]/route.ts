import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MODELS, buildRecommendations, isModelId } from "@/lib/models";
import { runDiagnosticInference } from "@/lib/inference";
import type { Json } from "@/types/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/bmp", "image/tiff"]);
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
};

export async function POST(request: Request, { params }: { params: Promise<{ modelId: string }> }) {
  try {
    const { modelId } = await params;
    if (!isModelId(modelId)) {
      return NextResponse.json({ error: "Unknown diagnostic model" }, { status: 404 });
    }
    const model = MODELS[modelId];
    if (!model.available) {
      return NextResponse.json({ error: `${model.name} is currently in calibration. Model 1 is active.` }, { status: 409 });
    }

    // 1. Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in to submit scans." }, { status: 401 });
    }

    // 2. Validate file upload
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form payload" }, { status: 400 });
    }

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Please upload an image file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File size exceeds the 10 MB limit" }, { status: 413 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: "Supported formats: PNG, JPEG, WEBP, BMP, TIFF" }, { status: 415 });
    }

    // 3. Upload file to Supabase Storage bucket 'medical-files'
    const ext = EXT[file.type] || "png";
    const storagePath = `${user.id}/${modelId}/${crypto.randomUUID()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("medical-files")
      .upload(storagePath, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // 4. Run AI Inference (HF Space or high-performance CPU ONNX fallback)
    let prediction;
    try {
      prediction = await runDiagnosticInference(modelId, buffer, file.name || "scan.png");
    } catch (infErr) {
      console.error("Inference execution error:", infErr);
      await supabase.storage.from("medical-files").remove([storagePath]);
      return NextResponse.json(
        { error: infErr instanceof Error ? infErr.message : "Inference engine failed" },
        { status: 502 }
      );
    }

    // 5. Build AI recommendations
    const recommendations = buildRecommendations(
      model,
      prediction.predicted_class,
      prediction.confidence,
      prediction.risk_level
    );

    // 6. Persist report via secure Supabase RPC 'submit_diagnostic_report'
    const { data: report, error: rpcErr } = await supabase.rpc("submit_diagnostic_report", {
      p_model_used: modelId,
      p_file_storage_path: storagePath,
      p_prediction_result: prediction as unknown as Json,
      p_confidence_score: prediction.confidence,
      p_risk_level: prediction.risk_level,
      p_ai_recommendations: recommendations,
    });

    if (rpcErr || !report) {
      console.error("RPC report error:", rpcErr);
      return NextResponse.json({ error: `Failed to record report: ${rpcErr?.message}` }, { status: 500 });
    }

    // 7. Generate temporary signed URL for immediate image display
    const { data: signed } = await supabase.storage.from("medical-files").createSignedUrl(storagePath, 3600);

    return NextResponse.json(
      {
        report,
        prediction,
        recommendations,
        image_url: signed?.signedUrl || null,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Diagnose route unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
