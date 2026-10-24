"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  Bot,
  Send,
  X,
  Sparkles,
  User,
  RefreshCw,
  Stethoscope,
  Maximize2,
  Minimize2,
  RotateCcw,
  ShieldCheck,
  Activity,
  HeartPulse,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  doctors?: Array<{ id: string; full_name: string | null; role: string; specialization: string | null }>;
}

export function ChatAssistant() {
  const pathname = usePathname();
  const isProviderRoute = pathname?.startsWith("/provider");

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Supabase Auth & Profile Context
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    id: string;
    full_name: string | null;
    role: string;
    specialization: string | null;
  } | null>(null);
  const [medProfile, setMedProfile] = useState<{
    blood_type: string | null;
    chronic_diseases: string[];
    allergies: string[];
  } | null>(null);

  // Messages state
  const [messages, setMessages] = useState<Message[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Determine current effective role (doctor/clinician vs patient)
  const isDoctor = useMemo(() => {
    return isProviderRoute || profile?.role === "doctor" || profile?.role === "hospital_admin" || profile?.role === "lab_technician";
  }, [isProviderRoute, profile?.role]);

  // Initial welcome message configured upon mount or role change
  useEffect(() => {
    setMounted(true);

    const initialTimestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (isDoctor) {
      setMessages([
        {
          role: "assistant",
          content:
            "Hello Doctor! I am your **Diagnose Me AI Clinical Co-Pilot**. I provide point-of-care decision support for thin/thick film malaria microscopy, 1D-CNN ECG arrhythmia classification (MIT-BIH 5-class), triage prioritization, and clinical validation notes. How can I assist with your worklist today?",
          timestamp: initialTimestamp,
        },
      ]);
    } else {
      setMessages([
        {
          role: "assistant",
          content:
            "Hello! I am your **Diagnose Me AI Health Assistant**. I can help you understand your diagnostic reports, explain medical terms, track symptoms, or connect you with verified specialists. How can I assist you today?",
          timestamp: initialTimestamp,
        },
      ]);
    }
  }, [isDoctor]);

  // Sync Supabase Auth & Profile
  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function syncAuth() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) return;

        if (session?.user) {
          setToken(session.access_token);

          const { data: prof } = await supabase
            .from("profiles")
            .select("id, full_name, role, specialization")
            .eq("id", session.user.id)
            .single();

          if (active && prof) {
            setProfile(prof);

            if (prof.role === "patient") {
              const { data: med } = await supabase
                .from("medical_profiles")
                .select("blood_type, chronic_diseases, allergies")
                .eq("patient_id", session.user.id)
                .single();

              if (active && med) {
                setMedProfile(med);
              }
            }
          }
        } else {
          setToken(null);
          setProfile(null);
          setMedProfile(null);
        }
      } catch (err) {
        console.warn("ChatAssistant auth sync error:", err);
      }
    }

    syncAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) {
        setToken(session.access_token);
        syncAuth();
      } else {
        setToken(null);
        setProfile(null);
        setMedProfile(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: text,
          history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
          profileContext: {
            userId: profile?.id,
            fullName: profile?.full_name,
            role: isDoctor ? "doctor" : (profile?.role || "patient"),
            specialization: profile?.specialization,
            bloodType: medProfile?.blood_type,
            chronicConditions: medProfile?.chronic_diseases,
            allergies: medProfile?.allergies,
          },
        }),
      });

      if (!res.ok) throw new Error("Failed to reach health assistant");

      const data = await res.json();
      const assistantMsg: Message = {
        role: "assistant",
        content: data.reply || "I am currently unable to process your request. Please try again shortly.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        doctors: data.recommendedDoctors,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: isDoctor
            ? "Connection interrupted. If verifying an acute or critical scan, please refer to on-device point-of-care model probabilities and standard clinical examination protocols."
            : "I experienced a connection issue while analyzing your inquiry. If you have an urgent medical concern, please reach out to emergency services or an in-person physician.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetConversation = () => {
    const initialTimestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages([
      {
        role: "assistant",
        content: isDoctor
          ? "Conversation reset. I am ready to support your microscopy inspection, ECG rhythm strip analysis, or clinical triage validation."
          : "Conversation reset. Hello! How can I assist you with your health questions or diagnostic reports today?",
        timestamp: initialTimestamp,
      },
    ]);
  };

  // Suggestion chips tailored to current persona
  const quickPrompts = useMemo(() => {
    if (isDoctor) {
      return [
        "Malaria microscopy grading criteria",
        "MIT-BIH Arrhythmia 5-class guidance",
        "WHO Malaria Artemether therapy protocol",
        "Triage criteria for high-risk flags",
      ];
    }
    return [
      "What does high risk in malaria mean?",
      "Explain my confidence score",
      "Find a verified specialist",
      "When should I visit the emergency room?",
    ];
  }, [isDoctor]);

  if (!mounted) return null;

  return (
    <>
      {/* Floating Action Button (FAB) anchored to bottom-right */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40 sm:bottom-8 sm:right-8 group flex items-center gap-3">
          {/* Subtle hover tooltip badge */}
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-blue-500/20 bg-background/95 px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-lg backdrop-blur-md opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:-translate-x-1">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{isDoctor ? "AI Clinical Co-Pilot" : "AI Health Assistant"}</span>
          </div>

          <button
            onClick={() => setIsOpen(true)}
            id="chat-assistant-fab"
            className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-700 text-white shadow-xl shadow-blue-500/30 ring-4 ring-blue-500/10 transition-all duration-300 hover:scale-108 hover:shadow-2xl hover:shadow-blue-500/40 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-400/30"
            aria-label={isDoctor ? "Open AI Clinical Co-Pilot" : "Open AI Health Assistant"}
          >
            <div className="relative">
              {isDoctor ? (
                <Stethoscope className="h-6 w-6 transition-transform duration-300 group-hover:rotate-12" />
              ) : (
                <Bot className="h-6 w-6 transition-transform duration-300 group-hover:scale-110" />
              )}
              {/* Online pulsing indicator */}
              <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white dark:border-background bg-emerald-500"></span>
              </span>
            </div>
          </button>
        </div>
      )}

      {/* Floating Chat Drawer / Pop-up Window */}
      {isOpen && (
        <div
          id="chat-assistant-window"
          className={`fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6 flex flex-col rounded-3xl border border-border/80 bg-background/95 shadow-2xl shadow-blue-950/25 backdrop-blur-xl transition-all duration-300 animate-in fade-in-50 zoom-in-95 ${
            isExpanded
              ? "w-[calc(100vw-2rem)] sm:w-[560px] h-[calc(100vh-3rem)] max-h-[820px]"
              : "w-[calc(100vw-2rem)] sm:w-[440px] h-[630px] max-h-[calc(100vh-4rem)]"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-transparent px-4 py-3 rounded-t-3xl">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
                {isDoctor ? <Stethoscope className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-sm text-foreground truncate">
                    {isDoctor ? "AI Clinical Co-Pilot" : "AI Health Assistant"}
                  </span>
                  <Badge
                    variant="outline"
                    className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0 text-[10px] font-semibold text-blue-700 dark:text-blue-300"
                  >
                    {isDoctor ? "Clinician Support" : "24/7 Clinical Guide"}
                  </Badge>
                </div>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {isDoctor
                    ? "Point-of-Care Triage & Diagnostic Decision Support"
                    : "Active & context-aware medical guide"}
                </span>
              </div>
            </div>

            {/* Window controls */}
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleResetConversation}
                title="Reset conversation"
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "Collapse window" : "Expand window"}
                className="hidden sm:inline-flex h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              >
                {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                title="Close chat"
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Active Context Banner */}
          {profile && (
            <div className="flex items-center justify-between px-4 py-1.5 bg-blue-50/70 dark:bg-blue-950/40 border-b border-border/40 text-[11px] text-blue-800 dark:text-blue-300">
              <span className="flex items-center gap-1.5 font-medium truncate">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                {isDoctor ? (
                  <span>
                    Logged in: <strong>Dr. {profile.full_name || "Doctor"}</strong>{" "}
                    {profile.specialization ? `(${profile.specialization})` : ""}
                  </span>
                ) : (
                  <span>
                    Patient: <strong>{profile.full_name || "Verified"}</strong>{" "}
                    {medProfile?.blood_type ? `· ${medProfile.blood_type}` : ""}
                  </span>
                )}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0 font-mono">Synced</span>
            </div>
          )}

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs sm:text-sm">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 shadow-xs">
                    {isDoctor ? <Stethoscope className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-xs ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-xs shadow-blue-500/10"
                      : "bg-muted/80 text-foreground border border-border/50 rounded-bl-xs"
                  }`}
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none break-words [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>table]:w-full [&>table]:border [&>table]:border-border/60 [&>table]:my-2 [&>table_th]:border-b [&>table_th]:p-1 [&>table_td]:p-1">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>

                  {/* Recommended Doctors Card (only shown for patients) */}
                  {!isDoctor && m.doctors && m.doctors.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t border-border/40 pt-2.5">
                      <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                        <Stethoscope className="h-3.5 w-3.5" />
                        Available Platform Specialists:
                      </span>
                      {m.doctors.slice(0, 2).map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between rounded-xl bg-background/80 p-2 text-xs border border-border/60"
                        >
                          <div>
                            <p className="font-medium text-foreground">Dr. {doc.full_name || "Specialist"}</p>
                            <p className="text-[10px] text-muted-foreground">{doc.specialization || "General Medicine"}</p>
                          </div>
                          <Badge variant="secondary" className="text-[10px] capitalize">
                            {doc.role}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  <span
                    className={`block text-[10px] mt-1.5 text-right ${
                      m.role === "user" ? "text-blue-100" : "text-muted-foreground"
                    }`}
                  >
                    {m.timestamp}
                  </span>
                </div>
                {m.role === "user" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 items-center text-muted-foreground text-xs py-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                </div>
                <span className="animate-pulse">
                  {isDoctor
                    ? "Evaluating clinical guidelines and model telemetry..."
                    : "Analyzing medical guidelines..."}
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-3.5 py-2 border-t border-border/40 bg-muted/20 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {quickPrompts.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSend(q)}
                disabled={loading}
                className="shrink-0 rounded-full border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/40 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100/80 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <div className="p-3 border-t border-border/60 bg-background/80 rounded-b-3xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isDoctor
                    ? "Ask clinical questions, therapy protocols, or triage criteria..."
                    : "Ask about symptoms, reports, or care..."
                }
                disabled={loading}
                className="h-10 text-xs sm:text-sm bg-muted/40 border-border/80 focus-visible:ring-blue-500 rounded-xl"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || loading}
                className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-90 disabled:opacity-50 shadow-sm shadow-blue-500/20"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <p className="mt-1.5 text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
              <ShieldCheck className="h-3 w-3 text-muted-foreground" />
              {isDoctor
                ? "Clinical Decision Support · Final medical diagnosis remains the responsibility of the attending physician."
                : "Decision support only · For emergencies dial your local emergency services line."}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
