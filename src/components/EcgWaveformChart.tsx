"use client";

import { useMemo, useState, useRef } from "react";
import { Activity, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EcgWaveformChartProps {
  signal: number[];
  title?: string;
  className?: string;
  riskLevel?: "low" | "medium" | "high" | "critical";
  height?: number;
  showGrid?: boolean;
}

export function EcgWaveformChart({
  signal,
  title = "1D ECG Heartbeat Waveform",
  className = "",
  riskLevel = "low",
  height = 190,
  showGrid = true,
}: EcgWaveformChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Normalize points to ensure 187 length
  const points = useMemo(() => {
    if (!signal || signal.length === 0) return new Array(187).fill(0);
    if (signal.length === 188) return signal.slice(0, 187);
    if (signal.length < 187) return [...signal, ...new Array(187 - signal.length).fill(0)];
    return signal.slice(0, 187);
  }, [signal]);

  // Dimensions for coordinate mapping
  const width = 680;
  const paddingX = 24;
  const paddingY = 20;
  const innerW = width - paddingX * 2;
  const innerH = height - paddingY * 2;

  // Max and min amplitude in signal
  const minVal = useMemo(() => Math.min(0, ...points), [points]);
  const maxVal = useMemo(() => Math.max(1, ...points), [points]);
  const range = maxVal - minVal || 1;

  // Build SVG path
  const pathD = useMemo(() => {
    return points
      .map((val, idx) => {
        const x = paddingX + (idx / (points.length - 1)) * innerW;
        const normY = (val - minVal) / range;
        const y = paddingY + innerH - normY * innerH;
        return `${idx === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }, [points, minVal, range, innerW, innerH, paddingX, paddingY]);

  // Color scheme based on risk
  const traceColor = useMemo(() => {
    switch (riskLevel) {
      case "critical":
        return "#f43f5e"; // rose-500
      case "high":
        return "#ea580c"; // orange-600
      case "medium":
        return "#f59e0b"; // amber-500
      default:
        return "#10b981"; // emerald-500
    }
  }, [riskLevel]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const ratio = (mouseX - (paddingX / width) * rect.width) / ((innerW / width) * rect.width);
    const index = Math.round(ratio * (points.length - 1));
    if (index >= 0 && index < points.length) {
      setHoverIndex(index);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const activePoint = hoverIndex !== null ? {
    idx: hoverIndex,
    val: points[hoverIndex],
    x: paddingX + (hoverIndex / (points.length - 1)) * innerW,
    y: paddingY + innerH - ((points[hoverIndex] - minVal) / range) * innerH,
  } : null;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-white shadow-inner ${className}`}
    >
      {/* Top Header */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <Activity className="h-3.5 w-3.5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5 font-mono">
              {title}
            </h4>
            <span className="text-[10px] text-slate-400">
              MIT-BIH Arrhythmia Beat Trace · 187 Time-Steps @ 125 Hz
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[10px] font-mono border-slate-700 bg-slate-900/80 text-slate-300"
          >
            t: 0 – 1.496s
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] font-mono border-slate-700 bg-slate-900/80 text-slate-300"
          >
            Amp: {minVal.toFixed(2)} to {maxVal.toFixed(2)}
          </Badge>
          {hoverIndex !== null && (
            <Badge className="bg-blue-600 text-[10px] font-mono text-white animate-in fade-in">
              Idx #{hoverIndex}: {points[hoverIndex]?.toFixed(4)}
            </Badge>
          )}
        </div>
      </div>

      {/* SVG Canvas with ECG Grid Paper Background */}
      <div className="relative w-full overflow-hidden rounded-lg bg-slate-950 select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair touch-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          preserveAspectRatio="none"
        >
          <defs>
            {/* Small 1mm equivalent grid */}
            <pattern id="ecg-small-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(244, 63, 94, 0.07)" strokeWidth="0.5" />
            </pattern>
            {/* Large 5mm equivalent grid */}
            <pattern id="ecg-large-grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <rect width="50" height="50" fill="url(#ecg-small-grid)" />
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(244, 63, 94, 0.18)" strokeWidth="1" />
            </pattern>
            {/* Gradient under curve */}
            <linearGradient id="trace-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={traceColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={traceColor} stopOpacity="0.0" />
            </linearGradient>
            {/* Glow Filter */}
            <filter id="ecg-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid Paper */}
          {showGrid && <rect width={width} height={height} fill="url(#ecg-large-grid)" />}

          {/* Isoelectric Baseline (y = 0) */}
          {(() => {
            const zeroY = paddingY + innerH - ((0 - minVal) / range) * innerH;
            return (
              <line
                x1={paddingX}
                y1={zeroY}
                x2={width - paddingX}
                y2={zeroY}
                stroke="rgba(148, 163, 184, 0.25)"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            );
          })()}

          {/* Area under curve */}
          <path
            d={`${pathD} L ${width - paddingX} ${paddingY + innerH} L ${paddingX} ${paddingY + innerH} Z`}
            fill="url(#trace-gradient)"
          />

          {/* Glowing Waveform Trace */}
          <path
            d={pathD}
            fill="none"
            stroke={traceColor}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#ecg-glow)"
          />

          {/* Interactive Inspection Reticle */}
          {activePoint && (
            <g>
              <line
                x1={activePoint.x}
                y1={paddingY}
                x2={activePoint.x}
                y2={height - paddingY}
                stroke="#60a5fa"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="4.5"
                fill="#60a5fa"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            </g>
          )}
        </svg>

        {/* Legend / Clinical Reference */}
        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono px-1">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: traceColor }}></span>
              187 Time Steps (0.00 – 1.49s)
            </span>
            <span className="hidden sm:inline text-slate-500">|</span>
            <span className="hidden sm:inline">Lead II Rhythm Strip Simulation</span>
          </div>
          <span className="text-slate-400">
            {activePoint ? `t = ${(activePoint.idx * 0.008).toFixed(3)}s` : "Hover waveform to inspect"}
          </span>
        </div>
      </div>
    </div>
  );
}
