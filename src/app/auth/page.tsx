"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  User,
  Stethoscope,
  Building2,
  Hospital,
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type Role = "patient" | "doctor" | "hospital" | "clinic";

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const initialTab = searchParams.get("tab") === "signup" ? "signup" : "login";
  const [mode, setMode] = useState<"login" | "signup">(initialTab);
  const [role, setRole] = useState<Role>("patient");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      if (mode === "signup") {
        if (!fullName.trim()) {
          throw new Error("Please enter your full name or organization name");
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: role,
              specialization: role !== "patient" ? specialization : null,
            },
          },
        });

        if (error) throw error;

        toast.success("Account created successfully!");
        const destination = role === "patient" ? "/patient" : "/provider";
        router.push(destination);
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Fetch user profile to route correctly
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();

        toast.success("Signed in successfully!");
        const userRole = profile?.role || "patient";
        const destination = userRole === "patient" ? "/patient" : "/provider";
        router.push(destination);
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { id: "patient", label: "Patient", icon: User, desc: "Personal health records & screening" },
    { id: "doctor", label: "Doctor", icon: Stethoscope, desc: "Clinical scan review & validation" },
    { id: "clinic", label: "Clinic", icon: Building2, desc: "Outpatient diagnostics & records" },
    { id: "hospital", label: "Hospital", icon: Hospital, desc: "Multi-department patient triage" },
  ];

  return (
    <div className="min-h-screen bg-medical-grid flex flex-col justify-between">
      {/* Top Bar */}
      <div className="container mx-auto max-w-7xl px-4 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25">
            <Activity className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-foreground">
            Diagnose<span className="text-blue-600">.me</span>
          </span>
        </Link>
        <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          HIPAA & GDPR Compliant Cloud Architecture
        </div>
      </div>

      {/* Main Container */}
      <div className="container mx-auto max-w-md px-4 py-8">
        <Card className="border-border/80 shadow-soft bg-card/95 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Activity className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold font-display">
              {mode === "login" ? "Welcome back" : "Create an account"}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {mode === "login"
                ? "Sign in to access your diagnostic reports and clinical workspace"
                : "Join the next generation of AI-assisted healthcare diagnostics"}
            </CardDescription>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 p-1 bg-muted rounded-xl mt-4">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setErrorMsg("");
                }}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  mode === "login"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setErrorMsg("");
                }}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  mode === "signup"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign Up
              </button>
            </div>
          </CardHeader>

          <CardContent>
            {errorMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Role Selector (Sign up mode) */}
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-foreground">Select your account role</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {roles.map((r) => {
                      const Icon = r.icon;
                      const isSelected = role === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setRole(r.id as Role)}
                          className={`flex items-start gap-2 rounded-xl border p-2.5 text-left transition-all ${
                            isSelected
                              ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20"
                              : "border-border/70 hover:border-border hover:bg-muted/40"
                          }`}
                        >
                          <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${isSelected ? "text-blue-600" : "text-muted-foreground"}`} />
                          <div className="min-w-0">
                            <p className={`text-xs font-semibold ${isSelected ? "text-blue-900" : "text-foreground"}`}>
                              {r.label}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">{r.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Full Name / Org Name */}
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-xs">
                    {role === "patient" ? "Full Name" : role === "doctor" ? "Doctor Full Name" : "Organization Name"}
                  </Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={role === "patient" ? "Jane Doe" : role === "doctor" ? "Dr. Alex Taylor, MD" : "St. Jude Clinic"}
                    required
                    className="h-10 text-sm"
                  />
                </div>
              )}

              {/* Specialization (for Doctors / Clinics / Hospitals) */}
              {mode === "signup" && role !== "patient" && (
                <div className="space-y-1.5">
                  <Label htmlFor="specialization" className="text-xs">
                    Specialization or Department
                  </Label>
                  <Input
                    id="specialization"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    placeholder="e.g. Infectious Diseases, Hematology, Pathology"
                    className="h-10 text-sm"
                  />
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">
                  Email Address
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className="h-10 text-sm pl-9"
                  />
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="h-10 text-sm pl-9"
                  />
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition-all hover:shadow-blue-500/30"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>{mode === "login" ? "Sign In to Workspace" : "Create Account"}</span>
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-xs text-muted-foreground">
              By proceeding, you agree to our Terms of Clinical Service and Privacy Disclaimers.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer disclaimers */}
      <footer className="py-6 text-center text-xs text-muted-foreground">
        © 2026 Diagnose Me Healthcare Systems. All medical AI predictions require validation by certified clinical personnel.
      </footer>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
