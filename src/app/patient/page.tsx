"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Activity,
  Upload,
  AlertTriangle,
  CheckCircle,
  Clock,
  Sparkles,
  FileText,
  Heart,
  Droplet,
  ShieldCheck,
  TrendingUp,
  RefreshCw,
  Info,
  Calendar,
  Stethoscope,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Navbar } from "@/components/Navbar";
import { ChatAssistant } from "@/components/ChatAssistant";
import { createClient } from "@/lib/supabase/client";
import { MODELS, MODEL_IDS, RISK_STYLES, type ModelId, type RiskLevel } from "@/lib/models";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export default function PatientDashboard() {
  const router = useRouter();
  const supabase = createClient();

  // User & Profile State
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ id: string; full_name: string | null; role: string } | null>(null);
  const [medProfile, setMedProfile] = useState<{
    id: string;
    blood_type: string | null;
    chronic_diseases: string[];
    allergies: string[];
  } | null>(null);

  // Diagnostic Studio State
  const [selectedModel, setSelectedModel] = useState<ModelId>("model_1");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    report: any;
    prediction: any;
    recommendations: string;
    image_url: string | null;
  } | null>(null);

  // Medical History & Alerts State
  const [reports, setReports] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  // Profile Edit State
  const [bloodType, setBloodType] = useState("");
  const [chronicInput, setChronicInput] = useState("");
  const [chronicList, setChronicList] = useState<string[]>([]);
  const [allergyInput, setAllergyInput] = useState("");
  const [allergyList, setAllergyList] = useState<string[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load patient data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/auth");
          return;
        }

        // Profile
        const { data: userProfile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (userProfile?.role !== "patient") {
          router.push("/provider");
          return;
        }
        setProfile(userProfile);

        // Medical Profile
        const { data: medData } = await supabase
          .from("medical_profiles")
          .select("*")
          .eq("patient_id", user.id)
          .single();

        if (medData) {
          setMedProfile(medData);
          setBloodType(medData.blood_type || "");
          setChronicList(medData.chronic_diseases || []);
          setAllergyList(medData.allergies || []);
        }

        // Reports
        const { data: reportData } = await supabase
          .from("diagnostic_reports")
          .select("*")
          .eq("patient_id", user.id)
          .order("created_at", { ascending: false });

        setReports(reportData || []);

        // Alerts & Reminders
        const { data: alertData } = await supabase
          .from("alerts_and_reminders")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        setAlerts(alertData || []);
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();

    // Supabase Realtime for live alerts
    const channel = supabase
      .channel("patient-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts_and_reminders" },
        (payload) => {
          setAlerts((prev) => [payload.new, ...prev]);
          toast.warning(`New Health Alert: ${payload.new.title}`);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, supabase]);

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setAnalysisResult(null);
  };

  // Quick Load Sample Micrograph
  const handleLoadSampleCell = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/png" });
      setSelectedFile(file);
      setPreviewUrl(url);
      setAnalysisResult(null);
      toast.info(`Loaded sample: ${filename}`);
    } catch {
      toast.error("Failed to load sample micrograph");
    }
  };

  // Submit scan to AI microservice
  const handleRunDiagnosis = async () => {
    if (!selectedFile) {
      toast.error("Please upload a medical scan or cell image first.");
      return;
    }

    setAnalyzing(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

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
      setReports((prev) => [data.report, ...prev]);
      toast.success("AI Diagnostic Screening completed!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Inference error occurred";
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  // Save Medical Profile
  const handleSaveMedProfile = async () => {
    if (!profile) return;
    setSavingProfile(true);

    try {
      const { error } = await supabase
        .from("medical_profiles")
        .update({
          blood_type: bloodType,
          chronic_diseases: chronicList,
          allergies: allergyList,
        })
        .eq("patient_id", profile.id);

      if (error) throw error;
      toast.success("Electronic medical profile updated successfully!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update profile";
      toast.error(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleMarkAlertRead = async (alertId: string) => {
    await supabase.from("alerts_and_reminders").update({ is_read: true }).eq("id", alertId);
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a)));
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium text-muted-foreground">Loading Diagnostic Studio...</p>
        </div>
      </div>
    );
  }

  const unreadAlerts = alerts.filter((a) => !a.is_read);

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      <Navbar
        userRole="patient"
        userName={profile?.full_name || "Patient"}
        unreadAlertsCount={unreadAlerts.length}
      />

      <main className="container mx-auto max-w-7xl px-4 sm:px-6 pt-6 space-y-6">
        {/* Welcome Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 p-6 text-white shadow-soft">
          <div className="space-y-1">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Hello, {profile?.full_name || "Patient"}
            </h1>
            <p className="text-blue-100 text-xs sm:text-sm">
              AI Disease Screening Studio · Secure Electronic Health Records · 24/7 Clinical Assistance
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 px-4 py-2 backdrop-blur-sm border border-white/15">
              <span className="block text-[11px] font-medium text-blue-200 uppercase tracking-wider">
                Total Screenings
              </span>
              <span className="font-display text-xl font-bold">{reports.length}</span>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-2 backdrop-blur-sm border border-white/15">
              <span className="block text-[11px] font-medium text-blue-200 uppercase tracking-wider">
                Active Alerts
              </span>
              <span className="font-display text-xl font-bold">{unreadAlerts.length}</span>
            </div>
          </div>
        </div>

        {/* Real-time Alerts Banner */}
        {unreadAlerts.length > 0 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-rose-900">
                    Important Health Alerts ({unreadAlerts.length})
                  </h4>
                  <div className="mt-1 space-y-1">
                    {unreadAlerts.slice(0, 2).map((a) => (
                      <div key={a.id} className="flex items-center gap-2 text-xs text-rose-700">
                        <span className="font-medium">• {a.title}:</span>
                        <span>{a.message}</span>
                        <button
                          onClick={() => handleMarkAlertRead(a.id)}
                          className="ml-2 text-[10px] font-semibold text-rose-800 underline hover:no-underline"
                        >
                          Dismiss
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <Tabs defaultValue="studio" className="w-full">
          <TabsList className="bg-white p-1 rounded-xl border shadow-sm grid grid-cols-3 max-w-md">
            <TabsTrigger value="studio" className="rounded-lg text-xs font-semibold">
              Diagnosis Studio
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg text-xs font-semibold">
              Screening History ({reports.length})
            </TabsTrigger>
            <TabsTrigger value="profile" className="rounded-lg text-xs font-semibold">
              Medical Profile
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: AI DIAGNOSTIC STUDIO */}
          <TabsContent value="studio" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Model Selector & Upload */}
              <div className="lg:col-span-5 space-y-6">
                {/* Model Selector Card */}
                <Card className="border-border/80 shadow-sm bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold font-display flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-blue-600" />
                      Diagnostic Model Selector
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Choose which AI diagnostic model to run your medical scan against
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {MODEL_IDS.map((id) => {
                      const m = MODELS[id];
                      const isSelected = selectedModel === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => m.available && setSelectedModel(id)}
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
                            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                              {m.description}
                            </p>
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
                    <CardTitle className="text-base font-bold font-display flex items-center gap-2">
                      <Upload className="h-4 w-4 text-blue-600" />
                      Scan Upload & Inspection
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {MODELS[selectedModel].inputHint || "Upload thin smear micrograph (PNG, JPG, WEBP)"}
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

                    {previewUrl ? (
                      <div className="relative rounded-xl border border-border/70 overflow-hidden bg-slate-900 flex flex-col items-center justify-center p-4">
                        <div className="relative h-56 w-56 rounded-lg overflow-hidden border border-white/20 shadow-md">
                          <img
                            src={previewUrl}
                            alt="Scan Preview"
                            className="h-full w-full object-cover"
                          />
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
                        <p className="mt-3 text-xs font-semibold text-foreground">
                          Click or drag medical scan to upload
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Supported: PNG, JPEG, WEBP, BMP (up to 10 MB)
                        </p>
                        <Button variant="outline" size="sm" className="mt-4 text-xs h-8">
                          Browse Local Files
                        </Button>
                      </div>
                    )}

                    {/* Quick Test Samples */}
                    <div className="pt-3 border-t border-border/60">
                      <p className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-blue-600" />
                        Quick Test with Sample Micrographs:
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleLoadSampleCell("/sample-cells/parasitized_cell.png", "malaria_parasitized_trophozoite.png")}
                          disabled={analyzing}
                          className="text-[11px] h-8 justify-start border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-800"
                        >
                          🔬 Parasitized Cell
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleLoadSampleCell("/sample-cells/uninfected_cell.png", "uninfected_erythrocyte.png")}
                          disabled={analyzing}
                          className="text-[11px] h-8 justify-start border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 text-emerald-800"
                        >
                          🩸 Uninfected Cell
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: AI Diagnostic Results & Recommendations */}
              <div className="lg:col-span-7">
                {analysisResult ? (
                  <Card className="border-border/80 shadow-soft bg-card overflow-hidden">
                    <div className={`p-4 text-white flex items-center justify-between ${
                      analysisResult.prediction.risk_level === "critical"
                        ? "bg-rose-600"
                        : analysisResult.prediction.risk_level === "high"
                        ? "bg-orange-600"
                        : analysisResult.prediction.risk_level === "medium"
                        ? "bg-amber-600"
                        : "bg-emerald-600"
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <Activity className="h-5 w-5" />
                        <div>
                          <h3 className="font-bold text-sm">
                            Screening Result: {analysisResult.prediction.predicted_class}
                          </h3>
                          <p className="text-[11px] opacity-90">
                            Model: {MODELS[selectedModel].name} · Inference time: {analysisResult.prediction.inference_ms || 4} ms
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-white/20 text-white border-0 text-xs uppercase tracking-wider font-bold">
                        {analysisResult.prediction.risk_level} Risk
                      </Badge>
                    </div>

                    <CardContent className="p-6 space-y-6">
                      {/* Confidence Meter */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-muted-foreground">Confidence Score</span>
                          <span className="font-bold text-foreground">
                            {(analysisResult.prediction.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                        <Progress
                          value={analysisResult.prediction.confidence * 100}
                          className="h-2.5 bg-muted"
                        />
                      </div>

                      {/* Probability Breakdown */}
                      <div className="rounded-xl border border-border/70 p-4 bg-muted/20">
                        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">
                          Class Probabilities
                        </h4>
                        <div className="space-y-2">
                          {Object.entries(analysisResult.prediction.probabilities || {}).map(([cls, prob]) => {
                            const val = Number(prob);
                            return (
                              <div key={cls} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="font-medium text-muted-foreground">{cls}</span>
                                  <span className="font-semibold text-foreground">{(val * 100).toFixed(2)}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      cls === "Parasitized" ? "bg-rose-500" : "bg-blue-500"
                                    }`}
                                    style={{ width: `${val * 100}%` }}
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
                              Queued for clinical inspection by verified specialists
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 text-[10px]">
                          Pending Clinical Review
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-border/80 shadow-sm bg-card h-full min-h-[420px] flex flex-col items-center justify-center p-8 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-4">
                      <Activity className="h-8 w-8" />
                    </div>
                    <h3 className="font-display text-lg font-bold text-foreground">
                      No Scan Analyzed Yet
                    </h3>
                    <p className="max-w-md text-xs sm:text-sm text-muted-foreground mt-1.5">
                      Upload a microscopy or medical scan on the left panel, select your target model, and execute AI screening to view probability metrics and clinical recommendations.
                    </p>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: SCREENING HISTORY */}
          <TabsContent value="history" className="mt-6 space-y-4">
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold font-display">
                  Past Diagnostic Screenings ({reports.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Review all previous AI screenings and doctor clinical validation notes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reports.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    No historical screenings found. Run your first screening in the Diagnosis Studio.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reports.map((r) => {
                      const risk = (r.risk_level || "low") as RiskLevel;
                      const style = RISK_STYLES[risk];
                      const pred = r.prediction_result as any;

                      return (
                        <div
                          key={r.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/70 p-4 transition-all hover:border-border hover:bg-muted/20"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs sm:text-sm text-foreground">
                                {pred?.predicted_class || "Screening"}
                              </span>
                              <Badge className={`${style.className} text-[10px] px-2 py-0 border-0 capitalize`}>
                                {risk} risk
                              </Badge>
                              {r.doctor_validated ? (
                                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                                  <ShieldCheck className="h-3 w-3" />
                                  Validated by Doctor
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                  Pending Validation
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Model: <span className="font-medium text-foreground">{r.model_used}</span> ·
                              Confidence: <span className="font-medium text-foreground">{((r.confidence_score || 0) * 100).toFixed(1)}%</span> ·
                              Date: {new Date(r.created_at).toLocaleDateString()}
                            </p>
                            {r.doctor_notes && (
                              <p className="text-xs text-blue-900 bg-blue-50/70 p-2 rounded-lg border border-blue-200 mt-2">
                                <strong>Doctor Note:</strong> {r.doctor_notes}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: ELECTRONIC MEDICAL PROFILE */}
          <TabsContent value="profile" className="mt-6 space-y-4">
            <Card className="border-border/80 shadow-sm max-w-2xl">
              <CardHeader>
                <CardTitle className="text-base font-bold font-display flex items-center gap-2">
                  <Heart className="h-4 w-4 text-rose-500" />
                  Electronic Health Profile
                </CardTitle>
                <CardDescription className="text-xs">
                  Keep your medical background updated so AI and doctors have complete clinical context
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Blood Type */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Droplet className="h-3.5 w-3.5 text-rose-500" />
                    Blood Type
                  </Label>
                  <select
                    value={bloodType}
                    onChange={(e) => setBloodType(e.target.value)}
                    className="w-full h-10 rounded-lg border border-border bg-background px-3 text-xs sm:text-sm"
                  >
                    <option value="">Select blood type</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>

                {/* Chronic Diseases */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Chronic Diseases or Long-term Conditions</Label>
                  <div className="flex gap-2">
                    <Input
                      value={chronicInput}
                      onChange={(e) => setChronicInput(e.target.value)}
                      placeholder="e.g. Asthma, Hypertension, Diabetes"
                      className="h-9 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && chronicInput.trim()) {
                          e.preventDefault();
                          setChronicList([...chronicList, chronicInput.trim()]);
                          setChronicInput("");
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (chronicInput.trim()) {
                          setChronicList([...chronicList, chronicInput.trim()]);
                          setChronicInput("");
                        }
                      }}
                      className="h-9 text-xs"
                    >
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {chronicList.map((item, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="text-[11px] gap-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setChronicList(chronicList.filter((_, i) => i !== idx))}
                      >
                        {item} ×
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Allergies */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Allergies (Medications / Environmental)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={allergyInput}
                      onChange={(e) => setAllergyInput(e.target.value)}
                      placeholder="e.g. Penicillin, Sulfa drugs, Latex"
                      className="h-9 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && allergyInput.trim()) {
                          e.preventDefault();
                          setAllergyList([...allergyList, allergyInput.trim()]);
                          setAllergyInput("");
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (allergyInput.trim()) {
                          setAllergyList([...allergyList, allergyInput.trim()]);
                          setAllergyInput("");
                        }
                      }}
                      className="h-9 text-xs"
                    >
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {allergyList.map((item, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="text-[11px] gap-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setAllergyList(allergyList.filter((_, i) => i !== idx))}
                      >
                        {item} ×
                      </Badge>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleSaveMedProfile}
                  disabled={savingProfile}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 mt-4"
                >
                  {savingProfile ? "Saving Profile..." : "Save Medical Profile"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* 24/7 AI Health Assistant Floating Drawer */}
      <ChatAssistant />
    </div>
  );
}
