import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MODELS, buildRecommendations, isModelId } from "@/lib/models";
import { runDiagnosticInference, parseEcgFloats } from "@/lib/inference";
import type { Json } from "@/types/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGES = new Set(["image/png", "image/jpeg", "image/webp", "image/bmp", "image/tiff"]);
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
      return NextResponse.json({ error: `${model.name} is currently in calibration.` }, { status: 409 });
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

    // 2. Parse input depending on model and content-type
    const contentType = request.headers.get("content-type") || "";
    let buffer: Buffer;
    let filename: string;
    let fileExt: string;
    let mimeType: string;
    let ecgFloats: number[] | undefined;

    if (modelId === "model_2") {
      // ECG Heartbeat Classifier: accepts JSON body, CSV/TXT file upload, or form-field signal
      if (contentType.includes("application/json")) {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
        }
        const rawSignal = body?.signal ?? body;
        ecgFloats = parseEcgFloats(rawSignal);
        if (!ecgFloats || ecgFloats.length === 0) {
          return NextResponse.json({ error: "Please provide a valid 187-value ECG signal array" }, { status: 400 });
        }
        const csvText = ecgFloats.join(",");
        buffer = Buffer.from(csvText, "utf-8");
        filename = body?.filename || "ecg_heartbeat.csv";
        fileExt = "csv";
        mimeType = "text/csv";
      } else {
        // multipart/form-data or urlencoded
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return NextResponse.json({ error: "Invalid form payload" }, { status: 400 });
        }

        const uploadedFile = form.get("file");
        const signalField = form.get("signal");

        if (uploadedFile instanceof File && uploadedFile.size > 0) {
          if (uploadedFile.size > MAX_BYTES) {
            return NextResponse.json({ error: "File size exceeds the 10 MB limit" }, { status: 413 });
          }
          const arrayBuf = await uploadedFile.arrayBuffer();
          buffer = Buffer.from(arrayBuf);
          filename = uploadedFile.name || "ecg_heartbeat.csv";
          fileExt = filename.toLowerCase().endsWith(".txt") ? "txt" : filename.toLowerCase().endsWith(".json") ? "json" : "csv";
          mimeType = fileExt === "json" ? "application/json" : "text/csv";
          ecgFloats = parseEcgFloats(buffer);
        } else if (typeof signalField === "string" && signalField.trim().length > 0) {
          ecgFloats = parseEcgFloats(signalField);
          const csvText = ecgFloats.join(",");
          buffer = Buffer.from(csvText, "utf-8");
          filename = "ecg_heartbeat.csv";
          fileExt = "csv";
          mimeType = "text/csv";
        } else {
          return NextResponse.json(
            { error: "Please upload an ECG .csv/.txt file or select a sample beat" },
            { status: 400 }
          );
        }
      }
    } else {
      // Model 1: Microscopy image classifier
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
      if (!ALLOWED_IMAGES.has(file.type)) {
        return NextResponse.json({ error: "Supported formats: PNG, JPEG, WEBP, BMP, TIFF" }, { status: 415 });
      }

      fileExt = EXT[file.type] || "png";
      mimeType = file.type;
      filename = file.name || "scan.png";
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    // 3. Upload file to Supabase Storage bucket 'medical-files'
    const storagePath = `${user.id}/${modelId}/${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("medical-files")
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // 4. Run AI Inference (HF Space or high-performance CPU ONNX fallback)
    let prediction;
    try {
      prediction = await runDiagnosticInference(modelId, buffer, filename, ecgFloats);
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

    // 7. If risk is high or critical, automatically insert a risk_alert into alerts_and_reminders
    if (prediction.risk_level === "high" || prediction.risk_level === "critical") {
      try {
        await supabase.from("alerts_and_reminders").insert({
          user_id: user.id,
          type: "risk_alert",
          title: `${prediction.risk_level === "critical" ? "Critical Risk Alert" : "High Risk Alert"}: ${prediction.predicted_class}`,
          message: `${model.name} detected an arrhythmia condition (${prediction.predicted_class}) with ${prediction.risk_level} risk (${(prediction.confidence * 100).toFixed(1)}% confidence). Immediate clinical review is recommended.`,
          is_read: false,
        });
      } catch (alertErr) {
        console.warn("Failed to insert automatic risk alert:", alertErr);
      }
    }

    // 8. Generate temporary signed URL for immediate display / preview
    const { data: signed } = await supabase.storage.from("medical-files").createSignedUrl(storagePath, 3600);

    return NextResponse.json(
      {
        report,
        prediction,
        recommendations,
        image_url: signed?.signedUrl || null,
        file_url: signed?.signedUrl || null,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Diagnose route unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
