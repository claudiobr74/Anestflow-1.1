/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";

import { AnesthesiaDocument, VitalRecord, BolusDrug, ContinuousInfusion, FluidRecord, OutputRecord, ClinicalEvent, VascularAccess, EquipmentConfig, InhalationAgent, AirwayDetails, AnesthesiaDocumentPatch } from "../types";
import { Syringe, HandHelping, Zap, Info, Settings, FlaskConical, Play, Pause, Square, Plus, Minus, Check, RefreshCw, Layers, Droplets, Trash2, ShieldAlert, CheckCircle, Clock, AlertTriangle, Sliders, Bell, BellOff, Search, FileText, Wind, ChevronDown, ChevronUp, Activity, Edit2, ChevronLeft, ChevronRight, Smartphone } from "lucide-react";
import { FAVORITE_DRUGS, FAVORITE_FLUIDS, CLINICAL_EVENTS_PRESETS } from "../mockData";
import AnesthesiaDescriptionDrawer from "./AnesthesiaDescriptionDrawer";
import AnesthesiaTemplatesModal from "./AnesthesiaTemplatesModal";
import { AnesthesiaTemplate } from "../types";
import { combineDateAndTime, formatToLocalTime, getLocalDateStringNow, getLocalTimeStringNow, getTzParts } from "../utils/timezone";
import { newClientId } from "../lib/procedureMapper";
import { resolveActiveVitalInterval } from "../lib/vitalInterval";
import { playVitalOverdueBeep } from "../lib/vitalAlertSound";
import { IntraoperativeUiProvider } from "./intra/IntraoperativeUiContext";
import IntraoperativeVitalsLaunch from "./intra/IntraoperativeVitalsLaunch";
import IntraoperativeInfusionsLaunch from "./intra/IntraoperativeInfusionsLaunch";
import IntraoperativeGasesLaunch from "./intra/IntraoperativeGasesLaunch";
import IntraoperativeHydrationLaunch from "./intra/IntraoperativeHydrationLaunch";
import IntraoperativeEventsLaunch from "./intra/IntraoperativeEventsLaunch";
import IntraoperativeSupportLaunch from "./intra/IntraoperativeSupportLaunch";
import IntraoperativeDrugsLaunch from "./intra/IntraoperativeDrugsLaunch";
import IntraoperativeTimersLaunch from "./intra/IntraoperativeTimersLaunch";
import IntraoperativeChartLaunch from "./intra/IntraoperativeChartLaunch";

interface IntraoperativeTabProps {
  ficha: AnesthesiaDocument;
  onUpdateDocument: (updates: AnesthesiaDocumentPatch) => void;
  selectedMinutes: number | null;
  onTimeSelect: (mins: number | null) => void;
  theme?: "light" | "dark" | "dark-clean";
  pendingTemplateForReview?: AnesthesiaTemplate | null;
  onClearPendingTemplate?: () => void;
  startAiSupervisor?: (taskName: string, onTimeout: () => void) => void;
  stopAiSupervisor?: (reason: string) => void;
  canEdit?: boolean;
  vitalIntervalMinutes?: number;
  soundAlertsEnabled?: boolean;
  compactMode?: boolean;
  onPatchAppSettings?: (patch: {
    vitalIntervalMinutes?: number;
    soundAlertsEnabled?: boolean;
    compactMode?: boolean;
  }) => void;
}

export default function IntraoperativeTab({
  ficha,
  onUpdateDocument: applyDocument,
  selectedMinutes,
  onTimeSelect,
  theme = "light",
  pendingTemplateForReview,
  onClearPendingTemplate,
  startAiSupervisor,
  stopAiSupervisor,
  canEdit = true,
  vitalIntervalMinutes = 5,
  soundAlertsEnabled = true,
  compactMode = false,
  onPatchAppSettings
}: IntraoperativeTabProps) {
  const onUpdateDocument = (updates: AnesthesiaDocumentPatch) => {
    if (!canEdit) return;
    applyDocument(updates);
  };

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
} = ficha;

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

  // Interval & fill alarm state — default from settings (not a second independent clock)
  const [loggingInterval, setLoggingInterval] = useState<number>(vitalIntervalMinutes);
  const [isCustomInterval, setIsCustomInterval] = useState<boolean>(
    vitalIntervalMinutes !== 5 && vitalIntervalMinutes !== 10 && vitalIntervalMinutes !== 15
  );
  const [customIntervalVal, setCustomIntervalVal] = useState<string>(String(vitalIntervalMinutes));
  const [nowTime, setNowTime] = useState<number>(Date.now());
  const [simulatedDelayMs, setSimulatedDelayMs] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(soundAlertsEnabled);

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

  useEffect(() => {
    setLoggingInterval(vitalIntervalMinutes);
    if (vitalIntervalMinutes === 5 || vitalIntervalMinutes === 10 || vitalIntervalMinutes === 15) {
      setIsCustomInterval(false);
    } else {
      setIsCustomInterval(true);
      setCustomIntervalVal(String(vitalIntervalMinutes));
    }
  }, [vitalIntervalMinutes]);

  useEffect(() => {
    setSoundEnabled(soundAlertsEnabled);
  }, [soundAlertsEnabled]);

  // Timer Click Helpers
  const handleTimerClick = (key: keyof typeof timers, label: string) => {
    const confirmed = window.confirm(`Deseja registrar o horário de: "${label}" como o horário atual?`);
    if (!confirmed) return;

    const nowIso = new Date().toISOString();
    const newEvent: ClinicalEvent = {
      id: newClientId(),
      name: label,
      timestamp: nowIso,
      category: "Marcador Temporal",
    };

    onUpdateDocument((prev) => ({
      timers: { ...prev.timers, [key]: nowIso },
      events: [...(prev.events || []), newEvent]
    }));
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
      onUpdateDocument((prev) => {
        const updatedTimers = { ...prev.timers };
        delete updatedTimers[key];
        return {
          timers: updatedTimers,
          events: (prev.events || []).filter(e => e.name !== label)
        };
      });
      return;
    }

    const patientDate = ficha.patient?.date || getLocalDateStringNow("America/Sao_Paulo");
    const isoString = combineDateAndTime(patientDate, timeString, "America/Sao_Paulo");

    onUpdateDocument((prev) => {
      const updatedEvents = (prev.events || []).filter(e => e.name !== label);
      updatedEvents.push({
        id: newClientId(),
        name: label,
        timestamp: isoString,
        category: "Marcador Temporal",
      });
      return {
        timers: { ...prev.timers, [key]: isoString },
        events: updatedEvents
      };
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
    onUpdateDocument((prev) => {
      const prevVitals = prev.vitals || [];
      const prevTimers = prev.timers || {};
      const mins = selectedMinutes !== null ? selectedMinutes :
        (prevTimers.startAnesthesia ? Math.round((Date.now() - new Date(prevTimers.startAnesthesia).getTime()) / 60000) : 0);

      const existingIndex = prevVitals.findIndex(v => v.minutesFromStart === mins);

      const newRecord: VitalRecord = {
        id: existingIndex >= 0 ? prevVitals[existingIndex].id : newClientId(),
        timestamp: prevTimers.startAnesthesia ? new Date(new Date(prevTimers.startAnesthesia).getTime() + mins * 60 * 1000).toISOString() : new Date().toISOString(),
        minutesFromStart: mins,
        pas: activeVitalsInput.pas ? parseInt(activeVitalsInput.pas) : (existingIndex >= 0 ? prevVitals[existingIndex].pas : undefined),
        pad: activeVitalsInput.pad ? parseInt(activeVitalsInput.pad) : (existingIndex >= 0 ? prevVitals[existingIndex].pad : undefined),
        fc: activeVitalsInput.fc ? parseInt(activeVitalsInput.fc) : (existingIndex >= 0 ? prevVitals[existingIndex].fc : undefined),
        spo2: activeVitalsInput.spo2 ? parseInt(activeVitalsInput.spo2) : (existingIndex >= 0 ? prevVitals[existingIndex].spo2 : undefined),
        etco2: activeVitalsInput.etco2 ? parseInt(activeVitalsInput.etco2) : (existingIndex >= 0 ? prevVitals[existingIndex].etco2 : undefined),
        temp: activeVitalsInput.temp ? parseFloat(activeVitalsInput.temp) : (existingIndex >= 0 ? prevVitals[existingIndex].temp : undefined),
        pai: activeVitalsInput.pai ? parseInt(activeVitalsInput.pai) : (existingIndex >= 0 ? prevVitals[existingIndex].pai : undefined),
        bis: activeVitalsInput.bis ? parseInt(activeVitalsInput.bis) : (existingIndex >= 0 ? prevVitals[existingIndex].bis : undefined),
      };

      if (newRecord.pas !== undefined && newRecord.pad !== undefined) {
        newRecord.pam = Math.round(newRecord.pad + (newRecord.pas - newRecord.pad) / 3);
      }

      const updatedVitals = [...prevVitals];
      if (existingIndex >= 0) {
        updatedVitals[existingIndex] = { ...updatedVitals[existingIndex], ...newRecord };
      } else {
        updatedVitals.push(newRecord);
      }
      return { vitals: updatedVitals };
    });
    setSimulatedDelayMs(0);
    
    setActiveVitalsInput({});
    setActiveField("pas");
    onTimeSelect(null);
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
      const patientDate = ficha.patient?.date || getLocalDateStringNow("America/Sao_Paulo");
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
      id: newClientId(),
      name: selectedDrug.name,
      dose: parsedDose,
      ampouleTotal: (selectedDrug as any).ampouleAmount,
      ampoules: parsedAmpoules,
      unit: selectedDrug.defaultUnit as any,
      route: customRoute as any,
      timestamp,
      minutesFromStart: mins,
      
    };

    const newEvent: ClinicalEvent = {
      id: newClientId(),
      name: `Bolus: ${selectedDrug.name} ${parsedDose}${selectedDrug.defaultUnit}${parsedAmpoules ? ` (${parsedAmpoules} amp)` : ''}`,
      timestamp,
      category: "Procedimento" as any,
      
    };

    onUpdateDocument((prev) => ({
      bolusDrugs: [...(prev.bolusDrugs || []), newBolus],
      events: [...(prev.events || []), newEvent]
    }));
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
      const patientDate = ficha.patient?.date || getLocalDateStringNow("America/Sao_Paulo");
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
      const patientDate = ficha.patient?.date || getLocalDateStringNow("America/Sao_Paulo");
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

    onUpdateDocument((prev) => ({
      continuousInfusions: [...(prev.continuousInfusions || []), newInf],
      events: [...(prev.events || []), newEvent, ...(newInfusion.endTimeMode === "custom" && newInfusion.customEndTime
        ? [{
            id: newClientId(),
            name: `Bomba: ${newInfusion.name} finalizada`,
            timestamp: combineDateAndTime(ficha.patient?.date || getLocalDateStringNow("America/Sao_Paulo"), newInfusion.customEndTime, "America/Sao_Paulo"),
            category: "Procedimento" as any,
          }]
        : [])]
    }));

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
    onUpdateDocument((prev) => ({
      continuousInfusions: (prev.continuousInfusions || []).filter(inf => inf.id !== id)
    }));
  };

  const handleRemoveBolusDrugByName = (name: string) => {
    onUpdateDocument((prev) => ({
      bolusDrugs: (prev.bolusDrugs || []).filter(d => d.name !== name)
    }));
  };

  const handleUpdateInfusionStatus = (id: string, status: "Alterado" | "Pausado" | "Finalizado", newRate?: number) => {
    const mins = timers.startAnesthesia ? Math.round((Date.now() - new Date(timers.startAnesthesia).getTime()) / 60000) : 0;
    
    onUpdateDocument((prev) => {
      const updated = (prev.continuousInfusions || []).map(inf => {
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
      return { continuousInfusions: updated };
    });
  };

  const handleUpdateInfusion = (id: string, updates: Partial<ContinuousInfusion>) => {
    let modifiedUpdates = { ...updates };
    if (modifiedUpdates.history) {
      modifiedUpdates.history = modifiedUpdates.history.map(h => {
        const mins = timers.startAnesthesia ? Math.round((new Date(h.timestamp).getTime() - new Date(timers.startAnesthesia).getTime()) / 60000) : 0;
        return { ...h, minutesFromStart: mins };
      });
    }
    onUpdateDocument((prev) => ({
      continuousInfusions: (prev.continuousInfusions || []).map(inf => {
        if (inf.id === id) {
          return { ...inf, ...modifiedUpdates };
        }
        return inf;
      })
    }));
  };

  // Gases and Inhalation agent management
  const handleStartInhalationAgent = () => {
    if ((ficha.inhalationAgents || []).some(ia => ia.agent === newAgent.agent)) {
      return;
    }
    let startTimestamp: string;
    let startMins: number;

    if (newAgent.startTimeMode === "now") {
      startTimestamp = new Date().toISOString();
      startMins = timers.startAnesthesia ? Math.round((Date.now() - new Date(timers.startAnesthesia).getTime()) / 60000) : 0;
    } else {
      const patientDate = ficha.patient?.date || getLocalDateStringNow("America/Sao_Paulo");
      const timeStr = newAgent.customStartTime || "00:00";
      const isoString = combineDateAndTime(patientDate, timeStr, "America/Sao_Paulo");
      startTimestamp = isoString;
      
      const targetTimeMs = new Date(isoString).getTime();
      const startTimeMs = timers.startAnesthesia ? new Date(timers.startAnesthesia).getTime() : targetTimeMs;
      startMins = Math.round((targetTimeMs - startTimeMs) / 60000);
    }

    let endTimestamp: string | undefined = undefined;
    if (newAgent.endTimeMode === "custom" && newAgent.customEndTime) {
      const patientDate = ficha.patient?.date || getLocalDateStringNow("America/Sao_Paulo");
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
      id: newClientId(),
      name: newEventName,
      timestamp: startTimestamp,
      category: "Procedimento" as any,
      
    };

    onUpdateDocument((prev) => {
      const extra = endTimestamp ? [{
        id: newClientId(),
        name: isO2 ? `O₂ finalizado` : `${newAgent.agent} finalizado`,
        timestamp: endTimestamp,
        category: "Procedimento" as any,
      }] : [];
      return {
        inhalationAgents: [...(prev.inhalationAgents || []), newInh],
        events: [...(prev.events || []), newEvent, ...extra]
      };
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
    onUpdateDocument((prev) => ({
      inhalationAgents: (prev.inhalationAgents || []).filter(ia => ia.id !== id)
    }));
  };

  const handleStopInhalationAgent = (id: string) => {
    onUpdateDocument((prev) => {
      const list = prev.inhalationAgents || [];
      const updated = list.map(ia => ia.id === id ? { ...ia, endTime: new Date().toISOString() } : ia);
      const targetInh = list.find(ia => ia.id === id);
      const isO2 = targetInh?.agent === "Oxigênio (O₂)";
      const agentName = targetInh?.agent ? (isO2 ? "O₂" : targetInh.agent) : "Gases Medicinais";
      const stopEvent: ClinicalEvent = {
        id: newClientId(),
        name: `${agentName} finalizado`,
        timestamp: new Date().toISOString(),
        category: "Procedimento" as any,
      };
      return {
        inhalationAgents: updated,
        events: [...(prev.events || []), stopEvent]
      };
    });
  };

  const handleUpdateInhalationAgent = (id: string, updates: Partial<InhalationAgent>) => {
    onUpdateDocument((prev) => {
      const list = prev.inhalationAgents || [];
      const updated = list.map(ia => ia.id === id ? { ...ia, ...updates } : ia);
      const targetInh = list.find(ia => ia.id === id);
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
      const isTimeEdit = ('startTime' in updates) || ('endTime' in updates);
      let evts = prev.events || [];
      if (!isTimeEdit && targetInh && (updates.flowO2 !== undefined || updates.inspiredConc !== undefined)) {
        evts = [...evts, {
          id: newClientId(),
          name: eventName,
          timestamp: new Date().toISOString(),
          category: "Procedimento" as any,
        }];
      }
      return { inhalationAgents: updated, events: evts };
    });
  };

  
  // --- RECONSTRUCTED MISSING CODE ---
  const activeInterval = resolveActiveVitalInterval({
    loggingInterval,
    isCustomInterval,
    customIntervalVal
  });
  const lastVital = ficha.vitals && ficha.vitals.length > 0 ? ficha.vitals[ficha.vitals.length - 1] : null;
  const lastVitalTime = lastVital ? new Date(lastVital.timestamp).getTime() : (timers.startAnesthesia ? new Date(timers.startAnesthesia).getTime() : Date.now());
  const elapsedMs = nowTime - lastVitalTime + simulatedDelayMs;
  const elapsedMins = elapsedMs / 60000;
  const isOverdue = elapsedMins >= activeInterval;
  const percent = Math.min(100, (elapsedMins / activeInterval) * 100);
  const nextVitalTime = new Date(lastVitalTime + activeInterval * 60000);
  const timeString = nextVitalTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  useEffect(() => {
    if (!soundEnabled || !isOverdue) return;
    playVitalOverdueBeep();
    const timer = window.setInterval(() => playVitalOverdueBeep(), 30000);
    return () => window.clearInterval(timer);
  }, [soundEnabled, isOverdue]);

  const totalInflow = (fluids || []).reduce((acc: number, f: any) => acc + (f.volume || 0), 0);
  const totalOutflow = (outputs || []).reduce((acc: number, o: any) => acc + (o.volume || 0), 0);
  const netBalance = totalInflow - totalOutflow;

  const handleAddFluid = () => {
    let fluidTimestamp: string;
    if (fluidTimeMode === "now") {
      fluidTimestamp = new Date().toISOString();
    } else {
      const patientDate = ficha.patient?.date || getLocalDateStringNow("America/Sao_Paulo");
      fluidTimestamp = combineDateAndTime(patientDate, customFluidTime || "00:00", "America/Sao_Paulo");
    }
    const fluidObj: any = {
      id: newClientId(),
      name: newFluid.name,
      volume: newFluid.volume,
      type: "Solução",
      timestamp: fluidTimestamp
    };
    onUpdateDocument((prev) => ({
      fluids: [...(prev.fluids || []), fluidObj],
      events: [...(prev.events || []), {
        id: newClientId(),
        name: `Infundido: ${fluidObj.name} ${fluidObj.volume}ml`,
        timestamp: fluidTimestamp,
        category: "Procedimento" as any
      }]
    }));
    setNewFluid(prev => ({ ...prev, volume: 500 }));
  };

  const handleRemoveFluid = (id: string) => {
    onUpdateDocument((prev) => ({ fluids: (prev.fluids || []).filter((f: any) => f.id !== id) }));
  };

  const handleAddOutput = () => {
    const vol = parseInt(outputVal);
    if (isNaN(vol) || vol <= 0) return;
    
    let outTimestamp: string;
    if (fluidTimeMode === "now") {
      outTimestamp = new Date().toISOString();
    } else {
      const patientDate = ficha.patient?.date || getLocalDateStringNow("America/Sao_Paulo");
      outTimestamp = combineDateAndTime(patientDate, customFluidTime || "00:00", "America/Sao_Paulo");
    }
    
    const outObj: any = {
      id: `out-${Date.now()}`,
      type: outputType,
      volume: vol,
      timestamp: outTimestamp
    };
    
    onUpdateDocument((prev) => ({
      outputs: [...(prev.outputs || []), outObj],
      events: [...(prev.events || []), {
        id: newClientId(),
        name: `Saída: ${outObj.type} ${outObj.volume}ml`,
        timestamp: outTimestamp,
        category: "Procedimento" as any
      }]
    }));
    setOutputVal("");
  };

  const handleRemoveOutput = (id: string) => {
    onUpdateDocument((prev) => ({ outputs: (prev.outputs || []).filter((o: any) => o.id !== id) }));
  };

  const getSelectedTechnique = () => {
    const tech: any = ficha.technique || {};
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
    
    let updatedAirway = ficha.airway;

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

    onUpdateDocument((prev) => ({
      bolusDrugs: [...(prev.bolusDrugs || []), ...newBolus],
      continuousInfusions: [...(prev.continuousInfusions || []), ...newContinuous],
      inhalationAgents: [...(prev.inhalationAgents || []), ...newInh],
      events: [...(prev.events || []), ...newClinicalEvents],
      fluids: [...(prev.fluids || []), ...newFluids],
      vascularAccesses: [...(prev.vascularAccesses || []), ...newAccesses],
      ...(template.airway ? { airway: updatedAirway } : {})
    }));

    setShowTemplatesModal(false);
  };
  // --- END RECONSTRUCTED MISSING CODE ---

  const handleTechniqueOtherTextChange = (text: string) => {
    onUpdateDocument((prev) => ({
      technique: {
        ...prev.technique,
        other: text
      } as any
    }));
  };

  const airway = ficha.airway || {
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
    onUpdateDocument((prev) => ({
      airway: {
        ...(prev.airway || airway),
        ...updates
      }
    }));
  };

  const handleEquipmentToggle = (key: keyof EquipmentConfig) => {
    onUpdateDocument((prev) => ({
      equipmentConfig: {
        ...prev.equipmentConfig,
        [key]: !prev.equipmentConfig[key]
      }
    }));
  };

  const handleEquipmentOtherTextChange = (text: string) => {
    onUpdateDocument((prev) => ({
      equipmentConfig: {
        ...prev.equipmentConfig,
        other: text
      }
    }));
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
          professional: ficha.team.anesthesiologistLead
        });
      }
      onUpdateDocument((prev) => {
        const centralList = (prev.vascularAccesses || []).filter(a => a.type === "Venoso Central");
        const currentPeripheralList = (prev.vascularAccesses || []).filter(a => a.type !== "Venoso Central");
        return { vascularAccesses: [...centralList, ...currentPeripheralList, ...newItems] };
      });
    } else if (count < currentPeripheralList.length) {
      onUpdateDocument((prev) => {
        const centralList = (prev.vascularAccesses || []).filter(a => a.type === "Venoso Central");
        const currentPeripheralList = (prev.vascularAccesses || []).filter(a => a.type !== "Venoso Central");
        return { vascularAccesses: [...centralList, ...currentPeripheralList.slice(0, count)] };
      });
    }
  };

  const handleUpdatePeripheralAccessItem = (id: string, updatedFields: Partial<VascularAccess>) => {
    onUpdateDocument((prev) => ({
      vascularAccesses: (prev.vascularAccesses || []).map(a => a.id === id ? { ...a, ...updatedFields } : a)
    }));
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
            professional: ficha.team.anesthesiologistLead
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
            professional: ficha.team.anesthesiologistLead
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

    onUpdateDocument((prev) => ({ vascularAccesses: updatedAccesses }));
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

  const notesCount = ficha.narrativeLaunches?.length || 0;
  const descriptionSummary = notesCount > 0 
    ? `${notesCount} registro${notesCount > 1 ? "s" : ""} lançado${notesCount > 1 ? "s" : ""}`
    : "Sem registros";

  const intraUi = {
    onUpdateDocument,
    isDark,
    cardClass,
    textHeadingClass,
    textMutedClass,
    borderClass,
    selectClass,
    inputClass,
    activeVitalsInput,
    setActiveVitalsInput,
    activeField,
    setActiveField,
    showTemplatesModal,
    setShowTemplatesModal,
    activeClinicalTabs,
    setActiveClinicalTabs,
    CLINICAL_TABS,
    PANEL_LABELS,
    isInfusionsActive,
    isGasesActive,
    manuallyExpanded,
    setManuallyExpanded,
    getIsExpanded,
    togglePanel,
    editingBolusDrugName,
    setEditingBolusDrugName,
    editingBolusDrugsList,
    setEditingBolusDrugsList,
    editingInfusionId,
    setEditingInfusionId,
    editingInfusionData,
    setEditingInfusionData,
    newInfusion,
    setNewInfusion,
    newAgent,
    setNewAgent,
    newFluid,
    setNewFluid,
    outputVal,
    setOutputVal,
    outputType,
    setOutputType,
    loggingInterval,
    setLoggingInterval,
    isCustomInterval,
    setIsCustomInterval,
    customIntervalVal,
    setCustomIntervalVal,
    nowTime,
    setNowTime,
    simulatedDelayMs,
    setSimulatedDelayMs,
    soundEnabled,
    setSoundEnabled,
    drugSearchQuery,
    setDrugSearchQuery,
    selectedDrugCategory,
    setSelectedDrugCategory,
    expandedSupportPanels,
    setExpandedSupportPanels,
    expandedMainPanels,
    setExpandedMainPanels,
    isDrugListExpanded,
    setIsDrugListExpanded,
    showDrugEditor,
    setShowDrugEditor,
    drugEditorMode,
    setDrugEditorMode,
    drugEditorData,
    setDrugEditorData,
    allAvailableDrugs,
    setAllAvailableDrugs,
    selectedDrug,
    setSelectedDrug,
    customDose,
    setCustomDose,
    customAmpoules,
    setCustomAmpoules,
    customRoute,
    setCustomRoute,
    timeMode,
    setTimeMode,
    customTime,
    setCustomTime,
    fluidTimeMode,
    setFluidTimeMode,
    customFluidTime,
    setCustomFluidTime,
    isNarrativeDrawerOpen,
    setIsNarrativeDrawerOpen,
    expandedSections,
    setExpandedSections,
    toggleSection,
    handleTimerClick,
    getTimeString,
    handleKeyPress,
    handleKeyBackspace,
    handleKeyClear,
    handleRegisterVitals,
    repeatLastVitals,
    handleSelectDrugForLaunch,
    handleSaveDrug,
    handleConfirmLaunch,
    handleStartInfusion,
    handleRemoveInfusion,
    handleRemoveBolusDrugByName,
    handleUpdateInfusionStatus,
    handleUpdateInfusion,
    handleStartInhalationAgent,
    handleRemoveInhalationAgent,
    handleStopInhalationAgent,
    handleUpdateInhalationAgent,
    activeInterval,
    lastVital,
    lastVitalTime,
    elapsedMs,
    elapsedMins,
    isOverdue,
    percent,
    nextVitalTime,
    timeString,
    totalInflow,
    totalOutflow,
    netBalance,
    handleAddFluid,
    handleRemoveFluid,
    handleAddOutput,
    handleRemoveOutput,
    getSelectedTechnique,
    handleTechniqueChange,
    currentPeripheralCount,
    setCurrentPeripheralCount,
    currentPeripheralSite,
    setCurrentPeripheralSite,
    currentPeripheralGauge,
    setCurrentPeripheralGauge,
    currentCentralSite,
    setCurrentCentralSite,
    currentHasIncidents,
    setCurrentHasIncidents,
    currentIncidentsText,
    setCurrentIncidentsText,
    handleApplyTemplate,
    airway,
    handleAirwayUpdate,
    handleEquipmentToggle,
    handleEquipmentOtherTextChange,
    handleTechniqueOtherTextChange,
    handleUpdateTimerValue,
    handlePeripheralCountChange,
    handleUpdatePeripheralAccessItem,
    handleVascularAccessUpdate,
    startAnesthStr,
    endAnesthStr,
    chronologySummary,
    latestVital,
    vitalsSummary,
    drugsSummary,
    activeInfusionsCount,
    infusionsSummary,
    activeGasesCount,
    gasesSummary,
    getSelectedTechniqueName,
    peripheralAccesses,
    centralAccesses,
    hasCentral,
    supportSummary,
    hydrationSummary,
    notesCount,
    descriptionSummary,
    vitals,
    bolusDrugs,
    continuousInfusions,
    fluids,
    outputs,
    events,
    timers,
    patient,
    inhalationAgents,
    technique,
    equipmentConfig,
    vascularAccesses,
    narrativeLaunches,
    ficha,
    applyDocument,
    selectedMinutes,
    onTimeSelect,
    theme,
    pendingTemplateForReview,
    onClearPendingTemplate,
    startAiSupervisor,
    stopAiSupervisor,
    canEdit,
    vitalIntervalMinutes,
    soundAlertsEnabled,
    compactMode,
    onPatchAppSettings
  };

  const renderPanelById = (panelId: string) => {
    switch (panelId) {
      case 'vitals': return <IntraoperativeVitalsLaunch />;
      case 'timers': return <IntraoperativeTimersLaunch />;
      case 'chart': return <IntraoperativeChartLaunch />;
      case 'support': return <IntraoperativeSupportLaunch />;
      case 'infusions': return <IntraoperativeInfusionsLaunch />;
      case 'gases': return <IntraoperativeGasesLaunch />;
      case 'hydration': return <IntraoperativeHydrationLaunch />;
      case 'events': return <IntraoperativeEventsLaunch />;
      case 'drugs': return <IntraoperativeDrugsLaunch />;
      default: return null;
    }
  };

  return (
    <IntraoperativeUiProvider value={intraUi}>
    <div className={`${compactMode ? "space-y-2" : "space-y-4"} w-full`} data-compact={compactMode ? "true" : "false"}>
      {/* 1. CRONOLOGIA (TIMERS) ALWAYS OPEN AND FIXED ABOVE THE CHART */}
      <div className={`w-full ${!canEdit ? "pointer-events-none" : ""}`}>
        <IntraoperativeTimersLaunch />
      </div>

      {/* 2. CLINICAL CHART ALWAYS FIXED */}
      <div className={`w-full ${!canEdit ? "pointer-events-none" : ""}`}>
        <IntraoperativeChartLaunch />
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
        <div className={`flex flex-col gap-4 w-full transition-all duration-200 ${!canEdit ? "pointer-events-none" : ""}`}>
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
        ficha={ficha}
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
            if (!canEdit) return;
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
                            const patientDate = ficha.patient?.date || getLocalDateStringNow("America/Sao_Paulo");
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
                  onUpdateDocument((prev) => ({
                    bolusDrugs: [
                      ...(prev.bolusDrugs || []).filter(d => d.name !== editingBolusDrugName),
                      ...editingBolusDrugsList
                    ]
                  }));
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
                  onUpdateDocument((prev) => ({
                    continuousInfusions: (prev.continuousInfusions || []).map(inf => {
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
                    })
                  }));
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
    </IntraoperativeUiProvider>
  );
}
