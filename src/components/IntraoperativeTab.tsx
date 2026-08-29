/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { DraggablePanel } from "./DraggablePanel";

import { AnesthesiaDocument, VitalRecord, BolusDrug, ContinuousInfusion, FluidRecord, OutputRecord, ClinicalEvent, VascularAccess, EquipmentConfig, InhalationAgent, AirwayDetails } from "../types";
import { Syringe, HandHelping, Zap, Info, Settings, FlaskConical, Play, Pause, Square, Plus, Minus, Check, RefreshCw, Layers, Droplets, Trash2, ShieldAlert, CheckCircle, Clock, AlertTriangle, Sliders, Bell, BellOff, Search, FileText, Wind, ChevronDown, ChevronUp, Activity, Edit2, ChevronLeft, ChevronRight, Smartphone } from "lucide-react";
import { FAVORITE_DRUGS, FAVORITE_FLUIDS, CLINICAL_EVENTS_PRESETS } from "../mockData";
import ClinicalChart from "./ClinicalChart";
import AnesthesiaDescriptionDrawer from "./AnesthesiaDescriptionDrawer";
import VitalsPanel from "./VitalsPanel";
import BolusDrugsPanel from "./BolusDrugsPanel";
import IntraoperativeDrugsPanel from "./IntraoperativeDrugsPanel";
import ContinuousInfusionsPanel from "./ContinuousInfusionsPanel";
import GasesPanel from "./GasesPanel";
import HydrationPanel from "./HydrationPanel";
import SupportPanel from "./SupportPanel";
import AnesthesiaTemplatesModal from "./AnesthesiaTemplatesModal";
import { AnesthesiaTemplate } from "../types";
import { combineDateAndTime, formatToLocalTime, getLocalDateStringNow, getLocalTimeStringNow, getTzParts } from "../utils/timezone";

interface IntraoperativeTabProps {
  document: AnesthesiaDocument;
  onUpdateDocument: (doc: Partial<AnesthesiaDocument>) => void;
  selectedMinutes: number | null;
  onTimeSelect: (mins: number | null) => void;
  theme?: "light" | "dark" | "dark-clean";
  pendingTemplateForReview?: AnesthesiaTemplate | null;
  onClearPendingTemplate?: () => void;
  startAiSupervisor?: (taskName: string, onTimeout: () => void) => void;
  stopAiSupervisor?: (reason: string) => void;
}

export default function IntraoperativeTab({
  document,
  onUpdateDocument,
  selectedMinutes,
  onTimeSelect,
  theme = "light",
  pendingTemplateForReview,
  onClearPendingTemplate,
  startAiSupervisor,
  stopAiSupervisor
}: IntraoperativeTabProps) {
  const { 
  vitals = [], 
  bolusDrugs = [], 
  continuousInfusions = [], 
  fluids = [], 
  outputs = [], 
  events = [], 
  timers, 
  patient, 
  inhalationAgents = [],
  technique = {} as any,
  equipmentConfig = {} as any,
  vascularAccesses = [],
  narrativeLaunches = []
} = document;

  const isDark = theme === "dark" || theme === "dark-clean";
  const cardClass = isDark
    ? "bg-[#1C1C1E]/90 backdrop-blur-md border-zinc-800/80 text-zinc-100 shadow-glass"
    : "bg-white/90 backdrop-blur-md border-zinc-200/60 text-zinc-900 shadow-glass";

  const textHeadingClass = isDark ? "text-zinc-100 font-semibold" : "text-slate-800 font-bold";
  const textMutedClass = isDark ? "text-zinc-400" : "text-slate-400 dark:text-zinc-500";
  const borderClass = isDark ? "border-zinc-800/80" : "border-slate-100";
  const selectClass = isDark ? "bg-zinc-800 border-zinc-700 text-white" : "bg-slate-100 dark:bg-zinc-900/80 border-slate-200 text-slate-800";
  const inputClass = isDark 
    ? "bg-[#000000] border-zinc-800 text-zinc-100 focus:border-indigo-500" 
    : "bg-white border-zinc-200 text-zinc-950 focus:border-indigo-500";

  // Active Keypad State
  const [activeVitalsInput, setActiveVitalsInput] = useState<{
    pas?: string;
    pad?: string;
    fc?: string;
    spo2?: string;
    etco2?: string;
    temp?: string;
    pai?: string;
    bis?: string;
  }>({});
  const [activeField, setActiveField] = useState<keyof typeof activeVitalsInput>("pas");
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);

  // Active panels below clinical chart (allows multiple open panels simultaneously)
  const [activeClinicalTabs, setActiveClinicalTabs] = useState<string[]>(["vitals"]);

  const CLINICAL_TABS = [
    { id: "support", label: "Suporte", icon: <HandHelping className="w-4 h-4" /> },
    { id: "vitals", label: "Vitais", icon: <Activity className="w-4 h-4" /> },
    { id: "drugs", label: "Fármacos", icon: <Syringe className="w-4 h-4" /> },
    { id: "infusions", label: "Bombas", icon: <Settings className="w-4 h-4" /> },
    { id: "gases", label: "Gases", icon: <Wind className="w-4 h-4" /> },
    { id: "hydration", label: "Líquidos", icon: <Droplets className="w-4 h-4" /> },
    { id: "events", label: "Eventos", icon: <FileText className="w-4 h-4" /> }
  ];

  const PANEL_LABELS: Record<string, { title: string; desc: string }> = {
    timers: { title: "Cronologia Intraoperatória", desc: "Controles de início/fim de anestesia e cirurgia" },
    chart: { title: "Gráfico de Sinais Vitais (Plotter)", desc: "Visualização gráfica de FC, PAS, PAD, SpO2, etc." },
    support: { title: "Suporte, Acessos e Técnica Anestésica", desc: "Registro de técnicas, vias aéreas, equipamentos e acessos vasculares" },
    infusions: { title: "Infusões Contínuas", desc: "Bombas de infusão e controle de drogas vasoativas" },
    gases: { title: "Gases Medicinais e Inalatórios", desc: "Fração inspirada de O2, Sevorane, Isoflorane, etc." },
    vitals: { title: "Teclado Numérico (Sinais Vitais)", desc: "Entrada rápida de dados vitais por minuto" },
    drugs: { title: "Fármacos em Bolus (Lançador Rápido)", desc: "Favoritos e botões de 1 e 2 toques" },
    events: { title: "Descrição e Eventos Clínicos", desc: "Anotações narrativas e intercorrências" },
  };

  const isInfusionsActive = continuousInfusions?.some(i => i.history?.length > 0 && i.history[i.history.length - 1].status !== 'Finalizado');
  const isGasesActive = inhalationAgents?.some(g => !g.endTime);

  const [manuallyExpanded, setManuallyExpanded] = useState<Record<string, boolean>>({});

  const getIsExpanded = (panelId: string) => {
    if (activeClinicalTabs.includes(panelId)) {
      return true;
    }
    if (manuallyExpanded[panelId] !== undefined) {
      return manuallyExpanded[panelId];
    }
    if (panelId === 'infusions' && isInfusionsActive) return true;
    if (panelId === 'gases' && isGasesActive) return true;
    if (panelId === 'timers' || panelId === 'chart') return true;
    return false;
  };

  const togglePanel = (panelId: string) => {
    setActiveClinicalTabs(prev => 
      prev.includes(panelId)
        ? prev.filter(id => id !== panelId)
        : [...prev, panelId]
    );
    setManuallyExpanded(prev => {
      const isCurrentlyExpanded = getIsExpanded(panelId);
      return { ...prev, [panelId]: !isCurrentlyExpanded };
    });
  };


  useEffect(() => {
    const handleExpandPanel = (e) => {
      const panelId = e.detail;
      setManuallyExpanded(prev => {
        if (!prev[panelId]) {
           return { ...prev, [panelId]: true };
        }
        return prev;
      });
    };
    window.addEventListener('expandPanel', handleExpandPanel);
    const handleOpenNarrativeDrawer = () => setIsNarrativeDrawerOpen(true);
    window.addEventListener('openNarrativeDrawer', handleOpenNarrativeDrawer);
    return () => {
      window.removeEventListener('expandPanel', handleExpandPanel);
      window.removeEventListener('openNarrativeDrawer', handleOpenNarrativeDrawer);
    };
  }, []);

  // States for editing drug summary lists and continuous infusions
  const [editingBolusDrugName, setEditingBolusDrugName] = useState<string | null>(null);
  const [editingBolusDrugsList, setEditingBolusDrugsList] = useState<BolusDrug[]>([]);
  const [editingInfusionId, setEditingInfusionId] = useState<string | null>(null);
  const [editingInfusionData, setEditingInfusionData] = useState<any>(null);

  // Continuous Infusion Preparation State
  const [newInfusion, setNewInfusion] = useState({
    name: "Remifentanil",
    concentration: "50 mcg/ml",
    diluent: "SF 0.9% 100ml",
    totalVolume: 100,
    rate: 0.1,
    unit: "mcg/kg/min" as any,
    startTimeMode: "now" as "now" | "custom",
    customStartTime: "",
    endTimeMode: "active" as "active" | "custom",
    customEndTime: "",
    ampoules: 1,
  });

  // Gases and Inhalation agent preparation state
  const [newAgent, setNewAgent] = useState({
    agent: "Sevoflurano" as "Sevoflurano" | "Desflurano" | "Isoflurano" | "Óxido Nitroso" | "Oxigênio (O₂)" | "Ar Comprimido",
    inspiredConc: 2.0,
    flowO2: 1.0,
    startTimeMode: "now" as "now" | "custom",
    customStartTime: "",
    endTimeMode: "active" as "active" | "custom",
    customEndTime: "",
  });

  // Fluids Preparation State
  const [newFluid, setNewFluid] = useState({
    name: "Soro Ringer com Lactato",
    type: "Cristaloide" as any,
    volume: 500
  });

  // Estimated loss & diurese input state
  const [outputVal, setOutputVal] = useState("");
  const [outputType, setOutputType] = useState<"Diurese" | "Perda Sanguínea Estimada">("Diurese");

  // Interval & fill alarm state
  const [loggingInterval, setLoggingInterval] = useState<number>(15);
  const [isCustomInterval, setIsCustomInterval] = useState<boolean>(false);
  const [customIntervalVal, setCustomIntervalVal] = useState<string>("8");
  const [nowTime, setNowTime] = useState<number>(Date.now());
  const [simulatedDelayMs, setSimulatedDelayMs] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);

  // States for the newly named "Lançador de Fármacos" filtering
  const [drugSearchQuery, setDrugSearchQuery] = useState("");
  const [selectedDrugCategory, setSelectedDrugCategory] = useState<string>("Todos");
  // Support panels state
  const [expandedSupportPanels, setExpandedSupportPanels] = useState<Record<string, boolean>>({});
  const [expandedMainPanels, setExpandedMainPanels] = useState<Record<string, boolean>>({});
  const [isDrugListExpanded, setIsDrugListExpanded] = useState<boolean>(false);
  
  // Drug editor modal state
  const [showDrugEditor, setShowDrugEditor] = useState(false);
  const [drugEditorMode, setDrugEditorMode] = useState<"create" | "edit">("create");
  const [drugEditorData, setDrugEditorData] = useState<Partial<typeof FAVORITE_DRUGS[number]>>({});


  // Templates modal state
  
  const [allAvailableDrugs, setAllAvailableDrugs] = useState<typeof FAVORITE_DRUGS[number][]>(() => {
    try {
      const local = localStorage.getItem("allCustomDrugs_v2");
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          // Merge missing properties from FAVORITE_DRUGS to support older saved states
          return parsed.map(savedDrug => {
            const defaultDrug = FAVORITE_DRUGS.find(d => d.name === savedDrug.name);
            if (defaultDrug) {
              return { 
                ...defaultDrug, 
                ...savedDrug, 
                ampouleAmount: savedDrug.ampouleAmount || defaultDrug.ampouleAmount 
              };
            }
            return savedDrug;
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [...FAVORITE_DRUGS];
  });

  // States for custom launching of drugs
  const [selectedDrug, setSelectedDrug] = useState<typeof FAVORITE_DRUGS[number]>(FAVORITE_DRUGS[0]);
  const [customDose, setCustomDose] = useState<string>(FAVORITE_DRUGS[0].defaultDose.toString());
  const [customAmpoules, setCustomAmpoules] = useState<string>("1");
  const [customRoute, setCustomRoute] = useState<string>(FAVORITE_DRUGS[0].defaultRoute);
  const [timeMode, setTimeMode] = useState<"now" | "custom">("now");
  const [customTime, setCustomTime] = useState<string>("");

  // States for custom launching of fluids
  const [fluidTimeMode, setFluidTimeMode] = useState<"now" | "custom">("now");
  const [customFluidTime, setCustomFluidTime] = useState<string>("");

  // State for side panel drawer
  const [isNarrativeDrawerOpen, setIsNarrativeDrawerOpen] = useState<boolean>(false);

  // Accordion cascade open/close state for input panels (left column)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    vitals: true,
    chronology: false,
    drugs: false,
    infusions: false,
    gases: false,
    support: false,
    hydration: false,
    description: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  useEffect(() => {
    if (selectedMinutes !== null && selectedMinutes !== undefined && timers.startAnesthesia) {
      const timestampMs = new Date(timers.startAnesthesia).getTime() + selectedMinutes * 60 * 1000;
      const d = new Date(timestampMs);
      const parts = getTzParts(d, "America/Sao_Paulo");
      const h = String(parts.hour).padStart(2, "0");
      const m = String(parts.minute).padStart(2, "0");
      setCustomTime(`${h}:${m}`);
      setTimeMode("custom");

      setCustomFluidTime(`${h}:${m}`);
      setFluidTimeMode("custom");
    }
  }, [selectedMinutes, timers.startAnesthesia]);

  useEffect(() => {
    const ticker = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  // Timer Click Helpers
  const handleTimerClick = (key: keyof typeof timers, label: string) => {
    const confirmed = window.confirm(`Deseja registrar o horário de: "${label}" como o horário atual?`);
    if (!confirmed) return;

    const updatedTimers = { ...timers, [key]: new Date().toISOString() };
    
    // Add a corresponding clinical event
    const newEvent: ClinicalEvent = {
      id: `ev-timer-${Date.now()}`,
      name: label,
      timestamp: new Date().toISOString(),
      category: "Marcador Temporal",
      
    };

    onUpdateDocument({
      timers: updatedTimers,
      events: [...events, newEvent]
    });
  };

  const getTimeString = (isoString?: string) => {
    if (!isoString) return "";
    try {
      return formatToLocalTime(isoString, "America/Sao_Paulo");
    } catch (e) {
      return "";
    }
  };

const handleUpdateTimerValue = (key: keyof typeof timers, label: string, timeString: string) => {
    if (!timeString) {
      const updatedTimers = { ...timers };
      delete updatedTimers[key];
      const filteredEvents = events.filter(e => e.name !== label);
      onUpdateDocument({
        timers: updatedTimers,
        events: filteredEvents
      });
      return;
    }

    const patientDate = document.patient?.date || getLocalDateStringNow("America/Sao_Paulo");
    const isoString = combineDateAndTime(patientDate, timeString, "America/Sao_Paulo");
    const updatedTimers = { ...timers, [key]: isoString };

    // Ensure absolutely no duplicate event exists for this marker
    const updatedEvents = events.filter(e => e.name !== label);
    updatedEvents.push({
      id: `ev-timer-${key}-${Date.now()}`,
      name: label,
      timestamp: isoString,
      category: "Marcador Temporal",
      
    });

    onUpdateDocument({
      timers: updatedTimers,
      events: updatedEvents
    });
  };

  // Vitals Keypad Input Handler
  const handleKeyPress = (num: string) => {
    setActiveVitalsInput(prev => ({
      ...prev,
      [activeField]: (prev[activeField] || "") + num
    }));
  };

  const handleKeyBackspace = () => {
    setActiveVitalsInput(prev => ({
      ...prev,
      [activeField]: (prev[activeField] || "").slice(0, -1)
    }));
  };

  const handleKeyClear = () => {
    setActiveVitalsInput(prev => ({
      ...prev,
      [activeField]: ""
    }));
  };

  // Register Quick Vitals State
  const handleRegisterVitals = () => {
    const mins = selectedMinutes !== null ? selectedMinutes : 
      (timers.startAnesthesia ? Math.round((Date.now() - new Date(timers.startAnesthesia).getTime()) / 60000) : 0);

    const existingIndex = vitals.findIndex(v => v.minutesFromStart === mins);

    const newRecord: VitalRecord = {
      id: existingIndex >= 0 ? vitals[existingIndex].id : `v-${Date.now()}`,
      timestamp: timers.startAnesthesia ? new Date(new Date(timers.startAnesthesia).getTime() + mins * 60 * 1000).toISOString() : new Date().toISOString(),
      minutesFromStart: mins,
      pas: activeVitalsInput.pas ? parseInt(activeVitalsInput.pas) : (existingIndex >= 0 ? vitals[existingIndex].pas : undefined),
      pad: activeVitalsInput.pad ? parseInt(activeVitalsInput.pad) : (existingIndex >= 0 ? vitals[existingIndex].pad : undefined),
      fc: activeVitalsInput.fc ? parseInt(activeVitalsInput.fc) : (existingIndex >= 0 ? vitals[existingIndex].fc : undefined),
      spo2: activeVitalsInput.spo2 ? parseInt(activeVitalsInput.spo2) : (existingIndex >= 0 ? vitals[existingIndex].spo2 : undefined),
      etco2: activeVitalsInput.etco2 ? parseInt(activeVitalsInput.etco2) : (existingIndex >= 0 ? vitals[existingIndex].etco2 : undefined),
      temp: activeVitalsInput.temp ? parseFloat(activeVitalsInput.temp) : (existingIndex >= 0 ? vitals[existingIndex].temp : undefined),
      pai: activeVitalsInput.pai ? parseInt(activeVitalsInput.pai) : (existingIndex >= 0 ? vitals[existingIndex].pai : undefined),
      bis: activeVitalsInput.bis ? parseInt(activeVitalsInput.bis) : (existingIndex >= 0 ? vitals[existingIndex].bis : undefined),
    };

    // Auto-calculate PAM
    if (newRecord.pas !== undefined && newRecord.pad !== undefined) {
      newRecord.pam = Math.round(newRecord.pad + (newRecord.pas - newRecord.pad) / 3);
    }

    let updatedVitals = [...vitals];
    if (existingIndex >= 0) {
      updatedVitals[existingIndex] = { ...updatedVitals[existingIndex], ...newRecord };
    } else {
      updatedVitals.push(newRecord);
    }

    onUpdateDocument({ vitals: updatedVitals });
    setSimulatedDelayMs(0); // Reset simulated delay when vitals are saved
    
    // Reset Keypad fields, set active to default
    setActiveVitalsInput({});
    setActiveField("pas");
    onTimeSelect(null); // snap out of interactive selection
  };

  const repeatLastVitals = () => {
    if (vitals.length === 0) return;
    const sorted = [...vitals].sort((a, b) => b.minutesFromStart - a.minutesFromStart);
    
    const latestValues: Record<string, string> = {};
    const params = ["pas", "pad", "fc", "spo2", "etco2", "temp", "pai", "bis"];
    
    params.forEach(param => {
      const found = sorted.find(v => v[param as keyof typeof v] !== undefined && v[param as keyof typeof v] !== null);
      if (found) {
        latestValues[param] = found[param as keyof typeof found]?.toString() || "";
      }
    });

    setActiveVitalsInput({
      pas: latestValues.pas || "",
      pad: latestValues.pad || "",
      fc: latestValues.fc || "",
      spo2: latestValues.spo2 || "",
      etco2: latestValues.etco2 || "",
      temp: latestValues.temp || "",
      pai: latestValues.pai || "",
      bis: latestValues.bis || "",
    });
  };

  // Presets and Drug deliver handlers
  const handleSelectDrugForLaunch = (drug: typeof FAVORITE_DRUGS[number]) => {
    setSelectedDrug(drug);
    setCustomDose(drug.defaultDose.toString());
    setCustomRoute(drug.defaultRoute);
    setCustomAmpoules("1");
  };

  const handleSaveDrug = () => {
    if (!selectedDrug.name) return;
    
    const newSavedDrug = {
      name: selectedDrug.name,
      defaultDose: parseFloat(customDose) || selectedDrug.defaultDose || 0,
      defaultUnit: selectedDrug.defaultUnit || "mg",
      defaultRoute: customRoute as any || "EV",
      category: selectedDrug.category || "Outros",
    };

    const existingIdx = allAvailableDrugs.findIndex(d => d.name === selectedDrug.name);
    let newDrugs = [...allAvailableDrugs];
    
    if (existingIdx >= 0) {
      newDrugs[existingIdx] = newSavedDrug;
    } else {
      newDrugs.push(newSavedDrug);
    }
    
    setAllAvailableDrugs(newDrugs);
    try {
      localStorage.setItem("allCustomDrugs_v2", JSON.stringify(newDrugs));
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfirmLaunch = () => {
    const parsedDose = parseFloat(customDose) || selectedDrug.defaultDose;

    let timestamp: string;
    let mins: number;

    if (timeMode === "now") {
      timestamp = new Date().toISOString();
      mins = timers.startAnesthesia ? Math.round((Date.now() - new Date(timers.startAnesthesia).getTime()) / 60000) : 0;
    } else {
      const patientDate = document.patient?.date || getLocalDateStringNow("America/Sao_Paulo");
      const timeStr = customTime || "00:00";
      // Construct UTC-based ISO String as used throughout the app
      const isoString = combineDateAndTime(patientDate, timeStr, "America/Sao_Paulo");
      timestamp = isoString;
      
      const targetTimeMs = new Date(isoString).getTime();
      const startTimeMs = timers.startAnesthesia ? new Date(timers.startAnesthesia).getTime() : targetTimeMs;
      mins = Math.round((targetTimeMs - startTimeMs) / 60000);
    }

    const parsedAmpoules = parseFloat(customAmpoules) || undefined;

    const newBolus: BolusDrug = {
      id: `bd-${Date.now()}`,
      name: selectedDrug.name,
      dose: parsedDose,
      ampouleTotal: (selectedDrug as any).ampouleAmount,
      ampoules: parsedAmpoules,
      unit: selectedDrug.defaultUnit as any,
      route: customRoute as any,
      timestamp,
      minutesFromStart: mins,
      
    };

    // Create a clinical event for visual plotting
    const newEvent: ClinicalEvent = {
      id: `ev-drug-${Date.now()}`,
      name: `Bolus: ${selectedDrug.name} ${parsedDose}${selectedDrug.defaultUnit}${parsedAmpoules ? ` (${parsedAmpoules} amp)` : ''}`,
      timestamp,
      category: "Procedimento" as any,
      
    };

    onUpdateDocument({
      bolusDrugs: [...bolusDrugs, newBolus],
      events: [...events, newEvent]
    });
  };

  // Continuous Infusion management
  const handleStartInfusion = () => {
    if (continuousInfusions.some(i => i.name === newInfusion.name)) {
      return;
    }
    let startTimestamp: string;
    let startMins: number;

    if (newInfusion.startTimeMode === "now") {
      startTimestamp = new Date().toISOString();
      startMins = timers.startAnesthesia ? Math.round((Date.now() - new Date(timers.startAnesthesia).getTime()) / 60000) : 0;
    } else {
      const patientDate = document.patient?.date || getLocalDateStringNow("America/Sao_Paulo");
      const timeStr = newInfusion.customStartTime || "00:00";
      const isoString = combineDateAndTime(patientDate, timeStr, "America/Sao_Paulo");
      startTimestamp = isoString;
      
      const targetTimeMs = new Date(isoString).getTime();
      const startTimeMs = timers.startAnesthesia ? new Date(timers.startAnesthesia).getTime() : targetTimeMs;
      startMins = Math.round((targetTimeMs - startTimeMs) / 60000);
    }

    const history: any[] = [
      {
        timestamp: startTimestamp,
        minutesFromStart: startMins,
        rate: newInfusion.rate,
        status: "Iniciado"
      }
    ];

    if (newInfusion.endTimeMode === "custom" && newInfusion.customEndTime) {
      const patientDate = document.patient?.date || getLocalDateStringNow("America/Sao_Paulo");
      const timeStr = newInfusion.customEndTime || "00:00";
      const isoString = combineDateAndTime(patientDate, timeStr, "America/Sao_Paulo");
      
      const targetTimeMs = new Date(isoString).getTime();
      const startTimeMs = timers.startAnesthesia ? new Date(timers.startAnesthesia).getTime() : targetTimeMs;
      const endMins = Math.round((targetTimeMs - startTimeMs) / 60000);

      history.push({
        timestamp: isoString,
        minutesFromStart: endMins,
        rate: 0,
        status: "Finalizado"
      });
    }

    const uniqueSuffix = () => Math.random().toString(36).substring(2, 7);

    const newInf: ContinuousInfusion = {
      id: `ci-${Date.now()}-${uniqueSuffix()}`,
      name: newInfusion.name,
      concentration: newInfusion.concentration,
      diluent: newInfusion.diluent,
      totalVolumePrepared: newInfusion.totalVolume,
      unit: newInfusion.unit,
      ampoules: (newInfusion as any).ampoules || 1,
      history
    };

    const newEvent: ClinicalEvent = {
      id: `ev-inf-${Date.now()}-${uniqueSuffix()}`,
      name: `Bomba: ${newInfusion.name} iniciada em ${newInfusion.rate} ${newInfusion.unit}`,
      timestamp: startTimestamp,
      category: "Procedimento" as any,
      
    };

    const updatedEvents = [...events, newEvent];
    if (newInfusion.endTimeMode === "custom" && newInfusion.customEndTime) {
      const endPatientDate = document.patient?.date || getLocalDateStringNow("America/Sao_Paulo");
      const endIso = combineDateAndTime(endPatientDate, newInfusion.customEndTime, "America/Sao_Paulo");
      updatedEvents.push({
        id: `ev-inf-end-${Date.now()}-${uniqueSuffix()}`,
        name: `Bomba: ${newInfusion.name} finalizada`,
        timestamp: endIso,
        category: "Procedimento" as any,
        
      });
    }

    onUpdateDocument({
      continuousInfusions: [...continuousInfusions, newInf],
      events: updatedEvents
    });

    // Reset continuous infusion preparation form
    setNewInfusion({
      name: "Remifentanil",
      concentration: "50 mcg/ml",
      diluent: "SF 0.9% 100ml",
      totalVolume: 100,
      rate: 0.1,
      unit: "mcg/kg/min",
      startTimeMode: "now",
      customStartTime: "",
      endTimeMode: "active",
      customEndTime: ""
    });
  };

  const handleRemoveInfusion = (id: string) => {
    onUpdateDocument({
      continuousInfusions: continuousInfusions.filter(inf => inf.id !== id)
    });
  };

  const handleRemoveBolusDrugByName = (name: string) => {
    onUpdateDocument({
      bolusDrugs: bolusDrugs.filter(d => d.name !== name)
    });
  };

  const handleUpdateInfusionStatus = (id: string, status: "Alterado" | "Pausado" | "Finalizado", newRate?: number) => {
    const mins = timers.startAnesthesia ? Math.round((Date.now() - new Date(timers.startAnesthesia).getTime()) / 60000) : 0;
    
    const updated = continuousInfusions.map(inf => {
      if (inf.id === id) {
        const rateToLog = newRate !== undefined ? newRate : (inf.history[inf.history.length - 1]?.rate || 0);
        return {
          ...inf,
          history: [
            ...inf.history,
            {
              timestamp: new Date().toISOString(),
              minutesFromStart: mins,
              rate: status === "Pausado" || status === "Finalizado" ? 0 : rateToLog,
              status
            }
          ]
        };
      }
      return inf;
    });

    onUpdateDocument({ continuousInfusions: updated });
  };

  const handleUpdateInfusion = (id: string, updates: Partial<ContinuousInfusion>) => {
    let modifiedUpdates = { ...updates };
    if (modifiedUpdates.history) {
      modifiedUpdates.history = modifiedUpdates.history.map(h => {
        const mins = timers.startAnesthesia ? Math.round((new Date(h.timestamp).getTime() - new Date(timers.startAnesthesia).getTime()) / 60000) : 0;
        return { ...h, minutesFromStart: mins };
      });
    }
    const updated = continuousInfusions.map(inf => {
      if (inf.id === id) {
        return { ...inf, ...modifiedUpdates };
      }
      return inf;
    });
    onUpdateDocument({ continuousInfusions: updated });
  };

  // Gases and Inhalation agent management
  const handleStartInhalationAgent = () => {
    if ((document.inhalationAgents || []).some(ia => ia.agent === newAgent.agent)) {
      return;
    }
    let startTimestamp: string;
    let startMins: number;

    if (newAgent.startTimeMode === "now") {
      startTimestamp = new Date().toISOString();
      startMins = timers.startAnesthesia ? Math.round((Date.now() - new Date(timers.startAnesthesia).getTime()) / 60000) : 0;
    } else {
      const patientDate = document.patient?.date || getLocalDateStringNow("America/Sao_Paulo");
      const timeStr = newAgent.customStartTime || "00:00";
      const isoString = combineDateAndTime(patientDate, timeStr, "America/Sao_Paulo");
      startTimestamp = isoString;
      
      const targetTimeMs = new Date(isoString).getTime();
      const startTimeMs = timers.startAnesthesia ? new Date(timers.startAnesthesia).getTime() : targetTimeMs;
      startMins = Math.round((targetTimeMs - startTimeMs) / 60000);
    }

    let endTimestamp: string | undefined = undefined;
    if (newAgent.endTimeMode === "custom" && newAgent.customEndTime) {
      const patientDate = document.patient?.date || getLocalDateStringNow("America/Sao_Paulo");
      const timeStr = newAgent.customEndTime || "00:00";
      endTimestamp = combineDateAndTime(patientDate, timeStr, "America/Sao_Paulo");
    }

    const uniqueSuffix = () => Math.random().toString(36).substring(2, 7);

    const isO2 = newAgent.agent === "Oxigênio (O₂)";
    const isAir = newAgent.agent === "Ar Comprimido";
    const isGas = isO2 || isAir;

    const newInh: InhalationAgent = {
      id: `ia-${Date.now()}-${uniqueSuffix()}`,
      agent: newAgent.agent,
      inspiredConc: isGas ? undefined : newAgent.inspiredConc,
      flowO2: isGas ? newAgent.flowO2 : undefined,
      startTime: startTimestamp,
      endTime: endTimestamp
    };

    // Format numbers according to Brazilian locale
    const flowO2Str = isGas ? newAgent.flowO2.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "";
    const concStr = isGas ? "" : newAgent.inspiredConc.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    const newEventName = isO2
      ? `O₂ ${flowO2Str} L/min`
      : isAir
        ? `Ar Comprimido ${flowO2Str} L/min`
        : `${newAgent.agent} ${concStr}%`;

    const newEvent: ClinicalEvent = {
      id: `ev-inh-${Date.now()}-${uniqueSuffix()}`,
      name: newEventName,
      timestamp: startTimestamp,
      category: "Procedimento" as any,
      
    };

    const updatedEvents = [...events, newEvent];
    if (endTimestamp) {
      const stopEventName = isO2
        ? `O₂ finalizado`
        : `${newAgent.agent} finalizado`;

      updatedEvents.push({
        id: `ev-inh-end-${Date.now()}-${uniqueSuffix()}`,
        name: stopEventName,
        timestamp: endTimestamp,
        category: "Procedimento" as any,
        
      });
    }

    onUpdateDocument({
      inhalationAgents: [...(document.inhalationAgents || []), newInh],
      events: updatedEvents
    });

    // Reset inhalation agents state
    setNewAgent({
      agent: "Sevoflurano",
      inspiredConc: 2.0,
      flowO2: 1.0,
      startTimeMode: "now",
      customStartTime: "",
      endTimeMode: "active",
      customEndTime: ""
    });
  };

  const handleRemoveInhalationAgent = (id: string) => {
    onUpdateDocument({
      inhalationAgents: (document.inhalationAgents || []).filter(ia => ia.id !== id)
    });
  };

  const handleStopInhalationAgent = (id: string) => {
    const updated = (document.inhalationAgents || []).map(ia => {
      if (ia.id === id) {
        return {
          ...ia,
          endTime: new Date().toISOString()
        };
      }
      return ia;
    });

    const targetInh = (document.inhalationAgents || []).find(ia => ia.id === id);
    const isO2 = targetInh?.agent === "Oxigênio (O₂)";
    const agentName = targetInh?.agent ? (isO2 ? "O₂" : targetInh.agent) : "Gases Medicinais";
    const stopEvent: ClinicalEvent = {
      id: `ev-inh-end-${Date.now()}`,
      name: `${agentName} finalizado`,
      timestamp: new Date().toISOString(),
      category: "Procedimento" as any,
      
    };

    onUpdateDocument({
      inhalationAgents: updated,
      events: [...events, stopEvent]
    });
  };

  const handleUpdateInhalationAgent = (id: string, updates: Partial<InhalationAgent>) => {
    const updated = (document.inhalationAgents || []).map(ia => {
      if (ia.id === id) {
        return {
          ...ia,
          ...updates
        };
      }
      return ia;
    });

    const targetInh = (document.inhalationAgents || []).find(ia => ia.id === id);
    let eventName = "Gás/Anestésico ajustado";
    if (targetInh) {
      const isO2 = targetInh.agent === "Oxigênio (O₂)";
      const isAir = targetInh.agent === "Ar Comprimido";
      const isGas = isO2 || isAir;
      const flow = updates.flowO2 !== undefined ? updates.flowO2 : targetInh.flowO2;
      const conc = updates.inspiredConc !== undefined ? updates.inspiredConc : targetInh.inspiredConc;
      const flowO2Str = isGas && flow !== undefined ? flow.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "";
      const concStr = !isGas && conc !== undefined ? conc.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "";
      eventName = isO2
        ? `O₂ ajustado para ${flowO2Str} L/min`
        : isAir
          ? `Ar Comprimido ${flowO2Str} L/min`
          : `${targetInh.agent} ajustado para ${concStr}%`;
    }

    // Only add an event if it's a dose/flow update (not just time edit)
    const isTimeEdit = ('startTime' in updates) || ('endTime' in updates);
    let evts = document.events || [];
    
    if (!isTimeEdit && targetInh && (updates.flowO2 !== undefined || updates.inspiredConc !== undefined)) {
      const newEvent = {
        id: `ev-inh-adj-${Date.now()}`,
        name: eventName,
        timestamp: new Date().toISOString(),
        category: "Procedimento" as any,
      };
      evts = [...evts, newEvent];
    }

    onUpdateDocument({
      inhalationAgents: updated,
      events: evts
    });
  };

  
  // --- RECONSTRUCTED MISSING CODE ---
  const activeInterval = 5;
  const lastVital = document.vitals && document.vitals.length > 0 ? document.vitals[document.vitals.length - 1] : null;
  const lastVitalTime = lastVital ? new Date(lastVital.timestamp).getTime() : (timers.startAnesthesia ? new Date(timers.startAnesthesia).getTime() : Date.now());
  const elapsedMs = Date.now() - lastVitalTime;
  const elapsedMins = elapsedMs / 60000;
  const isOverdue = elapsedMins >= activeInterval;
  const percent = Math.min(100, (elapsedMins / activeInterval) * 100);
  const nextVitalTime = new Date(lastVitalTime + activeInterval * 60000);
  const timeString = nextVitalTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const totalInflow = (fluids || []).reduce((acc: number, f: any) => acc + (f.volume || 0), 0);
  const totalOutflow = (outputs || []).reduce((acc: number, o: any) => acc + (o.volume || 0), 0);
  const netBalance = totalInflow - totalOutflow;

  const handleAddFluid = () => {
    let fluidTimestamp: string;
    if (fluidTimeMode === "now") {
      fluidTimestamp = new Date().toISOString();
    } else {
      const patientDate = document.patient?.date || getLocalDateStringNow("America/Sao_Paulo");
      fluidTimestamp = combineDateAndTime(patientDate, customFluidTime || "00:00", "America/Sao_Paulo");
    }
    const fluidObj: any = {
      id: `fl-${Date.now()}`,
      name: newFluid.name,
      volume: newFluid.volume,
      type: "Solução",
      timestamp: fluidTimestamp
    };
    onUpdateDocument({
      fluids: [...(document.fluids || []), fluidObj],
      events: [...(document.events || []), {
        id: `ev-fluid-${Date.now()}`,
        name: `Infundido: ${fluidObj.name} ${fluidObj.volume}ml`,
        timestamp: fluidTimestamp,
        category: "Procedimento" as any
      }]
    });
    setNewFluid(prev => ({ ...prev, volume: 500 }));
  };

  const handleRemoveFluid = (id: string) => {
    onUpdateDocument({ fluids: (document.fluids || []).filter((f: any) => f.id !== id) });
  };

  const handleAddOutput = () => {
    const vol = parseInt(outputVal);
    if (isNaN(vol) || vol <= 0) return;
    
    let outTimestamp: string;
    if (fluidTimeMode === "now") {
      outTimestamp = new Date().toISOString();
    } else {
      const patientDate = document.patient?.date || getLocalDateStringNow("America/Sao_Paulo");
      outTimestamp = combineDateAndTime(patientDate, customFluidTime || "00:00", "America/Sao_Paulo");
    }
    
    const outObj: any = {
      id: `out-${Date.now()}`,
      type: outputType,
      volume: vol,
      timestamp: outTimestamp
    };
    
    onUpdateDocument({
      outputs: [...(document.outputs || []), outObj],
      events: [...(document.events || []), {
        id: `ev-out-${Date.now()}`,
        name: `Saída: ${outObj.type} ${outObj.volume}ml`,
        timestamp: outTimestamp,
        category: "Procedimento" as any
      }]
    });
    setOutputVal("");
  };

  const handleRemoveOutput = (id: string) => {
    onUpdateDocument({ outputs: (document.outputs || []).filter((o: any) => o.id !== id) });
  };

  const getSelectedTechnique = () => {
    const tech: any = document.technique || {};
    if (tech.combinedSpinalEpidural) return "combinedSpinalEpidural";
    if (tech.balanced) return "balanced";
    if (tech.generalIV) return "generalIV";
    if (tech.generalInhalational) return "generalInhalational";
    if (tech.sedation) return "sedation";
    if (tech.local) return "local";
    if (tech.spinal) return "spinal";
    if (tech.epidural) return "epidural";
    if (tech.regionalPeripheralBlock) return "regionalPeripheralBlock";
    return "";
  };

  const handleTechniqueChange = (value: string) => {
    let newTech: any = {
      balanced: false,
      generalIV: false,
      generalInhalational: false,
      sedation: false,
      local: false,
      spinal: false,
      epidural: false,
      regionalPeripheralBlock: false,
      combinedSpinalEpidural: false,
      other: ""
    };
    if (value === "balanced") newTech.balanced = true;
    else if (value === "generalIV") newTech.generalIV = true;
    else if (value === "generalInhalational") newTech.generalInhalational = true;
    else if (value === "sedation") newTech.sedation = true;
    else if (value === "local") newTech.local = true;
    else if (value === "spinal") newTech.spinal = true;
    else if (value === "epidural") newTech.epidural = true;
    else if (value === "regionalPeripheralBlock") newTech.regionalPeripheralBlock = true;
    else if (value === "combinedSpinalEpidural") newTech.combinedSpinalEpidural = true;
    else if (value === "Geral Balanceada") newTech.balanced = true;
    else if (value === "Geral Venosa") newTech.generalIV = true;
    else if (value === "Geral Inalatória") newTech.generalInhalational = true;
    else if (value === "Sedação") newTech.sedation = true;
    else if (value === "Local") newTech.local = true;
    else if (value === "Raquianestesia") newTech.spinal = true;
    else if (value === "Peridural") newTech.epidural = true;
    else if (value === "Bloqueio Regional de Plexo/Nervo") newTech.regionalPeripheralBlock = true;
    else if (value === "Outra") newTech.other = "Outra";
    
    onUpdateDocument({ technique: newTech });
  };

  const [currentPeripheralCount, setCurrentPeripheralCount] = useState(1);
  const [currentPeripheralSite, setCurrentPeripheralSite] = useState("Membro Superior Direito");
  const [currentPeripheralGauge, setCurrentPeripheralGauge] = useState("20G");
  const [currentCentralSite, setCurrentCentralSite] = useState("Veia Jugular Interna Direita");
  const [currentHasIncidents, setCurrentHasIncidents] = useState(false);
  const [currentIncidentsText, setCurrentIncidentsText] = useState("");

  const handleApplyTemplate = (template: any) => {
    const now = Date.now();
    const baseTimeMs = timers.startAnesthesia ? new Date(timers.startAnesthesia).getTime() : now;
    
    // Arrays to hold the new items
    const newBolus: BolusDrug[] = [];
    const newContinuous: ContinuousInfusion[] = [];
    const newInh: InhalationAgent[] = [];
    const newClinicalEvents: ClinicalEvent[] = [];
    const newFluids: any[] = [];
    const newAccesses: any[] = [];
    const newBlocks: any[] = [];
    
    let updatedAirway = document.airway;

    const uniqueSuffix = () => Math.random().toString(36).substring(2, 7);

    // 1. Bolus Drugs
    if (template.bolusDrugs && template.bolusDrugs.length > 0) {
      template.bolusDrugs.forEach((b: any, idx: number) => {
        const offset = b.timeOffset || 0;
        const timeMs = baseTimeMs + (offset * 60000);
        const timestamp = new Date(timeMs).toISOString();
        const mins = timers.startAnesthesia ? Math.round((timeMs - baseTimeMs) / 60000) : 0;
        
        newBolus.push({
          id: `bd-${now}-${idx}-${uniqueSuffix()}`,
          name: b.name,
          dose: parseFloat(b.dose) || 0,
          unit: (b.unit as any) || "mg",
          route: (b.route as any) || "EV",
          timestamp,
          minutesFromStart: mins
        });
        
        newClinicalEvents.push({
          id: `ev-drug-${now}-${idx}-${uniqueSuffix()}`,
          name: `Bolus: ${b.name} ${b.dose}${b.unit}`,
          timestamp,
          category: "Procedimento" as any
        });
      });
    }

    // 2. Continuous Infusions
    if (template.continuousInfusions && template.continuousInfusions.length > 0) {
      template.continuousInfusions.forEach((c: any, idx: number) => {
        const offset = c.timeOffset || 0;
        const timeMs = baseTimeMs + (offset * 60000);
        const timestamp = new Date(timeMs).toISOString();
        const mins = timers.startAnesthesia ? Math.round((timeMs - baseTimeMs) / 60000) : 0;
        
        const rateVal = parseFloat(c.rate) || 0;
        const hist = [{
          timestamp,
          minutesFromStart: mins,
          rate: rateVal,
          status: "Iniciado" as const
        }];
        
        newContinuous.push({
          id: `ci-${now}-${idx}-${uniqueSuffix()}`,
          name: c.name,
          concentration: c.concentration || "N/A",
          diluent: c.diluent || "N/A",
          totalVolumePrepared: c.totalVolumePrepared || 50,
          unit: (c.rateUnit as any) || "mcg/kg/min",
          ampoules: 1,
          history: hist
        });
        
        newClinicalEvents.push({
          id: `ev-inf-${now}-${idx}-${uniqueSuffix()}`,
          name: `Bomba: ${c.name} iniciada em ${rateVal} ${c.rateUnit || ""}`,
          timestamp,
          category: "Procedimento" as any
        });
      });
    }

    // 3. Inhalation Agents
    if (template.inhalationAgents && template.inhalationAgents.length > 0) {
      template.inhalationAgents.forEach((ia: any, idx: number) => {
        const offset = ia.timeOffset || 0;
        const timeMs = baseTimeMs + (offset * 60000);
        const timestamp = new Date(timeMs).toISOString();
        
        const isO2 = ia.name === "Oxigênio (O₂)";
        const isAir = ia.name === "Ar Comprimido";
        const isGas = isO2 || isAir;
        
        newInh.push({
          id: `ia-${now}-${idx}-${uniqueSuffix()}`,
          agent: ia.name,
          inspiredConc: ia.inspiredConc !== undefined ? ia.inspiredConc : (isGas ? undefined : 2.0),
          flowO2: ia.flowO2 !== undefined ? ia.flowO2 : (isGas ? 2.0 : undefined),
          startTime: timestamp
        });
        
        const conc = ia.inspiredConc !== undefined ? ia.inspiredConc : (isGas ? undefined : 2.0);
        const flow = ia.flowO2 !== undefined ? ia.flowO2 : (isGas ? 2.0 : undefined);
        let eventName = isO2 ? `O₂ iniciado em ${flow} L/min` : isAir ? `Ar Comprimido ${flow} L/min` : `${ia.name} iniciado (${conc}%)`;
        
        newClinicalEvents.push({
          id: `ev-inh-${now}-${idx}-${uniqueSuffix()}`,
          name: eventName,
          timestamp,
          category: "Procedimento" as any
        });
      });
    }

    // 4. Clinical Events
    if (template.events && template.events.length > 0) {
      template.events.forEach((ev: any, idx: number) => {
        const offset = ev.timeOffset || 0;
        const timeMs = baseTimeMs + (offset * 60000);
        const timestamp = new Date(timeMs).toISOString();
        
        newClinicalEvents.push({
          id: `ev-tpl-${now}-${idx}-${uniqueSuffix()}`,
          name: ev.name,
          timestamp,
          category: (ev.category as any) || "Procedimento"
        });
      });
    }
    
    // 5. Fluids
    if (template.fluids && template.fluids.length > 0) {
      template.fluids.forEach((fl: any, idx: number) => {
        const offset = fl.timeOffset || 0;
        const timeMs = baseTimeMs + (offset * 60000);
        const timestamp = new Date(timeMs).toISOString();
        
        newFluids.push({
          id: `fl-${now}-${idx}-${uniqueSuffix()}`,
          name: fl.name,
          type: fl.type || "Cristaloide",
          volumePrepared: fl.volume,
          volumeAdministered: fl.volume,
          startTime: timestamp
        });
        
        newClinicalEvents.push({
          id: `ev-fl-${now}-${idx}-${uniqueSuffix()}`,
          name: `Líquido: ${fl.name} (${fl.volume}ml)`,
          timestamp,
          category: "Procedimento" as any
        });
      });
    }
    
    // 6. Airway
    if (template.airway) {
      updatedAirway = {
        ...updatedAirway,
        ventilationType: template.airway.ventilationType || "Espontânea",
        // deviceInfo intentionally omitted as it is not in type, but captured in events
      };
      
      const timeMs = baseTimeMs;
      const timestamp = new Date(timeMs).toISOString();
      newClinicalEvents.push({
        id: `ev-aw-${now}-${uniqueSuffix()}`,
        name: `Via Aérea: ${template.airway.ventilationType} ${template.airway.deviceInfo ? '('+template.airway.deviceInfo+')' : ''}`,
        timestamp,
        category: "Via Aérea" as any
      });
    }
    
    // 7. Accesses
    if (template.accesses && template.accesses.length > 0) {
      template.accesses.forEach((acc: any, idx: number) => {
        const offset = acc.timeOffset || 0;
        const timeMs = baseTimeMs + (offset * 60000);
        const timestamp = new Date(timeMs).toISOString();
        
        newAccesses.push({
          id: `acc-${now}-${idx}-${uniqueSuffix()}`,
          type: acc.type,
          site: acc.site,
          gauge: acc.gauge,
          status: "Funcionante",
          insertedAt: timestamp
        });
        
        newClinicalEvents.push({
          id: `ev-acc-${now}-${idx}-${uniqueSuffix()}`,
          name: `Acesso ${acc.type}: ${acc.site} ${acc.gauge ? '('+acc.gauge+')' : ''}`,
          timestamp,
          category: "Acesso" as any
        });
      });
    }
    
    // 8. Blocks
    if (template.blocks && template.blocks.length > 0) {
      template.blocks.forEach((blk: any, idx: number) => {
        const offset = blk.timeOffset || 0;
        const timeMs = baseTimeMs + (offset * 60000);
        const timestamp = new Date(timeMs).toISOString();
        
        newBlocks.push({
          id: `blk-${now}-${idx}-${uniqueSuffix()}`,
          type: blk.type,
          site: blk.site,
          drugs: blk.drugs,
          timestamp
        });
        
        newClinicalEvents.push({
          id: `ev-blk-${now}-${idx}-${uniqueSuffix()}`,
          name: `${blk.type}: ${blk.site}`,
          timestamp,
          category: "Bloqueio" as any
        });
      });
    }

    onUpdateDocument({
      bolusDrugs: [...(document.bolusDrugs || []), ...newBolus],
      continuousInfusions: [...(document.continuousInfusions || []), ...newContinuous],
      inhalationAgents: [...(document.inhalationAgents || []), ...newInh],
      events: [...(document.events || []), ...newClinicalEvents],
      fluids: [...(document.fluids || []), ...newFluids],
      vascularAccesses: [...(document.vascularAccesses || []), ...newAccesses],
      // blocks are saved purely as clinical events for now
      ...(template.airway ? { airway: updatedAirway } : {})
    });

    setShowTemplatesModal(false);
  };
  // --- END RECONSTRUCTED MISSING CODE ---

const handleTechniqueOtherTextChange = (text: string) => {
    onUpdateDocument({
      technique: {
        ...technique,
        other: text
      } as any
    });
  };

  const airway = document.airway || {
    ventilationType: "Espontânea",
    ventilationMode: "Espontânea",
    deviceSize: "",
    hasCuff: false,
    cuffPressure: 20,
    fixationDepth: "",
    attempts: 1,
    laryngoscopyType: "Laringoscopia Direta",
    airwayGuides: "Nenhum",
    cormackLehane: "Grau I",
    predictionEasy: "Fácil",
    capnographyConfirmed: true,
    extubatedInRoom: true,
    airwayHandoverMaintenance: false,
    incidents: "",
  };

  const handleAirwayUpdate = (updates: Partial<AirwayDetails>) => {
    onUpdateDocument({
      airway: {
        ...airway,
        ...updates
      }
    });
  };

  const handleEquipmentToggle = (key: keyof EquipmentConfig) => {
    onUpdateDocument({
      equipmentConfig: {
        ...equipmentConfig,
        [key]: !equipmentConfig[key]
      }
    });
  };

  const handleEquipmentOtherTextChange = (text: string) => {
    onUpdateDocument({
      equipmentConfig: {
        ...equipmentConfig,
        other: text
      }
    });
  };

  const handlePeripheralCountChange = (count: number) => {
    const centralList = vascularAccesses.filter(a => a.type === "Venoso Central");
    let currentPeripheralList = vascularAccesses.filter(a => a.type !== "Venoso Central");

    if (count > currentPeripheralList.length) {
      const addedCount = count - currentPeripheralList.length;
      const newItems: VascularAccess[] = [];
      for (let i = 0; i < addedCount; i++) {
        newItems.push({
          id: `va-p-${Date.now()}-${currentPeripheralList.length + i}`,
          type: "Venoso Periférico",
          site: "Fossa Cubital",
          side: "Direito",
          gauge: "18G",
          attempts: 1,
          ultrasoundGuided: false,
          timestamp: new Date().toISOString(),
          professional: document.team.anesthesiologistLead
        });
      }
      onUpdateDocument({ vascularAccesses: [...centralList, ...currentPeripheralList, ...newItems] });
    } else if (count < currentPeripheralList.length) {
      onUpdateDocument({ vascularAccesses: [...centralList, ...currentPeripheralList.slice(0, count)] });
    }
  };

  const handleUpdatePeripheralAccessItem = (id: string, updatedFields: Partial<VascularAccess>) => {
    const updated = vascularAccesses.map(a => {
      if (a.id === id) {
        return { ...a, ...updatedFields };
      }
      return a;
    });
    onUpdateDocument({ vascularAccesses: updated });
  };

  const handleVascularAccessUpdate = (updates: {
    peripheralCount?: number;
    peripheralSite?: string;
    peripheralGauge?: string;
    centralSite?: string; // "Nenhum" or specific site
    hasIncidents?: boolean;
    incidentsText?: string;
  }) => {
    let currentAccesses = [...vascularAccesses];
    const peripheralAccessesList = currentAccesses.filter(a => a.type === "Venoso Periférico");
    const centralAccessesList = currentAccesses.filter(a => a.type === "Venoso Central");
    const otherAccessesList = currentAccesses.filter(a => a.type !== "Venoso Periférico" && a.type !== "Venoso Central");

    // 1. Update Peripheral Count
    let finalPeripheral = [...peripheralAccessesList];
    if (updates.peripheralCount !== undefined) {
      const targetCount = updates.peripheralCount;
      if (targetCount > finalPeripheral.length) {
        for (let i = finalPeripheral.length; i < targetCount; i++) {
          finalPeripheral.push({
            id: `va-p-${Date.now()}-${i}`,
            type: "Venoso Periférico",
            site: updates.peripheralSite || currentPeripheralSite,
            side: "Direito",
            gauge: updates.peripheralGauge || currentPeripheralGauge,
            attempts: 1,
            ultrasoundGuided: false,
            timestamp: new Date().toISOString(),
            professional: document.team.anesthesiologistLead
          });
        }
      } else if (targetCount < finalPeripheral.length) {
        finalPeripheral = finalPeripheral.slice(0, targetCount);
      }
    }

    // 2. Update Peripheral Site
    if (updates.peripheralSite !== undefined) {
      finalPeripheral = finalPeripheral.map(p => ({ ...p, site: updates.peripheralSite! }));
    }

    // 3. Update Peripheral Gauge
    if (updates.peripheralGauge !== undefined) {
      finalPeripheral = finalPeripheral.map(p => ({ ...p, gauge: updates.peripheralGauge! }));
    }

    // 4. Update Central Site
    let finalCentral = [...centralAccessesList];
    if (updates.centralSite !== undefined) {
      if (updates.centralSite === "Nenhum") {
        finalCentral = [];
      } else {
        if (finalCentral.length === 0) {
          finalCentral.push({
            id: `va-c-${Date.now()}`,
            type: "Venoso Central",
            site: updates.centralSite,
            side: "Direito",
            gauge: "7Fr Duplo Lúmen",
            attempts: 1,
            ultrasoundGuided: true,
            timestamp: new Date().toISOString(),
            professional: document.team.anesthesiologistLead
          });
        } else {
          finalCentral = finalCentral.map(c => ({ ...c, site: updates.centralSite! }));
        }
      }
    }

    // Combine
    let updatedAccesses = [...finalPeripheral, ...finalCentral, ...otherAccessesList];

    // 5. Update Incidents
    if (updates.hasIncidents !== undefined || updates.incidentsText !== undefined) {
      const showIncidents = updates.hasIncidents !== undefined ? updates.hasIncidents : currentHasIncidents;
      const text = updates.incidentsText !== undefined ? updates.incidentsText : currentIncidentsText;
      
      updatedAccesses = updatedAccesses.map(a => ({
        ...a,
        incidents: showIncidents ? text : undefined
      }));
    }

    onUpdateDocument({ vascularAccesses: updatedAccesses });
  };

  // Summaries for the Collapsible/Accordion menus
  const startAnesthStr = timers.startAnesthesia ? new Date(timers.startAnesthesia).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "—";
  const endAnesthStr = timers.endAnesthesia ? new Date(timers.endAnesthesia).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "Ativo";
  const chronologySummary = timers.startAnesthesia ? `${startAnesthStr} — ${endAnesthStr}` : "Não iniciada";

  const latestVital = vitals.length > 0 ? [...vitals].sort((a, b) => b.minutesFromStart - a.minutesFromStart)[0] : null;
  const vitalsSummary = latestVital 
    ? `FC: ${latestVital.fc || "—"} | PA: ${latestVital.pas || "—"}/${latestVital.pad || "—"} | SpO₂: ${latestVital.spo2 || "—"}%`
    : "Nenhum sinal vital registrado";

  const drugsSummary = bolusDrugs.length > 0 
    ? `${bolusDrugs.length} dose${bolusDrugs.length > 1 ? "s" : ""} lançada${bolusDrugs.length > 1 ? "s" : ""}`
    : "Nenhum fármaco em bolus";

  const activeInfusionsCount = continuousInfusions.filter(inf => {
    if (!inf.history || inf.history.length === 0) return false;
    const sorted = [...inf.history].sort((a, b) => a.minutesFromStart - b.minutesFromStart);
    const last = sorted[sorted.length - 1];
    return last.status !== "Finalizado";
  }).length;
  const infusionsSummary = continuousInfusions.length > 0
    ? `${activeInfusionsCount} ativa${activeInfusionsCount !== 1 ? "s" : ""} (${continuousInfusions.length} total)`
    : "Nenhuma infusão contínua";

  const activeGasesCount = inhalationAgents.filter(ia => !ia.endTime).length;
  const gasesSummary = inhalationAgents.length > 0
    ? `${activeGasesCount} ativo${activeGasesCount !== 1 ? "s" : ""} (${inhalationAgents.length} total)`
    : "Nenhum gás ativo";

  const getSelectedTechniqueName = () => {
    if (technique.combinedSpinalEpidural) return "Comb. Geral + Reg.";
    if (technique.balanced) return "Geral Balanceada";
    if (technique.generalIV) return "Geral Venosa";
    if (technique.generalInhalational) return "Geral Inalatória";
    if (technique.generalIV && technique.generalInhalational) return "Geral Balanceada";
    if (technique.sedation) return "Sedação";
    if (technique.local) return "Local";
    if (technique.spinal) return "Raquianestesia";
    if (technique.epidural) return "Peridural";
    if (technique.regionalPeripheralBlock) return "Bloq. Regional";
    return "Não selecionada";
  };

  // vascularAccesses already defined
  const peripheralAccesses = vascularAccesses.filter(a => a.type === "Venoso Periférico");
  const centralAccesses = vascularAccesses.filter(a => a.type === "Venoso Central");
  const hasCentral = centralAccesses.length > 0;
  const supportSummary = `${getSelectedTechniqueName()} | ${peripheralAccesses.length} ac. perif.${hasCentral ? " + central" : ""}`;

  const hydrationSummary = `Entradas: ${totalInflow} ml | Saídas: ${totalOutflow} ml | Balanço: ${netBalance} ml`;

  const notesCount = document.narrativeLaunches?.length || 0;
  const descriptionSummary = notesCount > 0 
    ? `${notesCount} registro${notesCount > 1 ? "s" : ""} lançado${notesCount > 1 ? "s" : ""}`
    : "Sem registros";

  const renderCollapsedSquare = (panelId: string, icon: React.ReactNode, title: string) => {
    return (
      <DraggablePanel key={panelId} id={panelId} isDark={isDark} className="w-[calc(50%-0.625rem)] xl:w-full max-w-full">
        <div 
          onClick={() => togglePanel(panelId)}
          className={`w-full aspect-square rounded-lg flex flex-col items-center justify-center p-3 gap-2 cursor-pointer border hover:scale-[1.02] active:scale-95 transition-all ${
            isDark ? "bg-[#1C1C1E] border-zinc-800 text-zinc-300 hover:bg-zinc-800" : "bg-white border-zinc-200/80 text-zinc-700 hover:bg-slate-50 shadow-xs"
          }`}
        >
          <div className={`p-3 rounded-full ${isDark ? "bg-zinc-800/80 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}>
            {icon}
          </div>
          <span className="text-xs sm:text-xs font-bold text-center leading-tight">
            {title}
          </span>
        </div>
      </DraggablePanel>
    );
  };

  const renderVitals = () => {
    if (!getIsExpanded('vitals')) return renderCollapsedSquare('vitals', <Activity className="w-6 h-6" />, 'Sinais Vitais');
    return (
      /* TOUCHKEYPAD VITALS INTAKE (NÍVEL 1) */
      <DraggablePanel key="vitals" id="vitals" isDark={isDark} className="w-full max-w-full min-w-0">
        <div className={`p-5 rounded-lg shadow-xs border space-y-4 transition-all duration-300 relative ${
        isDark 
          ? isOverdue ? "bg-[#1C1C1E] border-rose-500 shadow-sm text-white" : "bg-[#1C1C1E] border-zinc-800 text-zinc-100"
          : isOverdue ? "bg-white border-rose-400 shadow-sm text-zinc-900" : "bg-white border-zinc-200/80 text-zinc-900"
      }`}>
        <button onClick={() => togglePanel('vitals')} className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-10"><ChevronUp className="w-4 h-4" /></button>
        <div className={`flex justify-between items-center border-b pb-3 pr-8 ${isDark ? "border-zinc-800" : "border-zinc-100"}`}>
          <h3 className={`text-xs font-bold tracking-widest uppercase flex items-center gap-1.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
            <Activity className={`w-3.5 h-3.5 ${isOverdue ? "text-rose-500 animate-ping" : "text-emerald-500"}`} />
            Lançador de Sinais Vitais
          </h3>
          <span className={`text-xs tabular-nums font-bold px-2 py-0.5 rounded ${isDark ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-600"}`}>
            {selectedMinutes !== null ? `Ajustando ${selectedMinutes}'` : "Hora Atual"}
          </span>
        </div>

        {/* Configuração do Intervalo de Registro */}
        <div className={`p-3 rounded-lg space-y-2 border transition ${
          isDark ? "bg-[#000000] border-zinc-800" : "bg-[#F2F2F7] border-zinc-200/60"
        }`}>
          <div className="flex items-center justify-between text-xs font-bold">
            <span className={`flex items-center gap-1.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              <Sliders className="w-3.5 h-3.5 text-indigo-500" />
              INTERVALO DE REGISTRO
            </span>
            
            {/* Sound alert switcher */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition ${
                soundEnabled 
                  ? isDark ? "bg-emerald-950/40 text-emerald-400 border border-emerald-800/40" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : isDark ? "bg-zinc-800 text-zinc-500 hover:text-zinc-400" : "bg-zinc-200/60 text-zinc-500 hover:text-zinc-700"
              }`}
              title={soundEnabled ? "Desativar aviso sonoro" : "Ativar aviso sonoro"}
            >
              {soundEnabled ? <Bell className="w-3 h-3 text-emerald-500" /> : <BellOff className="w-3 h-3" />}
              <span className="text-xs uppercase font-bold">{soundEnabled ? "Bipe ON" : "Mudo"}</span>
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {[5, 10, 15].map((val) => {
              const isActive = !isCustomInterval && loggingInterval === val;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setIsCustomInterval(false);
                    setLoggingInterval(val);
                  }}
                  className={`py-1.5 px-1.5 text-center rounded-lg text-xs font-bold transition select-none ${
                    isActive 
                      ? "bg-indigo-600 text-white" 
                      : isDark ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200" : "bg-white text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 border border-zinc-200/40 shadow-xs"
                  }`}
                >
                  {val} min
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setIsCustomInterval(true)}
              className={`py-1.5 px-1.5 text-center rounded-lg text-xs font-bold transition select-none ${
                isCustomInterval 
                  ? "bg-indigo-600 text-white" 
                  : isDark ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700" : "bg-white text-zinc-500 hover:bg-zinc-100 border border-zinc-200/40 shadow-xs"
              }`}
            >
              Outro
            </button>
          </div>

          {isCustomInterval && (
            <div className={`flex items-center justify-between gap-2 mt-1.5 p-2 rounded-lg border ${
              isDark ? "bg-[#000000] border-zinc-800" : "bg-white border-zinc-200/50"
            }`}>
              <span className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>Minutos personalizados:</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={customIntervalVal}
                  onChange={(e) => setCustomIntervalVal(e.target.value)}
                  className={`border text-xs px-2 py-0.5 rounded w-16 text-center focus:outline-none focus:border-indigo-500 tabular-nums ${
                    isDark ? "bg-zinc-900 border-zinc-800 text-white" : "bg-zinc-100 border-zinc-200 text-zinc-900"
                  }`}
                />
                <span className="text-xs text-zinc-400">min</span>
              </div>
            </div>
          )}

          {/* Test alert tools */}
          <div className={`flex items-center justify-between pt-2 border-t ${isDark ? "border-zinc-800/60" : "border-zinc-200/40"}`}>
            <button
              type="button"
              onClick={() => {
                const msToAdd = (activeInterval * 60000) + 120000; // Overdue by 2 mins
                setSimulatedDelayMs(msToAdd);
              }}
              className={`text-xs transition font-semibold flex items-center gap-1 ${isDark ? "text-indigo-400 hover:text-indigo-300" : "text-indigo-600 hover:text-indigo-500"}`}
            >
              <Zap className="w-3 h-3" /> Simular Atraso (+{activeInterval + 2}m)
            </button>
            {simulatedDelayMs > 0 && (
              <button
                type="button"
                onClick={() => setSimulatedDelayMs(0)}
                className="text-xs text-rose-500 hover:text-rose-600 transition font-semibold"
              >
                Resetar
              </button>
            )}
          </div>
        </div>

        {/* Alarm / Fill Ticker bar */}
        {timers.startAnesthesia ? (
          <div className={`p-3 rounded-lg border transition ${
            isOverdue 
              ? isDark ? "bg-rose-950/20 border-rose-500/40 animate-pulse text-white" : "bg-rose-50 border-rose-200/60 animate-pulse text-rose-950"
              : isDark ? "bg-[#000000] border-zinc-800" : "bg-[#F2F2F7] border-zinc-200/60"
          }`}>
            <div className="flex justify-between items-center text-xs mb-2 font-bold">
              <span className={`flex items-center gap-1 ${isOverdue ? "text-rose-500" : isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                {isOverdue ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                ) : (
                  <Clock className="w-3.5 h-3.5" />
                )}
                {isOverdue ? <><AlertTriangle className="w-3.5 h-3.5" /> ALERTA: REGISTRO ATRASADO!</> : "PRÓXIMO REGISTRO EM:"}
              </span>
              <span className={`tabular-nums font-bold ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                {timeString} / {activeInterval}:00
              </span>
            </div>
            
            <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? "bg-zinc-800" : "bg-zinc-200/60"}`}>
              <div
                className={`h-full transition-all duration-1000 ${isOverdue ? "bg-rose-500" : percent > 80 ? "bg-amber-500" : "bg-indigo-500"}`}
                style={{ width: `${percent}%` }}
              />
            </div>

            {isOverdue ? (
              <p className={`text-xs font-semibold mt-1 text-center ${isDark ? "text-rose-300" : "text-rose-600"}`}>
                Sinais vitais não registrados há {Math.floor(elapsedMins)} min. Lance e clique em Registrar Agora!
              </p>
            ) : (
              <p className="text-xs text-zinc-400 mt-1 text-center">
                Preencha novos dados antes do temporizador esgotar.
              </p>
            )}
          </div>
        ) : (
          <div className={`border p-3 rounded-lg text-center text-xs font-medium ${
            isDark ? "bg-[#000000] border-zinc-800/80 text-zinc-500" : "bg-zinc-50 border-zinc-200/55 text-zinc-400"
          }`}>
            <Info className="w-3.5 h-3.5" /> Inicie a anestesia no painel cronológico para ativar o temporizador de registros.
          </div>
        )}

        {/* Readout Panels */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: "pas", label: "PAS", color: "text-rose-500", unit: "mmHg" },
            { key: "pad", label: "PAD", color: "text-rose-500", unit: "mmHg" },
            { key: "fc", label: "FC", color: "text-blue-500", unit: "bpm" },
            { key: "spo2", label: "SpO₂", color: "text-emerald-500", unit: "%" },
            { key: "etco2", label: "ETCO₂", color: "text-teal-500", unit: "mmHg" },
            { key: "temp", label: "TEMP", color: "text-orange-500", unit: "°C" },
            { key: "pai", label: "PAI (Média)", color: "text-red-500", unit: "mmHg" },
            { key: "bis", label: "BIS", color: "text-purple-500", unit: "" }
          ].map((field) => {
            const active = activeField === field.key;
            const val = activeVitalsInput[field.key as keyof typeof activeVitalsInput] || "—";
            return (
              <button
                key={field.key}
                onClick={() => setActiveField(field.key as any)}
                className={`p-2 rounded-lg text-left transition select-none flex flex-col justify-between h-14 border ${
                  active 
                    ? "bg-indigo-50/50 border-indigo-500 ring-1 ring-indigo-500/20 text-indigo-950" 
                    : isDark ? "bg-zinc-900/60 border-zinc-800/70 text-zinc-300" : "bg-zinc-50/40 border-zinc-200/50 text-zinc-800"
                }`}
              >
                <span className={`text-xs font-bold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{field.label}</span>
                <div className="flex items-baseline justify-between w-full">
                  <span className={`text-base font-bold tabular-nums ${field.color}`}>{val}</span>
                  <span className="text-xs text-zinc-400 tabular-nums font-medium">{field.unit}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Physical numeric keypad */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "BKSP"].map((key) => {
            const isAction = key === "BKSP" || key === ".";
            return (
              <button
                key={key}
                onClick={() => {
                  if (key === "BKSP") handleKeyBackspace();
                  else handleKeyPress(key);
                }}
                className={`py-3 rounded-lg text-sm font-bold tabular-nums transition select-none ${
                  isAction 
                    ? isDark ? "bg-zinc-700 hover:bg-zinc-650 text-zinc-300" : "bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-600 shadow-xs" 
                    : isDark ? "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700/50" : "bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-900 shadow-xs active:scale-95"
                }`}
              >
                {key}
              </button>
            );
          })}
        </div>

        {/* Action buttons footer */}
        <div className={`grid grid-cols-2 gap-2 pt-2 border-t ${isDark ? "border-zinc-800" : "border-zinc-150"}`}>
          <button
            onClick={repeatLastVitals}
            className={`py-2 px-3 transition font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 ${
              isDark ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300" : "bg-zinc-100 hover:bg-zinc-200 border border-zinc-250 text-zinc-600"
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Repetir Último
          </button>
          <button
            onClick={handleRegisterVitals}
            className="py-2 px-3 bg-indigo-600 hover:bg-indigo-500 transition font-bold text-xs text-white rounded-lg flex items-center justify-center gap-1 shadow-xs"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Registrar Agora
          </button>
        </div>
      </div></DraggablePanel>
    );
  };

  const renderInfusions = () => {
    if (!getIsExpanded('infusions')) return renderCollapsedSquare('infusions', <Droplets className="w-6 h-6" />, 'Bombas de Infusão');
    return (
      /* CONTINUOUS INFUSION PUMPS CONTROL (NÍVEL 1) */
      <DraggablePanel key="infusions" id="infusions" isDark={isDark} className="w-full max-w-full min-w-0">
        <div className="relative">
          <button onClick={() => togglePanel('infusions')} className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-10"><ChevronUp className="w-4 h-4" /></button>
          <ContinuousInfusionsPanel 
        isDark={isDark}
        borderClass={borderClass}
        cardClass={cardClass}
        continuousInfusions={continuousInfusions}
        newInfusion={newInfusion}
        setNewInfusion={setNewInfusion}
        handleStartInfusion={handleStartInfusion}
        handleUpdateInfusionStatus={handleUpdateInfusionStatus}
        handleUpdateInfusion={handleUpdateInfusion}
        handleRemoveInfusion={handleRemoveInfusion}
        patientWeight={document.patient?.weight}
      /></div></DraggablePanel>
    );
  };

      const renderGases = () => {
    if (!getIsExpanded('gases')) return renderCollapsedSquare('gases', <Wind className="w-6 h-6" />, 'Gases');
    return (
      <DraggablePanel key="gases" id="gases" isDark={isDark} className="w-full max-w-full min-w-0">
        <div className="relative">
          <button onClick={() => togglePanel('gases')} className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-10"><ChevronUp className="w-4 h-4" /></button>
          <GasesPanel 
            isDark={isDark}
            borderClass={borderClass}
            cardClass={cardClass}
            inhalationAgents={inhalationAgents}
            newAgent={newAgent}
            setNewAgent={setNewAgent}
            handleStartInhalationAgent={handleStartInhalationAgent}
            handleStopInhalationAgent={handleStopInhalationAgent}
            handleRemoveInhalationAgent={handleRemoveInhalationAgent}
            handleUpdateAgent={handleUpdateInhalationAgent}
          />
        </div>
      </DraggablePanel>
    );
  };

      const renderHydration = () => {
    if (!getIsExpanded('hydration')) return renderCollapsedSquare('hydration', <Droplets className="w-6 h-6 text-blue-500" />, 'Líquidos');
    return (
      <DraggablePanel key="hydration" id="hydration" isDark={isDark} className="w-full max-w-full min-w-0">
        <div className="relative">
          <button onClick={() => togglePanel('hydration')} className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-10"><ChevronUp className="w-4 h-4" /></button>
          <HydrationPanel 
            isDark={isDark}
            borderClass={borderClass}
            cardClass={cardClass}
            newFluid={newFluid}
            setNewFluid={setNewFluid}
            fluidTimeMode={fluidTimeMode}
            setFluidTimeMode={setFluidTimeMode}
            customFluidTime={customFluidTime}
            setCustomFluidTime={setCustomFluidTime}
            handleAddFluid={handleAddFluid}
            fluids={fluids}
            handleRemoveFluid={handleRemoveFluid}
            getTimeString={getTimeString}
            outputType={outputType}
            setOutputType={setOutputType}
            outputVal={outputVal}
            setOutputVal={setOutputVal}
            handleAddOutput={handleAddOutput}
            outputs={outputs}
            handleRemoveOutput={handleRemoveOutput}
            totalInflow={totalInflow}
            totalOutflow={totalOutflow}
            netBalance={netBalance}
          />
        </div>
      </DraggablePanel>
    );
  };

      const renderEvents = () => {
    if (!getIsExpanded('events')) return renderCollapsedSquare('events', <FileText className="w-6 h-6" />, 'Descrição e Eventos');
    return (
      <DraggablePanel key="events" id="events" isDark={isDark} className="w-full max-w-full min-w-0">
        <div className={`${cardClass} p-5 rounded-lg border space-y-4 relative`}>
          <button onClick={() => togglePanel('events')} className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-10"><ChevronUp className="w-4 h-4" /></button>
          <div className={`flex items-center justify-between pb-2 border-b pr-8 ${borderClass}`}>
            <div className="flex items-center gap-2">
              <FileText className={`w-5 h-5 ${isDark ? "text-orange-400" : "text-orange-600"}`} />
              <div>
                <h3 className={`font-bold text-sm ${textHeadingClass}`}>
                  Descrição e Eventos Clínicos
                </h3>
                <p className={`text-xs ${textMutedClass}`}>
                  Registro de intercorrências, tempos cirúrgicos adicionais e notas de evolução
                </p>
              </div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${isDark ? "bg-orange-500/20 text-orange-400" : "bg-orange-100 text-orange-700"}`}>
              {descriptionSummary}
            </span>
          </div>
          <button
             onClick={() => setIsNarrativeDrawerOpen(true)}
             className={`w-full py-4 rounded-lg border flex items-center justify-center gap-2 transition active:scale-[0.98] ${isDark ? "bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20" : "bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100"}`}
           >
             <FileText className="w-5 h-5" />
             <span className="font-bold">Abrir Painel de Descrições e Eventos</span>
           </button>
        </div>
      </DraggablePanel>
    );
  };

  const renderSupport = () => {
    if (!getIsExpanded('support')) return renderCollapsedSquare('support', <HandHelping className="w-6 h-6" />, 'Suporte');
    return (
      <DraggablePanel key="support" id="support" isDark={isDark} className="w-full max-w-full min-w-0">
        <div className={`${cardClass} p-5 rounded-lg border space-y-4 relative`}>
          <button onClick={() => togglePanel('support')} className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-10"><ChevronUp className="w-4 h-4" /></button>
          <div className={`flex items-center gap-2 pb-2 border-b pr-8 ${borderClass}`}>
            <HandHelping className={`w-5 h-5 ${isDark ? "text-teal-400" : "text-teal-600"}`} />
            <div>
              <h3 className={`font-bold text-sm ${isDark ? "text-zinc-100" : "text-slate-800"}`}>
                Suporte, Acessos e Técnica Anestésica
              </h3>
              <p className={`text-xs ${isDark ? "text-zinc-400" : "text-slate-400 dark:text-zinc-500"}`}>
                Registre as técnicas, os equipamentos de apoio e os acessos vasculares utilizados no intraoperatório
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            {/* TIPO DE ANESTESIA */}
            <div className={`p-4 rounded-lg border transition-all duration-200 ${
              expandedSupportPanels['tipo']
                ? isDark
                  ? "bg-teal-950/20 border-teal-900/60 shadow-xs"
                  : "bg-teal-50/40 border-teal-200 shadow-sm"
                : isDark
                  ? "bg-zinc-900/40 border-zinc-800"
                  : "bg-white border-slate-200 shadow-sm"
            }`}>
              <button 
                onClick={() => setExpandedSupportPanels(prev => ({ ...prev, 'tipo': !prev['tipo'] }))}
                className="w-full flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                  <h4 className={`text-xs font-bold uppercase tracking-wide ${isDark ? "text-zinc-300" : "text-slate-600"}`}>
                    Tipo de Anestesia
                  </h4>
                </div>
                {expandedSupportPanels['tipo'] ? <ChevronUp className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300" /> : <ChevronDown className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300" />}
              </button>
              
              {expandedSupportPanels['tipo'] && (
                <div className={`mt-4 pt-4 border-t animate-in fade-in slide-in-from-top-2 duration-200 ${isDark ? "border-zinc-800" : "border-slate-100"}`}>
                  <div className="space-y-2">
                    <select
                      value={getSelectedTechnique()}
                      onChange={(e) => handleTechniqueChange(e.target.value)}
                      className={`w-full text-xs px-3 py-2.5 rounded-lg border outline-none font-semibold transition ${selectClass}`}
                    >
                      <option value="Geral Balanceada">Geral Balanceada</option>
                      <option value="Geral Venosa">Geral Venosa</option>
                      <option value="Geral Inalatória">Geral Inalatória</option>
                      <option value="Sedação">Sedação</option>
                      <option value="Local">Local</option>
                      <option value="Raquianestesia">Raquianestesia</option>
                      <option value="Peridural">Peridural</option>
                      <option value="Bloqueio Regional de Plexo/Nervo">Bloqueio Regional de Plexo/Nervo</option>
                      <option value="Combinada Geral + Regional">Combinada Geral + Regional</option>
                      <option value="Outra">Outra técnica...</option>
                    </select>

                    {(getSelectedTechnique() as string) === "Outra" && (
                      <input
                        type="text"
                        value={technique.other}
                        onChange={(e) => handleTechniqueOtherTextChange(e.target.value)}
                        placeholder="Descreva a técnica..."
                        className={`w-full text-xs px-3 py-2.5 border rounded-lg outline-none font-semibold transition ${inputClass}`}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* VIA AÉREA & VENTILAÇÃO */}
            <div className={`p-4 rounded-lg border transition-all duration-200 ${
              expandedSupportPanels['via']
                ? isDark
                  ? "bg-cyan-950/20 border-cyan-900/60 shadow-xs"
                  : "bg-cyan-50/40 border-cyan-200 shadow-sm"
                : isDark
                  ? "bg-zinc-900/40 border-zinc-800"
                  : "bg-white border-slate-200 shadow-sm"
            }`}>
              <button 
                onClick={() => setExpandedSupportPanels(prev => ({ ...prev, 'via': !prev['via'] }))}
                className="w-full flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                  <h4 className={`text-xs font-bold uppercase tracking-wide ${isDark ? "text-zinc-300" : "text-slate-600"}`}>
                    Via Aérea & Ventilação
                  </h4>
                </div>
                {expandedSupportPanels['via'] ? <ChevronUp className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300" /> : <ChevronDown className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300" />}
              </button>
              
              {expandedSupportPanels['via'] && (
                <div className={`mt-4 pt-4 border-t animate-in fade-in slide-in-from-top-2 duration-200 ${isDark ? "border-zinc-800" : "border-slate-100"}`}>
                  <div className="space-y-2 text-xs">
                    {/* Modo de Ventilação */}
                    <div className={`p-2.5 rounded-lg border ${isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-slate-50/55 border-slate-100"} space-y-1.5`}>
                      <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase block">Modo de Ventilação</span>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        {[
                          { value: "Espontânea", label: "Espontânea" },
                          { value: "VCM", label: "VCM" },
                          { value: "VCV", label: "VCV" },
                          { value: "PCV", label: "PCV" }
                        ].map((m) => {
                          const active = (airway.ventilationMode === m.value) || (!airway.ventilationMode && m.value === "Espontânea");
                          return (
                            <button
                              key={m.value}
                              type="button"
                              onClick={() => handleAirwayUpdate({ ventilationMode: m.value as any })}
                              className={`px-2 py-1 rounded text-center font-bold transition ${
                                active
                                  ? isDark
                                    ? "bg-cyan-950/40 border border-cyan-500 text-cyan-300"
                                    : "bg-cyan-50 border border-cyan-400 text-cyan-800"
                                  : isDark
                                    ? "bg-zinc-950 border border-zinc-850 text-zinc-500 hover:border-zinc-700"
                                    : "bg-white border border-slate-200 text-slate-500 dark:text-zinc-400 hover:border-slate-300"
                              }`}
                            >
                              {m.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Dispositivo de Via Aérea */}
                    <div className={`p-2.5 rounded-lg border ${isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-slate-50/55 border-slate-100"} space-y-2`}>
                      <div>
                        <label className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase block mb-1">Dispositivo</label>
                        <select
                          value={airway.ventilationType || "Espontânea"}
                          onChange={(e) => {
                            const newType = e.target.value as any;
                            // Clear device size when changing type, as sizes are different
                            handleAirwayUpdate({ ventilationType: newType, deviceSize: "" });
                          }}
                          className={`w-full text-xs px-2 py-1.5 rounded border outline-none font-semibold ${selectClass}`}
                        >
                          <option value="Espontânea">Espontânea (Nenhum)</option>
                          <option value="Máscara Facial">Máscara Facial / Cateter O₂</option>
                          <option value="Cânula Nasal">Cânula Nasal / Óculos O₂</option>
                          <option value="Cânula Orofaríngea">Cânula Orofaríngea (Guedel)</option>
                          <option value="Dispositivo Supraglótico">Máscara Laríngea</option>
                          <option value="Intubação Orotraqueal">Intubação Orotraqueal</option>
                          <option value="Intubação Nasotraqueal">Intubação Nasotraqueal</option>
                          <option value="Tubo Duplo Lúmen">Tubo Duplo Lúmen</option>
                          <option value="Traqueostomia">Traqueostomia</option>
                          <option value="Outros">Outros</option>
                        </select>
                      </div>

                      {/* Detalhes do Dispositivo */}
                      {airway.ventilationType !== "Espontânea" && (
                        <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-dashed border-slate-200/40">
                          <div>
                            <label className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase block">Calibre / Nº</label>
                            <input
                              type="text"
                              list="airway-device-sizes"
                              value={airway.deviceSize || ""}
                              onChange={(e) => handleAirwayUpdate({ deviceSize: e.target.value })}
                              placeholder="Selecione ou digite"
                              className={`w-full text-xs px-2 py-1 border rounded outline-none font-semibold ${inputClass}`}
                            />
                            <datalist id="airway-device-sizes">
                              {(airway.ventilationType === "Máscara Facial" ? ["0", "1", "2", "3", "4", "5", "6"] :
                                airway.ventilationType === "Cânula Nasal" ? ["Recém-nascido", "Infantil", "Pediátrico", "Adulto", "P", "M", "G"] :
                                airway.ventilationType === "Cânula Orofaríngea" ? ["000", "00", "0", "1", "2", "3", "4", "5", "6"] :
                                airway.ventilationType === "Dispositivo Supraglótico" ? ["1", "1.5", "2", "2.5", "3", "4", "5", "6"] :
                                (airway.ventilationType?.includes("Intubação") || airway.ventilationType === "Intubação Orotraqueal") ? ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0"] :
                                airway.ventilationType === "Tubo Duplo Lúmen" ? ["26", "28", "32", "35", "37", "39", "41"] :
                                airway.ventilationType === "Traqueostomia" ? ["4", "5", "6", "7", "8", "9", "10"] : []).map(size => (
                                <option key={size} value={size} />
                              ))}
                            </datalist>
                          </div>
                          
                          {/* Depth / Fixação - Only for tube intubations */}
                          {(airway.ventilationType?.includes("Intubação") || airway.ventilationType?.includes("Tubo") || airway.ventilationType === "Intubação Orotraqueal") ? (
                            <div>
                              <label className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase block">Fixação (cm)</label>
                              <input
                                type="text"
                                value={airway.fixationDepth || ""}
                                onChange={(e) => handleAirwayUpdate({ fixationDepth: e.target.value })}
                                placeholder="Ex: 22"
                                className={`w-full text-xs px-2 py-1 border rounded outline-none font-semibold ${inputClass}`}
                              />
                            </div>
                          ) : (
                            <div className="flex items-end">
                              <span className="text-xs text-slate-400 dark:text-zinc-500 italic">Dispositivo supraglótico/facial</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Cuff details for tubes */}
                      {(airway.ventilationType?.includes("Intubação") || airway.ventilationType?.includes("Tubo") || airway.ventilationType === "Traqueostomia" || airway.ventilationType === "Intubação Orotraqueal") && (
                        <div className="flex items-center gap-3 pt-1">
                          <label className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold">
                            <input
                              type="checkbox"
                              checked={!!airway.hasCuff}
                              onChange={(e) => handleAirwayUpdate({ hasCuff: e.target.checked })}
                              className="rounded border-zinc-300 accent-indigo-600"
                            />
                            Com Cuff
                          </label>
                          {airway.hasCuff && (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={airway.cuffPressure ?? 20}
                                onChange={(e) => handleAirwayUpdate({ cuffPressure: parseInt(e.target.value) || 0 })}
                                className={`w-14 text-xs px-1 py-0.5 border rounded text-center outline-none ${inputClass}`}
                              />
                              <span className="text-xs text-zinc-400 font-bold uppercase">cmH₂O</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Facilidade / Predição de Dificuldade */}
                    <div className={`p-2.5 rounded-lg border ${isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-slate-50/55 border-slate-100"} space-y-1.5`}>
                      <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase block">Facilidade de Intubação</span>
                      <div className="flex gap-2">
                        {[
                          { value: "Fácil", label: "Fácil" },
                          { value: "Difícil", label: "Difícil" }
                        ].map((opt) => {
                          const active = airway.predictionEasy === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleAirwayUpdate({ predictionEasy: opt.value as any })}
                              className={`flex-1 py-1 rounded text-xs font-bold text-center transition ${
                                active
                                  ? opt.value === "Fácil"
                                    ? "bg-emerald-500 text-white"
                                    : "bg-rose-500 text-white animate-pulse"
                                  : isDark
                                    ? "bg-zinc-800 text-zinc-400 border border-zinc-800"
                                    : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Intercorrências de Via Aérea */}
                    <div className={`p-2.5 rounded-lg border ${isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-slate-50/55 border-slate-100"} space-y-1.5`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase">Intercorrências (V.A.)</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAirwayUpdate({ incidents: "" })}
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              !airway.incidents
                                ? "bg-emerald-500 text-white"
                                : isDark ? "bg-zinc-800 text-zinc-500" : "bg-slate-200 text-slate-500 dark:text-zinc-400"
                            }`}
                          >
                            Não
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!airway.incidents) {
                                handleAirwayUpdate({ incidents: "Sim" });
                              }
                            }}
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              airway.incidents
                                ? "bg-rose-500 text-white animate-pulse"
                                : isDark ? "bg-zinc-800 text-zinc-500" : "bg-slate-200 text-slate-500 dark:text-zinc-400"
                            }`}
                          >
                            Sim
                          </button>
                        </div>
                      </div>

                      {airway.incidents && (
                        <input
                          type="text"
                          value={airway.incidents === "Sim" ? "" : airway.incidents}
                          onChange={(e) => handleAirwayUpdate({ incidents: e.target.value })}
                          placeholder="Quais intercorrências ocorreram?"
                          className={`w-full text-xs px-2 py-1 border rounded outline-none font-semibold ${inputClass}`}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* EQUIPAMENTOS E MATERIAIS */}
            <div className={`p-4 rounded-lg border transition-all duration-200 ${
              expandedSupportPanels['equipamentos']
                ? isDark
                  ? "bg-indigo-950/20 border-indigo-900/60 shadow-xs"
                  : "bg-indigo-50/40 border-indigo-200 shadow-sm"
                : isDark
                  ? "bg-zinc-900/40 border-zinc-800"
                  : "bg-white border-slate-200 shadow-sm"
            }`}>
              <button 
                onClick={() => setExpandedSupportPanels(prev => ({ ...prev, 'equipamentos': !prev['equipamentos'] }))}
                className="w-full flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  <h4 className={`text-xs font-bold uppercase tracking-wide ${isDark ? "text-zinc-300" : "text-slate-600"}`}>
                    Equipamentos e Materiais
                  </h4>
                </div>
                {expandedSupportPanels['equipamentos'] ? <ChevronUp className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300" /> : <ChevronDown className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300" />}
              </button>
              
              {expandedSupportPanels['equipamentos'] && (
                <div className={`mt-4 pt-4 border-t animate-in fade-in slide-in-from-top-2 duration-200 ${isDark ? "border-zinc-800" : "border-slate-100"}`}>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { key: "infusionPump", label: "Bomba Infusão" },
                      { key: "urinaryCatheter", label: "Sonda Vesical" },
                      { key: "gastricTube", label: "Sonda Gástrica" },
                      { key: "thermalBlanket", label: "Manta Térmica" },
                      { key: "thermalMattress", label: "Colchão Térmico" },
                      { key: "defibrillator", label: "Desfibrilador" }
                    ].map((item) => {
                      const active = !!(equipmentConfig as any)[item.key];
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => handleEquipmentToggle(item.key as keyof EquipmentConfig)}
                          className={`px-2.5 py-1.5 rounded-lg border text-left font-semibold transition ${
                            active
                              ? isDark
                                ? "bg-indigo-950/40 border-indigo-500 text-indigo-300"
                                : "bg-indigo-50 border-indigo-400 text-indigo-800"
                              : isDark
                                ? "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                                : "bg-slate-50 border-slate-200 text-slate-500 dark:text-zinc-400 hover:border-slate-300"
                          }`}
                        >
                          {item.label} {active ? "✓" : ""}
                        </button>
                      );
                    })}
                  </div>

                  <input
                    type="text"
                    value={equipmentConfig.other || ""}
                    onChange={(e) => handleEquipmentOtherTextChange(e.target.value)}
                    placeholder="Outro material (ex: manta, etc)..."
                    className={`w-full text-xs px-3 py-1.5 border rounded-lg outline-none font-semibold transition ${inputClass}`}
                  />
                </div>
              )}
            </div>

            {/* ACESSO VENOSO */}
            <div className={`p-4 rounded-lg border transition-all duration-200 ${
              expandedSupportPanels['acessos']
                ? isDark
                  ? "bg-violet-950/20 border-violet-900/60 shadow-xs"
                  : "bg-violet-50/40 border-violet-200 shadow-sm"
                : isDark
                  ? "bg-zinc-900/40 border-zinc-800"
                  : "bg-white border-slate-200 shadow-sm"
            }`}>
              <button 
                onClick={() => setExpandedSupportPanels(prev => ({ ...prev, 'acessos': !prev['acessos'] }))}
                className="w-full flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                  <h4 className={`text-xs font-bold uppercase tracking-wide ${isDark ? "text-zinc-300" : "text-slate-600"}`}>
                    Acesso Venoso
                  </h4>
                </div>
                {expandedSupportPanels['acessos'] ? <ChevronUp className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300" /> : <ChevronDown className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300" />}
              </button>
              
              {expandedSupportPanels['acessos'] && (
                <div className={`mt-4 pt-4 border-t animate-in fade-in slide-in-from-top-2 duration-200 ${isDark ? "border-zinc-800" : "border-slate-100"}`}>
                  <div className="space-y-2 text-xs">
                    {/* Peripheral Access Block */}
                    <div className={`p-2.5 rounded-lg border ${isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-slate-50/55 border-slate-100"} space-y-2`}>
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase">Acesso Periférico</span>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={currentPeripheralCount}
                            onChange={(e) => handlePeripheralCountChange(parseInt(e.target.value))}
                            className={`text-xs px-1.5 py-0.5 rounded border font-semibold ${selectClass}`}
                          >
                            <option value={0}>0 acessos</option>
                            <option value={1}>1 acesso</option>
                            <option value={2}>2 acessos</option>
                            <option value={3}>3 acessos</option>
                            <option value={4}>4 acessos</option>
                          </select>
                        </div>
                      </div>

                      {peripheralAccesses.map((acc, index) => (
                        <div key={acc.id} className="space-y-1.5 border-t border-dashed border-slate-200/60 pt-2 first:border-0 first:pt-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-500 uppercase">Linha #{index + 1}</span>
                          </div>
                          <div className="grid grid-cols-1 gap-1.5">
                            <div className="grid grid-cols-2 gap-1.5">
                              {/* Tipo */}
                              <div className="space-y-0.5">
                                <label className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase block">Tipo</label>
                                <input
                                  type="text"
                                  value={acc.type}
                                  onChange={(e) => handleUpdatePeripheralAccessItem(acc.id, { type: e.target.value })}
                                  placeholder="Ex: Venoso Periférico"
                                  className={`w-full text-xs px-2 py-1 border rounded outline-none font-semibold ${inputClass}`}
                                />
                              </div>
                              {/* Calibre */}
                              <div className="space-y-0.5">
                                <label className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase block">Calibre</label>
                                <input
                                  type="text"
                                  value={acc.gauge}
                                  onChange={(e) => handleUpdatePeripheralAccessItem(acc.id, { gauge: e.target.value })}
                                  placeholder="Ex: 18G, 16G"
                                  className={`w-full text-xs px-2 py-1 border rounded outline-none font-semibold ${inputClass}`}
                                />
                              </div>
                            </div>
                            {/* Local */}
                            <div className="space-y-0.5">
                              <label className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase block">Local da Punção</label>
                              <input
                                type="text"
                                value={acc.site}
                                onChange={(e) => handleUpdatePeripheralAccessItem(acc.id, { site: e.target.value })}
                                placeholder="Ex: Fossa Cubital"
                                className={`w-full text-xs px-2 py-1 border rounded outline-none font-semibold ${inputClass}`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Central Access Block */}
                    <div className={`p-2.5 rounded-lg border ${isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-slate-50/55 border-slate-100"} space-y-1.5`}>
                      <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase block">Via Central</span>
                      <select
                        value={currentCentralSite === "Nenhum" ? "Nenhum" : currentCentralSite}
                        onChange={(e) => handleVascularAccessUpdate({ centralSite: e.target.value })}
                        className={`w-full text-xs px-2 py-1 rounded border font-semibold ${selectClass}`}
                      >
                        <option value="Nenhum">Sem acesso central</option>
                        <option value="Veia Jugular Interna Direita (VJI D)">VJI Direita</option>
                        <option value="Veia Jugular Interna Esquerda (VJI E)">VJI Esquerda</option>
                        <option value="Veia Subclávia Direita (VSC D)">Subclávia Direita</option>
                        <option value="Veia Subclávia Esquerda (VSC E)">Subclávia Esquerda</option>
                        <option value="Veia Femoral Direita">Femoral Direita</option>
                        <option value="Veia Femoral Esquerda">Femoral Esquerda</option>
                        <option value="Outra via">Outra via central</option>
                      </select>
                      {currentCentralSite !== "Nenhum" && currentCentralSite !== "Veia Jugular Interna Direita (VJI D)" && currentCentralSite !== "Veia Jugular Interna Esquerda (VJI E)" && currentCentralSite !== "Veia Subclávia Direita (VSC D)" && currentCentralSite !== "Veia Subclávia Esquerda (VSC E)" && currentCentralSite !== "Veia Femoral Direita" && currentCentralSite !== "Veia Femoral Esquerda" && (
                        <input
                          type="text"
                          value={currentCentralSite}
                          onChange={(e) => handleVascularAccessUpdate({ centralSite: e.target.value })}
                          placeholder="Especifique a via central..."
                          className={`w-full text-xs px-2 py-1 border rounded outline-none font-semibold ${inputClass}`}
                        />
                      )}
                    </div>

                    {/* Intercorrências de Acesso */}
                    <div className={`p-2.5 rounded-lg border ${isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-slate-50/55 border-slate-100"} space-y-1.5`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase">Intercorrências de Acesso</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleVascularAccessUpdate({ hasIncidents: false })}
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              !currentHasIncidents
                                ? "bg-emerald-500 text-white"
                                : isDark ? "bg-zinc-800 text-zinc-500" : "bg-slate-200 text-slate-500 dark:text-zinc-400"
                            }`}
                          >
                            Não
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVascularAccessUpdate({ hasIncidents: true })}
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              currentHasIncidents
                                ? "bg-rose-500 text-white animate-pulse"
                                : isDark ? "bg-zinc-800 text-zinc-500" : "bg-slate-200 text-slate-500 dark:text-zinc-400"
                            }`}
                          >
                            Sim
                          </button>
                        </div>
                      </div>

                      {currentHasIncidents && (
                        <input
                          type="text"
                          value={currentIncidentsText}
                          onChange={(e) => handleVascularAccessUpdate({ incidentsText: e.target.value })}
                          placeholder="Quais intercorrências ocorreram?"
                          className={`w-full text-xs px-2 py-1.5 border rounded outline-none font-semibold ${inputClass}`}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DraggablePanel>
    );
  };

    const renderDrugs = () => {
    if (!getIsExpanded('drugs')) return renderCollapsedSquare('drugs', <Syringe className="w-6 h-6 text-rose-500" />, 'Fármacos');
    return (
      <DraggablePanel key="drugs" id="drugs" isDark={isDark} className="w-full max-w-full min-w-0">
        <div className="relative">
          <button onClick={() => togglePanel('drugs')} className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-10"><ChevronUp className="w-4 h-4" /></button>
          <IntraoperativeDrugsPanel
            isDark={isDark}
            cardClass={cardClass}
            borderClass={borderClass}
            inputClass={inputClass}
            selectClass={selectClass}
            document={document}
            onUpdateDocument={onUpdateDocument}
            patient={patient}
            allAvailableDrugs={allAvailableDrugs}
            bolusDrugs={bolusDrugs}
            continuousInfusions={continuousInfusions}
            selectedDrug={selectedDrug}
            setSelectedDrug={setSelectedDrug}
            customDose={customDose}
            setCustomDose={setCustomDose}
            customRoute={customRoute}
            setCustomRoute={setCustomRoute}
            customTime={customTime}
            setCustomTime={setCustomTime}
            timeMode={timeMode}
            setTimeMode={setTimeMode}
            isDrugListExpanded={isDrugListExpanded}
            setIsDrugListExpanded={setIsDrugListExpanded}
            drugSearchQuery={drugSearchQuery}
            setDrugSearchQuery={setDrugSearchQuery}
            selectedDrugCategory={selectedDrugCategory}
            setSelectedDrugCategory={setSelectedDrugCategory}
            showDrugEditor={showDrugEditor}
            setShowDrugEditor={setShowDrugEditor}
            drugEditorMode={drugEditorMode}
            setDrugEditorMode={setDrugEditorMode}
            drugEditorData={drugEditorData}
            setDrugEditorData={setDrugEditorData}
            handleConfirmLaunch={handleConfirmLaunch}
            handleRemoveBolusDrugByName={handleRemoveBolusDrugByName}
            setEditingBolusDrugName={setEditingBolusDrugName}
            setEditingBolusDrugsList={setEditingBolusDrugsList}
            handleRemoveInfusion={handleRemoveInfusion}
            setEditingInfusionId={setEditingInfusionId}
            setEditingInfusionData={setEditingInfusionData}
          />
        </div>
      </DraggablePanel>
    );
  };

  const renderTimers = () => {
    return (
      /* TIMING CONTROL BUTTONS (BARRA DE EVENTOS) */
      <DraggablePanel key="timers" id="timers" isDark={isDark} className="w-full max-w-full min-w-0">
        <div className={`${cardClass} p-5 rounded-lg border space-y-4`}>
          <div className={`flex items-center gap-2 pb-2 border-b ${borderClass}`}>
            <Clock className={`w-5 h-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
            <div>
              <h3 className={`font-bold text-sm ${isDark ? "text-zinc-100" : "text-slate-800"}`}>Cronologia Intraoperatória</h3>
              <p className={`text-xs ${isDark ? "text-zinc-400" : "text-slate-400 dark:text-zinc-500"}`}>Preencha digitando o horário ou clique em "Agora" para registrar o momento atual</p>
            </div>
            <div className="flex-1"></div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTemplatesModal(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition ${isDark ? "bg-indigo-900/40 text-indigo-300 hover:bg-indigo-900/60" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"}`}
              >
                <Layers className="w-4 h-4" />
                Usar Template Clínico
              </button>
            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Início Anestesia */}
            <div className={`p-3 rounded-lg border transition flex flex-col justify-between ${
              timers.startAnesthesia 
                ? isDark ? "bg-indigo-950/20 border-indigo-900/50" : "bg-indigo-50/45 border-indigo-200" 
                : isDark ? "bg-zinc-900/40 border-zinc-800/80" : "bg-zinc-50/50 border-zinc-200/50"
            }`}>
              <div className="flex items-center justify-between gap-1.5 mb-2">
                <span className={`text-xs font-bold flex items-center gap-1 ${isDark ? "text-indigo-300" : "text-indigo-950"}`}>
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  Início Anestesia
                </span>
                {timers.startAnesthesia && (
                  <button
                    onClick={() => handleUpdateTimerValue("startAnesthesia", "Início da Anestesia", "")}
                    className="text-xs text-rose-500 hover:text-rose-700 font-medium hover:underline transition"
                    title="Limpar horário"
                  >
                    Limpar
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={getTimeString(timers.startAnesthesia)}
                  onChange={(e) => handleUpdateTimerValue("startAnesthesia", "Início da Anestesia", e.target.value)}
                  className={`${inputClass} border rounded-lg px-2 py-1.5 text-xs text-center font-semibold focus:outline-none shadow-xs w-full`}
                />
                <button
                  onClick={() => {
                    const nowStr = getLocalTimeStringNow("America/Sao_Paulo");
                    handleUpdateTimerValue("startAnesthesia", "Início da Anestesia", nowStr);
                  }}
                  className={`${isDark ? "bg-indigo-950 text-indigo-300 hover:bg-indigo-900/85 border border-indigo-900/50" : "bg-indigo-600 hover:bg-indigo-500 text-white"} font-bold text-xs uppercase px-2.5 py-2.5 rounded-lg transition shadow-xs whitespace-nowrap`}
                >
                  Agora
                </button>
              </div>
            </div>

            {/* Início Cirurgia */}
            <div className={`p-3 rounded-lg border transition flex flex-col justify-between ${
              timers.startSurgery 
                ? isDark ? "bg-amber-950/20 border-amber-900/50" : "bg-amber-50/45 border-amber-200" 
                : isDark ? "bg-zinc-900/40 border-zinc-800/80" : "bg-zinc-50/50 border-zinc-200/50"
            }`}>
              <div className="flex items-center justify-between gap-1.5 mb-2">
                <span className={`text-xs font-bold flex items-center gap-1 ${isDark ? "text-amber-300" : "text-amber-950"}`}>
                  <Play className="w-3.5 h-3.5 text-amber-500" />
                  Início Cirurgia
                </span>
                {timers.startSurgery && (
                  <button
                    onClick={() => handleUpdateTimerValue("startSurgery", "Início da Cirurgia", "")}
                    className="text-xs text-rose-500 hover:text-rose-700 font-medium hover:underline transition"
                    title="Limpar horário"
                  >
                    Limpar
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={getTimeString(timers.startSurgery)}
                  onChange={(e) => handleUpdateTimerValue("startSurgery", "Início da Cirurgia", e.target.value)}
                  className={`${inputClass} border rounded-lg px-2 py-1.5 text-xs text-center font-semibold focus:outline-none shadow-xs w-full`}
                />
                <button
                  onClick={() => {
                    const nowStr = getLocalTimeStringNow("America/Sao_Paulo");
                    handleUpdateTimerValue("startSurgery", "Início da Cirurgia", nowStr);
                  }}
                  className={`${isDark ? "bg-amber-950 text-amber-300 hover:bg-amber-900/85 border border-amber-900/50" : "bg-amber-600 hover:bg-amber-500 text-white"} font-bold text-xs uppercase px-2.5 py-2.5 rounded-lg transition shadow-xs whitespace-nowrap`}
                >
                  Agora
                </button>
              </div>
            </div>

            {/* Fim Cirurgia */}
            <div className={`p-3 rounded-lg border transition flex flex-col justify-between ${
              timers.endSurgery 
                ? isDark ? "bg-rose-950/20 border-rose-900/50" : "bg-rose-50/45 border-rose-200" 
                : isDark ? "bg-zinc-900/40 border-zinc-800/80" : "bg-zinc-50/50 border-zinc-200/50"
            }`}>
              <div className="flex items-center justify-between gap-1.5 mb-2">
                <span className={`text-xs font-bold flex items-center gap-1 ${isDark ? "text-rose-300" : "text-rose-950"}`}>
                  <Square className="w-3.5 h-3.5 text-rose-500" />
                  Fim Cirurgia
                </span>
                {timers.endSurgery && (
                  <button
                    onClick={() => handleUpdateTimerValue("endSurgery", "Fim da Cirurgia", "")}
                    className="text-xs text-rose-500 hover:text-rose-700 font-medium hover:underline transition"
                    title="Limpar horário"
                  >
                    Limpar
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={getTimeString(timers.endSurgery)}
                  onChange={(e) => handleUpdateTimerValue("endSurgery", "Fim da Cirurgia", e.target.value)}
                  className={`${inputClass} border rounded-lg px-2 py-1.5 text-xs text-center font-semibold focus:outline-none shadow-xs w-full`}
                />
                <button
                  onClick={() => {
                    const nowStr = getLocalTimeStringNow("America/Sao_Paulo");
                    handleUpdateTimerValue("endSurgery", "Fim da Cirurgia", nowStr);
                  }}
                  className={`${isDark ? "bg-rose-950 text-rose-300 hover:bg-rose-900/85 border border-rose-900/50" : "bg-rose-600 hover:bg-rose-500 text-white"} font-bold text-xs uppercase px-2.5 py-2.5 rounded-lg transition shadow-xs whitespace-nowrap`}
                >
                  Agora
                </button>
              </div>
            </div>

            {/* Fim Anestesia */}
            <div className={`p-3 rounded-lg border transition flex flex-col justify-between ${
              timers.endAnesthesia 
                ? isDark ? "bg-zinc-800 border-zinc-700 text-white" : "bg-slate-100 dark:bg-zinc-900/80 border-slate-300" 
                : isDark ? "bg-zinc-900/40 border-zinc-800/80" : "bg-zinc-50/50 border-zinc-200/50"
            }`}>
              <div className="flex items-center justify-between gap-1.5 mb-2">
                <span className={`text-xs font-bold flex items-center gap-1 ${isDark ? "text-zinc-300" : "text-slate-900"}`}>
                  <CheckCircle className="w-3.5 h-3.5 text-zinc-400" />
                  Fim Anestesia
                </span>
                {timers.endAnesthesia && (
                  <button
                    onClick={() => handleUpdateTimerValue("endAnesthesia", "Fim da Anestesia", "")}
                    className="text-xs text-rose-500 hover:text-rose-700 font-medium hover:underline transition"
                    title="Limpar horário"
                  >
                    Limpar
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={getTimeString(timers.endAnesthesia)}
                  onChange={(e) => handleUpdateTimerValue("endAnesthesia", "Fim da Anestesia", e.target.value)}
                  className={`${inputClass} border rounded-lg px-2 py-1.5 text-xs text-center font-semibold focus:outline-none shadow-xs w-full`}
                />
                <button
                  onClick={() => {
                    const nowStr = getLocalTimeStringNow("America/Sao_Paulo");
                    handleUpdateTimerValue("endAnesthesia", "Fim da Anestesia", nowStr);
                  }}
                  className={`${isDark ? "bg-zinc-700 text-zinc-200 hover:bg-zinc-650" : "bg-slate-700 hover:bg-slate-800 text-white"} font-bold text-xs uppercase px-2.5 py-2.5 rounded-lg transition shadow-xs whitespace-nowrap`}
                >
                  Agora
                </button>
              </div>
            </div>
          </div>
        </div></DraggablePanel>
    );
  };

  const renderChart = () => {
    return (
      /* INTEGRATED VITAL PLOTTER */
      <DraggablePanel key="chart" id="chart" isDark={isDark} className="w-full max-w-full min-w-0">
        <div className="flex-1 min-h-[420px]">
          <ClinicalChart
            document={document}
            onTimeSelect={onTimeSelect}
            selectedMinutes={selectedMinutes}
            theme={theme}
            onAddVitalRecord={(record) => {
              const newVitals = [...(document.vitals || []), record];
              onUpdateDocument({ vitals: newVitals });
            }}
            onUpdateVitalRecord={(id, updates) => {
              const newVitals = (document.vitals || []).map(v => v.id === id ? { ...v, ...updates } : v);
              onUpdateDocument({ vitals: newVitals });
            }}
            onRemoveVitalRecord={(id) => {
              const newVitals = (document.vitals || []).filter(v => v.id !== id);
              onUpdateDocument({ vitals: newVitals });
            }}
            onUpdateVitalsList={(newVitals) => {
              onUpdateDocument({ vitals: newVitals });
            }}
          />
        </div></DraggablePanel>
    );
  };

  const renderPanelById = (panelId: string) => {
    switch (panelId) {
      case 'vitals': return renderVitals();
      case 'timers': return renderTimers();
      case 'chart': return renderChart();
      case 'support': return renderSupport();
      case 'infusions': return renderInfusions();
      case 'gases': return renderGases();
      case 'hydration': return renderHydration();
      case 'events': return renderEvents();
      case 'drugs': return renderDrugs();
      default: return null;
    }
  };

  return (
    <div className="space-y-4 w-full">
      {/* 1. CRONOLOGIA (TIMERS) ALWAYS OPEN AND FIXED ABOVE THE CHART */}
      <div className="w-full">
        {renderTimers()}
      </div>

      {/* 2. CLINICAL CHART ALWAYS FIXED */}
      <div className="w-full">
        {renderChart()}
      </div>

      {/* 3. COMPACT AND ELEGANT CLINICAL TABS ROW (RESPONSIVE GRID) */}
      <div className={`grid grid-cols-4 sm:grid-cols-7 gap-1 sm:gap-1.5 p-1 rounded-lg border ${
        isDark 
          ? "bg-[#1C1C1E] border-zinc-800 shadow-inner" 
          : "bg-indigo-50/50 border-indigo-100/60 shadow-sm"
      }`}>
        {CLINICAL_TABS.map((tab) => {
          const isActive = activeClinicalTabs.includes(tab.id);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveClinicalTabs(prev => 
                  prev.includes(tab.id)
                    ? prev.filter(id => id !== tab.id)
                    : [...prev, tab.id]
                );
              }}
              className={`w-full flex items-center justify-center gap-1 sm:gap-1.5 px-1 py-2 sm:px-3 sm:py-2 rounded-lg text-xs xs:text-xs sm:text-xs font-bold transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                isActive
                  ? isDark
                    ? "bg-indigo-600 text-white shadow-sm "
                    : "bg-indigo-600 text-white shadow-sm "
                  : isDark
                    ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                    : "text-slate-600 hover:text-indigo-600 hover:bg-white"
              }`}
            >
              <span className="text-xs sm:text-sm">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

        {/* 4. ACTIVE SUB-PANELS */}
        <div className="flex flex-col gap-4 w-full transition-all duration-200">
          {CLINICAL_TABS.map((tab) => {
            if (activeClinicalTabs.includes(tab.id)) {
              return (
                <div key={tab.id} className="w-full">
                  {renderPanelById(tab.id)}
                </div>
              );
            }
            return null;
          })}
        </div>

      {/* Drug Editor Modal */}
      {showDrugEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-lg shadow-sm p-5 ${isDark ? "bg-zinc-900 border border-zinc-800" : "bg-white border border-slate-200"}`}>
            <h3 className={`font-bold text-lg mb-4 flex items-center gap-2 ${isDark ? "text-zinc-100" : "text-slate-800"}`}>
              <Layers className="w-5 h-5 text-rose-500" />
              {drugEditorMode === "create" ? "Criar Novo Fármaco" : "Editar Fármaco"}
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className={`text-xs font-bold block ${isDark ? "text-zinc-400" : "text-slate-600"}`}>Nome do Fármaco</label>
                <input
                  type="text"
                  value={drugEditorData.name || ""}
                  onChange={(e) => setDrugEditorData({ ...drugEditorData, name: e.target.value })}
                  placeholder="Ex: Dipirona"
                  className={`w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none transition-colors ${
                    isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-rose-500" : "bg-slate-50 border-slate-200 text-slate-800 focus:border-rose-500"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={`text-xs font-bold block ${isDark ? "text-zinc-400" : "text-slate-600"}`}>Dose Padrão</label>
                  <input
                    type="number"
                    step="any"
                    value={drugEditorData.defaultDose || ""}
                    onChange={(e) => setDrugEditorData({ ...drugEditorData, defaultDose: parseFloat(e.target.value) })}
                    className={`w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none transition-colors ${
                      isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-rose-500" : "bg-slate-50 border-slate-200 text-slate-800 focus:border-rose-500"
                    }`}
                  />
                </div>
                <div className="space-y-1">
                  <label className={`text-xs font-bold block ${isDark ? "text-zinc-400" : "text-slate-600"}`}>Unidade</label>
                  <select
                    value={drugEditorData.defaultUnit || "mg"}
                    onChange={(e) => setDrugEditorData({ ...drugEditorData, defaultUnit: e.target.value })}
                    className={`w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none transition-colors ${
                      isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-rose-500" : "bg-slate-50 border-slate-200 text-slate-800 focus:border-rose-500"
                    }`}
                  >
                    <option value="mg">mg</option>
                    <option value="mcg">mcg</option>
                    <option value="g">g</option>
                    <option value="UI">UI</option>
                    <option value="ml">ml</option>
                    <option value="mEq">mEq</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={`text-xs font-bold block ${isDark ? "text-zinc-400" : "text-slate-600"}`}>Apresentação (Massa)</label>
                    <input
                      type="number"
                      step="any"
                      value={(drugEditorData as any).ampouleAmount || ""}
                      onChange={(e) => setDrugEditorData({ ...drugEditorData, ampouleAmount: parseFloat(e.target.value) })}
                      placeholder={`Ex: 2`}
                      className={`w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none transition-colors ${
                        isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-rose-500" : "bg-slate-50 border-slate-200 text-slate-800 focus:border-rose-500"
                      }`}
                    />
                    <p className={`text-xs ${isDark ? "text-zinc-500" : "text-slate-400 dark:text-zinc-500"}`}>
                      Total em {drugEditorData.defaultUnit || "mg"}.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className={`text-xs font-bold block ${isDark ? "text-zinc-400" : "text-slate-600"}`}>Volume da Ampola (mL)</label>
                    <input
                      type="number"
                      step="any"
                      value={(drugEditorData as any).ampouleVolume || ""}
                      onChange={(e) => setDrugEditorData({ ...drugEditorData, ampouleVolume: parseFloat(e.target.value) })}
                      placeholder={`Ex: 10`}
                      className={`w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none transition-colors ${
                        isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-rose-500" : "bg-slate-50 border-slate-200 text-slate-800 focus:border-rose-500"
                      }`}
                    />
                    <p className={`text-xs ${isDark ? "text-zinc-500" : "text-slate-400 dark:text-zinc-500"}`}>
                      Volume total da ampola.
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className={`text-xs font-bold block ${isDark ? "text-zinc-400" : "text-slate-600"}`}>Via Padrão</label>
                  <select
                    value={drugEditorData.defaultRoute || "EV"}
                    onChange={(e) => setDrugEditorData({ ...drugEditorData, defaultRoute: e.target.value })}
                    className={`w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none transition-colors ${
                      isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-rose-500" : "bg-slate-50 border-slate-200 text-slate-800 focus:border-rose-500"
                    }`}
                  >
                    <option value="EV">EV</option>
                    <option value="IM">IM</option>
                    <option value="SC">SC</option>
                    <option value="IO">IO</option>
                    <option value="Raqui">Raqui</option>
                    <option value="Peridural">Peridural</option>
                    <option value="Bloqueio">Bloqueio</option>
                    <option value="Inalatório">Inalatório</option>
                    <option value="ID">ID</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className={`text-xs font-bold block ${isDark ? "text-zinc-400" : "text-slate-600"}`}>Categoria</label>
                <select
                  value={drugEditorData.category || "Outros"}
                  onChange={(e) => setDrugEditorData({ ...drugEditorData, category: e.target.value })}
                  className={`w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none transition-colors ${
                    isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-rose-500" : "bg-slate-50 border-slate-200 text-slate-800 focus:border-rose-500"
                  }`}
                >
                  {["Sedativos / Indutores", "Bloqueadores Neuromusculares", "Opioides / Analgésicos", "Cardiovascular / Vasoativos", "Antieméticos", "Adjuvantes e Reversores", "Anestésicos Locais", "Anestésicos Inalatórios"].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200/20">
                <button
                  type="button"
                  onClick={() => setShowDrugEditor(false)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition ${
                    isDark ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" : "bg-slate-100 dark:bg-zinc-900/80 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!drugEditorData.name) return;
                    
                    let newSavedDrugs;
                    if (drugEditorMode === "create") {
                      // Add new drug
                      newSavedDrugs = [...allAvailableDrugs, drugEditorData as any];
                    } else {
                      // Update existing drug
                      newSavedDrugs = allAvailableDrugs.map(d => d.name === drugEditorData.name ? drugEditorData as any : d);
                    }
                    
                    setAllAvailableDrugs(newSavedDrugs);
                    try {
                      localStorage.setItem("allCustomDrugs_v2", JSON.stringify(newSavedDrugs));
                    } catch (err) {
                      console.error(err);
                    }
                    
                    if (selectedDrug.name === drugEditorData.name || drugEditorMode === "create") {
                      setSelectedDrug(drugEditorData as any);
                      setCustomDose(drugEditorData.defaultDose?.toString() || "");
                      setCustomRoute(drugEditorData.defaultRoute || "EV");
                    }
                    
                    setShowDrugEditor(false);
                  }}
                  disabled={!drugEditorData.name}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-2.5 rounded-lg text-xs font-bold transition disabled:opacity-50"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Side-panel slide over drawer */}
      <AnesthesiaDescriptionDrawer
        isOpen={isNarrativeDrawerOpen}
        onClose={() => setIsNarrativeDrawerOpen(false)}
        document={document}
        onUpdateDocument={onUpdateDocument}
        theme={theme}
        startAiSupervisor={startAiSupervisor}
        stopAiSupervisor={stopAiSupervisor}
      />
      {/* Modals & Dialogs */}
      {(showTemplatesModal || pendingTemplateForReview) && (
        <AnesthesiaTemplatesModal
          onClose={() => {
            setShowTemplatesModal(false);
            if (onClearPendingTemplate) onClearPendingTemplate();
          }}
          onApplyTemplate={(template) => {
            handleApplyTemplate(template); setShowTemplatesModal(false);
            if (onClearPendingTemplate) onClearPendingTemplate();
          }}
          theme={theme}
          initialReviewTemplate={pendingTemplateForReview}
        />
      )}

      {/* EDIT BOLUS DRUG MODAL */}
      {editingBolusDrugName && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-2xl rounded-lg border shadow-sm flex flex-col max-h-[90vh] overflow-hidden ${
            isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"
          }`}>
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between dark:border-zinc-800">
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-rose-500">
                  Editar Fármaco Administrado
                </h3>
                <p className={`text-xs font-bold ${isDark ? "text-zinc-300" : "text-slate-700"}`}>
                  {editingBolusDrugName}
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingBolusDrugName(null);
                  setEditingBolusDrugsList([]);
                }}
                className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition`}
              >
                <span className="text-xl">&times;</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {editingBolusDrugsList.map((drug, index) => {
                return (
                  <div
                    key={drug.id}
                    className={`p-4 rounded-lg border space-y-3 ${
                      isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        isDark ? "bg-zinc-800 text-zinc-400" : "bg-slate-200 text-slate-600"
                      }`}>
                        Aplicação #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBolusDrugsList(prev => prev.filter(d => d.id !== drug.id));
                        }}
                        className="text-rose-500 hover:text-rose-600 text-xs font-bold flex items-center gap-1 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Excluir esta dose
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {/* Dose */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Dose ({drug.unit})</label>
                        <input
                          type="number"
                          value={drug.dose}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setEditingBolusDrugsList(prev => prev.map(d => d.id === drug.id ? { ...d, dose: val } : d));
                          }}
                          className={`w-full text-xs px-2.5 py-1.5 rounded-lg border outline-none font-bold ${
                            isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"
                          }`}
                        />
                      </div>

                      {/* Route */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Via</label>
                        <select
                          value={drug.route}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setEditingBolusDrugsList(prev => prev.map(d => d.id === drug.id ? { ...d, route: val } : d));
                          }}
                          className={`w-full text-xs px-2 py-1.5 rounded-lg border outline-none font-bold ${
                            isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"
                          }`}
                        >
                          <option value="EV">EV</option>
                          <option value="IM">IM</option>
                          <option value="SC">SC</option>
                          <option value="IO">IO</option>
                          <option value="Raqui">Raqui</option>
                          <option value="Peridural">Peridural</option>
                          <option value="Bloqueio">Bloqueio</option>
                          <option value="Inalatório">Inalatório</option>
                          <option value="ID">ID</option>
                        </select>
                      </div>

                      {/* Ampoules */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Ampolas</label>
                        <input
                          type="number"
                          value={drug.ampoules || ""}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setEditingBolusDrugsList(prev => prev.map(d => d.id === drug.id ? { ...d, ampoules: val } : d));
                          }}
                          placeholder="1"
                          className={`w-full text-xs px-2.5 py-1.5 rounded-lg border outline-none font-bold ${
                            isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"
                          }`}
                        />
                      </div>

                      {/* Time */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Horário (Local)</label>
                        <input
                          type="time"
                          value={formatToLocalTime(drug.timestamp, "America/Sao_Paulo")}
                          onChange={(e) => {
                            const timeStr = e.target.value;
                            const patientDate = document.patient?.date || getLocalDateStringNow("America/Sao_Paulo");
                            const newTimestamp = combineDateAndTime(patientDate, timeStr, "America/Sao_Paulo");
                            const startTimeMs = timers.startAnesthesia ? new Date(timers.startAnesthesia).getTime() : new Date(newTimestamp).getTime();
                            const elapsedMins = Math.round((new Date(newTimestamp).getTime() - startTimeMs) / 60000);
                            
                            setEditingBolusDrugsList(prev => prev.map(d => d.id === drug.id ? { 
                              ...d, 
                              timestamp: newTimestamp,
                              minutesFromStart: elapsedMins
                            } : d));
                          }}
                          className={`w-full text-xs px-2.5 py-1.5 rounded-lg border outline-none font-bold ${
                            isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {editingBolusDrugsList.length === 0 && (
                <p className="text-center text-xs text-zinc-500 py-4">Nenhuma dose registrada. Ao salvar, este fármaco será removido completamente.</p>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t dark:border-zinc-800 flex justify-end gap-3">
              <button
                onClick={() => {
                  setEditingBolusDrugName(null);
                  setEditingBolusDrugsList([]);
                }}
                className={`px-4 py-2 text-xs font-bold rounded-lg border transition ${
                  isDark ? "border-zinc-800 hover:bg-zinc-900 text-zinc-400" : "border-slate-200 hover:bg-slate-100 text-slate-600"
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const otherDrugs = bolusDrugs.filter(d => d.name !== editingBolusDrugName);
                  onUpdateDocument({
                    bolusDrugs: [...otherDrugs, ...editingBolusDrugsList]
                  });
                  setEditingBolusDrugName(null);
                  setEditingBolusDrugsList([]);
                }}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CONTINUOUS INFUSION MODAL */}
      {editingInfusionId && editingInfusionData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-xl rounded-lg border shadow-sm flex flex-col max-h-[90vh] overflow-hidden ${
            isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"
          }`}>
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between dark:border-zinc-800">
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-indigo-500">
                  Editar Infusão Contínua
                </h3>
                <p className={`text-xs font-bold ${isDark ? "text-zinc-300" : "text-slate-700"}`}>
                  {editingInfusionData.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingInfusionId(null);
                  setEditingInfusionData(null);
                }}
                className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition`}
              >
                <span className="text-xl">&times;</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Name */}
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Nome do Fármaco</label>
                  <input
                    type="text"
                    value={editingInfusionData.name}
                    onChange={(e) => setEditingInfusionData((prev: any) => ({ ...prev, name: e.target.value }))}
                    className={`w-full text-xs px-3 py-2 rounded-lg border outline-none font-bold ${
                      isDark ? "bg-zinc-900 border-zinc-800 text-zinc-100 focus:border-indigo-500" : "bg-white border-slate-200 text-slate-800 focus:border-indigo-500"
                    }`}
                  />
                </div>

                {/* Concentration */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Concentração</label>
                  <input
                    type="text"
                    value={editingInfusionData.concentration}
                    onChange={(e) => setEditingInfusionData((prev: any) => ({ ...prev, concentration: e.target.value }))}
                    className={`w-full text-xs px-3 py-2 rounded-lg border outline-none font-bold ${
                      isDark ? "bg-zinc-900 border-zinc-800 text-zinc-100 focus:border-indigo-500" : "bg-white border-slate-200 text-slate-800 focus:border-indigo-500"
                    }`}
                  />
                </div>

                {/* Diluent */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Diluente</label>
                  <input
                    type="text"
                    value={editingInfusionData.diluent}
                    onChange={(e) => setEditingInfusionData((prev: any) => ({ ...prev, diluent: e.target.value }))}
                    className={`w-full text-xs px-3 py-2 rounded-lg border outline-none font-bold ${
                      isDark ? "bg-zinc-900 border-zinc-800 text-zinc-100 focus:border-indigo-500" : "bg-white border-slate-200 text-slate-800 focus:border-indigo-500"
                    }`}
                  />
                </div>

                {/* Total Volume Prepared */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Volume Preparado (ml)</label>
                  <input
                    type="number"
                    value={editingInfusionData.totalVolumePrepared || ""}
                    onChange={(e) => setEditingInfusionData((prev: any) => ({ ...prev, totalVolumePrepared: parseFloat(e.target.value) || 0 }))}
                    className={`w-full text-xs px-3 py-2 rounded-lg border outline-none font-bold ${
                      isDark ? "bg-zinc-900 border-zinc-800 text-zinc-100 focus:border-indigo-500" : "bg-white border-slate-200 text-slate-800 focus:border-indigo-500"
                    }`}
                  />
                </div>

                {/* Ampoules */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Nº Ampolas Usadas</label>
                  <input
                    type="number"
                    value={editingInfusionData.ampoules || ""}
                    onChange={(e) => setEditingInfusionData((prev: any) => ({ ...prev, ampoules: parseInt(e.target.value) || 0 }))}
                    className={`w-full text-xs px-3 py-2 rounded-lg border outline-none font-bold ${
                      isDark ? "bg-zinc-900 border-zinc-800 text-zinc-100 focus:border-indigo-500" : "bg-white border-slate-200 text-slate-800 focus:border-indigo-500"
                    }`}
                  />
                </div>

                {/* Dose Rate */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Vazão / Dose Atual</label>
                  <input
                    type="number"
                    step="any"
                    value={editingInfusionData.rate || ""}
                    onChange={(e) => setEditingInfusionData((prev: any) => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
                    className={`w-full text-xs px-3 py-2 rounded-lg border outline-none font-bold ${
                      isDark ? "bg-zinc-900 border-zinc-800 text-zinc-100 focus:border-indigo-500" : "bg-white border-slate-200 text-slate-800 focus:border-indigo-500"
                    }`}
                  />
                </div>

                {/* Unit */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Unidade de Vazão</label>
                  <select
                    value={editingInfusionData.unit}
                    onChange={(e) => setEditingInfusionData((prev: any) => ({ ...prev, unit: e.target.value as any }))}
                    className={`w-full text-xs px-2 py-2 rounded-lg border outline-none font-bold ${
                      isDark ? "bg-zinc-900 border-zinc-800 text-zinc-100 focus:border-indigo-500" : "bg-white border-slate-200 text-slate-800 focus:border-indigo-500"
                    }`}
                  >
                    <option value="mcg/kg/min">mcg/kg/min</option>
                    <option value="mcg/kg/h">mcg/kg/h</option>
                    <option value="mg/kg/min">mg/kg/min</option>
                    <option value="mg/kg/h">mg/kg/h</option>
                    <option value="mg/h">mg/h</option>
                    <option value="mcg/h">mcg/h</option>
                    <option value="mcg/min">mcg/min</option>
                    <option value="ml/h">ml/h</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t dark:border-zinc-800 flex justify-end gap-3">
              <button
                onClick={() => {
                  setEditingInfusionId(null);
                  setEditingInfusionData(null);
                }}
                className={`px-4 py-2 text-xs font-bold rounded-lg border transition ${
                  isDark ? "border-zinc-800 hover:bg-zinc-900 text-zinc-400" : "border-slate-200 hover:bg-slate-100 text-slate-600"
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const updated = continuousInfusions.map(inf => {
                    if (inf.id === editingInfusionId) {
                      const updatedHist = [...(inf.history || [])];
                      if (updatedHist.length > 0) {
                        const lastIdx = updatedHist.length - 1;
                        updatedHist[lastIdx] = {
                          ...updatedHist[lastIdx],
                          rate: editingInfusionData.rate
                        };
                      }
                      return {
                        ...inf,
                        ...editingInfusionData,
                        history: updatedHist
                      };
                    }
                    return inf;
                  });
                  onUpdateDocument({
                    continuousInfusions: updated
                  });
                  setEditingInfusionId(null);
                  setEditingInfusionData(null);
                }}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

  </div>
  );
}