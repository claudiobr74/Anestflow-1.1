import React from "react";
import { Layers, Syringe, ChevronUp, ChevronDown, Edit2, Minus, Plus, Check, Search, Activity, Trash2 } from "lucide-react";
import { DraggablePanel } from "./DraggablePanel";
import { formatToLocalTime, getLocalTimeStringNow } from "../utils/timezone";
import { BolusDrug, ContinuousInfusion } from "../types";

interface IntraoperativeDrugsPanelProps {
  key?: string;
  isDark: boolean;
  cardClass: string;
  borderClass: string;
  inputClass: string;
  selectClass: string;
  document: any;
  onUpdateDocument: any;
  patient: any;
  allAvailableDrugs: any[];
  bolusDrugs: BolusDrug[];
  continuousInfusions: ContinuousInfusion[];
  selectedDrug: any;
  setSelectedDrug: any;
  customDose: string;
  setCustomDose: any;
  customRoute: string;
  setCustomRoute: any;
  customTime: string;
  setCustomTime: any;
  timeMode: string;
  setTimeMode: any;
  isDrugListExpanded: boolean;
  setIsDrugListExpanded: any;
  drugSearchQuery: string;
  setDrugSearchQuery: any;
  selectedDrugCategory: string;
  setSelectedDrugCategory: any;
  showDrugEditor: boolean;
  setShowDrugEditor: any;
  drugEditorMode: string;
  setDrugEditorMode: any;
  drugEditorData: any;
  setDrugEditorData: any;
  handleConfirmLaunch: () => void;
  handleRemoveBolusDrugByName: (name: string) => void;
  setEditingBolusDrugName: any;
  setEditingBolusDrugsList: any;
  handleRemoveInfusion: (id: string) => void;
  setEditingInfusionId: any;
  setEditingInfusionData: any;
}

export default function IntraoperativeDrugsPanel({
  isDark,
  cardClass,
  borderClass,
  inputClass,
  selectClass,
  document,
  onUpdateDocument,
  patient,
  allAvailableDrugs,
  bolusDrugs,
  continuousInfusions,
  selectedDrug,
  setSelectedDrug,
  customDose,
  setCustomDose,
  customRoute,
  setCustomRoute,
  customTime,
  setCustomTime,
  timeMode,
  setTimeMode,
  isDrugListExpanded,
  setIsDrugListExpanded,
  drugSearchQuery,
  setDrugSearchQuery,
  selectedDrugCategory,
  setSelectedDrugCategory,
  showDrugEditor,
  setShowDrugEditor,
  drugEditorMode,
  setDrugEditorMode,
  drugEditorData,
  setDrugEditorData,
  handleConfirmLaunch,
  handleRemoveBolusDrugByName,
  setEditingBolusDrugName,
  setEditingBolusDrugsList,
  handleRemoveInfusion,
  setEditingInfusionId,
  setEditingInfusionData,
}: IntraoperativeDrugsPanelProps) {
  return (
    <DraggablePanel key="drugs" id="drugs" isDark={isDark}>
      <div className={`${cardClass} p-5 rounded-lg border space-y-4`}>
        <div className={`flex items-center justify-between border-b pb-3 ${isDark ? "border-zinc-800" : "border-slate-100"}`}>
          <div className="flex items-center gap-2">
            <Syringe className="w-4 h-4 text-rose-500" />
            <h3 className={`font-bold text-xs tracking-wide uppercase ${isDark ? "text-zinc-200" : "text-slate-800"}`}>Lançador de Fármacos</h3>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded tabular-nums font-medium ${isDark ? "bg-rose-950/20 text-rose-300" : "bg-rose-50 text-rose-700"}`}>
            Lançamento Rápido
          </span>
        </div>

        <div className="flex flex-col gap-5">
          {/* STAGING AREA */}
          <div className={`p-4 rounded-lg border transition-all duration-200 shadow-sm ${isDark ? "bg-zinc-900/80 border-rose-900/20" : "bg-rose-50/50 border-rose-100"}`}>
            <div className="flex flex-col gap-4">
              
              {/* Drug Info & Edit - Top Row (Full Width) */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-rose-100/40 dark:border-zinc-800/40">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <button
                      onClick={() => setIsDrugListExpanded(!isDrugListExpanded)}
                      className="flex items-center gap-1.5 hover:opacity-80 transition-opacity truncate"
                      title="Trocar Fármaco (Abrir lista)"
                    >
                      <h4 className={`text-base font-extrabold tracking-tight truncate ${isDark ? "text-zinc-100" : "text-slate-800"}`}>
                        {selectedDrug.name}
                      </h4>
                      {isDrugListExpanded ? <ChevronUp className="w-4 h-4 text-rose-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-rose-500 shrink-0" />}
                    </button>
                    <button 
                      onClick={() => {
                        setDrugEditorMode("edit");
                        setDrugEditorData(selectedDrug);
                        setShowDrugEditor(true);
                      }}
                      className="p-1 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors shrink-0"
                      title="Editar fármaco"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-rose-400/80" : "text-rose-600/80"}`}>
                    {selectedDrug.category || "Outros"}
                  </div>
                </div>
              </div>

              {/* Interactive Controls - Bottom Row (Full Width, Wrap Cleanly) */}
              <div className="flex flex-wrap items-center gap-3">
                
                {/* Dose Control */}
                <div className={`flex items-center p-0.5 rounded-lg border h-10 ${isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200 shadow-xs"}`}>
                  <button 
                    type="button" 
                    onClick={() => {
                      const step = selectedDrug.defaultUnit === "mcg" ? 10 : (selectedDrug.defaultUnit === "g" ? 0.5 : 1);
                      setCustomDose((prev: string) => String(Math.max(0, (parseFloat(prev || "0") - step))));
                    }} 
                    className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors active:scale-95 ${isDark ? "bg-zinc-900 text-zinc-400 hover:bg-zinc-800" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="relative flex items-center justify-center w-16 h-8">
                    <input
                       type="number"
                       step="any"
                       value={customDose}
                       onChange={(e) => setCustomDose(e.target.value)}
                       className="w-full h-full text-center font-bold text-sm bg-transparent border-none focus:ring-0 p-0 text-slate-800 dark:text-zinc-100 tabular-nums"
                    />
                  </div>
                  <span className={`text-xs font-bold mr-2.5 ${isDark ? "text-zinc-500" : "text-slate-400"}`}>{selectedDrug.defaultUnit}</span>
                  <button 
                    type="button" 
                    onClick={() => {
                      const step = selectedDrug.defaultUnit === "mcg" ? 10 : (selectedDrug.defaultUnit === "g" ? 0.5 : 1);
                      setCustomDose((prev: string) => String(parseFloat(prev || "0") + step));
                    }} 
                    className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors active:scale-95 ${isDark ? "bg-zinc-900 text-zinc-400 hover:bg-zinc-800" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Route Segmented Control */}
                <div className={`flex p-0.5 rounded-lg border h-10 items-center ${isDark ? "bg-zinc-950 border-zinc-800" : "bg-slate-100 border-slate-200"}`}>
                  {["EV", "IM", "SC", "VO"].map(route => (
                    <button
                      key={route}
                      type="button"
                      onClick={() => setCustomRoute(route)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all h-full ${customRoute === route ? "bg-white dark:bg-zinc-800 text-rose-600 dark:text-rose-400 shadow-xs" : "text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300"}`}
                    >
                      {route}
                    </button>
                  ))}
                </div>

                {/* Time & Launch */}
                <div className="flex flex-1 min-w-[240px] gap-2 h-10">
                  <input 
                    type="time" 
                    value={customTime}
                    onChange={(e) => { setCustomTime(e.target.value); setTimeMode("custom"); }}
                    className={`h-10 px-2.5 w-24 rounded-lg text-xs font-bold border tabular-nums transition-colors ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-rose-500" : "bg-white border-slate-200 text-slate-800 focus:border-rose-500"}`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setTimeMode("now");
                      const dateObj = new Date();
                      const h = String(dateObj.getUTCHours()).padStart(2, "0");
                      const m = String(dateObj.getUTCMinutes()).padStart(2, "0");
                      setCustomTime(`${h}:${m}`);
                    }}
                    className={`h-10 px-3.5 flex items-center justify-center rounded-lg border text-xs font-bold transition active:scale-95 ${
                      timeMode === "now"
                        ? "bg-rose-600 border-rose-600 text-white shadow-sm"
                        : isDark
                          ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    Agora
                  </button>
                  <button
                    onClick={handleConfirmLaunch}
                    className="h-10 px-5 flex-1 flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-sm shadow-rose-500/20 active:scale-95 transition-all whitespace-nowrap"
                  >
                    <Check className="w-4 h-4" />
                    <span>Lançar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Visual Ampoule Status */}
          {(() => {
            const ampouleAmount = (selectedDrug as any).ampouleAmount;
            const ampouleVolume = (selectedDrug as any).ampouleVolume;
            if (!ampouleAmount) return null;
            
            const currentDrugBoluses = document.bolusDrugs?.filter((b: any) => b.name === selectedDrug.name) || [];
            const totalDoseGiven = currentDrugBoluses.reduce((acc: number, b: any) => acc + (typeof b.dose === "number" ? b.dose : 0), 0);
            
            const currentAmpoules = Math.ceil(totalDoseGiven / ampouleAmount);
            
            const newDose = parseFloat(customDose) || 0;
            const newTotalDose = totalDoseGiven + newDose;
            const newAmpoules = Math.ceil(newTotalDose / ampouleAmount);
            
            const remainingInCurrentAmpoule = currentAmpoules > 0 ? (currentAmpoules * ampouleAmount) - totalDoseGiven : 0;
            const opensNewAmpoule = newAmpoules > currentAmpoules;
            
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-2">
                {/* Ampoule Specs card */}
                <div className={`p-3 rounded-lg border flex flex-col justify-between gap-1 transition-all ${
                  isDark ? "bg-zinc-900/50 border-zinc-800/80 text-zinc-300" : "bg-slate-50 border-slate-200/80 text-slate-600"
                }`}>
                  <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-zinc-500" : "text-slate-400"}`}>Especificação</span>
                  <div className="flex flex-col gap-1">
                    <span className={`text-xs font-bold leading-tight ${isDark ? "text-zinc-200" : "text-slate-800"}`}>
                      {ampouleAmount} {selectedDrug.defaultUnit} {ampouleVolume ? `/ ${ampouleVolume}mL` : ""}
                    </span>
                    {ampouleVolume && ampouleAmount && (
                      <span className={`self-start text-xs font-extrabold px-1.5 py-0.5 rounded tabular-nums ${
                        isDark ? "bg-zinc-800 text-zinc-300" : "bg-slate-200/70 text-slate-700"
                      }`}>
                        {+(ampouleAmount / ampouleVolume).toFixed(2)} {selectedDrug.defaultUnit}/mL
                      </span>
                    )}
                  </div>
                </div>

                {/* Total Infused card */}
                <div className={`p-3 rounded-lg border flex flex-col justify-between gap-1 transition-all ${
                  isDark ? "bg-zinc-900/50 border-zinc-800/80 text-zinc-300" : "bg-slate-50 border-slate-200/80 text-slate-600"
                }`}>
                  <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-zinc-500" : "text-slate-400"}`}>Total Infundido</span>
                  <span className="text-sm font-extrabold text-emerald-500">
                    {totalDoseGiven} {selectedDrug.defaultUnit}
                  </span>
                </div>

                {/* Sobra/Sobra atual card */}
                <div className={`p-3 rounded-lg border flex flex-col justify-between gap-1 transition-all ${
                  isDark ? "bg-zinc-900/50 border-zinc-800/80 text-zinc-300" : "bg-slate-50 border-slate-200/80 text-slate-600"
                }`}>
                  <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-zinc-500" : "text-slate-400"}`}>Sobra Atual</span>
                  <span className={`text-xs font-bold leading-tight ${remainingInCurrentAmpoule > 0 ? (isDark ? "text-zinc-200" : "text-slate-800") : "opacity-60"}`}>
                    {remainingInCurrentAmpoule > 0 
                      ? `${remainingInCurrentAmpoule} ${selectedDrug.defaultUnit}`
                      : "Sem sobra"
                    }
                  </span>
                </div>

                {/* Previsão de nova abertura card */}
                <div className={`p-3 rounded-lg border flex flex-col justify-between gap-1 transition-all ${
                  opensNewAmpoule 
                    ? (isDark ? "bg-rose-950/30 border-rose-900/40 text-rose-300" : "bg-rose-50 border-rose-200 text-rose-800")
                    : (isDark ? "bg-zinc-900/50 border-zinc-800/80 text-zinc-300" : "bg-slate-50 border-slate-200/80 text-slate-600")
                }`}>
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    opensNewAmpoule ? (isDark ? "text-rose-400" : "text-rose-700") : (isDark ? "text-zinc-500" : "text-slate-400")
                  }`}>Ação ao Lançar</span>
                  {newDose > 0 ? (
                    <span className={`text-xs font-bold flex items-center gap-1 leading-tight ${
                      opensNewAmpoule ? (isDark ? "text-rose-400 animate-pulse" : "text-rose-700") : (isDark ? "text-emerald-400" : "text-emerald-700")
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${opensNewAmpoule ? "bg-rose-500 animate-pulse" : "bg-emerald-500"}`}></span>
                      {opensNewAmpoule ? `+${newAmpoules - currentAmpoules} ampola(s)` : "Dose atual"}
                    </span>
                  ) : (
                    <span className="text-xs opacity-50 font-medium">Aguardando dose</span>
                  )}
                </div>
              </div>
            );
          })()}

          {isDrugListExpanded && (
            <div className={`space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 mt-4 pt-4 border-t ${isDark ? "border-zinc-800" : "border-slate-100"}`}>
              {/* Search & Filters */}
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex gap-2">
                  {/* Search */}
                  <div className="relative flex-1 min-w-0">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark ? "text-zinc-500" : "text-slate-400"}`} />
                    <input
                      type="text"
                      placeholder="Buscar fármaco..."
                      value={drugSearchQuery}
                      onChange={(e) => setDrugSearchQuery(e.target.value)}
                      className={`w-full pl-8 pr-3 h-10 rounded-lg text-xs border font-medium transition-colors ${
                        isDark 
                          ? "bg-zinc-900 border-zinc-800 text-zinc-200 focus:border-rose-500 focus:bg-zinc-950" 
                          : "bg-white border-slate-200 text-slate-800 focus:border-rose-500 focus:bg-slate-50"
                      }`}
                    />
                  </div>
                  
                  {/* New Drug Button */}
                  <button
                    onClick={() => {
                      setDrugEditorMode("create");
                      setDrugEditorData({
                        name: "",
                        category: selectedDrugCategory !== "Todos" ? selectedDrugCategory : "Outros",
                        defaultDose: 0,
                        defaultUnit: "mg",
                        defaultRoute: "EV",
                        ampouleAmount: 0,
                        ampouleVolume: 1
                      } as any);
                      setShowDrugEditor(true);
                    }}
                    className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                      isDark 
                        ? "bg-zinc-900 border border-zinc-800 text-rose-400 hover:bg-zinc-800" 
                        : "bg-white border border-slate-200 text-rose-600 hover:bg-rose-50"
                    }`}
                    title="Novo Fármaco"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Categories */}
                <div className="w-full overflow-x-auto scrollbar-none">
                  <div className="flex gap-1.5 min-w-max h-10 items-center py-0.5">
                    {["Todos", ...Array.from(new Set(allAvailableDrugs.map(d => d.category || "Outros"))).sort()].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedDrugCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                          selectedDrugCategory === cat
                            ? isDark
                              ? "bg-zinc-800 text-zinc-100 shadow-xs"
                              : "bg-slate-800 text-white shadow-xs"
                            : isDark
                              ? "bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800/50"
                              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                        }`}
                      >
                        {String(cat).split(" / ")[0].split(" e ")[0]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
  
              {/* Grid of Drugs */}
              <div className="max-h-[350px] overflow-y-auto pr-2 scrollbar-thin">
                <div 
                  className="grid gap-2.5"
                  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}
                >
                  {(() => {
                    const filteredDrugs = allAvailableDrugs.filter(drug => {
                      const matchesCategory = selectedDrugCategory === "Todos" || drug.category === selectedDrugCategory;
                      const matchesSearch = drug.name.toLowerCase().includes(drugSearchQuery.toLowerCase());
                      return matchesCategory && matchesSearch;
                    });
  
                    if (filteredDrugs.length === 0) {
                      return (
                        <div className="col-span-full text-center py-10 space-y-2">
                          <p className={`text-sm font-semibold ${isDark ? "text-zinc-500" : "text-slate-400 dark:text-zinc-500"}`}>
                            Nenhum fármaco encontrado.
                          </p>
                        </div>
                      );
                    }
  
                    return filteredDrugs.map((drug, index) => {
                      const isCurrentlySelected = selectedDrug.name === drug.name;
                      return (
                        <button
                          key={index}
                          onClick={() => {
                            setSelectedDrug(drug);
                            setIsDrugListExpanded(false);
                            setCustomDose(drug.defaultDose?.toString() || "");
                            setCustomRoute(drug.defaultRoute || "EV");
                            setCustomTime(formatToLocalTime(new Date(), "America/Sao_Paulo"));
                          }}
                          className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all active:scale-95 ${
                            isCurrentlySelected
                              ? isDark
                                ? "bg-rose-950/25 border-rose-500/60 shadow-xs"
                                : "bg-rose-50/50 border-rose-300 shadow-xs"
                              : isDark
                                ? "bg-zinc-900/40 border-zinc-800/80 hover:bg-zinc-800 hover:border-zinc-700"
                                : "bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200 shadow-xs"
                          }`}
                        >
                          <span className={`text-xs font-bold line-clamp-1 mb-1 w-full truncate ${
                            isCurrentlySelected 
                              ? (isDark ? "text-rose-400" : "text-rose-700")
                              : (isDark ? "text-zinc-200" : "text-slate-700")
                          }`}>
                            {drug.name}
                          </span>
                          
                          <div className="flex items-center justify-between w-full mt-auto pt-1">
                            <span className={`text-xs font-bold ${
                              isCurrentlySelected
                                ? (isDark ? "text-rose-300" : "text-rose-600")
                                : (isDark ? "text-zinc-400" : "text-slate-500")
                            }`}>
                              {drug.defaultDose} {drug.defaultUnit}
                            </span>
                            <span className={`text-xs px-1 py-0.5 rounded font-bold ${
                              isCurrentlySelected
                                ? isDark ? "bg-rose-900/40 text-rose-300" : "bg-rose-100 text-rose-700"
                                : isDark ? "bg-zinc-800 text-zinc-500" : "bg-slate-100 text-slate-500"
                            }`}>
                              {drug.defaultRoute || "EV"}
                            </span>
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* RESUMO DE FÁRMACOS ADMINISTRADOS */}
      <div className={`${cardClass} p-5 rounded-lg border space-y-4`}>
        <div className={`flex items-center justify-between border-b pb-3 ${isDark ? "border-zinc-800" : "border-slate-100"}`}>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            <h3 className={`font-bold text-xs tracking-wide uppercase ${isDark ? "text-zinc-200" : "text-slate-800"}`}>Fármacos Administrados (Resumo)</h3>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded tabular-nums font-medium ${isDark ? "bg-emerald-950/20 text-emerald-300" : "bg-emerald-50 text-emerald-700"}`}>
            {bolusDrugs.length + continuousInfusions.length} Registros
          </span>
        </div>

        <div className="max-h-[250px] overflow-y-auto pr-1 space-y-2 scrollbar-thin">
          {bolusDrugs.length === 0 && continuousInfusions.length === 0 ? (
            <p className={`text-center text-xs py-4 font-medium ${isDark ? "text-zinc-500" : "text-slate-400 dark:text-zinc-500"}`}>
              Nenhum fármaco administrado até o momento.
            </p>
          ) : (
            <div className="space-y-3">
              {/* Bolus Summary */}
              {Object.values(
                bolusDrugs.reduce((acc, drug) => {
                  const baseUnit = drug.unit.replace("/kg", "");
                  const key = `${drug.name}-${baseUnit}`;
                  if (!acc[key]) {
                    acc[key] = { 
                      name: drug.name, 
                      baseUnit, 
                      totalAbsoluteDose: 0, 
                      totalDosePerKg: 0, 
                      hasPerKg: false,
                      hasAbsolute: false,
                      count: 0, 
                      routes: new Set<string>(),
                      drugs: []
                    };
                  }
                  
                  const weight = patient?.weight || 0;
                  const dose = typeof drug.dose === "number" ? drug.dose : 0;
                  if (drug.unit && String(drug.unit).endsWith("/kg")) {
                    acc[key].totalDosePerKg += dose;
                    if (weight > 0) {
                      acc[key].totalAbsoluteDose += dose * weight;
                    }
                    acc[key].hasPerKg = true;
                  } else {
                    acc[key].totalAbsoluteDose += dose;
                    if (weight > 0) {
                      acc[key].totalDosePerKg += dose / weight;
                    }
                    acc[key].hasAbsolute = true;
                  }
                  
                  acc[key].count += 1;
                  acc[key].routes.add(drug.route);
                  acc[key].drugs.push(drug);
                  return acc;
                }, {} as Record<string, { 
                  name: string; 
                  baseUnit: string; 
                  totalAbsoluteDose: number; 
                  totalDosePerKg: number; 
                  hasPerKg: boolean;
                  hasAbsolute: boolean;
                  count: number; 
                  routes: Set<string>;
                  drugs: BolusDrug[];
                }>)
              ).map((summary, idx) => {
                const weight = patient?.weight || 0;
                
                let displayDose = "";
                let displaySub = "";

                if (weight > 0) {
                  displayDose = `${parseFloat(summary.totalAbsoluteDose.toFixed(2))} ${summary.baseUnit}`;
                  displaySub = `(${parseFloat(summary.totalDosePerKg.toFixed(2))} ${summary.baseUnit}/kg)`;
                } else {
                  if (summary.hasPerKg && !summary.hasAbsolute) {
                    displayDose = `${parseFloat(summary.totalDosePerKg.toFixed(2))} ${summary.baseUnit}/kg`;
                    displaySub = "Fórmula (Sem peso definido)";
                  } else if (summary.hasAbsolute && !summary.hasPerKg) {
                    displayDose = `${parseFloat(summary.totalAbsoluteDose.toFixed(2))} ${summary.baseUnit}`;
                    displaySub = "Sem peso definido";
                  } else {
                    displayDose = `${parseFloat(summary.totalAbsoluteDose.toFixed(2))} ${summary.baseUnit} + ${parseFloat(summary.totalDosePerKg.toFixed(2))} ${summary.baseUnit}/kg`;
                    displaySub = "Sem peso definido";
                  }
                }

                return (
                  <div key={idx} className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 ${
                    isDark ? "bg-zinc-900/40 border-zinc-800" : "bg-slate-50 border-slate-200"
                  }`}>
                    <div className="min-w-0 flex-1">
                      <div className={`text-xs font-bold truncate ${isDark ? "text-zinc-200" : "text-slate-800"}`}>{summary.name}</div>
                      <div className={`text-xs truncate ${isDark ? "text-zinc-500" : "text-slate-500"}`}>
                        {summary.count} dose{summary.count > 1 ? "s" : ""} • Via: {Array.from(summary.routes).join(", ")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex flex-col items-end">
                        <div className={`text-xs tabular-nums font-bold px-2 py-1 rounded ${
                          isDark ? "bg-zinc-800 text-zinc-300" : "bg-white border text-slate-700"
                        }`}>
                          {displayDose}
                        </div>
                        {displaySub && (
                          <div className={`text-xs tabular-nums mt-0.5 ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
                            {displaySub}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setEditingBolusDrugName(summary.name);
                          setEditingBolusDrugsList(JSON.parse(JSON.stringify(summary.drugs)));
                        }}
                        className="p-1.5 rounded hover:bg-indigo-500/10 hover:text-indigo-500 transition text-slate-400 dark:text-zinc-500"
                        title={`Editar registros de ${summary.name}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemoveBolusDrugByName(summary.name)}
                        className="p-1.5 rounded hover:bg-rose-500/10 hover:text-rose-500 transition text-slate-400 dark:text-zinc-500"
                        title={`Excluir todos os registros de ${summary.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              
              {/* Continuous Infusions Summary */}
              {continuousInfusions.map(inf => {
                const currentRate = inf.history.length > 0 ? inf.history[inf.history.length - 1].rate : 0;
                const weight = patient?.weight;
                let absoluteRate = "";
                
                if (weight && currentRate > 0) {
                   if (inf.unit.includes("/kg/min")) {
                      const baseUnit = inf.unit.split("/")[0]; // e.g. mcg
                      absoluteRate = `(${parseFloat((currentRate * weight).toFixed(2))} ${baseUnit}/min)`;
                   } else if (inf.unit.includes("/kg/h")) {
                      const baseUnit = inf.unit.split("/")[0]; // e.g. mcg
                      absoluteRate = `(${parseFloat((currentRate * weight).toFixed(2))} ${baseUnit}/h)`;
                   } else if (inf.unit.includes("/min") && !inf.unit.includes("/kg")) {
                      const baseUnit = inf.unit.split("/")[0]; // e.g. mcg
                      absoluteRate = `(${parseFloat((currentRate / weight).toFixed(2))} ${baseUnit}/kg/min)`;
                   } else if (inf.unit.includes("/h") && !inf.unit.includes("/kg")) {
                      const baseUnit = inf.unit.split("/")[0]; // e.g. mcg
                      absoluteRate = `(${parseFloat((currentRate / weight).toFixed(2))} ${baseUnit}/kg/h)`;
                   }
                }

                return (
                  <div key={inf.id} className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 ${
                    isDark ? "bg-indigo-950/20 border-indigo-900/40" : "bg-indigo-50/50 border-indigo-100"
                  }`}>
                    <div className="min-w-0 flex-1">
                      <div className={`text-xs font-bold truncate ${isDark ? "text-indigo-300" : "text-indigo-800"}`}>{inf.name}</div>
                      <div className={`text-xs truncate ${isDark ? "text-indigo-400/70" : "text-indigo-600/70"}`}>
                        Infusão Contínua • Conc: {inf.concentration}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex flex-col items-end gap-0.5">
                        <div className={`text-xs uppercase font-bold ${isDark ? "text-zinc-500" : "text-slate-400"}`}>Taxa Atual</div>
                        <div className={`text-xs tabular-nums font-bold px-2 py-1 rounded ${
                          isDark ? "bg-indigo-900/40 text-indigo-300" : "bg-indigo-100 text-indigo-700"
                        }`}>
                          {currentRate} {inf.unit}
                        </div>
                        {absoluteRate && (
                          <div className={`text-xs tabular-nums mt-0.5 ${isDark ? "text-indigo-400/60" : "text-indigo-600/60"}`}>
                            {absoluteRate}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setEditingInfusionId(inf.id);
                          setEditingInfusionData(JSON.parse(JSON.stringify(inf)));
                        }}
                        className="p-1.5 rounded hover:bg-indigo-500/10 hover:text-indigo-500 transition text-slate-400 dark:text-zinc-500"
                        title={`Editar infusão ${inf.name}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemoveInfusion(inf.id)}
                        className="p-1.5 rounded hover:bg-rose-500/10 hover:text-rose-500 transition text-slate-400 dark:text-zinc-500"
                        title={`Excluir infusão ${inf.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DraggablePanel>
  );
}
