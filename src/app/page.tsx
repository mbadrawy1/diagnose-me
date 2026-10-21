"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Microscope,
  Zap,
  Lock,
  HeartPulse,
  CheckCircle2,
  Users,
  ChevronRight,
  Bot,
  Brain,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";

export default function LandingPage() {
  const models = [
    {
      id: "model_1",
      name: "Malaria Cell Classifier",
      active: true,
      accuracy: "High Sensitivity",
      modality: "Thin Blood Smear Microscopy",
      desc: "Deep convolutional network detecting intracellular Plasmodium parasites in digitized Giemsa-stained red blood cells.",
      latency: "<10ms CPU",
    },
    {
      id: "model_2",
      name: "Pulmonary Disease Classifier",
      active: false,
      accuracy: "In Calibration",
      modality: "Chest Radiography (X-Ray)",
      desc: "Multi-class screening for pneumonia, tuberculosis, and lung infiltrates (Reserved Phase 2 Slot).",
      latency: "Coming Soon",
    },
    {
      id: "model_3",
      name: "Neuroimaging Pathology Analyzer",
      active: false,
      accuracy: "In Calibration",
      modality: "Brain MRI Modality",
      desc: "Deep learning volumetric segmentation for early neurological lesions (Reserved Phase 2 Slot).",
      latency: "Coming Soon",
    },
  ];

  const features = [
    {
      icon: Microscope,
      title: "Real-Time AI Microscopic Screening",
      desc: "Upload cellular micrographs or clinical scans for instantaneous probability quantification and risk stratification.",
    },
    {
      icon: Stethoscope,
      title: "Clinician Validation Workflow",
      desc: "Doctors and hospital specialists inspect high-resolution scans and digitally certify reports with clinical notes.",
    },
    {
      icon: HeartPulse,
      title: "Electronic Medical Profile",
      desc: "Track chronic conditions, blood types, allergies, and longitudinal diagnostic history securely in one place.",
    },
    {
      icon: Bot,
      title: "24/7 Context-Aware Health Assistant",
      desc: "Empathetic conversational AI trained on clinical protocols, aware of your past screenings and personal medical profile.",
    },
    {
      icon: AlertTriangle,
      title: "Instant Critical Risk Alerts",
      desc: "Real-time automated alerts for high-risk findings to notify patients and prioritize urgent clinical triage.",
    },
    {
      icon: Lock,
      title: "Private Supabase Cloud Vault",
      desc: "Row Level Security (RLS) policies guard sensitive medical files, DICOM assets, and patient records with zero leaks.",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-hero-glow bg-medical-grid pt-16 pb-24 md:pt-24 md:pb-32 border-b border-border/50">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 relative z-10 text-center">
          {/* Top Pill Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1 text-xs font-semibold text-blue-700 shadow-xs mb-6 backdrop-blur-sm animate-fade-up">
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            Next-Generation AI Healthcare Diagnostics
          </div>

          {/* Main Title */}
          <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground max-w-4xl mx-auto leading-[1.1]">
            Intelligent Disease Screening.{" "}
            <span className="text-gradient">Certified by Doctors.</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Diagnose Me bridges patients, physicians, and medical centers with CPU-optimized AI models, secure electronic health records, and 24/7 clinical decision support.
          </p>

          {/* CTA Group */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Button
              size="lg"
              className="h-12 px-7 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-glow rounded-xl gap-2 transition-all hover:scale-[1.02]"
              asChild
            >
              <Link href="/auth?tab=signup">
                <span>Start Free Screening</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-7 rounded-xl font-semibold gap-2 bg-background/80 hover:bg-muted"
              asChild
            >
              <Link href="/auth">
                <Stethoscope className="h-4 w-4 text-blue-600" />
                <span>Doctor & Hospital Portal</span>
              </Link>
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="mt-12 pt-8 border-t border-border/60 max-w-2xl mx-auto flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              CPU-Optimized Quantized Models
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              Private Storage RLS Protection
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <Activity className="h-4 w-4 text-indigo-600" />
              Sub-10ms Inference Latency
            </div>
          </div>
        </div>
      </section>

      {/* DIAGNOSTIC MODELS SHOWCASE */}
      <section className="py-20 bg-slate-50/60 border-b border-border/50">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
            <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 text-xs">
              Model Hub Architecture
            </Badge>
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
              Specialized Medical AI Microservices
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Modular architecture allowing instant drop-in expansion for new diagnostic modalities without database migrations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {models.map((m) => (
              <Card
                key={m.id}
                className={`card-hover border-border/80 bg-card/90 backdrop-blur-sm overflow-hidden flex flex-col justify-between ${
                  m.active ? "ring-2 ring-blue-600/30 shadow-soft" : "opacity-85"
                }`}
              >
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge
                      className={
                        m.active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-muted text-muted-foreground border-border"
                      }
                    >
                      {m.active ? "Production Ready" : "Reserved Slot"}
                    </Badge>
                    <span className="text-[11px] font-mono text-muted-foreground">{m.latency}</span>
                  </div>

                  <div>
                    <h3 className="font-display text-lg font-bold text-foreground">{m.name}</h3>
                    <p className="text-[11px] font-medium text-blue-600 mt-0.5">{m.modality}</p>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{m.desc}</p>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-border/60 bg-muted/20 flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">{m.accuracy}</span>
                  {m.active ? (
                    <Button size="sm" variant="ghost" className="text-xs text-blue-600 hover:text-blue-700 p-0" asChild>
                      <Link href="/auth?tab=signup" className="flex items-center gap-1">
                        Try Model <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Phase 2 Drop-in</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CORE PLATFORM CAPABILITIES */}
      <section className="py-20 bg-background">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
            <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 text-xs">
              End-to-End Capabilities
            </Badge>
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
              Designed for Complete Clinical Synergy
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Empowering healthcare ecosystems with rapid diagnostics, longitudinal tracking, and instant clinician collaboration.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="rounded-2xl border border-border/70 p-6 bg-card/60 hover:bg-card hover:border-blue-200 transition-all card-hover"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 mb-4">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-base font-bold text-foreground mb-1.5">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ROLES BANNER */}
      <section className="py-16 bg-gradient-to-br from-blue-900 to-indigo-950 text-white">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 text-center space-y-6">
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">
            Ready to transform medical diagnostics?
          </h2>
          <p className="text-xs sm:text-sm text-blue-200 max-w-xl mx-auto leading-relaxed">
            Create an account in seconds as a Patient, Physician, or Clinic. Access the Diagnosis Studio and AI health guidance immediately.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button size="lg" className="h-11 bg-white text-blue-900 hover:bg-blue-50 font-semibold" asChild>
              <Link href="/auth?tab=signup">Get Started as Patient</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-11 border-white/30 text-white hover:bg-white/10 font-semibold" asChild>
              <Link href="/auth?tab=signup">Register as Physician</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto border-t border-border/60 bg-muted/20 py-8 text-center text-xs text-muted-foreground">
        <div className="container mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600" />
            <span className="font-bold text-foreground">Diagnose.me</span>
            <span>© 2026 Diagnose Me Healthcare Systems</span>
          </div>
          <div className="text-[11px] max-w-md text-muted-foreground">
            Disclaimer: Diagnose Me AI predictions are clinical decision-support tools and do not constitute final medical diagnosis without licensed doctor validation.
          </div>
        </div>
      </footer>
    </div>
  );
}
