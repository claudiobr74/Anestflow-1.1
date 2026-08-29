#!/bin/bash
cat << 'INNER_EOF' > src/components/ContinuousInfusionsPanel.tsx
import React, { useState, useMemo } from "react";
import { Layers, Clock, Plus, Trash2, Pause, Square, Play, Calculator, Activity, ChevronDown, ChevronUp } from "lucide-react";
import { getTzParts } from "../utils/timezone";

export const INFUSION_DRUGS_PRESETS = [
  { category: "Opióides", name: "Remifentanil", concentration: "50 mcg/ml", concValue: 50, concUnit: "mcg", diluent: "SF 0.9% 100ml", totalVolumePrepared: 100, unit: "mcg/kg/min", rate: 0.1, ampoules: 1 },
  { category: "Opióides", name: "Fentanil", concentration: "50 mcg/ml", concValue: 50, concUnit: "mcg", diluent: "Fentanil Puro 50ml", totalVolumePrepared: 50, unit: "mcg/kg/h", rate: 1, ampoules: 5 },
  { category: "Opióides", name: "Sufentanil", concentration: "1 mcg/ml", concValue: 1, concUnit: "mcg", diluent: "SF 0.9% 50ml", totalVolumePrepared: 50, unit: "mcg/kg/h", rate: 0.2, ampoules: 1 },
  { category: "Hipnóticos/Sedativos", name: "Propofol", concentration: "10 mg/ml", concValue: 10, concUnit: "mg", diluent: "Puro", totalVolumePrepared: 50, unit: "mcg/kg/min", rate: 100, ampoules: 1 },
  { category: "Hipnóticos/Sedativos", name: "Dexmedetomidina", concentration: "4 mcg/ml", concValue: 4, concUnit: "mcg", diluent: "SF 0.9% 100ml", totalVolumePrepared: 100, unit: "mcg/kg/h", rate: 0.4, ampoules: 2 },
  { category: "Hipnóticos/Sedativos", name: "Cetamina", concentration: "10 mg/ml", concValue: 10, concUnit: "mg", diluent: "SF 0.9% 50ml", totalVolumePrepared: 50, unit: "mg/kg/h", rate: 0.2, ampoules: 1 },
  { category: "Vasopressores/Inotrópicos", name: "Noradrenalina", concentration: "160 mcg/ml", concValue: 160, concUnit: "mcg", diluent: "SG 5% 250ml", totalVolumePrepared: 250, unit: "mcg/kg/min", rate: 0.1, ampoules: 10 },
  { category: "Vasopressores/Inotrópicos", name: "Adrenalina", concentration: "16 mcg/ml", concValue: 16, concUnit: "mcg", diluent: "SG 5% 250ml", totalVolumePrepared: 250, unit: "mcg/kg/min", rate: 0.05, ampoules: 4 },
  { category: "Vasopressores/Inotrópicos", name: "Dobutamina", concentration: "1000 mcg/ml", concValue: 1000, concUnit: "mcg", diluent: "SF 0.9% 250ml", totalVolumePrepared: 250, unit: "mcg/kg/min", rate: 5, ampoules: 1 },
  { category: "Vasopressores/Inotrópicos", name: "Milrinona", concentration: "200 mcg/ml", concValue: 200, concUnit: "mcg", diluent: "SF 0.9% 100ml", totalVolumePrepared: 100, unit: "mcg/kg/min", rate: 0.5, ampoules: 2 },
  { category: "Vasodilatadores", name: "Nitroglicerina (Tridil)", concentration: "100 mcg/ml", concValue: 100, concUnit: "mcg", diluent: "SF 0.9% 250ml", totalVolumePrepared: 250, unit: "mcg/min", rate: 10, ampoules: 1 },
  { category: "Vasodilatadores", name: "Nitroprussiato (Nipride)", concentration: "200 mcg/ml", concValue: 200, concUnit: "mcg", diluent: "SG 5% 250ml", totalVolumePrepared: 250, unit: "mcg/kg/min", rate: 0.5, ampoules: 1 },
  { category: "Bloqueadores", name: "Cisatracúrio", concentration: "2 mg/ml", concValue: 2, concUnit: "mg", diluent: "SF 0.9% 100ml", totalVolumePrepared: 100, unit: "mcg/kg/min", rate: 1.5, ampoules: 10 },
  { category: "Outros", name: "Lidocaína", concentration: "20 mg/ml", concValue: 20, concUnit: "mg", diluent: "Puro", totalVolumePrepared: 50, unit: "mg/kg/h", rate: 1.5, ampoules: 1 },
  { category: "Outros", name: "Sulfato de Magnésio", concentration: "100 mg/ml", concValue: 100, concUnit: "mg", diluent: "SF 0.9% 100ml", totalVolumePrepared: 100, unit: "mg/kg/h", rate: 10, ampoules: 1 },
];

interface ContinuousInfusionsPanelProps {
  isDark: boolean;
  borderClass?: string;
  cardClass?: string;
  continuousInfusions: any[];
  newInfusion: any;
  setNewInfusion: React.Dispatch<React.SetStateAction<any>>;
  handleStartInfusion: () => void;
  handleUpdateInfusionStatus: (id: string, status: any, newRate?: number) => void;
  handleRemoveInfusion: (id: string) => void;
  patientWeight?: number;
}

export default function ContinuousInfusionsPanel({
  isDark,
  borderClass = "border-slate-200 dark:border-zinc-800",
  cardClass = "bg-white dark:bg-zinc-950",
  continuousInfusions,
  newInfusion,
  setNewInfusion,
  handleStartInfusion,
  handleUpdateInfusionStatus,
  handleRemoveInfusion,
  patientWeight = 70
}: ContinuousInfusionsPanelProps) {
  const [showPresets, setShowPresets] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Opióides");

  const categories = useMemo(() => {
    const cats = new Set<string>();
    INFUSION_DRUGS_PRESETS.forEach(p => cats.add(p.category));
    return Array.from(cats);
  }, []);

  const selectPreset = (preset: typeof INFUSION_DRUGS_PRESETS[0]) => {
    setNewInfusion((prev: any) => ({
      ...prev,
      name: preset.name,
      concentration: preset.concentration,
      concValue: preset.concValue,
      concUnit: preset.concUnit,
      diluent: preset.diluent,
      totalVolumePrepared: preset.totalVolumePrepared,
      rate: preset.rate,
      unit: preset.unit,
      ampoules: preset.ampoules,
      isCustom: false
    }));
    setShowPresets(false);
  };

  // DOSE CONVERTER CALCULATION
  const conversionRate = useMemo(() => {
    if (!newInfusion.rate || !newInfusion.concValue) return "0.0 ml/h";
    
    let rateNum = parseFloat(newInfusion.rate);
    if (isNaN(rateNum)) return "0.0 ml/h";

    let concNumeric = parseFloat(newInfusion.concValue);
    if (isNaN(concNumeric) || concNumeric === 0) return "0.0 ml/h";

    const isConcMg = newInfusion.concUnit === "mg" || newInfusion.concentration?.includes("mg/ml");
    const isConcMcg = newInfusion.concUnit === "mcg" || newInfusion.concentration?.includes("mcg/ml");

    let concInMcgPerMl = concNumeric;
    if (isConcMg) concInMcgPerMl = concNumeric * 1000;

    let rateInMcgPerMin = 0;
    const unit = newInfusion.unit || "";
    
    // Convert current rate to mcg/min
    if (unit === "mcg/kg/min") {
      rateInMcgPerMin = rateNum * patientWeight;
    } else if (unit === "mcg/kg/h") {
      rateInMcgPerMin = (rateNum * patientWeight) / 60;
    } else if (unit === "mg/kg/h") {
      rateInMcgPerMin = (rateNum * 1000 * patientWeight) / 60;
    } else if (unit === "mcg/min") {
      rateInMcgPerMin = rateNum;
    } else if (unit === "mcg/h") {
      rateInMcgPerMin = rateNum / 60;
    } else if (unit === "ml/h") {
      // Re-calculate back to whatever unit... wait, we just want to show ml/h.
      // If it's ALREADY ml/h, maybe we show mcg/kg/min equivalent?
      const totalMcgPerHour = rateNum * concInMcgPerMl;
      const mcgKgMin = totalMcgPerHour / 60 / patientWeight;
      return `${mcgKgMin.toFixed(2)} mcg/kg/min`;
    }

    // Now we have rateInMcgPerMin. Convert to ml/h
    const rateInMcgPerHour = rateInMcgPerMin * 60;
    const mlPerHour = rateInMcgPerHour / concInMcgPerMl;
    
    return `${mlPerHour.toFixed(1)} ml/h`;
  }, [newInfusion.rate, newInfusion.unit, newInfusion.concValue, newInfusion.concUnit, newInfusion.concentration, patientWeight]);

  return (
    <div className={`${cardClass} p-5 rounded-xl border space-y-5 shadow-xs`}>
      <div className={`flex items-center justify-between border-b pb-3 ${borderClass}`}>
        <h3 className={`font-bold text-xs tracking-wide uppercase flex items-center gap-2 ${isDark ? "text-zinc-200" : "text-slate-800"}`}>
          <Layers className={`w-4 h-4 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
          Painel de Bombas de Infusão Contínua (BIC)
        </h3>
        
        <button 
          onClick={() => setShowPresets(!showPresets)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
            showPresets ? "bg-indigo-600 text-white" : isDark ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          {showPresets ? "Esconder Protocolos" : "Protocolos Rápidos"}
        </button>
      </div>

      {showPresets && (
        <div className={`p-4 rounded-xl border ${isDark ? "bg-indigo-950/20 border-indigo-900/40" : "bg-indigo-50/50 border-indigo-100"} mb-4`}>
          <div className="flex flex-wrap gap-2 mb-4">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition ${
                  activeCategory === cat
                    ? "bg-indigo-600 text-white"
                    : isDark ? "bg-zinc-800/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200" : "bg-white text-slate-500 border hover:bg-slate-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {INFUSION_DRUGS_PRESETS.filter(p => p.category === activeCategory).map(preset => (
              <button
                key={preset.name}
                onClick={() => selectPreset(preset)}
                className={`p-2 rounded-lg border text-left flex flex-col justify-between h-full transition ${
                  isDark ? "bg-zinc-900/50 border-zinc-800 hover:bg-indigo-900/30 hover:border-indigo-500/50" : "bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30"
                }`}
              >
                <span className={`text-[11px] font-bold block ${isDark ? "text-zinc-200" : "text-slate-800"}`}>{preset.name}</span>
                <span className={`text-[9px] font-mono mt-1 ${isDark ? "text-indigo-300" : "text-indigo-600"}`}>{preset.concentration}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Setup / Preparation Form */}
      <div className={`p-4 rounded-xl border ${isDark ? "bg-zinc-900/40 border-zinc-800/80" : "bg-slate-50/50 border-slate-200"} space-y-4`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Preparar Infusão</span>
          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${isDark ? "bg-zinc-800 text-zinc-400" : "bg-white border text-slate-500"}`}>Peso Paciente: {patientWeight} kg</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          
          <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Drug Selector */}
            <div className="space-y-1 md:col-span-1">
              <label className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase">Fármaco / Solução</label>
              <input
                type="text"
                value={newInfusion.name || ""}
                onChange={(e) => {
                  setNewInfusion((prev: any) => ({ ...prev, name: e.target.value, isCustom: true }));
                }}
                placeholder="Ex: Sufentanil"
                className={`w-full text-xs px-2.5 py-2 rounded-lg border outline-none font-bold ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-indigo-500" : "bg-white border-slate-200 text-slate-800 focus:border-indigo-500"}`}
              />
            </div>

            {/* Concentration Value & Unit */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase">Concentração (p/ ml)</label>
              <div className="flex">
                <input
                  type="number"
                  step="any"
                  value={newInfusion.concValue || ""}
                  onChange={(e) => setNewInfusion((prev: any) => {
                    const concVal = e.target.value;
                    const cUnit = prev.concUnit || "mcg";
                    return { ...prev, concValue: concVal, concentration: `${concVal} ${cUnit}/ml` };
                  })}
                  placeholder="Ex: 50"
                  className={`w-full text-xs px-2.5 py-2 rounded-l-lg border-y border-l outline-none font-semibold ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"}`}
                />
                <select
                  value={newInfusion.concUnit || "mcg"}
                  onChange={(e) => setNewInfusion((prev: any) => {
                    const cUnit = e.target.value;
                    const cVal = prev.concValue || 0;
                    return { ...prev, concUnit: cUnit, concentration: `${cVal} ${cUnit}/ml` };
                  })}
                  className={`text-xs px-1 py-2 rounded-r-lg border outline-none font-semibold ${isDark ? "bg-zinc-900 border-zinc-800 text-zinc-300" : "bg-slate-100 border-slate-200 text-slate-600"}`}
                >
                  <option value="mcg">mcg</option>
                  <option value="mg">mg</option>
                </select>
              </div>
            </div>

            {/* Diluent */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase">Diluente</label>
              <input
                type="text"
                value={newInfusion.diluent || ""}
                onChange={(e) => setNewInfusion((prev: any) => ({ ...prev, diluent: e.target.value }))}
                placeholder="Ex: SF 0.9% 100ml"
                className={`w-full text-xs px-2.5 py-2 rounded-lg border outline-none font-semibold ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"}`}
              />
            </div>

            {/* Vol Total */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase">Vol. Preparado (ml)</label>
              <input
                type="number"
                value={newInfusion.totalVolumePrepared || ""}
                onChange={(e) => setNewInfusion((prev: any) => ({ ...prev, totalVolumePrepared: e.target.value }))}
                placeholder="Ex: 100"
                className={`w-full text-xs px-2.5 py-2 rounded-lg border outline-none font-semibold ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"}`}
              />
            </div>
          </div>

          <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-4 gap-3">
             {/* Unit */}
             <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase">Unidade de Vazão</label>
              <select
                value={newInfusion.unit || "mcg/kg/min"}
                onChange={(e) => setNewInfusion((prev: any) => ({ ...prev, unit: e.target.value }))}
                className={`w-full text-xs px-2.5 py-2 rounded-lg border outline-none font-semibold ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-indigo-500" : "bg-white border-slate-200 text-slate-800 focus:border-indigo-500"}`}
              >
                <option value="mcg/kg/min">mcg/kg/min</option>
                <option value="mcg/kg/h">mcg/kg/h</option>
                <option value="mg/kg/h">mg/kg/h</option>
                <option value="mcg/h">mcg/h</option>
                <option value="mcg/min">mcg/min</option>
                <option value="ml/h">ml/h</option>
              </select>
            </div>

            {/* Dose Rate Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase">Dose Atual ({newInfusion.unit || "ml/h"})</label>
              <input
                type="number"
                step="any"
                value={newInfusion.rate || ""}
                onChange={(e) => setNewInfusion((prev: any) => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
                className={`w-full text-xs px-2.5 py-2 rounded-lg border outline-none font-bold text-indigo-600 dark:text-indigo-400 ${isDark ? "bg-indigo-950/30 border-indigo-900/60" : "bg-indigo-50/50 border-indigo-200"}`}
              />
            </div>

            {/* Smart Calculator Preview */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-500 uppercase flex items-center gap-1"><Calculator className="w-3 h-3"/> Conversor Estimado (Bomba)</label>
              <div className={`w-full h-[34px] flex items-center px-3 rounded-lg border font-mono font-bold text-xs ${isDark ? "bg-emerald-950/20 border-emerald-900/40 text-emerald-400" : "bg-emerald-50/50 border-emerald-200 text-emerald-700"}`}>
                Equivalência: {conversionRate}
              </div>
            </div>
          </div>
          
          <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 border-t dark:border-zinc-800 mt-2">
            {/* Início Selector */}
            <div className="space-y-1.5 mt-2">
              <label className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase block">Horário de Início</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewInfusion((prev: any) => ({ ...prev, startTimeMode: "now" }))}
                  className={`flex-1 py-1.5 px-3 text-[10px] font-bold rounded-lg border transition ${
                    newInfusion.startTimeMode === "now"
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                      : isDark
                        ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  Agora
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewInfusion((prev: any) => {
                      const dateObj = new Date();
                      const parts = getTzParts(dateObj, "America/Sao_Paulo");
                      const h = String(parts.hour).padStart(2, "0");
                      const m = String(parts.minute).padStart(2, "0");
                      return { ...prev, startTimeMode: "custom", customStartTime: `${h}:${m}` };
                    });
                  }}
                  className={`flex-1 py-1.5 px-3 text-[10px] font-bold rounded-lg border transition ${
                    newInfusion.startTimeMode === "custom"
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                      : isDark
                        ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  Especificar
                </button>
              </div>
              {newInfusion.startTimeMode === "custom" && (
                <div className="flex items-center gap-1.5 pt-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  <input
                    type="time"
                    value={newInfusion.customStartTime}
                    onChange={(e) => setNewInfusion((prev: any) => ({ ...prev, customStartTime: e.target.value }))}
                    className={`px-2 py-1 text-xs rounded-md border font-mono outline-none ${
                      isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"
                    }`}
                  />
                </div>
              )}
            </div>

            {/* Fim Selector */}
            <div className="space-y-1.5 mt-2">
              <label className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase block">Horário de Término</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewInfusion((prev: any) => ({ ...prev, endTimeMode: "active" }))}
                  className={`flex-1 py-1.5 px-3 text-[10px] font-bold rounded-lg border transition ${
                    newInfusion.endTimeMode === "active"
                      ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                      : isDark
                        ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  Em andamento
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewInfusion((prev: any) => {
                      const dateObj = new Date();
                      const parts = getTzParts(dateObj, "America/Sao_Paulo");
                      const h = String(parts.hour).padStart(2, "0");
                      const m = String(parts.minute).padStart(2, "0");
                      return { ...prev, endTimeMode: "custom", customEndTime: `${h}:${m}` };
                    });
                  }}
                  className={`flex-1 py-1.5 px-3 text-[10px] font-bold rounded-lg border transition ${
                    newInfusion.endTimeMode === "custom"
                      ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                      : isDark
                        ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  Registrar término
                </button>
              </div>
              {newInfusion.endTimeMode === "custom" && (
                <div className="flex items-center gap-1.5 pt-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-500" />
                  <input
                    type="time"
                    value={newInfusion.customEndTime}
                    onChange={(e) => setNewInfusion((prev: any) => ({ ...prev, customEndTime: e.target.value }))}
                    className={`px-2 py-1 text-xs rounded-md border font-mono outline-none ${
                      isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"
                    }`}
                  />
                </div>
              )}
            </div>
          </div>
          
          <div className="md:col-span-12">
            <button
              onClick={handleStartInfusion}
              disabled={!newInfusion.name}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold py-3 rounded-lg transition shadow-xs flex items-center justify-center gap-1.5 mt-2"
            >
              <Plus className="w-4 h-4" />
              Lançar na Ficha: {newInfusion.name || "Selecione o fármaco"} ({newInfusion.rate} {newInfusion.unit})
            </button>
          </div>
        </div>
      </div>

      {/* Active and Recorded Pumps List */}
      {continuousInfusions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {continuousInfusions.map((inf) => {
            const hist = inf.history;
            const lastState = hist[hist.length - 1];
            const active = lastState && lastState.status !== "Pausado" && lastState.status !== "Finalizado";
            
            // Determine sliders configuration based on rates and units
            const isHighRate = lastState && lastState.rate > 10;
            const minVal = isHighRate ? 10 : 0.01;
            const maxVal = isHighRate ? 400 : 5.0;
            const stepVal = isHighRate ? 5 : 0.01;

            return (
              <div key={inf.id} className={`p-4 rounded-xl border transition flex flex-col justify-between space-y-3 ${
                active 
                  ? isDark ? "bg-indigo-950/20 border-indigo-900/50" : "bg-indigo-50/50 border-indigo-200" 
                  : isDark ? "bg-zinc-900/30 border-zinc-800 text-zinc-400" : "bg-slate-50 border-slate-200 text-slate-600"
              }`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className={`font-bold text-xs ${isDark ? "text-zinc-100" : "text-slate-800"}`}>{inf.name}</h4>
                    <p className={`text-[10px] font-mono ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
                      {inf.concentration} em {inf.diluent}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                      active 
                        ? isDark ? "bg-emerald-950 text-emerald-300 border border-emerald-900/40" : "bg-emerald-100 text-emerald-800" 
                        : isDark ? "bg-zinc-800 text-zinc-500" : "bg-slate-200 text-slate-600"
                    }`}>
                      {active ? `Ativa: ${lastState.rate} ${inf.unit}` : "Parada"}
                    </span>
                    
                    {/* Remove button */}
                    <button
                      onClick={() => handleRemoveInfusion(inf.id)}
                      className={`p-1 rounded hover:bg-rose-500/10 hover:text-rose-500 transition text-slate-400`}
                      title="Remover Infusão"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Infusion History Trail */}
                <div className="text-[9px] font-mono text-slate-400 dark:text-zinc-500 flex flex-wrap gap-1">
                  <span className="font-semibold uppercase text-[8px] text-slate-500 dark:text-zinc-400">Histórico:</span>
                  {hist.map((h: any, hIdx: number) => (
                    <span key={hIdx} className="bg-zinc-100/45 dark:bg-zinc-800/40 px-1 py-0.5 rounded border border-zinc-200/20 dark:border-zinc-700/50">
                      {h.minutesFromStart}' [{h.status}: {h.rate}]
                    </span>
                  ))}
                </div>

                <div className={`flex items-center justify-between gap-2 mt-2 pt-3 border-t ${isDark ? "border-zinc-800/80" : "border-slate-100"}`}>
                  {active ? (
                    <>
                      {/* Speed modification input with + and - */}
                      <div className="flex-1 flex items-center gap-1.5 p-1 rounded-lg border border-zinc-200/50 bg-white dark:bg-zinc-950 dark:border-zinc-800">
                        <button
                          onClick={() => handleUpdateInfusionStatus(inf.id, "Alterado", Math.max(0, parseFloat((lastState.rate - stepVal).toFixed(2))))}
                          className={`w-6 h-6 flex items-center justify-center rounded-md font-bold text-lg shadow-sm border transition ${isDark ? "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          step="any"
                          value={lastState.rate}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) handleUpdateInfusionStatus(inf.id, "Alterado", val);
                          }}
                          className={`flex-1 w-full text-center bg-transparent font-mono font-bold text-xs outline-none ${isDark ? "text-zinc-100" : "text-slate-800"}`}
                        />
                        <button
                          onClick={() => handleUpdateInfusionStatus(inf.id, "Alterado", parseFloat((lastState.rate + stepVal).toFixed(2)))}
                          className={`w-6 h-6 flex items-center justify-center rounded-md font-bold text-lg shadow-sm border transition ${isDark ? "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                        >
                          +
                        </button>
                      </div>
                      
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleUpdateInfusionStatus(inf.id, "Pausado")}
                          className={`p-1.5 rounded-lg transition ${isDark ? "bg-amber-950/45 hover:bg-amber-900/60 text-amber-300" : "bg-amber-100 hover:bg-amber-200 text-amber-800"}`}
                          title="Pausar"
                        >
                          <Pause className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleUpdateInfusionStatus(inf.id, "Finalizado")}
                          className={`p-1.5 rounded-lg transition ${isDark ? "bg-rose-950/45 hover:bg-rose-900/60 text-rose-300" : "bg-rose-100 hover:bg-rose-200 text-rose-800"}`}
                          title="Parar"
                        >
                          <Square className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => handleUpdateInfusionStatus(inf.id, "Alterado", inf.history[0]?.rate || 0.1)}
                      className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Ligar Bomba / Re-iniciar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className={`text-center text-xs py-4 font-medium ${isDark ? "text-zinc-500" : "text-slate-400"}`}>Nenhuma bomba de infusão em andamento.</p>
      )}
    </div>
  );
}
INNER_EOF
sh -n src/components/ContinuousInfusionsPanel.tsx
