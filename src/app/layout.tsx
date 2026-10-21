import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["500", "600", "700", "800"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Diagnose Me — AI-Powered Healthcare Diagnostics",
    template: "%s · Diagnose Me",
  },
  description:
    "Diagnose Me connects patients, doctors, hospitals and clinics with AI-assisted diagnostics, electronic medical profiles, real-time risk alerts and a 24/7 AI health assistant.",
  keywords: ["AI diagnosis", "malaria detection", "medical imaging", "electronic medical record", "telehealth"],
  applicationName: "Diagnose Me",
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans">
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
