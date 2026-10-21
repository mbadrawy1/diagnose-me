"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Activity, Bell, LogOut, ShieldAlert, User, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

interface NavbarProps {
  userRole?: string;
  userName?: string;
  unreadAlertsCount?: number;
}

export function Navbar({ userRole, userName, unreadAlertsCount = 0 }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const handleSignOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 transition-transform hover:scale-[1.02]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25">
            <Activity className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-lg font-bold tracking-tight text-foreground">
              Diagnose<span className="text-blue-600">.me</span>
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              AI Diagnostic Platform
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden items-center gap-6 md:flex">
          {userRole === "patient" && (
            <>
              <Link
                href="/patient"
                className={`text-sm font-medium transition-colors ${
                  pathname === "/patient" ? "text-blue-600 font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Diagnostic Studio
              </Link>
              <Link
                href="/patient/history"
                className={`text-sm font-medium transition-colors ${
                  pathname === "/patient/history" ? "text-blue-600 font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Medical History
              </Link>
              <Link
                href="/patient/profile"
                className={`text-sm font-medium transition-colors ${
                  pathname === "/patient/profile" ? "text-blue-600 font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Electronic Profile
              </Link>
            </>
          )}

          {userRole && userRole !== "patient" && (
            <>
              <Link
                href="/provider"
                className={`text-sm font-medium transition-colors ${
                  pathname === "/provider" ? "text-blue-600 font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Clinical Worklist
              </Link>
              <Link
                href="/provider/verified"
                className={`text-sm font-medium transition-colors ${
                  pathname === "/provider/verified" ? "text-blue-600 font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Validated Reports
              </Link>
            </>
          )}
        </nav>

        {/* User Status / Actions */}
        <div className="flex items-center gap-3">
          {userRole ? (
            <>
              <div className="hidden items-center gap-2 sm:flex">
                <Badge
                  variant="outline"
                  className="gap-1.5 border-blue-200 bg-blue-50/70 py-1 text-xs font-medium text-blue-700 capitalize"
                >
                  {userRole === "patient" ? (
                    <User className="h-3 w-3" />
                  ) : (
                    <Stethoscope className="h-3 w-3" />
                  )}
                  {userRole}
                </Badge>
                {userName && (
                  <span className="max-w-[130px] truncate text-xs font-medium text-muted-foreground">
                    {userName}
                  </span>
                )}
              </div>

              {unreadAlertsCount > 0 && (
                <div className="relative">
                  <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full text-muted-foreground hover:text-foreground">
                    <Bell className="h-4 w-4" />
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-background">
                      {unreadAlertsCount > 9 ? "9+" : unreadAlertsCount}
                    </span>
                  </Button>
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/auth">Sign In</Link>
              </Button>
              <Button size="sm" className="bg-blue-600 text-white shadow-sm hover:bg-blue-700" asChild>
                <Link href="/auth?tab=signup">Get Started</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
