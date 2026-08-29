/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { jsPDF } from "jspdf";
import * as htmlToImage from "html-to-image";
import { 
  Download, 
  Printer, 
  X, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Minimize2, 
  FileText, 
  Eye,
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  Activity,
  Heart,
  Thermometer,
  ShieldAlert,
  Calendar,
  Clock,
  User,
  Activity as VitalIcon,
  Info
} from "lucide-react";
import { AnesthesiaDocument, DocumentAmendment } from "../types";
import { getProcedureAmendments } from "../lib/proceduresService";
import {
  UNREGISTERED,
  displayAldreteScore,
  displayAldreteTotal,
  displayBloodPressure,
  displayQmentumRange,
  displayTemperature,
  displayVital,
  isRecordedNumber,
  qmentumRange,
  resolveRecoveryBaseline,
} from "../lib/clinicalDisplay";

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: AnesthesiaDocument;
}

export default function PdfPreviewModal({
  isOpen,
  onClose,
  document: doc
}: PdfPreviewModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scale, setScale] = useState(1);
  const [subcollectionAmendments, setSubcollectionAmendments] = useState<DocumentAmendment[]>([]);

  // Fetch subcollection amendments when modal opens
  useEffect(() => {
    let isMounted = true;
    if (isOpen && doc?.id) {
      getProcedureAmendments(doc.id)
        .then((items) => {
          if (isMounted) setSubcollectionAmendments(items);
        })
        .catch(console.warn);
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, doc?.id]);

  // Combined amendments deduplicated by ID and sorted chronologically
  const allAmendments = React.useMemo(() => {
    const map = new Map<string, any>();
    (doc.amendments || []).forEach((a: any) => { if (a && a.id) map.set(a.id, a); });
    subcollectionAmendments.forEach((a: any) => { if (a && a.id) map.set(a.id, a); });
    const list = Array.from(map.values());
    list.sort((a, b) => new Date(a.createdAt || a.timestamp || 0).getTime() - new Date(b.createdAt || b.timestamp || 0).getTime());
    return list;
  }, [doc.amendments, subcollectionAmendments]);

  // Auto-fit to width on load
  useEffect(() => {
    if (isOpen) {
      const updateScale = () => {
        const screenWidth = window.innerWidth;
        // Padding of 32px (16px each side)
        const availableWidth = screenWidth - 32;
        if (availableWidth < 1123) {
          setScale(Math.max(0.2, availableWidth / 1123));
        } else {
          setScale(1);
        }
      };
      updateScale();
      window.addEventListener('resize', updateScale);
      return () => window.removeEventListener('resize', updateScale);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGeneratePdf = async () => {
    if (!containerRef.current || isGenerating) return;
    
    try {
      setIsGenerating(true);
      const elements = containerRef.current.querySelectorAll('.print-page');
      
      if (elements.length === 0) {
        throw new Error('Nenhuma página encontrada para impressão');
      }

      // A4 Landscape dimensions in mm
      const pdf = new jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: 'a4'
      });

      for (let i = 0; i < elements.length; i++) {
        const element = elements[i] as HTMLElement;
        const imgData = await htmlToImage.toPng(element, {
          pixelRatio: 2,
          quality: 1.0,
          backgroundColor: '#ffffff',
          width: 1123,
          height: 794,
          style: {
            transform: 'scale(1)',
            transformOrigin: 'top left',
            width: '1123px',
            height: '794px'
          }
        });
        
        if (i > 0) {
          pdf.addPage();
        }
        
        pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);
      }
      
      pdf.save(`Ficha_Anestesia_${doc.patient?.fullName || 'Rascunho'}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Ocorreu um erro ao gerar o PDF. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Safe sub-objects to prevent null pointer exceptions
  const patient = doc.patient || {} as any;
  const team = doc.team || {} as any;
  const pre = doc.preEvaluation || {} as any;
  const technique = doc.technique || {} as any;
  const airway = doc.airway || {} as any;
  const monitorConfig = doc.monitorConfig || {} as any;
  const equipmentConfig = doc.equipmentConfig || {} as any;
  const checklist = doc.checklist || {} as any;
  const recovery = doc.recovery || {} as any;
  const handover = doc.handover || {} as any;

  // Latest intraoperative vitals for fallback baseline
  const getLatestIntraoperativeVitals = () => {
    const vitals = doc.vitals || [];
    if (vitals.length === 0) return null;
    return [...vitals].sort((a, b) => b.minutesFromStart - a.minutesFromStart)[0];
  };

  const latestIntra = getLatestIntraoperativeVitals();
  const baseline = resolveRecoveryBaseline(recovery, latestIntra);
  const baselinePas = baseline.pas;
  const baselinePad = baseline.pad;
  const baselineFc = baseline.fc;
  const baselineSpo2 = baseline.spo2;
  const baselineTemp = baseline.temp;

  // Deviation parameters
  const pasDeviationPct = recovery.paramPasDeviationPct ?? 20;
  const fcDeviationPct = recovery.paramFcDeviationPct ?? 20;
  const minSpo2 = recovery.paramMinSpo2 ?? 94;
  const minTemp = recovery.paramMinTemp ?? 35.5;
  const maxTemp = recovery.paramMaxTemp ?? 37.8;

  const pasRange = qmentumRange(baselinePas, pasDeviationPct);
  const padRange = qmentumRange(baselinePad, pasDeviationPct);
  const fcRange = qmentumRange(baselineFc, fcDeviationPct);
  const minPas = pasRange?.min;
  const maxPas = pasRange?.max;
  const minPad = padRange?.min;
  const maxPad = padRange?.max;
  const minFc = fcRange?.min;
  const maxFc = fcRange?.max;

  const getAnesthesiaDurationMinutes = (): number | null => {
    if (!doc.timers?.startAnesthesia) return null;
    const start = new Date(doc.timers.startAnesthesia).getTime();
    const end = doc.timers.endAnesthesia ? new Date(doc.timers.endAnesthesia).getTime() : Date.now();
    const diff = Math.round((end - start) / 60000);
    return diff > 0 ? diff : null;
  };

  const recordedWeightKg = (): number | null => {
    const raw = patient.weight;
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
    if (typeof raw === "string" && raw.trim()) {
      const parsed = parseFloat(raw);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return null;
  };

  const parseConcentration = (concentrationStr: string) => {
    if (!concentrationStr) return { value: 0, unit: "ml" };
    const match = concentrationStr.match(/^([\d.,]+)\s*(mcg|mg|g)\/ml/i);
    if (match) {
      const val = parseFloat(match[1].replace(",", "."));
      return { value: val, unit: match[2].toLowerCase() };
    }
    return { value: 0, unit: "ml" };
  };

  const calculateInfusionTotals = (inf: any) => {
    let totalDose = 0;
    let totalVolume = 0;

    const conc = parseConcentration(inf.concentration);
    const sortedHist = [...(inf.history || [])].sort((a, b) => a.minutesFromStart - b.minutesFromStart);
    if (sortedHist.length === 0) return { totalDose: 0, totalVolume: 0, doseUnit: "mg" };

    const endMins = getAnesthesiaDurationMinutes();
    const weight = recordedWeightKg();

    for (let i = 0; i < sortedHist.length; i++) {
      const current = sortedHist[i];
      const next = sortedHist[i + 1];
      
      let segmentEnd = endMins;
      if (next) {
        segmentEnd = next.minutesFromStart;
      } else if (current.status === "Pausado" || current.status === "Finalizado") {
        segmentEnd = current.minutesFromStart;
      }
      if (segmentEnd == null) continue;
      
      const duration = Math.max(0, segmentEnd - current.minutesFromStart);
      if (duration === 0) continue;
      
      const rate = current.rate;
      if (rate <= 0 || current.status === "Pausado" || current.status === "Finalizado") continue;

      let segmentDose = 0;
      let segmentVolume = 0;

      const u = inf.unit;
      if (u === "ml/h") {
        segmentVolume = (rate * duration) / 60;
        if (conc.value > 0) {
          segmentDose = segmentVolume * conc.value;
        }
      } else if (u === "mg/h") {
        segmentDose = (rate * duration) / 60;
        if (conc.value > 0 && conc.unit === "mg") {
          segmentVolume = segmentDose / conc.value;
        } else if (conc.value > 0 && conc.unit === "mcg") {
          segmentVolume = (segmentDose * 1000) / conc.value;
        }
      } else if (u === "mcg/h") {
        const doseMcg = (rate * duration) / 60;
        if (conc.value > 0) {
          if (conc.unit === "mcg") {
            segmentDose = doseMcg;
            segmentVolume = doseMcg / conc.value;
          } else if (conc.unit === "mg") {
            segmentDose = doseMcg / 1000;
            segmentVolume = segmentDose / conc.value;
          }
        }
      } else if (u === "mcg/min") {
        const doseMcg = rate * duration;
        if (conc.value > 0) {
          if (conc.unit === "mcg") {
            segmentDose = doseMcg;
            segmentVolume = doseMcg / conc.value;
          } else if (conc.unit === "mg") {
            segmentDose = doseMcg / 1000;
            segmentVolume = segmentDose / conc.value;
          }
        }
      } else if (u === "mcg/kg/min") {
        if (weight == null) continue;
        const doseMcg = rate * weight * duration;
        if (conc.value > 0) {
          if (conc.unit === "mcg") {
            segmentDose = doseMcg;
            segmentVolume = doseMcg / conc.value;
          } else if (conc.unit === "mg") {
            segmentDose = doseMcg / 1000;
            segmentVolume = segmentDose / conc.value;
          }
        }
      } else if (u === "mcg/kg/h") {
        if (weight == null) continue;
        const doseMcg = (rate * weight * duration) / 60;
        if (conc.value > 0) {
          if (conc.unit === "mcg") {
            segmentDose = doseMcg;
            segmentVolume = doseMcg / conc.value;
          } else if (conc.unit === "mg") {
            segmentDose = doseMcg / 1000;
            segmentVolume = segmentDose / conc.value;
          }
        }
      } else if (u === "mg/kg/min") {
        if (weight == null) continue;
        const doseMg = rate * weight * duration;
        if (conc.value > 0) {
          if (conc.unit === "mg") {
            segmentDose = doseMg;
            segmentVolume = doseMg / conc.value;
          } else if (conc.unit === "mcg") {
            segmentDose = doseMg * 1000;
            segmentVolume = segmentDose / conc.value;
          }
        }
      } else if (u === "mg/kg/h") {
        if (weight == null) continue;
        const doseMg = (rate * weight * duration) / 60;
        if (conc.value > 0) {
          if (conc.unit === "mg") {
            segmentDose = doseMg;
            segmentVolume = doseMg / conc.value;
          } else if (conc.unit === "mcg") {
            segmentDose = doseMg * 1000;
            segmentVolume = segmentDose / conc.value;
          }
        }
      } else if (u === "mg/h") {
        const doseMg = (rate * duration) / 60;
        if (conc.value > 0) {
          if (conc.unit === "mg") {
            segmentDose = doseMg;
            segmentVolume = doseMg / conc.value;
          } else if (conc.unit === "mcg") {
            segmentDose = doseMg * 1000;
            segmentVolume = segmentDose / conc.value;
          }
        }
      }

      totalDose += segmentDose;
      totalVolume += segmentVolume;
    }

    const doseUnit = conc.unit || "mg";
    return {
      totalDose: parseFloat(totalDose.toFixed(2)),
      totalVolume: parseFloat(totalVolume.toFixed(1)),
      doseUnit
    };
  };

  const getInfusionDefaultAmpoules = (name: string, volume: number): number => {
    const lower = name.toLowerCase();
    if (lower.includes("remifentanil")) return 1;
    if (lower.includes("propofol")) return volume >= 100 ? 5 : 1;
    if (lower.includes("noradrenalina") || lower.includes("norepinefrina")) return 4;
    if (lower.includes("dexmedetomidina")) return 2;
    if (lower.includes("cetamina")) return 1;
    if (lower.includes("fentanil")) return Math.ceil(volume / 10);
    if (lower.includes("sufentanil")) return 1;
    if (lower.includes("cisatracúrio")) return Math.ceil(volume / 10);
    if (lower.includes("adrenalina")) return Math.ceil(volume / 1);
    if (lower.includes("nitroglicerina")) return 1;
    if (lower.includes("nitroprussiato")) return 1;
    if (lower.includes("dobutamina")) return 1;
    if (lower.includes("dopamina")) return Math.ceil(volume / 10);
    if (lower.includes("milrinona")) return 2;
    return 1;
  };

  const getAmpoulesForInfusion = (inf: any) => {
    if (inf.ampoules !== undefined && inf.ampoules > 0) return inf.ampoules;
    return getInfusionDefaultAmpoules(inf.name, inf.totalVolumePrepared);
  };

  // Timeline scale calculation for vitals chart
  // Always lock timeline at 240 minutes for the standardized 15-minute grid (0 to 240 min)
  const totalMinutes = 240;
  const interval = 15;
  const timeTicks = Array.from({ length: 17 }, (_, i) => i * interval); // [0, 15, 30, ..., 240]

  // Graph coordinate helpers
  // First column in table is 70px.
  // We want the SVG's left margin to be exactly 70px, and right margin to be 980px of a 1000px width.
  const getX = (mins: number) => 70 + (mins / totalMinutes) * 910;
  const getY = (val: number) => {
    const clamped = Math.min(Math.max(val, 30), 220);
    return 10 + (1 - (clamped - 30) / 190) * 140; // Height of chart is 140, y ranges from 10 to 150
  };
  // Generates a beautiful plethysmographic ripple along the SpO₂ line segments in PDF report
  const getPdfSpO2RipplePath = () => {
    const pts = (doc.vitals || [])
      .filter((v) => v.minutesFromStart <= totalMinutes && v.spo2 !== undefined && v.spo2 !== null)
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
            const ripple = Math.sin(angle) * 2.5 + Math.sin(angle * 2) * 0.8;
            
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

  // Generates a beautiful breathing (sinusoidal) ripple along the ETCO₂ line segments in PDF report
  const getPdfEtco2RipplePath = () => {
    const pts = (doc.vitals || [])
      .filter((v) => v.minutesFromStart <= totalMinutes && v.etco2 !== undefined && v.etco2 !== null)
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
            const t_minutes = ((currX - 70) / 910) * totalMinutes;
            const angle = 2 * Math.PI * 12 * t_minutes;
            
            // Low amplitude sinusoidal wave (e.g. amplitude of 2.0 pixels in PDF layout)
            const ripple = Math.sin(angle) * 2.0;
            
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

  // Format helper for time
  const formatTime = (isoString?: string) => {
    if (!isoString) return "-";
    try {
      return new Date(isoString).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      });
    } catch {
      return isoString;
    }
  };

  // Format helper for date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Helper to find a vital record closest to a specific minutesFromStart (within +/- 7.5 min)
  const getVitalForMinutes = (mins: number) => {
    const vitals = doc.vitals || [];
    const hits = vitals.filter(v => Math.abs(v.minutesFromStart - mins) <= 7.5);
    if (hits.length === 0) return null;
    // Return the one closest to the target minutes
    return hits.reduce((prev, curr) => 
      Math.abs(curr.minutesFromStart - mins) < Math.abs(prev.minutesFromStart - mins) ? curr : prev
    );
  };

  // Helper to calculate hour from startAnesthesia + minutes
  const getSlotTimeLabel = (mins: number) => {
    if (!doc.timers?.startAnesthesia) return `+${mins}'`;
    try {
      const startMs = new Date(doc.timers.startAnesthesia).getTime();
      const slotDate = new Date(startMs + mins * 60000);
      return slotDate.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      });
    } catch {
      return `+${mins}'`;
    }
  };

  const activeTechs: string[] = [];
  if (technique.balanced) activeTechs.push("Geral Balanceada");
  if (technique.generalIV) activeTechs.push("Geral Venosa (TIVA)");
  if (technique.generalInhalational) activeTechs.push("Geral Inalatória");
  if (technique.sedation) activeTechs.push("Sedação");
  if (technique.local) activeTechs.push("Local");
  if (technique.spinal) activeTechs.push("Raquianestesia");
  if (technique.epidural) activeTechs.push("Peridural");
  if (technique.combinedSpinalEpidural) activeTechs.push("Combinado (Raqui/Peri)");
  if (technique.regionalPeripheralBlock) activeTechs.push("Bloqueio Periférico");
  if (technique.regionalIV) activeTechs.push("Bloqueio Regional Venoso");

  const hasAllergies = (pre.allergies?.list && pre.allergies.list.length > 0) || (patient.allergies && patient.allergies !== "Nenhuma" && patient.allergies !== "Sem alergias conhecidas" && patient.allergies !== "Sem alergias");

  const renderCircle = (checked: boolean) => (
    <span className="inline-flex items-center justify-center mr-1 shrink-0">
      <span className="w-2.5 h-2.5 rounded-full border border-zinc-400 flex items-center justify-center bg-white">
        {checked && <span className="w-1.5 h-1.5 rounded-full bg-zinc-950" />}
      </span>
    </span>
  );

  const diureseOutput = (doc.outputs || []).find((o) => o.type.toLowerCase().includes("diurese") || o.type.toLowerCase().includes("urina") || o.type.toLowerCase().includes("urina/diurese"));
  const diureseVolume = diureseOutput ? `${diureseOutput.volume} ml` : "________ ml";

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0F1113] text-white font-sans animate-fade-in select-none">
      {/* TOOLBAR */}
      <header className="min-h-[56px] flex flex-wrap items-center justify-between gap-4 px-6 py-2.5 bg-[#17191C] border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/10 border border-indigo-500/20 rounded-lg text-indigo-400">
            <FileText className="w-5 h-5" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-xs font-black tracking-tight uppercase tabular-nums text-zinc-200">
              {patient.fullName || "Ficha Sem Nome"}
            </h1>
            <p className="text-xs text-zinc-500 font-bold uppercase tabular-nums tracking-wider">
              PRONTUÁRIO CLÍNICO DIGITAL
            </p>
          </div>
        </div>

        <div className="flex flex-1 sm:flex-none items-center justify-center gap-2">
          <button onClick={() => setScale(s => Math.max(0.2, s - 0.1))} className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs tabular-nums text-zinc-400 w-12 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(2, s + 0.1))} className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setScale(window.innerWidth < 1123 ? (window.innerWidth - 32) / 1123 : 1)} className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300" title="Ajustar à tela">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleGeneratePdf}
            disabled={isGenerating}
            className={`px-4 py-1.5 ${isGenerating ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-500'} text-white rounded-lg text-xs font-bold shadow-md  transition flex items-center gap-1.5 cursor-pointer`}
            title="Gerar e salvar PDF"
          >
            <Printer className={`w-3.5 h-3.5 ${isGenerating ? 'animate-pulse' : ''}`} />
            <span>{isGenerating ? 'Gerando PDF...' : 'Imprimir / Salvar PDF'}</span>
          </button>

          <div className="w-px h-5 bg-zinc-800 mx-1" />

          <button
            onClick={onClose}
            className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg transition flex items-center justify-center cursor-pointer"
            title="Fechar Visualizador"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* VIEWER ENGINE AREA */}
      <main className="flex-1 bg-[#0A0C0D] relative overflow-auto p-4 md:p-8 flex flex-col items-center justify-start select-text">
        <div 
          ref={containerRef} 
          className="w-[1123px] min-w-[1123px] space-y-8 printable-area print:w-auto print:min-w-0 origin-top"
          style={{ transform: `scale(${scale})`, marginBottom: `${(scale - 1) * 1600}px` }}
        >
          
          {/* ============================================== */}
          {/* SHEET 1: INTRAOPERATIVE RECORD */}
          {/* ============================================== */}
          <div className="bg-white text-zinc-900 shadow-lg p-4 md:p-5 relative flex flex-col justify-between w-[1123px] h-[794px] min-w-[1123px] min-h-[794px] mx-auto rounded-lg aspect-[1123/794] print:shadow-none print:border-zinc-800 print:rounded-none print:m-0 print:p-[5mm] printable-area print-page overflow-hidden print:w-auto print:h-auto print:min-w-0 print:min-h-0">
            
            {/* Background watermarks for unsaved drafts */}
            {doc.status !== "Signed" && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 pointer-events-none opacity-[0.02] select-none text-center z-0">
                <span className="text-[100px] font-black tabular-nums leading-none text-rose-600 block">RASCUNHO</span>
                <span className="text-[24px] font-black tabular-nums leading-none text-rose-600 block">DOCUMENTO NÃO ASSINADO</span>
              </div>
            )}

            {/* HEADER COMPACTO */}
            <div className="border-b border-zinc-200 pb-1.5 mb-2 flex justify-between items-center z-10">
              <div>
                <h2 className="text-xs font-black tracking-tight text-indigo-950 uppercase tabular-nums leading-none">
                  ANESTFLOW • PRONTUÁRIO CLÍNICO DIGITAL DE ANESTESIA
                </h2>
                <p className="text-xs tabular-nums font-extrabold text-zinc-400 uppercase tracking-widest mt-0.5 leading-none">
                  REGISTRO INTRAOPERATÓRIO OFICIAL (PÁGINA 1 DE 2)
                </p>
              </div>
              <div className="text-right flex items-center gap-2">
                <span className="text-xs text-zinc-400 tabular-nums font-bold uppercase leading-none">ID SESSÃO</span>
                <span className="text-xs tabular-nums font-black text-indigo-800 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded leading-none">
                  {doc.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
            </div>

            {/* IDENTIFICAÇÃO DO PACIENTE E EQUIPE */}
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-lg p-2.5 mb-2.5 grid grid-cols-12 gap-y-1.5 gap-x-3 text-[9.5px] leading-tight z-10">
              <div className="col-span-4 border-r border-zinc-200/80 pr-2">
                <span className="text-xs font-extrabold text-zinc-400 block uppercase leading-none mb-0.5">Paciente</span>
                <span className="font-black text-indigo-950 text-xs truncate block leading-none mb-0.5">{patient.fullName || "NÃO CADASTRADO"}</span>
                <span className="text-xs text-zinc-500 font-medium leading-none">Nasc: {formatDate(patient.birthDate)} ({patient.age || "—"}a • {patient.gender === "M" ? "Masc" : "Fem"})</span>
              </div>
              <div className="col-span-2 border-r border-zinc-200/80 pr-2">
                <span className="text-xs font-extrabold text-zinc-400 block uppercase leading-none mb-0.5">IMC</span>
                <span className="font-bold text-zinc-700 block leading-none mb-0.5">{patient.weight || "—"} kg • {patient.height || "—"} cm</span>
                <span className="text-xs font-extrabold text-indigo-700 leading-none">IMC: {patient.imc ? `${patient.imc.toFixed(1)} kg/m²` : "—"}</span>
              </div>
              <div className="col-span-2 border-r border-zinc-200/80 pr-2">
                <span className="text-xs font-extrabold text-zinc-400 block uppercase leading-none mb-0.5">Classificação</span>
                <span className="font-bold text-indigo-950 block leading-none mb-0.5">{patient.asa || "ASA I"}</span>
                <span className="text-xs font-extrabold text-zinc-500 uppercase leading-none">{patient.urgencyType || "Eletivo"}</span>
              </div>
              <div className="col-span-4 pl-1">
                <span className="text-xs font-extrabold text-zinc-400 block uppercase leading-none mb-0.5">Alergias em Destaque</span>
                {hasAllergies ? (
                  <span className="inline-block px-1.5 py-0.5 bg-rose-100 border border-rose-200 rounded text-rose-700 font-extrabold text-xs animate-pulse leading-none">
                    ALERGIA: {(patient.allergies || pre.allergies?.list?.map((a: any) => a.agent).join(", ") || "Sim").toUpperCase()}
                  </span>
                ) : (
                  <span className="text-emerald-600 font-extrabold block text-xs leading-none">✓ SEM ALERGIAS CONHECIDAS</span>
                )}
              </div>

              <div className="col-span-12 border-t border-zinc-200/60 pt-1 mt-0.5 grid grid-cols-12 gap-x-3">
                <div className="col-span-5 border-r border-zinc-200/80 pr-2">
                  <span className="text-xs font-extrabold text-zinc-400 block uppercase leading-none mb-0.5">Diagnóstico Clínico</span>
                  <span className="font-medium text-zinc-700 block truncate leading-tight">{patient.diagnosis || "Não descrito."}</span>
                </div>
                <div className="col-span-7">
                  <span className="text-xs font-extrabold text-zinc-400 block uppercase leading-none mb-0.5">Procedimento Realizado</span>
                  <span className="font-black text-indigo-950 uppercase block truncate leading-tight">{patient.actualProcedure || patient.scheduledProcedure || "Não descrito."}</span>
                </div>
              </div>

              <div className="col-span-12 border-t border-zinc-200/60 pt-1 grid grid-cols-3 gap-x-3">
                <div>
                  <span className="text-xs font-extrabold text-zinc-400 block uppercase leading-none">Anestesiologista</span>
                  <span className="font-bold text-zinc-800 leading-none block">{team.anesthesiologistLead || "—"}</span>
                  <span className="text-zinc-500 tabular-nums text-xs leading-none block">CRM {team.crmLead || "—"}-{team.ufLead || "—"}</span>
                </div>
                <div>
                  <span className="text-xs font-extrabold text-zinc-400 block uppercase leading-none">Cirurgião</span>
                  <span className="font-bold text-zinc-800 block truncate leading-none">{team.surgeon || "—"}</span>
                  <span className="text-zinc-500 tabular-nums text-xs leading-none block">CRM {team.surgeonCRM || "—"}-{team.surgeonUF || "GO"}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-extrabold text-zinc-400 block uppercase leading-none">Data</span>
                  <span className="font-bold text-zinc-800 block leading-none mt-0.5">{patient.date ? formatDate(patient.date) : "—"}</span>
                </div>
              </div>
            </div>

            {/* FICHA GRÁFICA DE SINAIS VITAIS (SVG) */}
            <div className="border border-zinc-300 rounded-lg p-2.5 bg-white mb-2 z-10 flex-1 flex flex-col justify-between">
              <div className="flex justify-between items-center pb-1 border-b border-zinc-150 mb-1.5 shrink-0">
                <span className="text-xs font-black text-indigo-950 uppercase tracking-tight tabular-nums">
                  I. Ficha Gráfica de Sinais Vitais (Série Intraoperatória)
                </span>
                <span className="text-xs text-zinc-400 font-bold uppercase">
                  FC: • Azul (bpm) | PA: ⬍ Vermelho (mmHg) [▲ Sístole / ▼ Diástole]
                </span>
              </div>

              {/* Graphic area */}
              <div className="w-full flex-1 flex items-center justify-center">
                <svg viewBox="0 0 1000 170" className="w-full h-auto overflow-visible select-none">
                  {/* Grid Lines Y (Horizontal) */}
                  {[220, 210, 200, 190, 180, 170, 160, 150, 140, 130, 120, 110, 100, 90, 80, 70, 60, 50, 40].map((val) => {
                    const isAccent = val % 50 === 0;
                    const isLabelValue = val % 20 === 0;
                    return (
                      <g key={val}>
                        <line
                          x1={70}
                          y1={getY(val)}
                          x2={980}
                          y2={getY(val)}
                          stroke={isAccent ? "#cbd5e1" : "#f1f5f9"}
                          strokeWidth={isAccent ? 1 : 0.6}
                        />
                        {isAccent && (
                          <line
                            x1={70}
                            y1={getY(val)}
                            x2={980}
                            y2={getY(val)}
                            stroke="#cbd5e1"
                            strokeWidth={0.8}
                          />
                        )}
                        {/* Left Labels */}
                        {isLabelValue && (
                          <text
                            x={62}
                            y={getY(val) + 3}
                            textAnchor="end"
                            fontSize={7.5}
                            fontWeight="bold"
                            className="fill-zinc-400 tabular-nums"
                          >
                            {val}
                          </text>
                        )}
                        {/* Right Labels */}
                        {isLabelValue && (
                          <text
                            x={988}
                            y={getY(val) + 3}
                            textAnchor="start"
                            fontSize={7.5}
                            fontWeight="bold"
                            className="fill-zinc-400 tabular-nums"
                          >
                            {val}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Grid Lines X (Vertical) & Labels */}
                  {timeTicks.map((mins) => {
                    const x = getX(mins);
                    const label = getSlotTimeLabel(mins);
                    return (
                      <g key={mins}>
                        <line
                          x1={x}
                          y1={10}
                          x2={x}
                          y2={150}
                          stroke="#f1f5f9"
                          strokeWidth={1}
                        />
                        <line
                          x1={x}
                          y1={10}
                          x2={x}
                          y2={150}
                          stroke="#cbd5e1"
                          strokeWidth={mins % 60 === 0 ? 1 : 0.6}
                          strokeDasharray={mins % 60 === 0 ? "none" : "3 3"}
                        />
                        {/* Time label under vertical line */}
                        <text
                          x={x}
                          y={162}
                          textAnchor="middle"
                          fontSize={8}
                          fontWeight="bold"
                          className="fill-zinc-500 tabular-nums"
                        >
                          {label}
                        </text>
                      </g>
                    );
                  })}

                  {/* Axis borders */}
                  <rect x={70} y={10} width={910} height={140} fill="none" stroke="#94a3b8" strokeWidth={1} />

                  {/* Heart Rate (FC) line & dots (Blue) */}
                  {(() => {
                    const fcPts = (doc.vitals || [])
                      .filter((v) => v.minutesFromStart <= totalMinutes && v.fc !== undefined && v.fc !== null)
                      .sort((a, b) => a.minutesFromStart - b.minutesFromStart);
                    
                    const pathD = fcPts
                      .map((v, idx) => `${idx === 0 ? "M" : "L"} ${getX(v.minutesFromStart)} ${getY(v.fc!)}`)
                      .join(" ");

                    return (
                      <g>
                        {pathD && (
                          <path
                            d={pathD}
                            fill="none"
                            stroke="#1d4ed8"
                            strokeWidth={1.8}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}
                        {fcPts.map((v, idx) => (
                          <circle
                            key={idx}
                            cx={getX(v.minutesFromStart)}
                            cy={getY(v.fc!)}
                            r={3}
                            className="fill-blue-600 stroke-white stroke-[1.2]"
                          />
                        ))}
                      </g>
                    );
                  })()}

                  {/* Blood Pressure (PA) Systolic / Diastolic Vertical Bars (Red) with medical point arrows */}
                  {(doc.vitals || [])
                    .filter((v) => v.minutesFromStart <= totalMinutes && v.pas !== undefined && v.pad !== undefined)
                    .map((v, idx) => {
                      const x = getX(v.minutesFromStart);
                      const ySys = getY(v.pas!);
                      const yDia = getY(v.pad!);
                      return (
                        <g key={idx}>
                          {/* Vertical Bar */}
                          <line
                            x1={x}
                            y1={ySys}
                            x2={x}
                            y2={yDia}
                            stroke="#b91c1c"
                            strokeWidth={1.5}
                          />
                          {/* Systolic indicator: Triangle pointing UP (▲) */}
                          <polygon
                            points={`${x},${ySys} ${x - 4},${ySys + 5} ${x + 4},${ySys + 5}`}
                            className="fill-red-700"
                          />
                          {/* Diastolic indicator: Triangle pointing DOWN (▼) */}
                          <polygon
                            points={`${x},${yDia} ${x - 4},${yDia - 5} ${x + 4},${yDia - 5}`}
                            className="fill-red-700"
                          />
                        </g>
                      );
                    })}

                  {/* Invasive Blood Pressure (PAI) - Single mean line with diamond symbols */}
                  {(() => {
                    const paiPts = (doc.vitals || [])
                      .filter((v) => v.minutesFromStart <= totalMinutes && v.pai !== undefined && v.pai !== null)
                      .sort((a, b) => a.minutesFromStart - b.minutesFromStart);
                    
                    const pathD = paiPts
                      .map((v, idx) => `${idx === 0 ? "M" : "L"} ${getX(v.minutesFromStart)} ${getY(v.pai!)}`)
                      .join(" ");

                    return (
                      <g>
                        {pathD && (
                          <path
                            d={pathD}
                            fill="none"
                            stroke="#dc2626"
                            strokeWidth={1.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}
                        {paiPts.map((v, idx) => {
                          const x = getX(v.minutesFromStart);
                          const y = getY(v.pai!);
                          return (
                            <g key={`pdf-pai-pt-${idx}`}>
                              {/* Horizontal base bar */}
                              <line
                                x1={x - 4.5}
                                y1={y}
                                x2={x + 4.5}
                                y2={y}
                                stroke="#dc2626"
                                strokeWidth={1.8}
                                strokeLinecap="round"
                              />
                              {/* Vertical stem */}
                              <line
                                x1={x}
                                y1={y - 7.5}
                                x2={x}
                                y2={y}
                                stroke="#dc2626"
                                strokeWidth={1.8}
                                strokeLinecap="round"
                              />
                            </g>
                          );
                        })}
                      </g>
                    );
                  })()}

                  {/* BIS line & squares (Purple) */}
                  {(() => {
                    const bisPts = (doc.vitals || [])
                      .filter((v) => v.minutesFromStart <= totalMinutes && v.bis !== undefined && v.bis !== null)
                      .sort((a, b) => a.minutesFromStart - b.minutesFromStart);
                    
                    const pathD = bisPts
                      .map((v, idx) => `${idx === 0 ? "M" : "L"} ${getX(v.minutesFromStart)} ${getY(v.bis!)}`)
                      .join(" ");

                    return (
                      <g>
                        {pathD && (
                          <path
                            d={pathD}
                            fill="none"
                            stroke="#7c3aed"
                            strokeWidth={1.5}
                            strokeDasharray="3 3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}
                        {bisPts.map((v, idx) => (
                          <rect
                            key={`pdf-bis-pt-${idx}`}
                            x={getX(v.minutesFromStart) - 3}
                            y={getY(v.bis!) - 3}
                            width={6}
                            height={6}
                            fill="#7c3aed"
                          />
                        ))}
                      </g>
                    );
                  })()}

                  {/* Oxygen Saturation (SpO₂) line & dots (Green) */}
                  {(() => {
                    const spo2Pts = (doc.vitals || [])
                      .filter((v) => v.minutesFromStart <= totalMinutes && v.spo2 !== undefined && v.spo2 !== null)
                      .sort((a, b) => a.minutesFromStart - b.minutesFromStart);

                    return (
                      <g>
                        {spo2Pts.length > 0 && (
                          <path
                            d={getPdfSpO2RipplePath()}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth={1.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}
                        {spo2Pts.map((v, idx) => (
                          <circle
                            key={`pdf-spo2-pt-${idx}`}
                            cx={getX(v.minutesFromStart)}
                            cy={getY(v.spo2!)}
                            r={2.5}
                            fill="#10b981"
                            stroke="#ffffff"
                            strokeWidth={0.8}
                          />
                        ))}
                      </g>
                    );
                  })()}

                  {/* ETCO₂ - Yellow Triangles & Sinusoidal Wave (PDF report) */}
                  {(() => {
                    const etco2Pts = (doc.vitals || [])
                      .filter((v) => v.minutesFromStart <= totalMinutes && v.etco2 !== undefined && v.etco2 !== null)
                      .sort((a, b) => a.minutesFromStart - b.minutesFromStart);

                    return (
                      <g>
                        {etco2Pts.length > 0 && (
                          <path
                            d={getPdfEtco2RipplePath()}
                            fill="none"
                            stroke="#eab308"
                            strokeWidth={1.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}
                        {etco2Pts.map((v, idx) => {
                          const x = getX(v.minutesFromStart);
                          const y = getY(v.etco2!);
                          return (
                            <polygon
                              key={`pdf-etco2-pt-${idx}`}
                              points={`${x},${y - 4} ${x + 4.5},${y + 3} ${x - 4.5},${y + 3}`}
                              fill="#facc15"
                              stroke="#ca8a04"
                              strokeWidth={0.8}
                            />
                          );
                        })}
                      </g>
                    );
                  })()}

                  {/* Baseline Markers for Anesthesia (X) and Surgery (○) */}
                  {(() => {
                    const getMins = (isoString?: string) => {
                      if (!isoString || !doc.timers?.startAnesthesia) return null;
                      try {
                        return Math.round((new Date(isoString).getTime() - new Date(doc.timers.startAnesthesia).getTime()) / 60000);
                      } catch {
                        return null;
                      }
                    };

                    const list: { mins: number; type: "anesthesia" | "surgery" }[] = [];
                    if (doc.timers?.startAnesthesia) {
                      list.push({ mins: 0, type: "anesthesia" });
                    }
                    const endAnesth = getMins(doc.timers?.endAnesthesia);
                    if (endAnesth !== null && endAnesth >= 0 && endAnesth <= totalMinutes) {
                      list.push({ mins: endAnesth, type: "anesthesia" });
                    }
                    const startSurg = getMins(doc.timers?.startSurgery);
                    if (startSurg !== null && startSurg >= 0 && startSurg <= totalMinutes) {
                      list.push({ mins: startSurg, type: "surgery" });
                    }
                    const endSurg = getMins(doc.timers?.endSurgery);
                    if (endSurg !== null && endSurg >= 0 && endSurg <= totalMinutes) {
                      list.push({ mins: endSurg, type: "surgery" });
                    }

                    const y = 150; // Baseline in PDF chart is at y=150

                    return list.map((item, idx) => {
                      const x = getX(item.mins);
                      if (item.type === "anesthesia") {
                        return (
                          <g key={`pdf-base-marker-${idx}`}>
                            {/* White outline for high contrast */}
                            <line x1={x - 4.5} y1={y - 4.5} x2={x + 4.5} y2={y + 4.5} stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                            <line x1={x + 4.5} y1={y - 4.5} x2={x - 4.5} y2={y + 4.5} stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                            {/* Black X */}
                            <line x1={x - 4.5} y1={y - 4.5} x2={x + 4.5} y2={y + 4.5} stroke="#000000" strokeWidth="1.5" strokeLinecap="round" />
                            <line x1={x + 4.5} y1={y - 4.5} x2={x - 4.5} y2={y + 4.5} stroke="#000000" strokeWidth="1.5" strokeLinecap="round" />
                          </g>
                        );
                      } else {
                        return (
                          <g key={`pdf-base-marker-${idx}`}>
                            {/* White outline for high contrast */}
                            <circle cx={x} cy={y} r="4.5" fill="#ffffff" stroke="#ffffff" strokeWidth="1.5" />
                            {/* Black empty circle */}
                            <circle cx={x} cy={y} r="3.5" fill="none" stroke="#000000" strokeWidth="1.8" />
                          </g>
                        );
                      }
                    });
                  })()}
                </svg>
              </div>

              {/* MATRIZ NUMÉRICA INTEGRADA (ALINHADA PERFEITAMENTE) */}
              <div className="mt-2 border-t border-zinc-200 pt-2 shrink-0">
                <div className="grid grid-cols-[70px_repeat(17,_1fr)] text-xs tabular-nums leading-none font-bold text-center border border-zinc-200 rounded-lg overflow-hidden bg-zinc-50">
                  {/* Row 1: Tempo */}
                  <div className="py-1.5 px-2 text-left bg-zinc-100 border-r border-zinc-200 text-zinc-500 uppercase font-black">Minuto</div>
                  {timeTicks.map((mins) => (
                    <div key={mins} className="py-1.5 border-r last:border-r-0 border-zinc-200 text-zinc-600 bg-zinc-100/50">
                      +{mins}'
                    </div>
                  ))}

                  {/* REGISTROS DE INFUSÕES CONTÍNUAS (ALINHAMENTO EM GRADE) */}
                  {(doc.continuousInfusions || []).map((inf, idx) => {
                    const hasHistory = inf.history && inf.history.length > 0;
                    if (!hasHistory) return null;
                    const sortedHist = [...inf.history].sort((a, b) => a.minutesFromStart - b.minutesFromStart);
                    const bgClass = idx % 2 === 0 ? "bg-white" : "bg-zinc-50/30";

                    return (
                      <React.Fragment key={inf.id}>
                        <div className={`py-1.5 px-2 text-left border-t border-r border-zinc-200 text-indigo-900 font-black truncate ${bgClass}`} title={`${inf.name} (${inf.unit})`}>
                          {inf.name.split(" ")[0]} ({inf.unit})
                        </div>
                        {timeTicks.map((mins) => {
                          const activeEntry = sortedHist
                            .filter((h) => h.minutesFromStart <= mins)
                            .pop();
                          const isActive = activeEntry && activeEntry.status !== "Pausado" && activeEntry.status !== "Finalizado";
                          const rateVal = isActive ? activeEntry.rate : "-";
                          return (
                            <div
                              key={mins}
                              className={`py-1.5 border-t border-r last:border-r-0 border-zinc-200 font-extrabold text-xs ${
                                isActive ? "bg-indigo-50/70 text-indigo-700 font-black" : `${bgClass} text-zinc-300`
                              }`}
                            >
                              {rateVal}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}

                  {/* REGISTROS DE GASES E AGENTES INALATÓRIOS (ALINHAMENTO EM GRADE) */}
                  {(doc.inhalationAgents || []).map((ia, idx) => {
                    const isO2 = ia.agent === "Oxigênio (O₂)";
                    const isAir = ia.agent === "Ar Comprimido";
                    const isGas = isO2 || isAir;
                    const displayName = isO2 ? "O₂" : isAir ? "Ar" : ia.agent.substring(0, 10);
                    const bgClass = idx % 2 === 0 ? "bg-white" : "bg-zinc-50/30";
                    const startAnesth = doc.timers?.startAnesthesia ? new Date(doc.timers.startAnesthesia).getTime() : null;

                    return (
                      <React.Fragment key={ia.id}>
                        <div className={`py-1.5 px-2 text-left border-t border-r border-zinc-200 text-teal-950 font-black truncate ${bgClass}`} title={`${ia.agent} ${isGas ? "(L/min)" : "(%)"}`}>
                          {displayName} {isGas ? "L/m" : "%"}
                        </div>
                        {timeTicks.map((mins) => {
                          const tStart = new Date(ia.startTime).getTime();
                          const startMins = startAnesth ? Math.max(0, Math.round((tStart - startAnesth) / 60000)) : 0;
                          const tEnd = ia.endTime ? new Date(ia.endTime).getTime() : null;
                          const endMins = tEnd && startAnesth ? Math.round((tEnd - startAnesth) / 60000) : totalMinutes;

                          const isActive = mins >= startMins && mins <= endMins;
                          let displayVal = "-";
                          if (isActive) {
                            displayVal = isGas
                              ? `${ia.flowO2 ?? 0}`
                              : `${ia.inspiredConc ?? 0}`;
                          }

                          let cellBgClass = bgClass;
                          let textClass = "text-zinc-300";
                          if (isActive) {
                            if (isO2) {
                              cellBgClass = "bg-cyan-50/55";
                              textClass = "text-cyan-700 font-black";
                            } else if (isAir) {
                              cellBgClass = "bg-sky-50/55";
                              textClass = "text-sky-700 font-black";
                            } else {
                              cellBgClass = "bg-teal-50/55";
                              textClass = "text-teal-700 font-black";
                            }
                          }

                          return (
                            <div
                              key={mins}
                              className={`py-1.5 border-t border-r last:border-r-0 border-zinc-200 font-extrabold text-xs ${cellBgClass} ${textClass}`}
                            >
                              {displayVal}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* PARÂMETROS CLÍNICOS DETALHADOS (4 COLUNAS COMPACTAS) */}
            <div className="grid grid-cols-4 gap-3 text-xs leading-snug border border-zinc-200 rounded-lg p-3 bg-zinc-50/50 z-10 shrink-0">
              
              {/* COL 1: TÉCNICA & VIA AÉREA */}
              <div className="border-r border-zinc-200/80 pr-2 flex flex-col justify-between">
                <div>
                  <h4 className="font-black text-indigo-950 uppercase border-b border-zinc-200 pb-1 mb-1 tracking-tight flex items-center gap-1">
                    <Activity className="w-3 h-3 text-indigo-500" />
                    <span>1. Técnica & Via Aérea</span>
                  </h4>
                  {/* SEÇÃO TÉCNICA ANESTÉSICA */}
                  <div className="mt-1 border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-xs">
                    <div className="bg-zinc-100 text-zinc-800 font-black text-center text-xs uppercase py-0.5 tracking-wider border-b border-zinc-200">
                      TÉCNICA ANESTÉSICA
                    </div>
                    <div className="p-1.5 space-y-1 text-xs leading-tight text-zinc-800 max-h-[58px] overflow-hidden">
                      {activeTechs.length > 0 ? (
                        activeTechs.slice(0, 3).map((tech, i) => (
                          <div key={i} className="flex items-center gap-1 font-bold text-indigo-950 truncate">
                            <span className="text-indigo-600 font-extrabold">✓</span>
                            <span className="truncate">{tech}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-zinc-400 italic">Nenhuma técnica registrada</div>
                      )}
                      {technique.other && technique.other !== "Outra técnica" && (
                        <div className="flex items-start gap-1 font-bold text-indigo-950 border-t border-dashed border-zinc-100 pt-1 mt-1 truncate">
                          <span className="text-indigo-600 font-extrabold">✓</span>
                          <span className="truncate">Outra: <span className="underline">{technique.other}</span></span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SEÇÃO MODELO DE VENTILAÇÃO */}
                  <div className="mt-1.5 border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-xs">
                    <div className="bg-zinc-100 text-zinc-800 font-black text-center text-xs uppercase py-0.5 tracking-wider border-b border-zinc-200">
                      VIA AÉREA & VENTILAÇÃO
                    </div>
                    <div className="p-1.5 space-y-1 text-xs leading-tight text-zinc-800">
                      <div className="flex justify-between items-center py-0.5 border-b border-zinc-100">
                        <span className="text-zinc-400 font-extrabold text-xs uppercase">Modo de Ventilação</span>
                        <span className="font-extrabold text-indigo-950 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100 uppercase truncate max-w-[80px]">
                          {airway.ventilationMode || "Espontânea"}
                        </span>
                      </div>
                      
                      <div className="py-0.5 border-b border-zinc-100">
                        <span className="text-zinc-400 block font-extrabold text-xs uppercase mb-0.5">Dispositivo</span>
                        <div className="font-extrabold text-teal-950 flex items-center gap-1 truncate">
                          <span className="text-teal-600">✓</span>
                          <span className="truncate">{airway.ventilationType || "Espontânea (Nenhum)"}</span>
                          {airway.deviceSize && (
                            <span className="text-zinc-500 tabular-nums text-xs shrink-0"> (Nº {airway.deviceSize})</span>
                          )}
                          {airway.fixationDepth && (
                            <span className="text-zinc-500 tabular-nums text-xs shrink-0"> - {airway.fixationDepth}cm</span>
                          )}
                        </div>
                      </div>

                      {airway.predictionEasy && (airway.ventilationType === "Intubação Orotraqueal" || airway.ventilationType === "Intubação Nasotraqueal" || airway.ventilationType === "Tubo Duplo Lúmen") && (
                        <div className="flex justify-between items-center py-0.5 border-b border-zinc-100">
                          <span className="text-zinc-400 font-extrabold text-xs uppercase">Predição IOT</span>
                          <span className={`font-black text-xs uppercase px-1 py-0.2 rounded ${airway.predictionEasy === "Difícil" ? "text-rose-600 bg-rose-50 border border-rose-100" : "text-emerald-600 bg-emerald-50 border border-emerald-100"}`}>
                            {airway.predictionEasy}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between items-center py-0.5 border-b border-zinc-100">
                        <span className="text-zinc-400 font-extrabold text-xs uppercase">Intercorrências</span>
                        <span className={`font-black text-xs uppercase px-1 py-0.2 rounded ${airway.incidents ? "text-rose-600 bg-rose-50 border border-rose-100" : "text-emerald-600 bg-emerald-50 border border-emerald-100"}`}>
                          {airway.incidents ? "Sim" : "Não"}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pt-0.5">
                        <span className="text-zinc-400 font-extrabold text-xs uppercase">Diurese</span>
                        <span className="font-black text-zinc-800 text-xs">{diureseVolume}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* COL 2: ACESSOS & MATERIAIS */}
              <div className="border-r border-zinc-200/80 pr-2 pl-1">
                <h4 className="font-black text-indigo-950 uppercase border-b border-zinc-200 pb-1 mb-1.5 tracking-tight flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  <span>2. Acessos & Materiais</span>
                </h4>
                <div className="space-y-1">
                  <div>
                    <span className="text-zinc-400 block uppercase font-extrabold text-xs">Acessos Vasculares</span>
                    <div className="font-extrabold text-zinc-700 max-h-[38px] overflow-hidden">
                      {doc.vascularAccesses && doc.vascularAccesses.length > 0 ? (
                        doc.vascularAccesses.slice(0, 3).map((acc, i) => (
                          <div key={acc.id || i} className="truncate">
                            • {acc.type} ({acc.gauge} {acc.site} {acc.side})
                          </div>
                        ))
                      ) : (
                        <span className="text-zinc-400 font-normal">Nenhum acesso invasivo registrado</span>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-dashed border-zinc-200 pt-1 mt-1">
                    <span className="text-zinc-400 block uppercase font-extrabold text-xs">Equipamentos de Apoio</span>
                    <div className="font-medium text-zinc-600 line-clamp-2 overflow-hidden max-h-[24px]">
                      {[
                        equipmentConfig.thermalBlanket && "Manta Térmica",
                        equipmentConfig.thermalMattress && "Colchão Térmico",
                        equipmentConfig.infusionPump && "Bomba de Infusão",
                        equipmentConfig.urinaryCatheter && "Sonda Vesical",
                        equipmentConfig.gastricTube && "Sonda Gástrica"
                      ].filter(Boolean).join(", ") || "Apenas monitorização padrão"}
                    </div>
                  </div>
                  <div className="border-t border-dashed border-zinc-200 pt-1">
                    <span className="text-zinc-400 block uppercase font-extrabold text-xs">Segurança Checklist</span>
                    <span className="font-extrabold text-emerald-600 uppercase">
                      {checklist.patientIdConfirmed && checklist.procedureConfirmed && checklist.monitorsReady ? "✓ Checklist Completo" : "Parcial"}
                    </span>
                  </div>
                </div>
              </div>

              {/* COL 3: FLUIDOS & INALAÇÃO */}
              <div className="border-r border-zinc-200/80 pr-2 pl-1">
                <h4 className="font-black text-indigo-950 uppercase border-b border-zinc-200 pb-1 mb-1.5 tracking-tight flex items-center gap-1">
                  <Thermometer className="w-3 h-3 text-amber-500" />
                  <span>3. Fluidos & Inalação</span>
                </h4>
                <div className="space-y-1">
                  <div>
                    <span className="text-zinc-400 block uppercase font-extrabold text-xs">Cristaloides & Coloides</span>
                    <span className="font-bold text-zinc-700 block line-clamp-2 overflow-hidden max-h-[26px]">
                      {doc.fluids && doc.fluids.length > 0 
                        ? doc.fluids.map((f) => `${f.name} (${f.volumeAdministered}ml)`).join(", ")
                        : "Nenhuma infusão."
                      }
                    </span>
                    <span className="font-extrabold text-indigo-700 text-xs block">
                      Total Infundido: {doc.fluids ? doc.fluids.reduce((acc, curr) => acc + (curr.volumeAdministered || 0), 0) : 0} ml
                    </span>
                  </div>
                  <div className="border-t border-dashed border-zinc-200 pt-1 mt-1">
                    <span className="text-zinc-400 block uppercase font-extrabold text-xs">Perdas Estimadas</span>
                    <span className="font-bold text-rose-600 block line-clamp-1 overflow-hidden max-h-[14px]">
                      {doc.outputs && doc.outputs.length > 0 
                        ? doc.outputs.map((o) => `${o.type} (${o.volume}ml)`).join(", ")
                        : "Nenhuma perda relevante."
                      }
                    </span>
                  </div>
                  <div className="border-t border-dashed border-zinc-200 pt-1">
                    <span className="text-zinc-400 block uppercase font-extrabold text-xs">Inalatórios & Vaporizadores</span>
                    <span className="font-bold text-zinc-700 block truncate">
                      Agente: {equipmentConfig.vaporizerAgent || "Nenhum vaporizador ativo"}
                    </span>
                  </div>
                </div>
              </div>

              {/* COL 4: FÁRMACOS & INFUSÕES */}
              <div className="pl-1">
                <h4 className="font-black text-indigo-950 uppercase border-b border-zinc-200 pb-1 mb-1.5 tracking-tight flex items-center gap-1">
                  <Heart className="w-3 h-3 text-rose-500" />
                  <span>4. Fármacos & Infusões</span>
                </h4>
                <div className="space-y-1">
                  <div>
                    <span className="text-zinc-400 block uppercase font-extrabold text-xs">Administrações em Bolus</span>
                    <div className="max-h-[64px] overflow-hidden space-y-0.5 font-bold text-zinc-700 text-xs">
                      {doc.bolusDrugs && doc.bolusDrugs.length > 0 ? (
                        Object.entries(
                          doc.bolusDrugs.reduce((acc: any, curr) => {
                            if (!acc[curr.name]) {
                              acc[curr.name] = { unit: curr.unit, totalDose: 0, ampouleTotal: curr.ampouleTotal, manualAmpoules: 0 };
                            }
                            acc[curr.name].totalDose += curr.dose;
                            if (curr.ampouleTotal) acc[curr.name].ampouleTotal = curr.ampouleTotal;
                            if (curr.ampoules) acc[curr.name].manualAmpoules += curr.ampoules;
                            return acc;
                          }, {})
                        ).slice(0, 6).map(([name, data]: [string, any], idx) => {
                          const totalAmpoules = data.manualAmpoules > 0
                            ? data.manualAmpoules
                            : (data.ampouleTotal ? Math.ceil(data.totalDose / data.ampouleTotal) : 1);

                          return (
                            <div key={idx} className="truncate">
                              • {name}: {data.totalDose}{data.unit} ({totalAmpoules} amp)
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-zinc-400 font-normal block">Nenhum bolus</span>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-dashed border-zinc-200 pt-1 mt-1">
                    <span className="text-zinc-400 block uppercase font-extrabold text-xs">Infusões Contínuas (Totais)</span>
                    <div className="max-h-[34px] overflow-hidden space-y-0.5 font-bold text-zinc-700 text-xs">
                      {doc.continuousInfusions && doc.continuousInfusions.length > 0 ? (
                        doc.continuousInfusions.slice(0, 3).map((c, idx) => {
                          const totals = calculateInfusionTotals(c);
                          const ampoules = getAmpoulesForInfusion(c);
                          return (
                            <div key={c.id || idx} className="truncate">
                              • {c.name}: {totals.totalDose}{totals.doseUnit} / {totals.totalVolume}ml ({ampoules} amp)
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-zinc-400 font-normal block text-xs">Nenhuma infusão registrada</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* PAGE NUMBER FOOTER */}
            <div className="flex justify-between items-center border-t border-zinc-300 pt-2 mt-2 text-xs font-bold text-zinc-400 tabular-nums shrink-0 z-10">
              <span>SISTEMA DE SEGURANÇA INTEGRADA ANESTFLOW</span>
              <span>PÁGINA 1 DE 2</span>
            </div>

          </div>

          {/* ============================================== */}
          {/* SHEET 2: PRE-OP ASSESSMENT, RECOVERY & NARRATIVE */}
          {/* ============================================== */}
          <div className="bg-white text-zinc-900 shadow-lg p-4 md:p-5 relative flex flex-col justify-between w-[1123px] h-[794px] min-w-[1123px] min-h-[794px] mx-auto rounded-lg aspect-[1123/794] print:shadow-none print:border-zinc-800 print:rounded-none print:m-0 print:p-[5mm] printable-area print-page overflow-hidden print:w-auto print:h-auto print:min-w-0 print:min-h-0">
            
            {/* Background watermarks for unsaved drafts */}
            {doc.status !== "Signed" && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 pointer-events-none opacity-[0.02] select-none text-center z-0">
                <span className="text-[100px] font-black tabular-nums leading-none text-rose-600 block">RASCUNHO</span>
                <span className="text-[24px] font-black tabular-nums leading-none text-rose-600 block">DOCUMENTO NÃO ASSINADO</span>
              </div>
            )}

            {/* HEADER COMPACTO */}
            <div className="border-b border-zinc-300 pb-2 mb-3 flex justify-between items-start z-10">
              <div>
                <h2 className="text-[13px] font-black tracking-tight text-indigo-950 uppercase tabular-nums">
                  AVALIAÇÃO PRÉ-ANESTÉSICA, RECUPERAÇÃO (SRPA) & EVOLUÇÕES CLÍNICAS
                </h2>
                <p className="text-xs tabular-nums font-extrabold text-zinc-400 uppercase tracking-widest mt-0.5">
                  FICHA CLÍNICA MULTI-SESSÃO OFICIAL (PÁGINA 2 DE 2)
                </p>
              </div>
              <div className="text-right flex items-center gap-3">
                <div className="text-xs text-zinc-400 tabular-nums font-bold uppercase leading-none">PACIENTE</div>
                <div className="text-xs tabular-nums font-black text-indigo-800 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                  {(patient.fullName || "PACIENTE NÃO IDENTIFICADO").toUpperCase()}
                </div>
              </div>
            </div>

            {/* TRÊS COLUNAS GERAIS */}
            <div className="grid grid-cols-3 gap-4 flex-1 z-10 min-h-0 overflow-hidden mb-3">
              
              {/* COL A: AVALIAÇÃO PRÉ-ANESTÉSICA */}
              <div className="border border-zinc-200 rounded-lg p-3 bg-white flex flex-col justify-between overflow-y-auto">
                <div>
                  <h3 className="font-black text-indigo-950 uppercase pb-1.5 border-b border-zinc-150 mb-2 tracking-tight text-xs flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                    <span>1. Avaliação Pré-Anestésica</span>
                  </h3>
                  
                  <div className="space-y-2 text-xs leading-tight">
                    <div className="grid grid-cols-2 gap-2 bg-zinc-50 p-1.5 rounded-lg border border-zinc-100">
                      <div>
                        <span className="text-zinc-400 block font-extrabold uppercase text-xs">Jejum Sólidos</span>
                        <span className="font-bold text-zinc-800">{pre.jejumSolidsHours || "—"} horas</span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block font-extrabold uppercase text-xs">Jejum Líquidos</span>
                        <span className="font-bold text-zinc-800">{pre.jejumLiquidsHours || "—"} horas</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-zinc-400 block font-extrabold uppercase text-xs">Histórico de Alergias / Risco NVPO</span>
                      {pre.allergies?.list && pre.allergies.list.length > 0 ? (
                        <span className="font-bold text-rose-600 block truncate max-w-full">
                          Alergia: {pre.allergies.list.map((a: any) => `${a.agent} (${a.severity})`).join(", ")}
                        </span>
                      ) : (
                        <span className="font-extrabold text-emerald-600 block truncate max-w-full">Sem Alergias Conhecidas (Negativo)</span>
                      )}
                      <span className="font-medium text-zinc-600 block truncate">
                        Score de Apfel: <span className="font-bold text-indigo-700">{pre.apfelScore ?? 0}/4</span> | NVPO Prévia: {pre.nauseaVomitingHistory ? "Sim" : "Não"}
                      </span>
                    </div>

                    <div className="border-t border-zinc-100 pt-1.5">
                      <span className="text-zinc-400 block font-extrabold uppercase text-xs">Exame Físico</span>
                      <p className="text-zinc-600 font-medium space-y-0.5">
                        <span className="block truncate">• Cardio: {pre.physicalExam?.cardiac || "Sopro ausente"}</span>
                        <span className="block truncate">• Resp: {pre.physicalExam?.respiratory || "Múrmurio vesicular preservado"}</span>
                        <span className="block truncate">• Neuro: {pre.physicalExam?.neurological || "Lúcido e orientado"}</span>
                      </p>
                    </div>

                    <div className="border-t border-zinc-100 pt-1.5">
                      <span className="text-zinc-400 block font-extrabold uppercase text-xs">Exames de Laboratório</span>
                      <div className="grid grid-cols-3 gap-1 text-xs font-bold text-zinc-700 bg-zinc-50 p-1 rounded">
                        <div>Hb: <span className="text-indigo-800">{pre.laboratory?.hb || "—"}</span></div>
                        <div>Ht: <span className="text-indigo-800">{pre.laboratory?.ht || "—"}</span></div>
                        <div>Plat: <span className="text-indigo-800">{pre.laboratory?.plaquetas || "—"}</span></div>
                        <div>Na: <span className="text-indigo-800">{pre.laboratory?.na || "—"}</span></div>
                        <div>K: <span className="text-indigo-800">{pre.laboratory?.k || "—"}</span></div>
                        <div>Coag: <span className="text-indigo-800">{pre.laboratory?.coagulation || "—"}</span></div>
                      </div>
                    </div>

                    <div className="border-t border-zinc-100 pt-1.5">
                      <span className="text-zinc-400 block font-extrabold uppercase text-xs">Predição de Vias Aéreas</span>
                      <p className="text-zinc-600 font-semibold space-y-0.5">
                        <span className="block truncate">• Mallampati: <span className="font-extrabold text-indigo-700">Grau {pre.airwayEvaluation?.mallampati || "I"}</span></span>
                        <span className="block truncate">• Mobilidade Cervical: {pre.airwayEvaluation?.neckMobility || "Normal"}</span>
                        <span className="block truncate">• Estado Dentário: {pre.airwayEvaluation?.teethStatus || "Conservados"}</span>
                        <span className="block truncate">• Distância Tireomentoniana: {pre.airwayEvaluation?.tireomentonianaCm || "> 5 cm"}</span>
                        <span className="block truncate">
                          • Via Aérea Difícil: <span className={pre.airwayEvaluation?.predictDifficultAirway ? "text-rose-600 font-black" : "text-emerald-600 font-black"}>
                            {pre.airwayEvaluation?.predictDifficultAirway ? "SIM (ALERTA)" : "NÃO"}
                          </span>
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-zinc-200 pt-2 mt-2 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100">
                  <span className="text-zinc-500 block uppercase font-extrabold text-xs leading-none">Avaliação e Liberação</span>
                  <span className="font-black text-indigo-950 text-xs">
                    {pre.releasedForSurgery ? "LIBERADO PARA CIRURGIA" : "PENDENTE DE AVALIAÇÃO"}
                  </span>
                  {pre.releaseNotes && (
                    <p className="text-zinc-600 text-xs italic mt-0.5 leading-snug line-clamp-2 overflow-hidden max-h-[22px]">"{pre.releaseNotes}"</p>
                  )}
                </div>
              </div>

              {/* COL B: EVOLUÇÕES & ASSINATURA ELETRÔNICA HOMOLOGADA */}
              <div className="border border-zinc-200 rounded-lg p-3 bg-white flex flex-col justify-between overflow-y-auto">
                <div className="space-y-3">
                  <h3 className="font-black text-indigo-950 uppercase pb-1.5 border-b border-zinc-150 mb-1 tracking-tight text-xs flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span>2. Descrição Anestésica & Eventos</span>
                  </h3>

                  {/* NARRATIVA PRINCIPAL */}
                  <div className="text-xs leading-relaxed">
                    <span className="text-zinc-400 block font-extrabold uppercase text-xs mb-0.5">Descrição Técnica</span>
                    {doc.narrativeLaunches && doc.narrativeLaunches.length > 0 ? (
                      doc.narrativeLaunches.filter((l) => l.type === "Descrição Principal").slice(0, 1).map((l, idx) => (
                        <p key={idx} className="text-zinc-700 font-medium text-justify italic bg-zinc-50 p-2 rounded-lg border border-zinc-200/50 line-clamp-5 overflow-hidden max-h-[110px]">
                          "{l.text}"
                        </p>
                      ))
                    ) : (
                      <p className="text-zinc-400 italic bg-zinc-50 p-2 rounded-lg border border-zinc-200/50 line-clamp-5 overflow-hidden max-h-[110px]">
                        Nenhuma descrição técnica principal descrita no prontuário.
                      </p>
                    )}
                  </div>

                  {/* LINHA DO TEMPO CRONOLÓGICA DE EVENTOS */}
                  <div>
                    <span className="text-zinc-400 block font-extrabold uppercase text-xs mb-1">Evolução Cronológica</span>
                    <div className="max-h-[110px] overflow-y-auto space-y-1 tabular-nums text-xs text-zinc-600">
                      {doc.narrativeLaunches && doc.narrativeLaunches.length > 0 ? (
                        doc.narrativeLaunches.filter((l) => l.type !== "Descrição Principal").slice(0, 6).map((l, idx) => (
                          <div key={l.id || idx} className="flex gap-2 border-b border-zinc-100 pb-0.5 last:border-b-0">
                            <span className="text-indigo-800 font-black shrink-0">[{l.time}]</span>
                            <span className="font-medium truncate">{l.text}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-zinc-400 italic">Nenhum evento registrado.</div>
                      )}
                    </div>
                  </div>

                  {/* HISTÓRICO DE TROCAS DE RESPONSABILIDADE */}
                  {doc.transfers && doc.transfers.length > 0 && (
                    <div className="bg-amber-50/60 p-2 rounded-lg border border-amber-200 mt-2 text-xs">
                      <span className="text-amber-950 font-black uppercase text-xs block mb-0.5">
                        Troca de Responsabilidade (Handover)
                      </span>
                      {doc.transfers.map((t, idx) => (
                        <div key={t.id || idx} className="border-b border-amber-200/50 pb-0.5 last:border-b-0">
                          <span className="font-bold text-amber-900">
                            {t.outgoingName} ➔ {t.incomingName} (CRM {t.incomingCRM}/{t.incomingUF})
                          </span>
                          {t.clinicalConditions && <span className="text-zinc-600 block italic">Condições: {t.clinicalConditions}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ASSINATURA ELETRÔNICA HOMOLOGADA */}
                <div className="border-t border-zinc-200 pt-2.5 mt-3">
                  <span className="text-zinc-400 block uppercase font-extrabold text-xs mb-1">Assinatura Eletrônica e Hash SHA-256</span>
                  
                  {doc.status === "Signed" && doc.hash ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-center relative overflow-hidden">
                      {/* Approved Seal effect */}
                      <div className="absolute -right-2 -bottom-2 w-10 h-10 border-2 border-emerald-500/10 rounded-full flex items-center justify-center opacity-20 pointer-events-none">
                        <ShieldCheck className="w-8 h-8 text-emerald-500" />
                      </div>
                      <div className="flex items-center justify-center gap-1.5 text-emerald-700 font-black text-[9.5px]">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>ASSINATURA DIGITAL VALIDADA (SHA-256)</span>
                      </div>
                      <p className="font-black text-zinc-800 text-xs mt-1 leading-none uppercase">
                        {((doc.signedBy?.name || team.anesthesiologistLead || "Anestesiologista Responsável")).toUpperCase()}
                      </p>
                      <p className="text-xs text-zinc-600 tabular-nums font-bold mt-0.5 leading-none">
                        CRM {doc.signedBy?.crm || team.crmLead || "—"}-{doc.signedBy?.uf || team.ufLead || "—"}
                      </p>
                      {doc.signedAt && (
                        <p className="text-xs text-zinc-500 tabular-nums mt-0.5 leading-none">
                          HOMOLOGADO EM: {new Date(doc.signedAt).toLocaleString("pt-BR")}
                        </p>
                      )}
                      <p className="text-xs text-emerald-800 tabular-nums font-bold mt-1.5 break-all uppercase leading-tight bg-emerald-100/60 p-1 rounded border border-emerald-200/80">
                        HASH SHA-256: {doc.hash.toUpperCase()}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1 text-amber-700 font-black text-[9.5px]">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>PENDENTE DE ASSINATURA DIGITAL</span>
                      </div>
                      <p className="font-black text-zinc-800 text-xs mt-1 leading-none uppercase">
                        {(team.anesthesiologistLead || "Médico Anestesista").toUpperCase()}
                      </p>
                      <p className="text-xs text-zinc-500 tabular-nums font-bold mt-0.5 leading-none">
                        CRM {team.crmLead || "—"}-{team.ufLead || "—"}
                      </p>
                      <p className="text-xs text-amber-600 tabular-nums mt-1 uppercase font-bold leading-none">
                        DOCUMENTO EM RASCUNHO (AGUARDANDO ENCERRAMENTO)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* COL C: RECUPERAÇÃO PÓS-ANESTÉSICA (SRPA) */}
              <div className="border border-zinc-200 rounded-lg p-3 bg-zinc-50/30 flex flex-col justify-between overflow-y-auto">
                <div>
                  <h3 className="font-black text-indigo-950 uppercase pb-1.5 border-b border-zinc-150 mb-2 tracking-tight text-xs flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-emerald-600" />
                    <span>3. Recuperação Pós-Anestésica (SRPA)</span>
                  </h3>

                  <div className="space-y-2 text-xs leading-tight">
                    <div className="bg-white p-1.5 rounded-lg border border-zinc-200">
                      <span className="text-zinc-400 block font-extrabold uppercase text-xs">Dados da Admissão</span>
                      <span className="font-bold text-zinc-800 block">
                        Horário de Entrada: {recovery.admissionTime ? (
                          /^\d{4}-\d{2}-\d{2}T/.test(recovery.admissionTime) ? (
                            new Date(recovery.admissionTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
                          ) : recovery.admissionTime
                        ) : "—"}
                      </span>
                      <span className="text-zinc-500 block">Profissional Responsável: {recovery.admittingStaff || doc.team?.anesthesiologistLead || "—"}</span>
                      <p className="text-zinc-600 font-semibold mt-1.5 text-xs tabular-nums leading-normal">
                        PA Admissão: <span className="text-zinc-900 font-extrabold">{isRecordedNumber(baselinePas) || isRecordedNumber(baselinePad) ? `${displayBloodPressure(baselinePas, baselinePad)} mmHg` : UNREGISTERED}</span><br/>
                        FC Admissão: <span className="text-zinc-900 font-extrabold">{isRecordedNumber(baselineFc) ? displayVital(baselineFc, " bpm") : UNREGISTERED}</span><br/>
                        SpO₂ Admissão: <span className="text-zinc-900 font-extrabold">{isRecordedNumber(baselineSpo2) ? displayVital(baselineSpo2, "%") : UNREGISTERED}</span><br/>
                        Temp Admissão: <span className="text-zinc-900 font-extrabold">{displayTemperature(baselineTemp)}</span><br/>
                        Dor Admissão: <span className="text-zinc-900 font-extrabold">{recovery.painScale !== undefined ? `${recovery.painScale}/10` : "—"}</span>
                      </p>
                    </div>

                    {/* LIMITES DE ALERTA CALCULADOS (QMENTUM) */}
                    <div className="bg-indigo-50/50 p-1.5 rounded-lg border border-indigo-100">
                      <span className="text-indigo-950 block font-black uppercase text-xs mb-1">Limites de Alerta Calculados (QMentum)</span>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs font-bold text-zinc-700 tabular-nums">
                        <div>PAS: <span className="text-indigo-800 font-extrabold">{pasRange ? displayQmentumRange(pasRange) : UNREGISTERED}</span>{pasRange ? " mmHg" : ""}</div>
                        <div>PAD: <span className="text-indigo-800 font-extrabold">{padRange ? displayQmentumRange(padRange) : UNREGISTERED}</span>{padRange ? " mmHg" : ""}</div>
                        <div>FC: <span className="text-indigo-800 font-extrabold">{fcRange ? displayQmentumRange(fcRange) : UNREGISTERED}</span>{fcRange ? " bpm" : ""}</div>
                        <div>SpO₂: <span className="text-indigo-800 font-extrabold">≥ {minSpo2}%</span></div>
                        <div className="col-span-2">Temp: <span className="text-indigo-800 font-extrabold">{minTemp.toFixed(1)}°C - {maxTemp.toFixed(1)}°C</span></div>
                      </div>
                    </div>

                    <div className="bg-white p-1.5 rounded-lg border border-zinc-200">
                      <span className="text-zinc-400 block font-extrabold uppercase text-xs mb-1">Cálculo Índice Aldrete & Kroulik</span>
                      <div className="grid grid-cols-2 gap-y-0.5 gap-x-2 text-xs font-bold text-zinc-600">
                        <div>Atividade Motora:</div><div className="text-right text-indigo-700">{displayAldreteScore(recovery.scoreActivity)}</div>
                        <div>Respiração:</div><div className="text-right text-indigo-700">{displayAldreteScore(recovery.scoreRespiration)}</div>
                        <div>Circulação:</div><div className="text-right text-indigo-700">{displayAldreteScore(recovery.scoreCirculation)}</div>
                        <div>Nível Consciência:</div><div className="text-right text-indigo-700">{displayAldreteScore(recovery.scoreConsciousness)}</div>
                        <div>Saturação O₂:</div><div className="text-right text-indigo-700">{displayAldreteScore(recovery.scoreSaturation)}</div>
                      </div>
                      <div className="border-t border-zinc-200 mt-1 pt-1 flex justify-between font-black text-indigo-950 text-xs">
                        <span>SCORE ALDRETE TOTAL:</span>
                        <span className="text-indigo-800">
                          {displayAldreteTotal([
                            recovery.scoreActivity,
                            recovery.scoreRespiration,
                            recovery.scoreCirculation,
                            recovery.scoreConsciousness,
                            recovery.scoreSaturation,
                          ])}
                        </span>
                      </div>
                    </div>

                    {/* REGISTROS SERIADOS DA RECUPERAÇÃO */}
                    {recovery.records && recovery.records.length > 0 && (
                      <div className="bg-white p-1.5 rounded-lg border border-zinc-200">
                        <span className="text-zinc-400 block font-extrabold uppercase text-xs mb-1">Registros Seriados de Evolução (SRPA)</span>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-zinc-200 text-zinc-500 font-bold">
                                <th className="pb-0.5 font-extrabold">Min</th>
                                <th className="pb-0.5 font-extrabold text-center">PA</th>
                                <th className="pb-0.5 font-extrabold text-center">FC</th>
                                <th className="pb-0.5 font-extrabold text-center">Sat</th>
                                <th className="pb-0.5 font-extrabold text-center">Temp</th>
                                <th className="pb-0.5 font-extrabold text-center">Dor</th>
                                <th className="pb-0.5 font-extrabold text-right">Aldrete</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 text-zinc-700 font-bold tabular-nums">
                              {recovery.records.map((r: any, idx: number) => {
                                const aldLabel = displayAldreteTotal([
                                  r.aldreteActivity,
                                  r.aldreteRespiration,
                                  r.aldreteCirculation,
                                  r.aldreteConsciousness,
                                  r.aldreteOximetry,
                                ]);
                                return (
                                  <tr key={r.id || idx}>
                                    <td className="py-0.5">{r.minutesFromAdmission}'</td>
                                    <td className="py-0.5 text-center">{r.pas && r.pad ? `${r.pas}/${r.pad}` : "—"}</td>
                                    <td className="py-0.5 text-center">{r.fc ?? "—"}</td>
                                    <td className="py-0.5 text-center">{r.spo2 ? `${r.spo2}%` : "—"}</td>
                                    <td className="py-0.5 text-center">{r.temp ? `${r.temp}°C` : "—"}</td>
                                    <td className="py-0.5 text-center">{isRecordedNumber(r.painScale) ? `${r.painScale}/10` : "—"}</td>
                                    <td className="py-0.5 text-right font-black text-indigo-700">{aldLabel}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* ADENDOS RETIFICATÓRIOS SE HOUVER (EXIBIÇÃO SEPARADA E IMUTÁVEL) */}
                    {allAmendments && allAmendments.length > 0 && (
                      <div className="bg-amber-50/80 border border-amber-300 p-2 rounded-lg space-y-1.5 mt-2">
                        <div className="flex justify-between items-center border-b border-amber-200 pb-1">
                          <span className="text-amber-900 font-black uppercase text-xs tracking-wider flex items-center gap-1">
                            Adendos Retificatórios Oficiais (Subcoleção Imutável)
                          </span>
                          <span className="text-xs tabular-nums text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-bold">
                            {allAmendments.length} {allAmendments.length === 1 ? 'Adendo' : 'Adendos'}
                          </span>
                        </div>

                        {allAmendments.map((amd: any, idx: number) => (
                          <div key={amd.id || idx} className="text-xs text-zinc-800 border-t border-amber-200 first:border-t-0 pt-1.5 space-y-0.5">
                            <div className="flex justify-between items-center font-bold text-amber-950">
                              <span>Adendo #{idx + 1}: {amd.reason}</span>
                              <span className="tabular-nums text-xs text-zinc-500">
                                {new Date(amd.createdAt || amd.timestamp || Date.now()).toLocaleString("pt-BR")}
                              </span>
                            </div>
                            <p className="italic text-zinc-900 bg-white/80 p-1 rounded border border-amber-100 font-sans leading-snug">"{amd.text}"</p>
                            <div className="flex justify-between items-center text-xs text-zinc-500 tabular-nums pt-0.5">
                              <span>Profissional: {amd.authorName} (CRM {amd.authorCRM}{amd.authorUF ? `/${amd.authorUF}` : ''})</span>
                              {amd.createdByUid && <span>UID: {amd.createdByUid}</span>}
                            </div>
                            {amd.hash && (
                              <div className="text-[6.5px] tabular-nums text-indigo-900 bg-indigo-50/50 p-0.5 rounded border border-indigo-100 truncate">
                                HASH SHA-256 DO ADENDO: {amd.hash}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-zinc-200 pt-2 mt-2">
                  <span className="text-zinc-500 block uppercase font-extrabold text-xs leading-none">Alta SRPA & Transferência</span>
                  <span className="font-black text-indigo-950 text-[9.5px] block">{handover.dischargeCondition ? `CONDIÇÃO: ${handover.dischargeCondition.toUpperCase()}` : "ALTA AUTORIZADA"}</span>
                  <span className="text-zinc-600 block text-xs font-bold truncate">Destino: {handover.destination || "Quarto de Internação"}</span>
                  {handover.notes && (
                    <p className="text-zinc-500 text-xs italic mt-0.5 leading-snug line-clamp-2 overflow-hidden max-h-[22px]">"{handover.notes}"</p>
                  )}
                </div>
              </div>

            </div>

            {/* PAGE NUMBER FOOTER */}
            <div className="flex justify-between items-center border-t border-zinc-300 pt-2 mt-2 text-xs font-bold text-zinc-400 tabular-nums shrink-0 z-10">
              <span>SISTEMA DE SEGURANÇA INTEGRADA ANESTFLOW</span>
              <span className="text-zinc-500 font-extrabold tracking-tight uppercase">
                PACIENTE: {patient.fullName || "NÃO CADASTRADO"} • PRONTUÁRIO: {patient.recordNumber || patient.admissionNumber || "—"} • NASC: {formatDate(patient.birthDate)} ({patient.age || "—"} ANOS • {patient.gender === "M" ? "MASC" : "FEM"})
              </span>
              <span>PÁGINA 2 DE 2</span>
            </div>

          </div>

        </div>
      </main>

      {/* FOOTER */}
      <footer className="h-9 px-6 flex items-center justify-between bg-[#151719] text-xs font-bold text-zinc-500 tabular-nums border-t border-zinc-800 shrink-0">
        <span>SISTEMA DE PRONTUÁRIO DIGITAL ANESTFLOW • DESKTOP WYSIWYG</span>
        <span className="text-indigo-400">Padrão Digital Seguro em Conformidade com CFM</span>
      </footer>
    </div>
  );
}
