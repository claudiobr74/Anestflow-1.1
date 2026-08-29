/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as d3 from "d3";
import React, { useState, useRef, useEffect } from "react";
import { AnesthesiaDocument, VitalRecord, ClinicalEvent, BolusDrug, ContinuousInfusion, InhalationAgent } from "../types";
import { Activity, Clock, ZoomIn, ZoomOut, Maximize2, HelpCircle, Sliders, ChevronLeft, ChevronRight } from "lucide-react";

interface ClinicalChartProps {
  ficha: AnesthesiaDocument;
  onTimeSelect?: (minutes: number) => void;
  selectedMinutes?: number | null;
  theme?: "light" | "dark" | "dark-clean";
  onUpdateVitalRecord?: (id: string, updates: Partial<VitalRecord>) => void;
  onAddVitalRecord?: (record: VitalRecord) => void;
  onRemoveVitalRecord?: (id: string) => void;
  onUpdateVitalsList?: (vitals: VitalRecord[]) => void;
}

type VitalTool = "fc" | "pas" | "pad" | "spo2" | "etco2" | "temp" | "bis" | "pai" | "fr" | "tof" | "pvc" | null;

export default function ClinicalChart({ 
  ficha, 
  onTimeSelect, 
  selectedMinutes, 
  theme = "light",
  onUpdateVitalRecord,
  onAddVitalRecord,
  onRemoveVitalRecord,
  onUpdateVitalsList
}: ClinicalChartProps) {
  const { timers, inhalationAgents = [] } = ficha;
  const vitals = (ficha.vitals || []).filter((v) => !v.voidedAt);
  const events = (ficha.events || []).filter((e) => !e.voidedAt);
  const bolusDrugs = (ficha.bolusDrugs || []).filter((d) => !d.voidedAt);
  const continuousInfusions = (ficha.continuousInfusions || []).filter((i) => !i.voidedAt);

  const isDark = theme === "dark" || theme === "dark-clean";
  const cardClass = isDark
    ? "bg-[#1C1C1E] border-zinc-800 text-zinc-100 shadow-sm"
    : "bg-white border-zinc-200/80 text-zinc-900 shadow-xs";

  const headerClass = isDark ? "bg-[#2C2C2E]/65 border-b border-zinc-850 text-zinc-100" : "bg-slate-50 border-b border-slate-100 text-slate-800";
  const footerClass = isDark ? "bg-[#2C2C2E]/65 border-t border-zinc-850 text-zinc-400" : "bg-slate-50 border-t border-slate-100 text-slate-500";
  const canvasBgClass = isDark ? "bg-[#000000]" : "bg-slate-50/30";

  // Chart horizontal sizing parameters (zoom slider controls this value in pixels per minute)
  const [colWidth, setColWidth] = useState<number>(12);
  const [rowZoom, setRowZoom] = useState<number>(0);

  // Grid limit in minutes (dynamic progressive increment)
  const [maxMinutesLimit, setMaxMinutesLimit] = useState<number>(() => {
    const startAnesth = timers?.startAnesthesia ? new Date(timers.startAnesthesia) : null;
    const dataMax = Math.max(
      90,
      vitals.length > 0 ? Math.max(...vitals.map(v => v.minutesFromStart)) + 15 : 90,
      events.length > 0 ? Math.max(...events.map(e => {
        if (!startAnesth) return 0;
        const t = new Date(e.timestamp).getTime();
        return Math.round((t - startAnesth.getTime()) / 60000);
      })) + 15 : 90
    );
    return Math.ceil(dataMax / 15) * 15;
  });

  const [hoveredVitals, setHoveredVitals] = useState<VitalRecord | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 420 });

  // Interactive Tools State
  const [activeTool, setActiveTool] = useState<VitalTool>(null);
  const [draggingPoint, setDraggingPoint] = useState<{ id: string, type: VitalTool, startX: number, startY: number } | null>(null);
  const [dragCurrentXY, setDragCurrentXY] = useState<{ x: number, y: number } | null>(null);
  const [isHoveringTrash, setIsHoveringTrash] = useState(false);
  
  // Upgrade states
  const [crosshair, setCrosshair] = useState<{ x: number, mins: number, rawX: number, rawY: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStartX, setPanStartX] = useState(0);
  const [panScrollStart, setPanScrollStart] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Handle resizing of container fluidly
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        setDimensions((prev) => ({ ...prev, width: Math.max(width, 600) }));
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Time calculations
  const startAnesth = timers.startAnesthesia ? new Date(timers.startAnesthesia) : null;
  
  // Calculate total active time range
  const totalMins = Math.max(
    maxMinutesLimit,
    vitals.length > 0 ? Math.max(...vitals.map(v => v.minutesFromStart)) + 15 : 90,
    events.length > 0 ? Math.max(...events.map(e => {
      if (!startAnesth) return 0;
      const t = new Date(e.timestamp).getTime();
      return Math.round((t - startAnesth.getTime()) / 60000);
    })) + 15 : 90
  );

  // Round up total minutes to nearest 15 for grid alignment
  const maxGridMins = Math.ceil(totalMins / 15) * 15;
  const leftMargin = 70;
  const rightMargin = 40;
  const topMargin = 50;

  const infCount = continuousInfusions.length;
  const inhCount = inhalationAgents.length;
  
  // OPTION 1: Use a static compact bottom margin inside the SVG, and render infusions and gases as beautiful HTML timelines below.
  const bottomMargin = 35; // For time labels

  const chartInnerWidth = maxGridMins * colWidth;
  const chartWidth = chartInnerWidth + leftMargin + rightMargin;
  
  const plotHeight = 265 * (1 + rowZoom / 100);
  const laneHeight = 28;
  const infusionsLanesHeight = Math.max(0, continuousInfusions.filter(inf => inf.history && inf.history.length > 0).length * laneHeight);
  const activeInhAgents = inhalationAgents.length;
  const gasesLanesHeight = Math.max(0, activeInhAgents * laneHeight);
  const lanesTotalHeight = (infusionsLanesHeight > 0 ? infusionsLanesHeight + 15 : 0) + (gasesLanesHeight > 0 ? gasesLanesHeight + 15 : 0);
  const chartHeight = topMargin + plotHeight + lanesTotalHeight + bottomMargin;

  // Scale functions
  const getX = (minutes: number) => leftMargin + minutes * colWidth;
  const getY = (val: number, minVal = 0, maxVal = 200) => {
    const clamped = Math.max(minVal, Math.min(maxVal, val));
    const ratio = (clamped - minVal) / (maxVal - minVal);
    return topMargin + plotHeight * (1 - ratio);
  };

  const getAreaPathFromLine = (path: string, pts: any[]) => {
    if (!path || pts.length === 0) return "";
    const firstX = getX(pts[0].minutesFromStart);
    const lastX = getX(pts[pts.length - 1].minutesFromStart);
    const baseY = getY(0);
    return `${path} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
  };

  // Generates a beautiful plethysmographic ripple along the SpO₂ line segments
  const getSpO2RipplePath = () => {
    const pts = activeVitals
      .filter((v) => v.spo2 !== undefined)
      .sort((a, b) => a.minutesFromStart - b.minutesFromStart);
    
    if (pts.length === 0) return "";
    
    let path = "";
    
    for (let i = 0; i < pts.length; i++) {
      const x = getX(pts[i].minutesFromStart);
      const y = getY(pts[i].spo2!);
      
      if (i === 0) {
        path += `M ${x} ${y}`;
      } else {
        const prevX = getX(pts[i - 1].minutesFromStart);
        const prevY = getY(pts[i - 1].spo2!);
        
        const dx = x - prevX;
        if (dx > 1) {
          const step = 1.5;
          const stepsCount = Math.floor(dx / step);
          for (let s = 1; s < stepsCount; s++) {
            const currX = prevX + s * step;
            const t = (currX - prevX) / dx;
            const baseY = prevY + t * (y - prevY);
            
            // Generate high-frequency sine waves with secondary reflection (dicrotic wave)
            const angle = ((currX - prevX) / 8) * 2 * Math.PI;
            const ripple = Math.sin(angle) * 3.5 + Math.sin(angle * 2) * 1.2;
            
            // Sine windowing function to keep end points perfectly anchored to real registered data dots
            const windowMultiplier = Math.sin(t * Math.PI);
            const finalY = baseY + ripple * windowMultiplier;
            
            path += ` L ${currX.toFixed(1)} ${finalY.toFixed(1)}`;
          }
        }
        path += ` L ${x} ${y}`;
      }
    }
    return path;
  };

  // Generates a beautiful breathing (sinusoidal) ripple along the ETCO2 line segments
  const getEtco2RipplePath = () => {
    const pts = activeVitals
      .filter((v) => v.etco2 !== undefined)
      .sort((a, b) => a.minutesFromStart - b.minutesFromStart);
    
    if (pts.length === 0) return "";
    
    let path = "";
    
    for (let i = 0; i < pts.length; i++) {
      const x = getX(pts[i].minutesFromStart);
      const y = getY(pts[i].etco2!);
      
      if (i === 0) {
        path += `M ${x} ${y}`;
      } else {
        const prevX = getX(pts[i - 1].minutesFromStart);
        const prevY = getY(pts[i - 1].etco2!);
        
        const dx = x - prevX;
        if (dx > 1) {
          const step = 1.5;
          const stepsCount = Math.floor(dx / step);
          for (let s = 1; s < stepsCount; s++) {
            const currX = prevX + s * step;
            const t = (currX - prevX) / dx;
            const baseY = prevY + t * (y - prevY);
            
            // Minutes from start for this current point
            const t_minutes = (currX - leftMargin) / colWidth;
            const angle = 2 * Math.PI * 12 * t_minutes;
            
            // Low amplitude sinusoidal wave (e.g. amplitude of 3.0 pixels)
            const ripple = Math.sin(angle) * 3.0;
            
            // Sine windowing function to keep end points perfectly anchored to real registered data dots
            const windowMultiplier = Math.sin(t * Math.PI);
            const finalY = baseY + ripple * windowMultiplier;
            
            path += ` L ${currX.toFixed(1)} ${finalY.toFixed(1)}`;
          }
        }
        path += ` L ${x} ${y}`;
      }
    }
    return path;
  };

  // Humanize time for timeline ticks
  const formatTimeTick = (minsFromStart: number) => {
    if (!startAnesth) return `+${minsFromStart}'`;
    const d = new Date(startAnesth.getTime() + minsFromStart * 60000);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  // Format relative hours and minutes from point zero (start of anesthesia)
  const formatRelativeTime = (mins: number) => {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    const minsStr = remMins.toString().padStart(2, "0");
    return `${hrs}h${minsStr}`;
  };

  // Generate grid columns (every 15 mins a major line, every 5 mins a minor line)
  const cols: number[] = [];
  for (let m = 0; m <= maxGridMins; m += 5) {
    cols.push(m);
  }

  // Generate vitals markers for plot
  const activeVitals = [...vitals].sort((a, b) => a.minutesFromStart - b.minutesFromStart);

  return (
    <div 
      id="chart-section-card" 
      className={`${isFullscreen ? `fixed inset-0 z-[100] h-screen w-screen ${isDark ? "bg-[#09090b]" : "bg-white"} rounded-none border-0` : `${cardClass} rounded-lg border h-full`} overflow-hidden flex flex-col`}
    >
      {/* Chart Control Toolbar */}
      <div className={`px-4 py-3 flex flex-wrap items-center justify-between gap-3 select-none ${headerClass}`}>
        <div className="flex items-center gap-2">
          <Activity className={`w-5 h-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
          <h3 className={`font-semibold text-sm ${isDark ? "text-zinc-100" : "text-slate-800"}`}>Ficha Gráfica Intraoperatória</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium ${
            isDark ? "bg-indigo-950/50 text-indigo-300 border border-indigo-900/60" : "bg-indigo-50 text-indigo-700"
          }`}>
            Resolução CFM 2.174
          </span>
        </div>

        <div className={`flex items-center gap-1.5 text-xs ${isDark ? "text-zinc-400" : "text-slate-500"} overflow-x-auto scrollbar-none max-w-full w-full lg:w-auto`}>
          <button 
            onClick={() => setActiveTool(activeTool === "fc" ? null : "fc")}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition shrink-0 ${activeTool === "fc" ? (isDark ? "bg-indigo-900/50 text-indigo-300" : "bg-indigo-100 text-indigo-700") : "hover:bg-black/5 dark:hover:bg-white/5"}`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
            <span>FC</span>
          </button>
          
          <button 
            onClick={() => setActiveTool(activeTool === "pas" ? null : "pas")}
            className={`flex items-center gap-1 px-2 py-1 rounded transition shrink-0 ${activeTool === "pas" ? (isDark ? "bg-indigo-900/50 text-indigo-300" : "bg-indigo-100 text-indigo-700") : "hover:bg-black/5 dark:hover:bg-white/5"}`}
          >
            <span className="text-rose-600 font-bold font-mono text-xs">∨</span>
            <span>PAS</span>
          </button>

          <button 
            onClick={() => setActiveTool(activeTool === "pad" ? null : "pad")}
            className={`flex items-center gap-1 px-2 py-1 rounded transition shrink-0 ${activeTool === "pad" ? (isDark ? "bg-indigo-900/50 text-indigo-300" : "bg-indigo-100 text-indigo-700") : "hover:bg-black/5 dark:hover:bg-white/5"}`}
          >
            <span className="text-rose-600 font-bold font-mono text-xs">∧</span>
            <span>PAD</span>
          </button>

          <button 
            onClick={() => setActiveTool(activeTool === "spo2" ? null : "spo2")}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition shrink-0 ${activeTool === "spo2" ? (isDark ? "bg-indigo-900/50 text-indigo-300" : "bg-indigo-100 text-indigo-700") : "hover:bg-black/5 dark:hover:bg-white/5"}`}
          >
            <span className="w-2 h-2 bg-emerald-500 inline-block rotate-45"></span>
            <span>SpO₂</span>
          </button>
          
          <button 
            onClick={() => setActiveTool(activeTool === "etco2" ? null : "etco2")}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition shrink-0 ${activeTool === "etco2" ? (isDark ? "bg-indigo-900/50 text-indigo-300" : "bg-indigo-100 text-indigo-700") : "hover:bg-black/5 dark:hover:bg-white/5"}`}
          >
            <svg className="w-3 h-3 text-yellow-500 fill-yellow-400 shrink-0" viewBox="0 0 10 10" aria-hidden="true">
        <defs>
          <linearGradient id="fc-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="spo2-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="pai-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="bis-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="etco2-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eab308" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#eab308" stopOpacity="0" />
          </linearGradient>
        </defs>
              <polygon points="5,1 9.5,8.5 0.5,8.5" stroke="#d97706" strokeWidth="1.2" />
            </svg>
            <span>ETCO₂</span>
          </button>

          <button 
            onClick={() => setActiveTool(activeTool === "pai" ? null : "pai")}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition shrink-0 ${activeTool === "pai" ? (isDark ? "bg-indigo-900/50 text-indigo-300" : "bg-indigo-100 text-indigo-700") : "hover:bg-black/5 dark:hover:bg-white/5"}`}
          >
            <span className="text-red-500 font-bold font-mono">⊥</span>
            <span>PAI</span>
          </button>

          <button 
            onClick={() => setActiveTool(activeTool === "bis" ? null : "bis")}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition shrink-0 ${activeTool === "bis" ? (isDark ? "bg-indigo-900/50 text-indigo-300" : "bg-indigo-100 text-indigo-700") : "hover:bg-black/5 dark:hover:bg-white/5"}`}
          >
            <span className="w-2.5 h-2.5 bg-purple-500 inline-block shrink-0"></span>
            <span>BIS</span>
          </button>

          <button 
            onClick={() => setActiveTool(activeTool === "temp" ? null : "temp")}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition shrink-0 ${activeTool === "temp" ? (isDark ? "bg-indigo-900/50 text-indigo-300" : "bg-indigo-100 text-indigo-700") : "hover:bg-black/5 dark:hover:bg-white/5"}`}
          >
            <span className="text-orange-500 font-bold font-mono">+</span>
            <span>TEMP</span>
          </button>

          <button 
            onClick={() => setActiveTool(activeTool === "fr" ? null : "fr")}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition shrink-0 ${activeTool === "fr" ? (isDark ? "bg-indigo-900/50 text-indigo-300" : "bg-indigo-100 text-indigo-700") : "hover:bg-black/5 dark:hover:bg-white/5"}`}
          >
            <span className="text-teal-500 font-bold font-mono">x</span>
            <span>FR</span>
          </button>

          <button 
            onClick={() => setActiveTool(activeTool === "pvc" ? null : "pvc")}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition shrink-0 ${activeTool === "pvc" ? (isDark ? "bg-indigo-900/50 text-indigo-300" : "bg-indigo-100 text-indigo-700") : "hover:bg-black/5 dark:hover:bg-white/5"}`}
          >
            <span className="text-cyan-500 font-bold font-mono text-xs">▼</span>
            <span>PVC</span>
          </button>

          <button 
            onClick={() => setActiveTool(activeTool === "tof" ? null : "tof")}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition shrink-0 ${activeTool === "tof" ? (isDark ? "bg-indigo-900/50 text-indigo-300" : "bg-indigo-100 text-indigo-700") : "hover:bg-black/5 dark:hover:bg-white/5"}`}
          >
            <span className="text-rose-500 font-bold font-mono tracking-[1px] text-[8px]">III</span>
            <span>TOF</span>
          </button>

          {activeTool && (
            <span className={`text-xs ml-2 font-medium shrink-0 ${isDark ? "text-indigo-400" : "text-indigo-600"}`}>
              Toque no gráfico para adicionar.
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 overflow-x-auto scrollbar-none max-w-full w-full lg:w-auto pb-1 lg:pb-0">
          <div className={`flex items-center gap-2.5 px-2.5 py-1 rounded-lg border shrink-0 ${
            isDark ? "bg-zinc-900/60 border-zinc-800 text-zinc-300" : "bg-slate-100 border-slate-200 text-slate-700"
          }`}>
            <span className="text-xs font-bold opacity-60">X</span>
            <div className={`flex items-center gap-1.5 rounded-md px-1 py-0.5 ${isDark ? "bg-zinc-950/40" : "bg-white/60"}`}>
              <button
                type="button"
                onClick={() => setColWidth(prev => Math.max(8, prev - 1))}
                className={`p-0.5 rounded-md transition-all active:scale-90 hover:opacity-100 cursor-pointer flex items-center justify-center ${
                  isDark ? "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100" : "hover:bg-slate-200 text-slate-500 hover:text-slate-900"
                }`}
                title="Diminuir Zoom Horizontal"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono font-bold w-6 text-center select-none" title="Nível de Zoom Horizontal">
                {Math.round(((colWidth - 8) / 10) * 100)}
              </span>
              <button
                type="button"
                onClick={() => setColWidth(prev => Math.min(18, prev + 1))}
                className={`p-0.5 rounded-md transition-all active:scale-90 hover:opacity-100 cursor-pointer flex items-center justify-center ${
                  isDark ? "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100" : "hover:bg-slate-200 text-slate-500 hover:text-slate-900"
                }`}
                title="Aumentar Zoom Horizontal"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-0.5"></div>
            
            <span className="text-xs font-bold opacity-60">Y</span>
            <div className={`flex items-center gap-1.5 rounded-md px-1 py-0.5 ${isDark ? "bg-zinc-950/40" : "bg-white/60"}`}>
              <button
                type="button"
                onClick={() => setRowZoom(prev => Math.max(0, prev - 10))}
                className={`p-0.5 rounded-md transition-all active:scale-90 hover:opacity-100 cursor-pointer flex items-center justify-center ${
                  isDark ? "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100" : "hover:bg-slate-200 text-slate-500 hover:text-slate-900"
                }`}
                title="Diminuir Zoom Vertical"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono font-bold w-6 text-center select-none" title="Nível de Zoom Vertical">
                {rowZoom}
              </span>
              <button
                type="button"
                onClick={() => setRowZoom(prev => Math.min(200, prev + 10))}
                className={`p-0.5 rounded-md transition-all active:scale-90 hover:opacity-100 cursor-pointer flex items-center justify-center ${
                  isDark ? "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100" : "hover:bg-slate-200 text-slate-500 hover:text-slate-900"
                }`}
                title="Aumentar Zoom Vertical"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-800 pl-2 shrink-0">
            <button
              onClick={() => setColWidth(8)}
              className={`px-2 py-1 rounded text-xs font-semibold transition shrink-0 ${
                colWidth === 8 
                  ? isDark ? "bg-zinc-800 text-indigo-400 border border-zinc-700 shadow-xs" : "bg-white text-indigo-600 border border-slate-200 shadow-xs" 
                  : isDark ? "text-zinc-400 hover:bg-zinc-800 hover:text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
              title="Compacto"
            >
              Compacto
            </button>
            <button
              onClick={() => setColWidth(12)}
              className={`px-2 py-1 rounded text-xs font-semibold transition shrink-0 ${
                colWidth === 12 
                  ? isDark ? "bg-zinc-800 text-indigo-400 border border-zinc-700 shadow-xs" : "bg-white text-indigo-600 border border-slate-200 shadow-xs" 
                  : isDark ? "text-zinc-400 hover:bg-zinc-800 hover:text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
              title="Normal"
            >
              Normal
            </button>
            <button
              onClick={() => setColWidth(18)}
              className={`px-2 py-1 rounded text-xs font-semibold transition shrink-0 ${
                colWidth === 18 
                  ? isDark ? "bg-zinc-800 text-indigo-400 border border-zinc-700 shadow-xs" : "bg-white text-indigo-600 border border-slate-200 shadow-xs" 
                  : isDark ? "text-zinc-400 hover:bg-zinc-800 hover:text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
              title="Expandido"
            >
              Expandido
            </button>
          </div>

          <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 self-center shrink-0"></div>

          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border shrink-0 ${
            isDark ? "bg-zinc-900/60 border-zinc-800 text-zinc-300" : "bg-slate-100 border-slate-200 text-slate-700"
          }`}>
            <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="text-xs font-bold opacity-75 shrink-0">Grade:</span>
            <select
              value={maxMinutesLimit}
              onChange={(e) => setMaxMinutesLimit(Number(e.target.value))}
              className={`text-xs font-bold bg-transparent border-none outline-none cursor-pointer focus:ring-0 ${
                isDark ? "text-indigo-400" : "text-indigo-600"
              }`}
              title="Duração da Grade"
            >
              {Array.from(new Set([90, 120, 180, 240, 360, 480, 720, 1080, 1440, maxMinutesLimit]))
                .sort((a, b) => a - b)
                .map((mins) => {
                  const hrs = Math.floor(mins / 60);
                  const rm = mins % 60;
                  const label = rm === 0 ? `${hrs}h` : `${hrs}h${rm}`;
                  return (
                    <option key={mins} value={mins} className={isDark ? "bg-zinc-950 text-zinc-100" : "bg-white text-slate-800"}>
                      {label} ({mins} min)
                    </option>
                  );
                })}
            </select>
            <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-700 mx-1 shrink-0"></div>
            <button
              onClick={() => setMaxMinutesLimit(prev => prev + 60)}
              className={`px-1.5 py-0.5 rounded text-xs font-bold transition shrink-0 ${
                isDark ? "bg-zinc-800 hover:bg-zinc-700 text-indigo-300" : "bg-white hover:bg-indigo-50 border border-slate-200 text-indigo-600 shadow-xs"
              }`}
              title="Adicionar +1 Hora"
            >
              +1h
            </button>
            <button
              onClick={() => setMaxMinutesLimit(prev => prev + 240)}
              className={`px-1.5 py-0.5 rounded text-xs font-bold transition shrink-0 ${
                isDark ? "bg-zinc-800 hover:bg-zinc-700 text-indigo-300" : "bg-white hover:bg-indigo-50 border border-slate-200 text-indigo-600 shadow-xs"
              }`}
              title="Adicionar +4 Horas"
            >
              +4h
            </button>
          </div>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`ml-1 px-2 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                isFullscreen 
                  ? isDark ? "bg-indigo-500/20 text-indigo-300" : "bg-indigo-100 text-indigo-700"
                  : isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-slate-500 hover:bg-slate-100"
              }`}
              title="Tela Cheia (Landscape)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      
      {/* Chart Canvas Area */}
      <div ref={containerRef} className={`flex-1 overflow-auto p-4 relative ${canvasBgClass}`}>
        <svg
          ref={svgRef}
          width={chartWidth}
          height={chartHeight}
          className="mx-auto block touch-none"
          style={{ minWidth: `${chartWidth}px`, maxWidth: "none", height: `${chartHeight}px` }}
          onPointerDown={(e) => {
            if (!activeTool && !draggingPoint) {
              const svg = svgRef.current;
              if (svg) {
                if ((e.target as any).tagName !== 'svg' && (e.target as any).tagName !== 'rect') return;
                setIsPanning(true);
                setPanStartX(e.clientX);
                if (containerRef.current) {
                  setPanScrollStart(containerRef.current.scrollLeft);
                }
              }
            }
          }}
          onPointerMove={(e) => {
            if (isPanning && containerRef.current) {
               const dx = e.clientX - panStartX;
               containerRef.current.scrollLeft = panScrollStart - dx;
            }
            
            if (svgRef.current) {
              const rect = svgRef.current.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const clickY = e.clientY - rect.top;
              const clickedMins = Math.round(((clickX - leftMargin) / chartInnerWidth) * maxGridMins);
              if (clickX >= leftMargin && clickX <= chartWidth - rightMargin) {
                 setCrosshair({ x: clickX + leftMargin, mins: clickedMins, rawX: e.clientX, rawY: e.clientY });
              } else {
                 setCrosshair(null);
              }
            }
            

            if (draggingPoint) {
              const rect = e.currentTarget.getBoundingClientRect();
              setDragCurrentXY({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
              });
              
              // Check if hovering trash
              const dropY = e.clientY - rect.top;
              const dropX = e.clientX - rect.left;
              if (dropY < topMargin || dropY > topMargin + plotHeight + 10 || dropX < leftMargin - 10 || dropX > chartWidth - rightMargin + 10) { // Hovering out of bounds = trash
                setIsHoveringTrash(true);
              } else {
                setIsHoveringTrash(false);
              }
            }
          }}
          onPointerUp={(e) => {
            setIsPanning(false);

            if (draggingPoint && dragCurrentXY) {
              try {
                e.currentTarget.releasePointerCapture(e.pointerId);
              } catch (err) {}
              const rect = e.currentTarget.getBoundingClientRect();
              // Use dragCurrentXY if available to prevent touch release coordinate issues on mobile devices (where clientX/Y on pointerup can be 0 or undefined)
              const dropX = dragCurrentXY ? dragCurrentXY.x : (e.clientX - rect.left);
              const dropY = dragCurrentXY ? dragCurrentXY.y : (e.clientY - rect.top);

              if (dropY < topMargin || dropY > topMargin + plotHeight + 10 || dropX < leftMargin - 10 || dropX > chartWidth - rightMargin + 10) {
                // Drop into trash zone
                // Actually remove the field from the record
                const existing = vitals.find(v => v.id === draggingPoint.id);
                if (existing) {
                  const keys = ["fc", "pas", "pad", "pam", "spo2", "etco2", "temp", "bis", "pai", "fr", "tof", "pvc"];
                  const otherKeys = keys.filter(k => k !== draggingPoint.type && (existing as any)[k] !== undefined);
                  
                  let newVitals: VitalRecord[];
                  if (otherKeys.length === 0) {
                    newVitals = vitals.filter(v => v.id !== draggingPoint.id);
                  } else {
                    newVitals = vitals.map(v => {
                      if (v.id === draggingPoint.id) {
                        const updated = { ...v };
                        delete (updated as any)[draggingPoint.type];
                        if (draggingPoint.type === "pas" || draggingPoint.type === "pad") {
                          delete updated.pam;
                        }
                        return updated;
                      }
                      return v;
                    });
                  }

                  if (onUpdateVitalsList) {
                    onUpdateVitalsList(newVitals);
                  } else {
                    if (otherKeys.length === 0 && onRemoveVitalRecord) {
                      onRemoveVitalRecord(draggingPoint.id);
                    } else if (onUpdateVitalRecord) {
                      const updates: Partial<VitalRecord> = { [draggingPoint.type]: undefined };
                      if (draggingPoint.type === "pas" || draggingPoint.type === "pad") {
                        updates.pam = undefined;
                      }
                      onUpdateVitalRecord(draggingPoint.id, updates);
                    }
                  }
                }
              } else {
                // Update to new value
                const clickedMins = Math.round(((dropX - leftMargin) / chartInnerWidth) * maxGridMins);
                const snappedMins = Math.round(clickedMins / 5) * 5;
                const validSnappedMins = Math.min(maxGridMins, Math.max(0, snappedMins));

                const ratio = (dropY - topMargin) / plotHeight;
                const rawVal = 200 - (ratio * 200);
                const validRawVal = Math.max(0, Math.min(200, rawVal));
                const snappedVal = Math.round(rawVal / 5) * 5;
                const validSnappedVal = Math.min(200, Math.max(0, snappedVal));
                
                const sourceRecord = vitals.find(v => v.id === draggingPoint.id);
                const isHorizontalMove = sourceRecord ? validSnappedMins !== sourceRecord.minutesFromStart : false;
                const shouldCopy = isHorizontalMove; // Repeat/copy all vital signs selectively on horizontal dragging

                const precisionTools = ["etco2", "spo2", "temp", "fr", "pvc", "tof"];
                
                // Calculate the final value dynamically from the vertical drop position
                const finalVal = precisionTools.includes(draggingPoint.type)
                  ? Math.max(0, Math.min(200, Math.round(rawVal * 10) / 10))
                  : validSnappedVal;

                // Move or Copy to the new location (validSnappedMins)
                if (sourceRecord) {
                  const keys = ["fc", "pas", "pad", "pam", "spo2", "etco2", "temp", "bis", "pai", "fr", "tof", "pvc"];

                  let nextVitals: VitalRecord[] = [];
                  if (isHorizontalMove) {
                    if (shouldCopy) {
                      // Repeat (copy) the vital sign: keep the original record intact at its original time
                      nextVitals = vitals.map(v => ({ ...v }));
                    } else {
                      // Move other vitals: remove the vital from the original record so it isn't duplicated
                      nextVitals = vitals.map(v => {
                        if (v.id === draggingPoint.id) {
                          const updated = { ...v };
                          delete (updated as any)[draggingPoint.type];
                          if (draggingPoint.type === "pas" || draggingPoint.type === "pad") {
                            if (updated.pas !== undefined && updated.pad !== undefined) {
                              updated.pam = Math.round(updated.pad + (updated.pas - updated.pad) / 3);
                            } else {
                              delete updated.pam;
                            }
                          }
                          return updated;
                        }
                        return v;
                      });
                      
                      // Filter out records that are completely empty
                      nextVitals = nextVitals.filter(v => {
                        return keys.some(k => (v as any)[k] !== undefined);
                      });
                    }
                  } else {
                    // For vertical-only move, UPDATE: update the value in place inside the original record
                    nextVitals = vitals.map(v => {
                      if (v.id === draggingPoint.id) {
                        const updated = { ...v };
                        (updated as any)[draggingPoint.type] = finalVal;
                        if (draggingPoint.type === "pas" || draggingPoint.type === "pad") {
                          if (updated.pas !== undefined && updated.pad !== undefined) {
                            updated.pam = Math.round(updated.pad + (updated.pas - updated.pad) / 3);
                          }
                        }
                        return updated;
                      }
                      return v;
                    });
                  }

                  if (isHorizontalMove) {
                    // Add or Merge to the target record at validSnappedMins
                    const targetIndex = nextVitals.findIndex(v => v.minutesFromStart === validSnappedMins);
                    if (targetIndex >= 0) {
                      const targetRecord = { ...nextVitals[targetIndex] };
                      (targetRecord as any)[draggingPoint.type] = finalVal;
                      
                      // Recalculate PAM if needed
                      if (draggingPoint.type === "pas" || draggingPoint.type === "pad") {
                        if (targetRecord.pas !== undefined && targetRecord.pad !== undefined) {
                          targetRecord.pam = Math.round(targetRecord.pad + (targetRecord.pas - targetRecord.pad) / 3);
                        }
                      }
                      nextVitals[targetIndex] = targetRecord;
                    } else {
                      const newRecord: VitalRecord = {
                        id: `v-${Date.now()}`,
                        minutesFromStart: validSnappedMins,
                        timestamp: timers?.startAnesthesia 
                          ? new Date(new Date(timers.startAnesthesia).getTime() + validSnappedMins * 60 * 1000).toISOString() 
                          : new Date().toISOString(),
                        [draggingPoint.type]: finalVal
                      };
                      nextVitals.push(newRecord);
                    }
                  }

                  // Ensure there are absolutely no duplicates anywhere (by minutesFromStart)
                  const mergedMap = new Map<number, VitalRecord>();
                  nextVitals.forEach(v => {
                    const existing = mergedMap.get(v.minutesFromStart);
                    if (existing) {
                      mergedMap.set(v.minutesFromStart, { ...existing, ...v });
                    } else {
                      mergedMap.set(v.minutesFromStart, { ...v });
                    }
                  });
                  const finalVitals = Array.from(mergedMap.values());

                  if (onUpdateVitalsList) {
                    onUpdateVitalsList(finalVitals);
                  } else if (onUpdateVitalRecord) {
                    if (isHorizontalMove) {
                      onUpdateVitalRecord(draggingPoint.id, { minutesFromStart: validSnappedMins, [draggingPoint.type]: finalVal });
                    } else {
                      onUpdateVitalRecord(draggingPoint.id, { [draggingPoint.type]: finalVal });
                    }
                  }
                }
              }
            }
            setDraggingPoint(null);
            setDragCurrentXY(null);
            setIsHoveringTrash(false);
          }}
          onPointerLeave={(e) => {
            // Pointer capture keeps the dragging active even if pointer leaves SVG boundaries
          }}
        >
          {/* Trash Zone */}
          {draggingPoint && (
            <g className="transition-opacity duration-200 pointer-events-none">
              {/* Highlight whole graph if hovering trash */}
              {isHoveringTrash && (
                <rect x="0" y="0" width={chartWidth} height={chartHeight} fill="#ef4444" opacity="0.1" />
              )}
              
              <rect x="0" y="0" width={chartWidth} height={topMargin} fill="#ef4444" opacity={isHoveringTrash ? "0.22" : "0.08"} />
              <rect x="0" y="0" width={chartWidth} height={4} fill="#ef4444" />
              {isHoveringTrash && (
                <rect x="0" y="0" width={chartWidth} height={chartHeight} fill="none" stroke="#ef4444" strokeWidth="6" />
              )}
              <text 
                x={chartWidth / 2} 
                y={topMargin / 2 + 5} 
                textAnchor="middle" 
                fill="#ef4444" 
                className={`font-bold uppercase tracking-widest transition-all ${
                  isHoveringTrash ? "text-[14px] font-black scale-105 fill-rose-600" : "text-xs"
                }`}
              >
                {isHoveringTrash ? "🚨 SOLTE PARA EXCLUIR REGISTRO 🚨" : "Arraste para FORA DO GRÁFICO para excluir"}
              </text>
            </g>
          )}

          <defs>
            <linearGradient id="pam-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#be123c" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#be123c" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Legend / Axis Labels (Y axis) */}
          <g>
            {/* Background for left sidebar */}
            <rect x="0" y="0" width={leftMargin} height={chartHeight} fill={isDark ? "#1C1C1E" : "#f8fafc"} />
            <line x1={leftMargin} y1={topMargin} x2={leftMargin} y2={topMargin + plotHeight} stroke={isDark ? "#48484A" : "#cbd5e1"} strokeWidth="1.5" />

            {/* Vitals label marks */}
            {[200, 190, 180, 170, 160, 150, 140, 130, 120, 110, 100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0].map((val) => {
              const y = getY(val);
              const isAccent = val % 50 === 0;
              return (
                <g key={val}>
                  <line
                    x1={leftMargin - (isAccent ? 7 : 4)}
                    y1={y}
                    x2={leftMargin}
                    y2={y}
                    stroke={isDark ? (isAccent ? "#636366" : "#3A3A3C") : (isAccent ? "#475569" : "#94a3b8")}
                    strokeWidth={isAccent ? "1.5" : "1"}
                  />
                  <text
                    x={leftMargin - 10}
                    y={y + 3.5}
                    textAnchor="end"
                    className={`font-mono font-medium ${isAccent ? "text-xs font-bold" : "text-[8.5px]"}`}
                    fill={isDark ? (isAccent ? "#F2F2F7" : "#AEAEB2") : (isAccent ? "#1e293b" : "#64748b")}
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Secondary Labels inside vertical Axis */}
            <text x="15" y={topMargin + 10} className="font-semibold text-[8px] tracking-wider" fill={isDark ? "#8E8E93" : "#94a3b8"} transform={`rotate(-90 15 ${topMargin + 10})`}>
              FC (bpm) / PA (mmHg) / SpO₂ (%) / ETCO₂ (mmHg)
            </text>
          </g>

          {/* Grid Columns & Timeline Axis */}
          <g pointerEvents="none">
            {cols.map((m) => {
              const x = getX(m);
              const isMajor = m % 15 === 0;
              return (
                <g key={m}>
                  {/* Grid vertical line */}
                  <line
                    x1={x}
                    y1={topMargin}
                    x2={x}
                    y2={topMargin + plotHeight}
                    stroke={isMajor ? (isDark ? "#3f3f46" : "#cbd5e1") : (isDark ? "#27272a" : "#e2e8f0")}
                    strokeWidth={isMajor ? "1" : "0.5"}
                  />

                  {/* Horizontal Time Ticks (Top & Bottom of plot) */}
                  {isMajor && (
                    <g>
                      {/* Top time label */}
                      <text
                        x={x}
                        y={topMargin - 10}
                        textAnchor="middle"
                        className="font-mono text-xs font-semibold"
                        fill={isDark ? "#E5E5EA" : "#475569"}
                      >
                        {formatTimeTick(m)}
                      </text>
                      <circle cx={x} cy={topMargin} r="2" fill={isDark ? "#8E8E93" : "#475569"} />

                      {/* Timeline minutes label at bottom */}
                      <text
                        x={x}
                        y={topMargin + plotHeight + 16}
                        textAnchor="middle"
                        className="font-mono text-xs"
                        fill={isDark ? "#8E8E93" : "#94a3b8"}
                      >
                        {startAnesth ? formatRelativeTime(m) : `${m}'`}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Horizontal Grid lines (Every 10 units, with accent lines every 50 units) */}
            {[200, 190, 180, 170, 160, 150, 140, 130, 120, 110, 100, 90, 80, 70, 60, 50, 40, 30, 20, 10].map((val) => {
              const y = getY(val);
              const isAccent = val % 50 === 0;
              return (
                <line
                  key={val}
                  x1={leftMargin}
                  y1={y}
                  x2={chartWidth - rightMargin}
                  y2={y}
                  stroke={isAccent ? (isDark ? "#3f3f46" : "#cbd5e1") : (isDark ? "#2c2c2e" : "#e2e8f0")}
                  strokeWidth={isAccent ? "0.8" : "0.5"}
                />
              );
            })}
            {/* Baseline (0) */}
            <line
              x1={leftMargin}
              y1={getY(0)}
              x2={chartWidth - rightMargin}
              y2={getY(0)}
              stroke={isDark ? "#48484A" : "#94a3b8"}
              strokeWidth="1.5"
            />
          </g>

          {/* Interactive touch listener to log vitals directly */}
          <rect
            x={leftMargin}
            y={topMargin}
            width={chartInnerWidth}
            height={plotHeight}
            fill="transparent"
            className={activeTool ? "cursor-crosshair" : "cursor-default"}
            onPointerDown={(e) => {
              if (activeTool) {
                const svg = svgRef.current;
                if (!svg) return;
                const rect = svg.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickY = e.clientY - rect.top;

                // Translate X to minutes (clickX is relative to SVG left edge)
                const clickedMins = Math.round(((clickX - leftMargin) / chartInnerWidth) * maxGridMins);
                const snappedMins = Math.round(clickedMins / 5) * 5;
                const validSnappedMins = Math.min(maxGridMins, Math.max(0, snappedMins));

                // Translate Y to value (0-200) (clickY is relative to SVG top edge)
                const ratio = (clickY - topMargin) / plotHeight;
                const rawVal = 200 - (ratio * 200);
                const validRawVal = Math.max(0, Math.min(200, rawVal));
                // Snap value to nearest 5
                const snappedVal = Math.round(rawVal / 5) * 5;
                const validSnappedVal = Math.min(200, Math.max(0, snappedVal));
                
                // For ETCO2 and SpO2, map 1:1 on the Y-axis scale of 0-200 with precision
                const precisionTools = ["etco2", "spo2", "temp", "fr", "pvc", "tof"];
                const finalVal = activeTool && precisionTools.includes(activeTool)
                  ? Math.max(0, Math.min(200, Math.round(rawVal * 10) / 10))
                  : validSnappedVal;

                if (onUpdateVitalsList) {
                  let nextVitals = [...vitals];
                  const existingIndex = nextVitals.findIndex(v => v.minutesFromStart === validSnappedMins);
                  if (existingIndex >= 0) {
                    const updated = { ...nextVitals[existingIndex], [activeTool]: finalVal };
                    if (activeTool === "pas" || activeTool === "pad") {
                      if (updated.pas !== undefined && updated.pad !== undefined) {
                        updated.pam = Math.round(updated.pad + (updated.pas - updated.pad) / 3);
                      }
                    }
                    nextVitals[existingIndex] = updated;
                  } else {
                    const newRecord: VitalRecord = {
                      id: `v-${Date.now()}`,
                      minutesFromStart: validSnappedMins,
                      timestamp: timers?.startAnesthesia 
                        ? new Date(new Date(timers.startAnesthesia).getTime() + validSnappedMins * 60 * 1000).toISOString() 
                        : new Date().toISOString(),
                      [activeTool]: finalVal
                    };
                    nextVitals.push(newRecord);
                  }

                  // Perform deduplication
                  const mergedMap = new Map<number, VitalRecord>();
                  nextVitals.forEach(v => {
                    const existing = mergedMap.get(v.minutesFromStart);
                    if (existing) {
                      mergedMap.set(v.minutesFromStart, { ...existing, ...v });
                    } else {
                      mergedMap.set(v.minutesFromStart, { ...v });
                    }
                  });
                  onUpdateVitalsList(Array.from(mergedMap.values()));
                } else {
                  // Look for existing vital record at this time
                  const existing = vitals.find(v => v.minutesFromStart === validSnappedMins);

                  if (existing && onUpdateVitalRecord) {
                    onUpdateVitalRecord(existing.id, { [activeTool]: finalVal });
                  } else if (onAddVitalRecord) {
                    const newRecord: VitalRecord = {
                      id: `v-${Date.now()}`,
                      minutesFromStart: validSnappedMins,
                      timestamp: new Date(Date.now()).toISOString(),
                      [activeTool]: finalVal
                    };
                    onAddVitalRecord(newRecord);
                  }
                }
              } else if (!activeTool && onTimeSelect) {
                const svg = svgRef.current;
                if (!svg) return;
                const rect = svg.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickedMins = Math.round(((clickX - leftMargin) / chartInnerWidth) * maxGridMins);
                const snappedMins = Math.round(clickedMins / 5) * 5;
                const validSnapped = Math.min(maxGridMins, Math.max(0, snappedMins));
                onTimeSelect(validSnapped);
              }
            }}
          />

          {/* Baseline Markers for Anesthesia (X) and Surgery (○) */}
          <g>
            {(() => {
              const getMins = (isoString?: string) => {
                if (!isoString || !startAnesth) return null;
                try {
                  return Math.round((new Date(isoString).getTime() - startAnesth.getTime()) / 60000);
                } catch {
                  return null;
                }
              };

              const list: { mins: number; type: "anesthesia" | "surgery"; label: string }[] = [];
              if (startAnesth) {
                list.push({ mins: 0, type: "anesthesia", label: "Início da Anestesia" });
              }
              const endAnesth = getMins(timers.endAnesthesia);
              if (endAnesth !== null && endAnesth >= 0 && endAnesth <= maxGridMins) {
                list.push({ mins: endAnesth, type: "anesthesia", label: "Fim da Anestesia" });
              }
              const startSurg = getMins(timers.startSurgery);
              if (startSurg !== null && startSurg >= 0 && startSurg <= maxGridMins) {
                list.push({ mins: startSurg, type: "surgery", label: "Início da Cirurgia" });
              }
              const endSurg = getMins(timers.endSurgery);
              if (endSurg !== null && endSurg >= 0 && endSurg <= maxGridMins) {
                list.push({ mins: endSurg, type: "surgery", label: "Fim da Cirurgia" });
              }

              const y = getY(0);

              return list.map((item, idx) => {
                const x = getX(item.mins);
                if (item.type === "anesthesia") {
                  return (
                    <g key={`base-marker-${idx}`} className="cursor-help">
                      <title>{item.label}</title>
                      {/* White outline for high contrast */}
                      <line x1={x - 6} y1={y - 6} x2={x + 6} y2={y + 6} stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
                      <line x1={x + 6} y1={y - 6} x2={x - 6} y2={y + 6} stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
                      {/* Black X */}
                      <line x1={x - 6} y1={y - 6} x2={x + 6} y2={y + 6} stroke="#000000" strokeWidth="2.5" strokeLinecap="round" />
                      <line x1={x + 6} y1={y - 6} x2={x - 6} y2={y + 6} stroke="#000000" strokeWidth="2.5" strokeLinecap="round" />
                    </g>
                  );
                } else {
                  return (
                    <g key={`base-marker-${idx}`} className="cursor-help">
                      <title>{item.label}</title>
                      {/* White outline for high contrast */}
                      <circle cx={x} cy={y} r="6.5" fill="#ffffff" stroke="#ffffff" strokeWidth="2" />
                      {/* Black empty circle */}
                      <circle cx={x} cy={y} r="5.5" fill="none" stroke="#000000" strokeWidth="2.5" />
                    </g>
                  );
                }
              });
            })()}
          </g>

          {/* INTERACTIVE SELECTION BAR */}
          {selectedMinutes !== null && selectedMinutes !== undefined && (
            <g>
              <line
                x1={getX(selectedMinutes)}
                y1={topMargin - 20}
                x2={getX(selectedMinutes)}
                y2={topMargin + plotHeight + 40}
                stroke="#6366f1"
                strokeWidth="2.5"
                strokeDasharray="4,2"
              />
              <rect
                x={getX(selectedMinutes) - 20}
                y={topMargin - 28}
                width="40"
                height="15"
                rx="4"
                fill="#6366f1"
              />
              <text
                x={getX(selectedMinutes)}
                y={topMargin - 18}
                textAnchor="middle"
                fill="#ffffff"
                className="font-mono text-xs font-bold"
              >
                {selectedMinutes}'
              </text>
            </g>
          )}

          {/* Plotting: PAM Line & Area */}
          {(() => {
            const pamVitals = activeVitals.filter(v => v.pam !== undefined);
            if (pamVitals.length > 1) {
              return (
                <g className={activeTool ? "pointer-events-none" : ""}>
                  <path
                    d={d3.area<VitalRecord>()
                      .x(d => getX(d.minutesFromStart))
                      .y0(getY(0))
                      .y1(d => getY(d.pam!))
                      .curve(d3.curveMonotoneX)(pamVitals) || ""}
                    fill="url(#pam-gradient)"
                    pointerEvents="none"
                  />
                  <path
                    d={d3.line<VitalRecord>()
                      .x(d => getX(d.minutesFromStart))
                      .y(d => getY(d.pam!))
                      .curve(d3.curveMonotoneX)(pamVitals) || ""}
                    fill="none"
                    stroke="#be123c"
                    strokeWidth="1.8"
                    strokeDasharray="4 4"
                    pointerEvents="none"
                  />
                </g>
              );
            }
            return null;
          })()}

          {/* Plotting: Pulse Lines & Blood Pressure (PAS ∨ and PAD ∧) */}
          <g className={activeTool ? "pointer-events-none" : ""}>
            {activeVitals.map((v) => {
              if (v.pas === undefined && v.pad === undefined) return null;
              const x = getX(v.minutesFromStart);
              const yPas = v.pas !== undefined ? getY(v.pas) : null;
              const yPad = v.pad !== undefined ? getY(v.pad) : null;
              const yPam = v.pam ? getY(v.pam) : null;

              return (
                <g key={`bp-${v.id}`}>
                  {/* Pulse pressure bar */}
                  {yPas !== null && yPad !== null && (
                    <line
                      x1={x}
                      y1={yPas}
                      x2={x}
                      y2={yPad}
                      stroke="#e11d48"
                      strokeWidth="1.5"
                      pointerEvents="none"
                    />
                  )}

                  {/* PAS marker: downward arrowhead / V symbol */}
                  {yPas !== null && (
                    <g
                      className="cursor-grab active:cursor-grabbing"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        svgRef.current?.setPointerCapture(e.pointerId);
                        setDraggingPoint({ id: v.id, type: "pas", startX: x, startY: yPas });
                        setDragCurrentXY({ x, y: yPas });
                      }}
                    >
                      <path
                        d={`M ${x-5} ${yPas-3} L ${x} ${yPas+2} L ${x+5} ${yPas-3}`}
                        fill="transparent"
                        stroke="#e11d48"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Invisible larger hit area for dragging */}
                      <rect x={x-10} y={yPas-10} width="20" height="20" fill="transparent" />
                    </g>
                  )}

                  {/* PAD marker: upward arrowhead / ^ symbol */}
                  {yPad !== null && (
                    <g
                      className="cursor-grab active:cursor-grabbing"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        svgRef.current?.setPointerCapture(e.pointerId);
                        setDraggingPoint({ id: v.id, type: "pad", startX: x, startY: yPad });
                        setDragCurrentXY({ x, y: yPad });
                      }}
                    >
                      <path
                        d={`M ${x-5} ${yPad+3} L ${x} ${yPad-2} L ${x+5} ${yPad+3}`}
                        fill="transparent"
                        stroke="#e11d48"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Invisible larger hit area for dragging */}
                      <rect x={x-10} y={yPad-10} width="20" height="20" fill="transparent" />
                    </g>
                  )}

                  {/* PAM marker: small diamond */}
                  {yPas !== null && yPad !== null && yPam && (
                    <polygon
                      points={`${x},${yPam-3.5} ${x+3.5},${yPam} ${x},${yPam+3.5} ${x-3.5},${yPam}`}
                      fill="#be123c"
                    />
                  )}
                </g>
              );
            })}
          </g>

          {/* Plotting: Heart Rate (FC) - Blue Line & Dots */}
          <g className={activeTool ? "pointer-events-none" : ""}>
            {/* Render connecting line first */}
            {activeVitals.filter(v => v.fc !== undefined).length > 1 && (
              <>
                <path
                  d={d3.area<VitalRecord>().x(d => getX(d.minutesFromStart)).y0(getY(0)).y1(d => getY(d.fc!)).curve(d3.curveMonotoneX)(activeVitals.filter(v => v.fc !== undefined)) || ""}
                  fill="url(#fc-gradient)"
                  pointerEvents="none"
                />
                <path
                  d={d3.line<VitalRecord>().x(d => getX(d.minutesFromStart)).y(d => getY(d.fc!)).curve(d3.curveMonotoneX)(activeVitals.filter(v => v.fc !== undefined)) || ""}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2.2"
                  pointerEvents="none"
                />
              </>
            )}

            {/* Render individual dots */}
            {activeVitals.map((v) => {
              if (v.fc === undefined) return null;
              const x = getX(v.minutesFromStart);
              const y = getY(v.fc);
              return (
                <g
                  key={`fc-${v.id}`}
                  className="cursor-grab active:cursor-grabbing hover:scale-150 transition-transform origin-center"
                  style={{ transformOrigin: `${x}px ${y}px` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    svgRef.current?.setPointerCapture(e.pointerId);
                    setDraggingPoint({ id: v.id, type: "fc", startX: x, startY: y });
                    setDragCurrentXY({ x, y });
                  }}
                  onMouseEnter={() => setHoveredVitals(v)}
                  onMouseLeave={() => setHoveredVitals(null)}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r="4.5"
                    fill="#2563eb"
                    stroke="#ffffff"
                    strokeWidth="1.2"
                  />
                  <rect x={x-10} y={y-10} width="20" height="20" fill="transparent" />
                </g>
              );
            })}
          </g>

          {/* Plotting: Invasive Blood Pressure (PAI) - Red-Orange connecting line and Diamond symbols */}
          <g className={activeTool ? "pointer-events-none" : ""}>
            {/* Connecting line */}
            {activeVitals.filter(v => v.pai !== undefined).length > 1 && (
              <>
                <path
                  d={d3.area<VitalRecord>().x(d => getX(d.minutesFromStart)).y0(getY(0)).y1(d => getY(d.pai!))(activeVitals.filter(v => v.pai !== undefined)) || ""}
                  fill="url(#pai-gradient)"
                  pointerEvents="none"
                />
                <path
                  d={activeVitals
                    .filter((v) => v.pai !== undefined)
                    .map((v, idx) => {
                      const x = getX(v.minutesFromStart);
                      const y = getY(v.pai!);
                      return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="1.8"
                  pointerEvents="none"
                />
              </>
            )}

            {/* Individual inverted T (⊥) symbols */}
            {activeVitals.map((v) => {
              if (v.pai === undefined) return null;
              const x = getX(v.minutesFromStart);
              const y = getY(v.pai);

              return (
                <g
                  key={`pai-gp-${v.id}`}
                  className="cursor-grab active:cursor-grabbing hover:scale-125 transition-transform origin-center"
                  style={{ transformOrigin: `${x}px ${y}px` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    svgRef.current?.setPointerCapture(e.pointerId);
                    setDraggingPoint({ id: v.id, type: "pai", startX: x, startY: y });
                    setDragCurrentXY({ x, y });
                  }}
                  onMouseEnter={() => setHoveredVitals(v)}
                  onMouseLeave={() => setHoveredVitals(null)}
                >
                  {/* Invisible hover trigger area */}
                  <circle cx={x} cy={y - 4} r={10} fill="transparent" />

                  {/* Horizontal base bar */}
                  <line
                    x1={x - 6}
                    y1={y}
                    x2={x + 6}
                    y2={y}
                    stroke="#dc2626"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />

                  {/* Vertical stem */}
                  <line
                    x1={x}
                    y1={y - 9}
                    x2={x}
                    y2={y}
                    stroke="#dc2626"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </g>
              );
            })}
          </g>

          {/* Plotting: BIS - Purple Dashed Line & Filled Squares */}
          <g className={activeTool ? "pointer-events-none" : ""}>
            {/* BIS connecting dashed line */}
            {activeVitals.filter(v => v.bis !== undefined).length > 1 && (
              <>
                <path
                  d={d3.area<VitalRecord>().x(d => getX(d.minutesFromStart)).y0(getY(0)).y1(d => getY(d.bis!))(activeVitals.filter(v => v.bis !== undefined)) || ""}
                  fill="url(#bis-gradient)"
                  pointerEvents="none"
                />
                <path
                  d={activeVitals
                    .filter((v) => v.bis !== undefined)
                    .map((v, idx) => {
                      const x = getX(v.minutesFromStart);
                      const y = getY(v.bis!);
                      return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="#a78bfa"
                  strokeWidth="1.8"
                  strokeDasharray="3 3"
                  pointerEvents="none"
                />
              </>
            )}

            {/* Individual BIS points */}
            {activeVitals.map((v) => {
              if (v.bis === undefined) return null;
              const x = getX(v.minutesFromStart);
              const y = getY(v.bis);
              return (
                <g
                  key={`bis-gp-${v.id}`}
                  className="cursor-grab active:cursor-grabbing hover:scale-150 transition-transform origin-center"
                  style={{ transformOrigin: `${x}px ${y}px` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    svgRef.current?.setPointerCapture(e.pointerId);
                    setDraggingPoint({ id: v.id, type: "bis", startX: x, startY: y });
                    setDragCurrentXY({ x, y });
                  }}
                  onMouseEnter={() => setHoveredVitals(v)}
                  onMouseLeave={() => setHoveredVitals(null)}
                >
                  <rect
                    x={x - 3}
                    y={y - 3}
                    width={6}
                    height={6}
                    fill="#7c3aed"
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                  <rect x={x - 10} y={y - 10} width="20" height="20" fill="transparent" />
                </g>
              );
            })}
          </g>

          {/* Plotting: SpO₂ - Green Wave/Line */}
          <g className={activeTool ? "pointer-events-none" : ""}>
            {/* Connecting line with high-frequency plethysmographic ripple */}
            {activeVitals.filter(v => v.spo2 !== undefined).length > 1 && (
              <>
                <path
                  d={getAreaPathFromLine(getSpO2RipplePath(), activeVitals.filter(v => v.spo2 !== undefined).sort((a, b) => a.minutesFromStart - b.minutesFromStart))}
                  fill="url(#spo2-gradient)"
                  pointerEvents="none"
                />
                <path
                  d={getSpO2RipplePath()}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
              </>
            )}

            {/* Individual SpO₂ dots */}
            {activeVitals.map((v) => {
              if (v.spo2 === undefined) return null;
              const x = getX(v.minutesFromStart);
              const y = getY(v.spo2);
              return (
                <g
                  key={`spo2-gp-${v.id}`}
                  className="cursor-grab active:cursor-grabbing hover:scale-150 transition-transform origin-center"
                  style={{ transformOrigin: `${x}px ${y}px` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    svgRef.current?.setPointerCapture(e.pointerId);
                    setDraggingPoint({ id: v.id, type: "spo2", startX: x, startY: y });
                    setDragCurrentXY({ x, y });
                  }}
                  onMouseEnter={() => setHoveredVitals(v)}
                  onMouseLeave={() => setHoveredVitals(null)}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r="4.2"
                    fill="#10b981"
                    stroke="#ffffff"
                    strokeWidth="1.2"
                  />
                  <rect x={x-10} y={y-10} width="20" height="20" fill="transparent" />
                </g>
              );
            })}
          </g>

          {/* Plotting: ETCO₂ - Yellow Triangles & Sinusoidal Wave */}
          <g className={activeTool ? "pointer-events-none" : ""}>
            {/* Connecting line with sinusoidal wave at 12 ipm */}
            {activeVitals.filter(v => v.etco2 !== undefined).length > 1 && (
              <>
                <path
                  d={getAreaPathFromLine(getEtco2RipplePath(), activeVitals.filter(v => v.etco2 !== undefined).sort((a, b) => a.minutesFromStart - b.minutesFromStart))}
                  fill="url(#etco2-gradient)"
                  pointerEvents="none"
                />
                <path
                  d={getEtco2RipplePath()}
                  fill="none"
                  stroke="#eab308"
                  strokeWidth="2.0"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
              </>
            )}

            {/* Individual ETCO₂ Yellow Triangles */}
            {activeVitals.map((v) => {
              if (v.etco2 === undefined) return null;
              const x = getX(v.minutesFromStart);
              const y = getY(v.etco2);
              return (
                <g
                  key={`etco2-gp-${v.id}`}
                  className="cursor-grab active:cursor-grabbing hover:scale-150 transition-transform origin-center"
                  style={{ transformOrigin: `${x}px ${y}px` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    svgRef.current?.setPointerCapture(e.pointerId);
                    setDraggingPoint({ id: v.id, type: "etco2", startX: x, startY: y });
                    setDragCurrentXY({ x, y });
                  }}
                  onMouseEnter={() => setHoveredVitals(v)}
                  onMouseLeave={() => setHoveredVitals(null)}
                >
                  <polygon
                    points={`${x},${y - 6} ${x + 6.5},${y + 4.5} ${x - 6.5},${y + 4.5}`}
                    fill="#facc15"
                    stroke="#d97706"
                    strokeWidth="1.2"
                  />
                  <rect x={x - 10} y={y - 10} width="20" height="20" fill="transparent" />
                </g>
              );
            })}
          </g>

          {/* Plotting: TEMP - Orange cross (+) */}
          <g className={activeTool ? "pointer-events-none" : ""}>
            {activeVitals.map((v) => {
              if (v.temp === undefined) return null;
              const x = getX(v.minutesFromStart);
              const y = getY(v.temp);
              return (
                <g
                  key={`temp-gp-${v.id}`}
                  className="cursor-grab active:cursor-grabbing hover:scale-150 transition-transform origin-center"
                  style={{ transformOrigin: `${x}px ${y}px` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    svgRef.current?.setPointerCapture(e.pointerId);
                    setDraggingPoint({ id: v.id, type: "temp", startX: x, startY: y });
                    setDragCurrentXY({ x, y });
                  }}
                  onMouseEnter={() => setHoveredVitals(v)}
                  onMouseLeave={() => setHoveredVitals(null)}
                >
                  <path d={`M ${x - 5} ${y} L ${x + 5} ${y} M ${x} ${y - 5} L ${x} ${y + 5}`} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
                  <rect x={x - 10} y={y - 10} width="20" height="20" fill="transparent" />
                </g>
              );
            })}
          </g>

          {/* Plotting: FR - Teal X */}
          <g className={activeTool ? "pointer-events-none" : ""}>
            {activeVitals.map((v) => {
              if (v.fr === undefined) return null;
              const x = getX(v.minutesFromStart);
              const y = getY(v.fr);
              return (
                <g
                  key={`fr-gp-${v.id}`}
                  className="cursor-grab active:cursor-grabbing hover:scale-150 transition-transform origin-center"
                  style={{ transformOrigin: `${x}px ${y}px` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    svgRef.current?.setPointerCapture(e.pointerId);
                    setDraggingPoint({ id: v.id, type: "fr", startX: x, startY: y });
                    setDragCurrentXY({ x, y });
                  }}
                  onMouseEnter={() => setHoveredVitals(v)}
                  onMouseLeave={() => setHoveredVitals(null)}
                >
                  <path d={`M ${x - 4} ${y - 4} L ${x + 4} ${y + 4} M ${x - 4} ${y + 4} L ${x + 4} ${y - 4}`} fill="none" stroke="#14b8a6" strokeWidth="2.5" strokeLinecap="round" />
                  <rect x={x - 10} y={y - 10} width="20" height="20" fill="transparent" />
                </g>
              );
            })}
          </g>

          {/* Plotting: PVC - Cyan Triangle pointing down */}
          <g className={activeTool ? "pointer-events-none" : ""}>
            {activeVitals.map((v) => {
              if (v.pvc === undefined) return null;
              const x = getX(v.minutesFromStart);
              const y = getY(v.pvc);
              return (
                <g
                  key={`pvc-gp-${v.id}`}
                  className="cursor-grab active:cursor-grabbing hover:scale-150 transition-transform origin-center"
                  style={{ transformOrigin: `${x}px ${y}px` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    svgRef.current?.setPointerCapture(e.pointerId);
                    setDraggingPoint({ id: v.id, type: "pvc", startX: x, startY: y });
                    setDragCurrentXY({ x, y });
                  }}
                  onMouseEnter={() => setHoveredVitals(v)}
                  onMouseLeave={() => setHoveredVitals(null)}
                >
                  <polygon points={`${x - 5},${y - 4} ${x + 5},${y - 4} ${x},${y + 5}`} fill="#06b6d4" stroke="#0891b2" strokeWidth="1.2" />
                  <rect x={x - 10} y={y - 10} width="20" height="20" fill="transparent" />
                </g>
              );
            })}
          </g>

          {/* Plotting: TOF - Four small squares */}
          <g className={activeTool ? "pointer-events-none" : ""}>
            {activeVitals.map((v) => {
              if (v.tof === undefined) return null;
              const x = getX(v.minutesFromStart);
              const y = getY(v.tof);
              return (
                <g
                  key={`tof-gp-${v.id}`}
                  className="cursor-grab active:cursor-grabbing hover:scale-150 transition-transform origin-center"
                  style={{ transformOrigin: `${x}px ${y}px` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    svgRef.current?.setPointerCapture(e.pointerId);
                    setDraggingPoint({ id: v.id, type: "tof", startX: x, startY: y });
                    setDragCurrentXY({ x, y });
                  }}
                  onMouseEnter={() => setHoveredVitals(v)}
                  onMouseLeave={() => setHoveredVitals(null)}
                >
                  <rect x={x - 5} y={y - 2} width={2} height={4} fill="#f43f5e" />
                  <rect x={x - 1} y={y - 2} width={2} height={4} fill="#f43f5e" />
                  <rect x={x + 3} y={y - 2} width={2} height={4} fill="#f43f5e" />
                  <rect x={x - 10} y={y - 10} width="20" height="20" fill="transparent" />
                </g>
              );
            })}
          </g>

          {/* CLINICAL EVENT MARKERS (Top of the chart) */}
          <g transform={`translate(0, ${topMargin})`}>
            {events
              .filter((ev) => {
                const name = ev.name;
                return !(
                  name === "Início da Anestesia" ||
                  name === "Fim da Anestesia" ||
                  name === "Início da Cirurgia" ||
                  name === "Fim da Cirurgia" ||
                  name === "Início Anestesia" ||
                  name === "Fim Anestesia" ||
                  name === "Início Cirurgia" ||
                  name === "Fim Cirurgia"
                );
              })
              .map((ev, idx) => {
                if (!startAnesth) return null;
                const t = new Date(ev.timestamp).getTime();
                const mins = Math.round((t - startAnesth.getTime()) / 60000);
                
                if (mins < 0 || mins > maxGridMins) return null;
                
                const x = getX(mins);
                const isLead = ev.name.includes("Anestesia") || ev.name.includes("Cirurgia");

                return (
                  <g key={ev.id}>
                    {/* Vertical flag indicator line */}
                    <line x1={x} y1="-10" x2={x} y2="10" stroke={isLead ? "#f43f5e" : "#8b5cf6"} strokeWidth="1" strokeDasharray="2,2" />
                    
                    {/* Circle Flag pin */}
                    <circle cx={x} cy="-10" r="4.5" fill={isLead ? "#f43f5e" : "#8b5cf6"} />
                    <text
                      x={x}
                      y="-7"
                      textAnchor="middle"
                      fill="#ffffff"
                      className="font-sans font-bold text-[7px]"
                    >
                      {idx + 1}
                    </text>
  
                    {/* Flag tooltip tag on hover */}
                    <title>{`${idx + 1}. ${ev.name} - ${formatTimeTick(mins)}`}</title>
                  </g>
                );
              })}
          </g>

          {/* Visual indicator for the item currently being dragged */}
          {draggingPoint && dragCurrentXY && (
            <g transform={`translate(${dragCurrentXY.x}, ${dragCurrentXY.y})`} className="pointer-events-none opacity-60">
              {draggingPoint.type === "fc" && (
                <circle cx={0} cy={0} r="4.5" fill="#2563eb" stroke="#ffffff" strokeWidth="1.2" />
              )}
              {draggingPoint.type === "pas" && (
                <path d="M -5 -3 L 0 2 L 5 -3" fill="none" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              )}
              {draggingPoint.type === "pad" && (
                <path d="M -5 3 L 0 -2 L 5 3" fill="none" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              )}
              {draggingPoint.type === "spo2" && (
                <circle cx={0} cy={0} r="4.2" fill="#10b981" stroke="#ffffff" strokeWidth="1.2" />
              )}
              {draggingPoint.type === "etco2" && (
                <polygon
                  points="0,-6 6.5,4.5 -6.5,4.5"
                  fill="#facc15"
                  stroke="#d97706"
                  strokeWidth="1.2"
                />
              )}
              {draggingPoint.type === "pai" && (
                <g>
                  {/* Horizontal base bar */}
                  <line x1={-6} y1={0} x2={6} y2={0} stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" />
                  {/* Vertical stem */}
                  <line x1={0} y1={-9} x2={0} y2={0} stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" />
                </g>
              )}
              {draggingPoint.type === "bis" && (
                <rect x={-3} y={-3} width={6} height={6} fill="#7c3aed" stroke="#ffffff" strokeWidth="1" />
              )}
              {draggingPoint.type === "temp" && (
                <path d="M -5 0 L 5 0 M 0 -5 L 0 5" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
              )}
              {draggingPoint.type === "fr" && (
                <path d="M -4 -4 L 4 4 M -4 4 L 4 -4" fill="none" stroke="#14b8a6" strokeWidth="2.5" strokeLinecap="round" />
              )}
              {draggingPoint.type === "pvc" && (
                <polygon points="-5,-4 5,-4 0,5" fill="#06b6d4" stroke="#0891b2" strokeWidth="1.2" />
              )}
              {draggingPoint.type === "tof" && (
                <g>
                  <rect x={-5} y={-2} width={2} height={4} fill="#f43f5e" />
                  <rect x={-1} y={-2} width={2} height={4} fill="#f43f5e" />
                  <rect x={3} y={-2} width={2} height={4} fill="#f43f5e" />
                </g>
              )}
              
              {/* Tooltip to show new value */}
              <rect x={10} y={-10} width={40} height={16} rx={2} fill={isHoveringTrash ? "#f43f5e" : "#000"} opacity={0.8} />
              <text x={30} y={2} textAnchor="middle" fill="#fff" fontSize={10} className="font-mono">
                {(() => {
                  if (isHoveringTrash) return "LIXO";
                  return ["etco2", "spo2", "temp", "fr", "pvc", "tof"].includes(draggingPoint.type)
                    ? `${Math.max(0, Math.min(200, Math.round((200 - (((dragCurrentXY.y - topMargin) / plotHeight) * 200)) * 10) / 10))}`
                    : `${Math.max(0, Math.min(200, Math.round((200 - (((dragCurrentXY.y - topMargin) / plotHeight) * 200)) / 5) * 5))}`;
                })()}
              </text>
            </g>
          )}
        
          {/* LANES FOR INFUSIONS AND GASES */}
          <g transform={`translate(0, ${topMargin + plotHeight + 15})`}>
            {(() => {
               let currentY = 0;
               const elements: React.ReactNode[] = [];
               
               const validInfusions = continuousInfusions.filter(inf => inf.history && inf.history.length > 0);
               if (validInfusions.length > 0) {
                 elements.push(
                   <text key="inf-title" x={15} y={currentY + 18} className="text-xs font-bold uppercase tracking-wider" fill="#6366f1">
                     INFUSÕES CONTÍNUAS
                   </text>
                 );
                 currentY += laneHeight;
                 
                 validInfusions.forEach((inf) => {
                   elements.push(
                     <g key={`inf-${inf.id}`} transform={`translate(0, ${currentY})`}>
                       <rect x={leftMargin} y={0} width={chartInnerWidth} height={20} fill={isDark ? "#27272a" : "#f1f5f9"} rx={4} />
                       <text x={leftMargin - 10} y={14} textAnchor="end" className="text-xs font-semibold" fill={isDark ? "#d4d4d8" : "#475569"}>
                         {inf.name}
                       </text>
                       {inf.history.map((hist, hIdx) => {
                         const sortedHist = [...inf.history].sort((a, b) => a.minutesFromStart - b.minutesFromStart);
                         const nextHist = sortedHist[hIdx + 1];
                         const endMins = nextHist ? nextHist.minutesFromStart : maxGridMins;
                         const w = (endMins - hist.minutesFromStart) * colWidth;
                         const xStart = getX(hist.minutesFromStart);
                         if (hist.status === "Pausado" || hist.status === "Finalizado" || w <= 0) return null;
                         return (
                           <g key={`hist-${hIdx}`}>
                             <rect x={xStart} y={0} width={w} height={20} fill="#6366f1" opacity="0.8" rx={2} />
                             {w > 30 && (
                               <text x={xStart + 5} y={13} className="text-[8px] font-bold font-mono" fill="#ffffff">
                                 {hist.rate}
                               </text>
                             )}
                           </g>
                         );
                       })}
                     </g>
                   );
                   currentY += laneHeight;
                 });
               }
               
               if (inhalationAgents.length > 0) {
                 elements.push(
                   <text key="gas-title" x={15} y={currentY + 18} className="text-xs font-bold uppercase tracking-wider" fill="#14b8a6">
                     GASES & INALATÓRIOS
                   </text>
                 );
                 currentY += laneHeight;
                 
                 inhalationAgents.forEach((ia) => {
                   if (!startAnesth) return;
                   const tStart = new Date(ia.startTime).getTime();
                   const startMins = Math.max(0, Math.round((tStart - startAnesth.getTime()) / 60000));
                   const tEnd = ia.endTime ? new Date(ia.endTime).getTime() : Date.now();
                   const endMins = Math.min(maxGridMins, Math.round((tEnd - startAnesth.getTime()) / 60000));
                   const xStart = getX(startMins);
                   const w = (endMins - startMins) * colWidth;
                   if (w <= 0) return;
                   
                   let color = "#14b8a6";
                   if (ia.agent === "Oxigênio (O₂)") color = "#06b6d4";
                   else if (ia.agent === "Ar Comprimido") color = "#0ea5e9";
                   else if (ia.agent === "Sevoflurano") color = "#f59e0b";
                   else if (ia.agent === "Desflurano") color = "#3b82f6";
                   else if (ia.agent === "Isoflurano") color = "#a855f7";
                   
                   elements.push(
                     <g key={`ia-${ia.id}`} transform={`translate(0, ${currentY})`}>
                       <rect x={leftMargin} y={0} width={chartInnerWidth} height={20} fill={isDark ? "#27272a" : "#f1f5f9"} rx={4} />
                       <text x={leftMargin - 10} y={14} textAnchor="end" className="text-xs font-semibold" fill={isDark ? "#d4d4d8" : "#475569"}>
                         {ia.agent}
                       </text>
                       <rect x={xStart} y={0} width={w} height={20} fill={color} opacity="0.8" rx={2} />
                       {w > 30 && (
                         <text x={xStart + 5} y={13} className="text-[8px] font-bold font-mono" fill="#ffffff">
                           {ia.agent === "Oxigênio (O₂)" || ia.agent === "Ar Comprimido" ? `${ia.flowO2}L` : `${ia.inspiredConc}%`}
                         </text>
                       )}
                     </g>
                   );
                   currentY += laneHeight;
                 });
               }
               return elements;
            })()}
          </g>

          {/* CROSSHAIR OVERLAY */}
          {crosshair && !draggingPoint && (
             <g className="pointer-events-none">
               <line x1={crosshair.x} y1={topMargin} x2={crosshair.x} y2={chartHeight - bottomMargin} stroke={isDark ? "#ffffff" : "#ef4444"} strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
               <rect x={crosshair.x - (startAnesth ? 20 : 15)} y={topMargin - 15} width={startAnesth ? 40 : 30} height={14} rx={2} fill={isDark ? "#3f3f46" : "#ef4444"} />
               <text x={crosshair.x} y={topMargin - 5} textAnchor="middle" fill="#ffffff" className="text-xs font-bold font-mono">
                 {startAnesth ? formatRelativeTime(crosshair.mins) : `${crosshair.mins}'`}
               </text>
               
               <g transform={`translate(${crosshair.x < chartWidth / 2 ? crosshair.x + 10 : crosshair.x - 130}, ${topMargin + 10})`}>
                 <rect x={0} y={0} width={120} height={100} rx={6} fill={isDark ? "#18181b" : "#ffffff"} stroke={isDark ? "#3f3f46" : "#e2e8f0"} strokeWidth="1" opacity="0.95" />
                 <text x={8} y={16} className="text-xs font-bold" fill={isDark ? "#f4f4f5" : "#18181b"}>
                   {startAnesth ? `Tempo: ${formatRelativeTime(crosshair.mins)}` : `Minuto ${crosshair.mins}'`}
                 </text>
                 <line x1={8} y1={22} x2={112} y2={22} stroke={isDark ? "#3f3f46" : "#e2e8f0"} />
                 {(() => {
                   const v = vitals.find(v => v.minutesFromStart === crosshair.mins);
                   if (!v) return <text x={8} y={38} className="text-xs" fill="#94a3b8">Sem registros vitais</text>;
                   return (
                     <>
                       {v.fc !== undefined && <text x={8} y={38} className="text-xs font-bold font-mono" fill="#3b82f6">FC: {v.fc} bpm</text>}
                       {v.pas !== undefined && v.pad !== undefined && <text x={8} y={51} className="text-xs font-bold font-mono" fill="#ef4444">PA: {v.pas}/{v.pad} mmHg</text>}
                       {v.spo2 !== undefined && <text x={8} y={64} className="text-xs font-bold font-mono" fill="#10b981">SpO2: {v.spo2}%</text>}
                       {v.etco2 !== undefined && <text x={8} y={77} className="text-xs font-bold font-mono" fill="#eab308">ETCO2: {v.etco2}</text>}
                     </>
                   );
                 })()}
               </g>
             </g>
          )}
</svg>

        {/* Hover Vitals Detail Card */}
        {hoveredVitals && (
          <div className="absolute top-4 left-20 bg-slate-900/95 text-white p-2.5 rounded-lg shadow-sm text-xs font-mono space-y-1 z-10 border border-slate-700 pointer-events-none backdrop-blur-xs">
            <div className="font-sans font-bold text-indigo-300 border-b border-slate-700 pb-1 flex justify-between items-center gap-4">
              <span>Registro de {hoveredVitals.minutesFromStart} min</span>
              <span className="text-xs text-slate-400">{formatTimeTick(hoveredVitals.minutesFromStart)}</span>
            </div>
            {(hoveredVitals.pas !== undefined || hoveredVitals.pad !== undefined) && (
              <div>PA: <span className="text-rose-400 font-bold">{hoveredVitals.pas !== undefined ? hoveredVitals.pas : "?"}/{hoveredVitals.pad !== undefined ? hoveredVitals.pad : "?"}</span> {hoveredVitals.pam !== undefined && <span className="text-slate-400 text-xs">(PAM {hoveredVitals.pam})</span>}</div>
            )}
            {hoveredVitals.pai !== undefined && (
              <div>PAI: <span className="text-red-400 font-bold">{hoveredVitals.pai} mmHg</span></div>
            )}
            {hoveredVitals.fc !== undefined && (
              <div>FC: <span className="text-blue-400 font-bold">{hoveredVitals.fc} bpm</span></div>
            )}
            {hoveredVitals.spo2 !== undefined && (
              <div>SpO₂: <span className="text-emerald-400 font-bold">{hoveredVitals.spo2}%</span></div>
            )}
            {hoveredVitals.etco2 !== undefined && (
              <div>ETCO₂: <span className="text-teal-300 font-bold">{hoveredVitals.etco2} mmHg</span></div>
            )}
            {hoveredVitals.temp !== undefined && (
              <div>TEMP: <span className="text-orange-300">{hoveredVitals.temp}°C</span></div>
            )}
            {hoveredVitals.fr !== undefined && (
              <div>FR: <span className="text-indigo-300">{hoveredVitals.fr} ipm</span></div>
            )}
            {hoveredVitals.bis !== undefined && (
              <div>BIS: <span className="text-purple-300 font-bold">{hoveredVitals.bis}</span></div>
            )}
          </div>
        )}
      </div>

      <div className={`px-4 py-2.5 flex justify-between items-center select-none text-xs ${footerClass}`}>
        <div className="flex items-center gap-1">
          <HelpCircle className={`w-3.5 h-3.5 ${isDark ? "text-zinc-500" : "text-slate-400"}`} />
          <span>Toque no gráfico ou nas linhas de tempo para focar um horário específico para o registro rápido.</span>
        </div>
        <div className={`font-mono text-xs px-1.5 py-0.5 rounded font-bold ${isDark ? "bg-zinc-800 text-zinc-300" : "bg-slate-200 text-slate-700"}`}>
          Escala: {colWidth}px / min
        </div>
      </div>
    </div>
  );
}
