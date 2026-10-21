"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, X, MessageSquare, Sparkles, User, RefreshCw, AlertCircle, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  doctors?: Array<{ id: string; full_name: string | null; role: string; specialization: string | null }>;
}

export function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I am your **Diagnose Me AI Health Assistant**. I can help you understand your diagnostic reports, explain medical terms, track symptoms, or connect you with verified specialists. How can I assist you today?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
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
          content:
            "I experienced a connection issue while analyzing your inquiry. If you have an urgent medical concern, please reach out to emergency services or an in-person physician.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    "What does high risk in malaria mean?",
    "Explain my confidence score",
    "Find a specialist doctor",
  ];

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/30 transition-all duration-300 hover:scale-105 hover:shadow-blue-500/40 active:scale-95"
          aria-label="Open AI Health Assistant"
        >
          <div className="relative">
            <Bot className="h-6 w-6" />
            <span className="absolute -right-1 -top-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
            </span>
          </div>
        </button>
      )}

      {/* Slide-out / Floating Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[600px] w-full max-w-[420px] flex-col rounded-2xl border border-border/80 bg-background/95 shadow-2xl backdrop-blur-lg transition-all duration-300 sm:w-[420px]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 bg-blue-600/5 px-4 py-3.5 rounded-t-2xl">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/20">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm text-foreground">AI Health Assistant</span>
                  <Badge variant="outline" className="border-blue-200 bg-blue-50 px-1.5 py-0 text-[10px] text-blue-700">
                    24/7 Clinical Guide
                  </Badge>
                </div>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  Active & context-aware
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                    <Bot className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-sm ${
                    m.role === "user"
                      ? "bg-blue-600 text-white rounded-br-xs"
                      : "bg-muted/80 text-foreground border border-border/50 rounded-bl-xs"
                  }`}
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>

                  {/* Recommended Doctors Card */}
                  {m.doctors && m.doctors.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t border-border/40 pt-2.5">
                      <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                        <Stethoscope className="h-3.5 w-3.5" />
                        Available Platform Doctors:
                      </span>
                      {m.doctors.slice(0, 2).map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between rounded-lg bg-background/80 p-2 text-xs border border-border/60"
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

                  <span className={`block text-[10px] mt-1.5 text-right ${m.role === "user" ? "text-blue-100" : "text-muted-foreground"}`}>
                    {m.timestamp}
                  </span>
                </div>
                {m.role === "user" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 items-center text-muted-foreground text-xs py-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                </div>
                <span>Analyzing medical guidelines...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-4 py-2 border-t border-border/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {quickPrompts.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSend(q)}
                disabled={loading}
                className="shrink-0 rounded-full border border-blue-200 bg-blue-50/50 px-2.5 py-1 text-[11px] text-blue-700 hover:bg-blue-100/70 transition-colors disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <div className="p-3 border-t border-border/60 bg-background/80 rounded-b-2xl">
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
                placeholder="Ask about symptoms, reports, or care..."
                disabled={loading}
                className="h-10 text-xs sm:text-sm bg-muted/40 border-border/80 focus-visible:ring-blue-500"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || loading}
                className="h-10 w-10 shrink-0 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <p className="mt-1 text-[10px] text-center text-muted-foreground">
              Decision support only · For emergencies dial your local emergency line.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
