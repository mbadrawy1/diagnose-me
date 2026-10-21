"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Stethoscope,
  Activity,
  CheckCircle2,
  AlertTriangle,
  FileText,
  User,
  Eye,
  RefreshCw,
  Search,
  Check,
  X,
  MessageSquare,
  ShieldCheck,
  Calendar,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Navbar } from "@/components/Navbar";
import { PointOfCareScanner } from "@/components/PointOfCareScanner";
import { createClient } from "@/lib/supabase/client";
import { RISK_STYLES, type RiskLevel } from "@/lib/models";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export default function ProviderDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ id: string; full_name: string | null; role: string; specialization: string | null } | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "high_risk" | "validated">("all");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"worklist" | "scanner">("worklist");

  // Inspection & Validation Modal
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [doctorNotes, setDoctorNotes] = useState("");
  const [validating, setValidating] = useState(false);

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

        const { data: userProfile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (userProfile?.role === "patient") {
          router.push("/patient");
          return;
        }
        setProfile(userProfile);

        // Fetch reports with patient profiles
        const { data: reportsData, error } = await supabase
          .from("diagnostic_reports")
          .select(`
            *,
            patient:patient_id ( id, full_name )
          `)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setReports(reportsData || []);
      } catch (err) {
        console.error("Provider dashboard error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router, supabase]);

  // Open Inspection Modal & fetch signed URL
  const handleInspectReport = async (report: any) => {
    setSelectedReport(report);
    setDoctorNotes(report.doctor_notes || "");
    setImageUrl(null);

    if (report.file_storage_path) {
      setImageLoading(true);
      try {
        const res = await fetch(`/api/storage/url?path=${encodeURIComponent(report.file_storage_path)}`);
        const data = await res.json();
        if (data.url) {
          setImageUrl(data.url);
        }
      } catch (err) {
        console.error("Failed to load scan image:", err);
      } finally {
        setImageLoading(false);
      }
    }
  };

  // Submit Doctor Validation
  const handleValidateReport = async () => {
    if (!selectedReport) return;
    setValidating(true);

    try {
      const res = await fetch(`/api/reports/${selectedReport.id}/validate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: doctorNotes }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Validation failed");

      toast.success("Diagnostic report clinically validated!");

      // Update local state
      setReports((prev) =>
        prev.map((r) =>
          r.id === selectedReport.id
            ? { ...r, doctor_validated: true, doctor_notes: doctorNotes, validated_at: new Date().toISOString() }
            : r
        )
      );

      setSelectedReport((prev: any) => ({ ...prev, doctor_validated: true, doctor_notes: doctorNotes }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to validate";
      toast.error(msg);
    } finally {
      setValidating(false);
    }
  };

  const handleScannerReportCreated = (data: { report: any; prediction: any; recommendations: string; image_url: string | null }) => {
    const formatted = {
      ...data.report,
      patient: {
        id: profile?.id,
        full_name: profile?.full_name ? `Dr. ${profile.full_name} (Point-of-Care Scan)` : "Point-of-Care Scan",
      },
    };
    setReports((prev) => [formatted, ...prev]);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium text-muted-foreground">Loading Clinical Workspace...</p>
        </div>
      </div>
    );
  }

  // Filtered reports
  const filteredReports = reports.filter((r) => {
    if (filter === "pending" && r.doctor_validated) return false;
    if (filter === "validated" && !r.doctor_validated) return false;
    if (filter === "high_risk" && r.risk_level !== "high" && r.risk_level !== "critical") return false;

    if (search) {
      const q = search.toLowerCase();
      const patientName = r.patient?.full_name?.toLowerCase() || "";
      const model = r.model_used.toLowerCase();
      const pred = (r.prediction_result as any)?.predicted_class?.toLowerCase() || "";
      return patientName.includes(q) || model.includes(q) || pred.includes(q);
    }

    return true;
  });

  const pendingCount = reports.filter((r) => !r.doctor_validated).length;
  const highRiskCount = reports.filter((r) => r.risk_level === "high" || r.risk_level === "critical").length;
  const validatedCount = reports.filter((r) => r.doctor_validated).length;

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      <Navbar
        userRole={profile?.role || "doctor"}
        userName={profile?.full_name || "Doctor"}
      />

      <main className="container mx-auto max-w-7xl px-4 sm:px-6 pt-6 space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 text-white shadow-soft">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight">
                {profile?.role === "hospital" || profile?.role === "clinic" ? profile.full_name : `Dr. ${profile?.full_name || "Specialist"}`}
              </h1>
              <Badge className="bg-blue-500/20 text-blue-200 border-blue-400/30 capitalize text-xs">
                {profile?.role}
              </Badge>
            </div>
            <p className="text-blue-200 text-xs sm:text-sm">
              Clinical Scan Inspection Worklist · Triage & AI Diagnostic Validation
              {profile?.specialization && ` · Department: ${profile.specialization}`}
            </p>
          </div>

          {/* Metric Stats */}
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 px-4 py-2 backdrop-blur-sm border border-white/15">
              <span className="block text-[11px] font-medium text-blue-200 uppercase tracking-wider">
                Pending Triage
              </span>
              <span className="font-display text-xl font-bold text-amber-300">{pendingCount}</span>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-2 backdrop-blur-sm border border-white/15">
              <span className="block text-[11px] font-medium text-blue-200 uppercase tracking-wider">
                Critical / High
              </span>
              <span className="font-display text-xl font-bold text-rose-400">{highRiskCount}</span>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-2 backdrop-blur-sm border border-white/15">
              <span className="block text-[11px] font-medium text-blue-200 uppercase tracking-wider">
                Validated
              </span>
              <span className="font-display text-xl font-bold text-emerald-400">{validatedCount}</span>
            </div>
          </div>
        </div>

        {/* Navigation Mode Switcher */}
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <Button
            variant={activeTab === "worklist" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("worklist")}
            className={`text-xs h-9 gap-1.5 ${
              activeTab === "worklist"
                ? "bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
                : "border-border text-foreground hover:bg-muted"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Clinical Triage Worklist
            <Badge
              variant="secondary"
              className={`ml-1 text-[10px] px-1.5 py-0 ${
                activeTab === "worklist" ? "bg-white/20 text-white" : "bg-muted text-foreground"
              }`}
            >
              {pendingCount}
            </Badge>
          </Button>
          <Button
            variant={activeTab === "scanner" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("scanner")}
            className={`text-xs h-9 gap-1.5 ${
              activeTab === "scanner"
                ? "bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-glow"
                : "border-blue-300 text-blue-700 hover:bg-blue-50"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            Point-of-Care AI Scanner
            <Badge
              variant="outline"
              className="ml-1 text-[10px] px-1.5 py-0 border-emerald-300 bg-emerald-50 text-emerald-700"
            >
              Scan & Upload
            </Badge>
          </Button>
        </div>

        {activeTab === "scanner" ? (
          <PointOfCareScanner
            title="Doctor Point-of-Care Diagnostic Scanner"
            description="Perform immediate digitized microscopy screening, evaluate cell classification probabilities, and attach findings directly to clinical records."
            onReportCreated={handleScannerReportCreated}
          />
        ) : (
          <>
        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
              className="text-xs h-8"
            >
              All Scans ({reports.length})
            </Button>
            <Button
              variant={filter === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("pending")}
              className="text-xs h-8"
            >
              Pending Review ({pendingCount})
            </Button>
            <Button
              variant={filter === "high_risk" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("high_risk")}
              className="text-xs h-8 text-rose-600 border-rose-200 hover:bg-rose-50"
            >
              High & Critical Risk ({highRiskCount})
            </Button>
            <Button
              variant={filter === "validated" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("validated")}
              className="text-xs h-8 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
            >
              Validated ({validatedCount})
            </Button>
          </div>

          <div className="relative w-full sm:w-64">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by patient or model..."
              className="h-8 text-xs pl-8 bg-white"
            />
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>

        {/* Triage Worklist Table / Cards */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold font-display">
              Incoming Diagnostic Triage Worklist
            </CardTitle>
            <CardDescription className="text-xs">
              Review scans, inspect micrographs, and approve diagnostic reports for patient records
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredReports.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No diagnostic screenings match your filter criteria.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReports.map((r) => {
                  const risk = (r.risk_level || "low") as RiskLevel;
                  const style = RISK_STYLES[risk];
                  const pred = r.prediction_result as any;

                  return (
                    <div
                      key={r.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border/70 p-4 transition-all hover:border-border hover:bg-muted/20"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">
                            {r.patient?.full_name || "Patient Screening"}
                          </span>
                          <Badge className={`${style.className} text-[10px] px-2 py-0 border-0 capitalize`}>
                            {risk} risk
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {r.model_used}
                          </Badge>
                          {r.doctor_validated ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] flex items-center gap-1">
                              <ShieldCheck className="h-3 w-3" />
                              Validated
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-[10px]">
                              Awaiting Review
                            </Badge>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                          <span>
                            Prediction: <strong className="text-foreground">{pred?.predicted_class || "N/A"}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Confidence: <strong className="text-foreground">{((r.confidence_score || 0) * 100).toFixed(1)}%</strong>
                          </span>
                          <span>•</span>
                          <span>Date: {new Date(r.created_at).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleInspectReport(r)}
                          className="h-8 text-xs gap-1.5 bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Inspect & Validate
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
          </>
        )}
      </main>

      {/* Inspection & Validation Dialog */}
      {selectedReport && (
        <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold font-display flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-blue-600" />
                Clinical Scan Inspection & Validation
              </DialogTitle>
              <DialogDescription className="text-xs">
                Patient: {selectedReport.patient?.full_name || "Patient"} · Screening ID: {selectedReport.id.slice(0, 8)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 pt-2">
              {/* Scan Micrograph Viewer */}
              <div className="rounded-xl border border-border/80 bg-slate-950 p-4 flex flex-col items-center justify-center">
                {imageLoading ? (
                  <div className="py-12 flex flex-col items-center gap-2 text-slate-400 text-xs">
                    <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
                    <span>Loading scan from secure Supabase storage...</span>
                  </div>
                ) : imageUrl ? (
                  <div className="relative max-h-72 w-full flex items-center justify-center">
                    <img
                      src={imageUrl}
                      alt="Medical scan"
                      className="max-h-72 rounded-lg object-contain border border-white/10 shadow-lg"
                    />
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-8">Scan file not available in storage.</p>
                )}
                <span className="mt-2 text-[10px] text-slate-400">
                  Storage Path: {selectedReport.file_storage_path}
                </span>
              </div>

              {/* AI Prediction Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border p-2.5 bg-muted/20">
                  <span className="block text-[10px] text-muted-foreground">Model</span>
                  <span className="font-semibold text-xs text-foreground">{selectedReport.model_used}</span>
                </div>
                <div className="rounded-lg border p-2.5 bg-muted/20">
                  <span className="block text-[10px] text-muted-foreground">Prediction</span>
                  <span className="font-semibold text-xs text-foreground">
                    {(selectedReport.prediction_result as any)?.predicted_class}
                  </span>
                </div>
                <div className="rounded-lg border p-2.5 bg-muted/20">
                  <span className="block text-[10px] text-muted-foreground">Confidence</span>
                  <span className="font-semibold text-xs text-foreground">
                    {((selectedReport.confidence_score || 0) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="rounded-lg border p-2.5 bg-muted/20">
                  <span className="block text-[10px] text-muted-foreground">Risk Level</span>
                  <Badge className={`${RISK_STYLES[selectedReport.risk_level as RiskLevel]?.className} text-[10px] border-0 capitalize mt-0.5`}>
                    {selectedReport.risk_level}
                  </Badge>
                </div>
              </div>

              {/* AI Recommendations */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 text-xs text-foreground/90 space-y-1">
                <span className="font-semibold text-blue-900 block text-xs">AI Generated Guidance:</span>
                <div className="prose prose-xs max-w-none">
                  <ReactMarkdown>{selectedReport.ai_recommendations || "No recommendations generated."}</ReactMarkdown>
                </div>
              </div>

              {/* Doctor Clinical Notes & Validation */}
              <div className="space-y-3 border-t pt-4">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Attending Physician Clinical Notes</span>
                  {selectedReport.doctor_validated && (
                    <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Clinically Validated on {new Date(selectedReport.validated_at || Date.now()).toLocaleDateString()}
                    </span>
                  )}
                </label>
                <Textarea
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="Enter clinical assessment, microscopy confirmation, recommended medication (e.g. Artemisinin-based combination therapy), or follow-up instructions..."
                  rows={3}
                  className="text-xs sm:text-sm"
                />

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedReport(null)} className="text-xs">
                    Close
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleValidateReport}
                    disabled={validating}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5"
                  >
                    {validating ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    {selectedReport.doctor_validated ? "Update Clinical Validation" : "Validate Report"}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
