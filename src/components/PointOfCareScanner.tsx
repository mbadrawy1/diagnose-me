"use client";

import { useState, useRef } from "react";
import {
  Upload,
  Sparkles,
  RefreshCw,
  Activity,
  CheckCircle,
  Info,
  Stethoscope,
  HeartPulse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MODELS, MODEL_IDS, type ModelId } from "@/lib/models";
import { EcgWaveformChart } from "@/components/EcgWaveformChart";
import {
  NORMAL_BEAT_PRESET,
  VENTRICULAR_ECTOPIC_PRESET,
  parseEcgCsvOrText,
} from "@/lib/ecgSamples";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface PointOfCareScannerProps {
  onReportCreated?: (data: { report: any; prediction: any; recommendations: string; image_url: string | null; file_url?: string | null }) => void;
  title?: string;
  description?: string;
}

export function PointOfCareScanner({
  onReportCreated,
  title = "AI Diagnosis Studio",
  description = "Select a specialized diagnostic model, upload medical scans or 1D ECG signals, and run instant AI inference.",
}: PointOfCareScannerProps) {
  const [selectedModel, setSelectedModel] = useState<ModelId>("model_1");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ecgSignal, setEcgSignal] = useState<number[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    report: any;
    prediction: any;
    recommendations: string;
    image_url: string | null;
    file_url?: string | null;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleModelChange = (id: ModelId) => {
    setSelectedModel(id);
    setSelectedFile(null);
    setPreviewUrl(null);
    setEcgSignal(null);
    setAnalysisResult(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setAnalysisResult(null);

    if (selectedModel === "model_2") {
      try {
        const text = await file.text();
        const signal = parseEcgCsvOrText(text);
        if (signal.length === 0) {
          toast.error("Could not parse numeric ECG values from file.");
          return;
        }
        setEcgSignal(signal);
        setPreviewUrl(null);
        toast.info(`Loaded ${signal.length}-point ECG signal from ${file.name}`);
      } catch (err) {
        toast.error("Failed to read ECG file");
      }
    } else {
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      setEcgSignal(null);
    }
  };

  const handleLoadSampleCell = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/png" });
      setSelectedFile(file);
      setPreviewUrl(url);
      setEcgSignal(null);
      setAnalysisResult(null);
      toast.info(`Loaded sample micrograph: ${filename}`);
    } catch {
      toast.error("Failed to load sample image");
    }
  };

  const handleLoadSampleEcg = (type: "normal" | "pvc") => {
    const isNormal = type === "normal";
    const signal = isNormal ? NORMAL_BEAT_PRESET : VENTRICULAR_ECTOPIC_PRESET;
    const filename = isNormal ? "normal_sinus_beat_sample.csv" : "ventricular_ectopic_pvc_sample.csv";
    const csvContent = signal.join(",");
    const file = new File([csvContent], filename, { type: "text/csv" });

    setSelectedFile(file);
    setEcgSignal(signal);
    setPreviewUrl(null);
    setAnalysisResult(null);
    toast.info(`Loaded ${isNormal ? "Normal Beat" : "Ventricular Ectopic Beat"} sample (${signal.length} points)`);
  };

  const handleRunDiagnosis = async () => {
    if (!selectedFile && !ecgSignal) {
      toast.error(
        selectedModel === "model_2"
          ? "Please upload a .csv ECG file or click a sample beat first."
          : "Please upload or load a medical micrograph first."
      );
      return;
    }

    setAnalyzing(true);
    const formData = new FormData();

    if (selectedFile) {
      formData.append("file", selectedFile);
    } else if (ecgSignal) {
      const blob = new Blob([ecgSignal.join(",")], { type: "text/csv" });
      formData.append("file", blob, "ecg_beat.csv");
    }

    try {
      const res = await fetch(`/api/diagnose/${selectedModel}`, {
        method: "POST",
        body: formData,
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        // Fallback if server returned non-JSON
      }

      if (!res.ok) {
        throw new Error(data?.error || `Diagnostic scan failed (${res.status}: ${res.statusText || "Server error"})`);
      }

      if (!data) {
        throw new Error("Received empty response from diagnostic server");
      }

      setAnalysisResult(data);
      if (onReportCreated) {
        onReportCreated(data);
      }
      toast.success("AI Diagnostic Screening completed!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Inference error occurred";
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const isModel2 = selectedModel === "model_2";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            {title}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <Badge variant="outline" className="w-fit text-[11px] bg-blue-50 text-blue-700 border-blue-200">
          Quantized ONNX Engine (&lt;10ms CPU)
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Model Selection & Upload */}
        <div className="lg:col-span-5 space-y-4">
          {/* Model Selector Card */}
          <Card className="border-border/80 shadow-sm bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold font-display">Diagnostic Model Selection</CardTitle>
              <CardDescription className="text-xs">Choose active modality</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {MODEL_IDS.map((id) => {
                const m = MODELS[id];
                const isSelected = selectedModel === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => m.available && handleModelChange(id)}
                    disabled={!m.available}
                    className={`w-full flex items-start justify-between rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20"
                        : m.available
                        ? "border-border/70 hover:border-border hover:bg-muted/40 cursor-pointer"
                        : "border-dashed border-border/50 opacity-60 cursor-not-allowed bg-muted/20"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${isSelected ? "text-blue-900" : "text-foreground"}`}>
                          {m.name}
                        </span>
                        {m.available ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Phase 2 Slot
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{m.description}</p>
                      <span className="inline-block mt-1 text-[10px] font-medium text-blue-600">
                        Modality: {m.modality}
                      </span>
                    </div>
                    {isSelected && <CheckCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Upload Card */}
          <Card className="border-border/80 shadow-sm bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold font-display flex items-center gap-2">
                {isModel2 ? <HeartPulse className="h-4 w-4 text-rose-600" /> : <Upload className="h-4 w-4 text-blue-600" />}
                {isModel2 ? "ECG Waveform Upload & Preview" : "Cell Micrograph Upload"}
              </CardTitle>
              <CardDescription className="text-xs">
                {MODELS[selectedModel].inputHint || "Upload clinical scan"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept={MODELS[selectedModel].accepts}
                className="hidden"
              />

              {/* MODEL 2: 1D ECG PREVIEW */}
              {isModel2 ? (
                ecgSignal ? (
                  <div className="space-y-3">
                    <EcgWaveformChart
                      signal={ecgSignal}
                      title="Uploaded Heartbeat Waveform Preview"
                      height={180}
                    />
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={analyzing}
                        className="text-xs h-8"
                      >
                        Change File
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleRunDiagnosis}
                        disabled={analyzing}
                        className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5"
                      >
                        {analyzing ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            Running 1D-CNN Inference...
                          </>
                        ) : (
                          <>
                            <Activity className="h-3.5 w-3.5" />
                            Classify Arrhythmia Beat
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 p-7 text-center hover:border-blue-500 hover:bg-blue-50/30 transition-all cursor-pointer"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 group-hover:scale-110 transition-transform">
                      <HeartPulse className="h-6 w-6" />
                    </div>
                    <p className="mt-3 text-xs font-semibold text-foreground">Click or drag ECG .CSV file to upload</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      187 normalized heartbeat float values (single row or column)
                    </p>
                    <Button variant="outline" size="sm" className="mt-4 text-xs h-8">
                      Browse .CSV / .TXT
                    </Button>
                  </div>
                )
              ) : (
                /* MODEL 1: IMAGE PREVIEW */
                previewUrl ? (
                  <div className="relative rounded-xl border border-border/70 overflow-hidden bg-slate-900 flex flex-col items-center justify-center p-4">
                    <div className="relative h-52 w-52 rounded-lg overflow-hidden border border-white/20 shadow-md">
                      <img src={previewUrl} alt="Cell Preview" className="h-full w-full object-cover" />
                      {analyzing && (
                        <div className="absolute inset-0 bg-blue-600/30 backdrop-blur-[1px] flex items-center justify-center">
                          <div className="h-1 w-full bg-blue-400/80 animate-scan absolute"></div>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={analyzing}
                        className="text-xs h-8 text-white border-white/20 bg-white/10 hover:bg-white/20"
                      >
                        Change Image
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleRunDiagnosis}
                        disabled={analyzing}
                        className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                      >
                        {analyzing ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            Running AI Inference...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                            Analyze Scan Now
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 p-8 text-center hover:border-blue-500 hover:bg-blue-50/30 transition-all cursor-pointer"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
                      <Upload className="h-6 w-6" />
                    </div>
                    <p className="mt-3 text-xs font-semibold text-foreground">Click or drag medical scan to upload</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Supported: PNG, JPEG, WEBP, BMP (up to 10 MB)</p>
                    <Button variant="outline" size="sm" className="mt-4 text-xs h-8">
                      Browse Local Files
                    </Button>
                  </div>
                )
              )}

              {/* Quick Test Samples */}
              <div className="pt-3 border-t border-border/60">
                <p className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-blue-600" />
                  {isModel2 ? "1-Click Built-in MIT-BIH Presets:" : "Quick Test with Sample Micrographs:"}
                </p>
                {isModel2 ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleLoadSampleEcg("normal")}
                      disabled={analyzing}
                      className="text-[11px] h-8 justify-start border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 text-emerald-800"
                    >
                      💚 Normal Beat (Class N)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleLoadSampleEcg("pvc")}
                      disabled={analyzing}
                      className="text-[11px] h-8 justify-start border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-800"
                    >
                      ⚡ Ventricular Ectopic (PVC)
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleLoadSampleCell("/sample-cells/parasitized_cell.png", "malaria_parasitized_ring_sample.png")
                      }
                      disabled={analyzing}
                      className="text-[11px] h-8 justify-start border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-800"
                    >
                      🔬 Parasitized Cell
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleLoadSampleCell("/sample-cells/uninfected_cell.png", "uninfected_erythrocyte_sample.png")
                      }
                      disabled={analyzing}
                      className="text-[11px] h-8 justify-start border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 text-emerald-800"
                    >
                      🩸 Uninfected Cell
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: AI Diagnostic Results & Recommendations */}
        <div className="lg:col-span-7">
          {analysisResult ? (
            <Card className="border-border/80 shadow-soft bg-card overflow-hidden">
              <div
                className={`p-4 text-white flex items-center justify-between ${
                  analysisResult.prediction.risk_level === "critical"
                    ? "bg-rose-600"
                    : analysisResult.prediction.risk_level === "high"
                    ? "bg-orange-600"
                    : analysisResult.prediction.risk_level === "medium"
                    ? "bg-amber-600"
                    : "bg-emerald-600"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Activity className="h-5 w-5" />
                  <div>
                    <h3 className="font-bold text-sm">
                      Screening Result: {analysisResult.prediction.predicted_class}
                    </h3>
                    <p className="text-[11px] opacity-90">
                      Model: {MODELS[selectedModel].name} · Inference time:{" "}
                      {analysisResult.prediction.inference_ms || 1} ms
                    </p>
                  </div>
                </div>
                <Badge className="bg-white/20 text-white border-0 text-xs uppercase tracking-wider font-bold">
                  {analysisResult.prediction.risk_level} Risk
                </Badge>
              </div>

              <CardContent className="p-6 space-y-6">
                {/* 1D ECG Waveform Chart if model_2 */}
                {isModel2 && (analysisResult.prediction.signal_preview || ecgSignal) && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <HeartPulse className="h-4 w-4 text-rose-500" />
                      187-Point ECG Arrhythmia Waveform Trace
                    </h4>
                    <EcgWaveformChart
                      signal={analysisResult.prediction.signal_preview || ecgSignal || []}
                      riskLevel={analysisResult.prediction.risk_level}
                      height={200}
                    />
                  </div>
                )}

                {/* Confidence Meter */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-muted-foreground">Confidence Score</span>
                    <span className="font-bold text-foreground">
                      {(analysisResult.prediction.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={analysisResult.prediction.confidence * 100} className="h-2.5 bg-muted" />
                </div>

                {/* Probability Breakdown */}
                <div className="rounded-xl border border-border/70 p-4 bg-muted/20">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">
                    {isModel2 ? "MIT-BIH Arrhythmia 5-Class Probabilities" : "Class Probabilities"}
                  </h4>
                  <div className="space-y-2.5">
                    {Object.entries(analysisResult.prediction.probabilities || {}).map(([cls, prob]) => {
                      const val = Number(prob);
                      let barColor = "bg-blue-500";
                      if (cls.startsWith("N")) barColor = "bg-emerald-500";
                      else if (cls.startsWith("S")) barColor = "bg-amber-500";
                      else if (cls.startsWith("V")) barColor = "bg-rose-500";
                      else if (cls.startsWith("F")) barColor = "bg-indigo-500";
                      else if (cls.startsWith("Q")) barColor = "bg-slate-500";
                      else if (cls === "Parasitized") barColor = "bg-rose-500";

                      return (
                        <div key={cls} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium text-muted-foreground">{cls}</span>
                            <span className="font-semibold text-foreground">{(val * 100).toFixed(2)}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                              style={{ width: `${Math.max(1, val * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* AI Recommendations */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="h-4 w-4 text-blue-600" />
                    AI Clinical Recommendations
                  </h4>
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-xs sm:text-sm text-foreground/90 prose prose-sm max-w-none">
                    <ReactMarkdown>{analysisResult.recommendations}</ReactMarkdown>
                  </div>
                </div>

                {/* Clinical Validation Status */}
                <div className="flex items-center justify-between rounded-xl border border-border/70 p-3.5 bg-muted/30">
                  <div className="flex items-center gap-2.5">
                    <Stethoscope className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">Doctor Validation</p>
                      <p className="text-[11px] text-muted-foreground">
                        Report generated and recorded to patient clinical history
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 text-[10px]">
                    Recorded & Queued
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/80 shadow-sm bg-card h-full min-h-[420px] flex flex-col items-center justify-center p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-4">
                <Activity className="h-8 w-8" />
              </div>
              <h3 className="font-display text-base font-bold text-foreground">
                Ready for Diagnostic Screening
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1.5 leading-relaxed">
                {isModel2
                  ? "Upload a 187-sample ECG .CSV heartbeat recording or click one of the 1-click built-in presets (Normal or PVC) to test."
                  : "Upload a digitized micrograph above or click one of the quick test sample buttons to trigger the ONNX AI diagnostic pipeline."}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
