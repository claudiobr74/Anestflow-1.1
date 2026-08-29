import React, { useState, useMemo } from "react";
import { Layers, Settings, Clock, Plus, Trash2, Pause, Square, Play, Calculator, Activity, ChevronDown, ChevronUp, Edit2, X } from "lucide-react";
import { getTzParts } from "../utils/timezone";

const DEFAULT_INFUSION_DRUGS_PRESETS = [
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
  handleUpdateInfusion: (id: string, updates: any) => void;
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
  handleUpdateInfusion,
  handleRemoveInfusion,
  patientWeight = 70
}: ContinuousInfusionsPanelProps) {
  const [showPresets, setShowPresets] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Opióides");
  const [presets, setPresets] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem("infusionPresets");
      if (stored) return JSON.parse(stored);
    } catch(e) {}
    return DEFAULT_INFUSION_DRUGS_PRESETS;
  });
  const [isEditingPresets, setIsEditingPresets] = useState(false);
  const [editingPresetData, setEditingPresetData] = useState<any | null>(null);
  
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [editingHistoryData, setEditingHistoryData] = useState<any[]>([]);

  const savePresets = (newPresets: any[]) => {
    setPresets(newPresets);
    localStorage.setItem("infusionPresets", JSON.stringify(newPresets));
  };

  const handleDeletePreset = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Tem certeza que deseja excluir o protocolo ${name}?`)) {
      savePresets(presets.filter(p => p.name !== name));
    }
  };

  const handleEditPreset = (preset: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPresetData({ ...preset, originalName: preset.name });
  };

  const handleAddNewPreset = () => {
    setEditingPresetData({
      category: activeCategory,
      name: "",
      concentration: "",
      concValue: 0,
      concUnit: "mcg",
      diluent: "",
      totalVolumePrepared: 100,
      unit: "mcg/kg/min",
      rate: 0.1,
      ampoules: 1,
      isNew: true
    });
  };

  const handleSavePresetEdit = () => {
    if (!editingPresetData || !editingPresetData.name) return;
    
    let newPresets = [...presets];
    if (editingPresetData.isNew) {
      const { isNew, originalName, ...dataToSave } = editingPresetData;
      dataToSave.concentration = `${dataToSave.concValue} ${dataToSave.concUnit}/ml`;
      newPresets.push(dataToSave);
    } else {
      const { isNew, originalName, ...dataToSave } = editingPresetData;
      dataToSave.concentration = `${dataToSave.concValue} ${dataToSave.concUnit}/ml`;
      newPresets = newPresets.map(p => p.name === originalName ? dataToSave : p);
    }
    
    savePresets(newPresets);
    setEditingPresetData(null);
  };

  const categories = useMemo(() => {
    const cats = new Set<string>();
    presets.forEach((p: any) => cats.add(p.category));
    return Array.from(cats);
  }, [presets]);

  const selectPreset = (preset: any) => {
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
    } else if (unit === "mg/kg/min") {
      rateInMcgPerMin = rateNum * 1000 * patientWeight;
    } else if (unit === "mg/kg/h") {
      rateInMcgPerMin = (rateNum * 1000 * patientWeight) / 60;
    } else if (unit === "mg/h") {
      rateInMcgPerMin = (rateNum * 1000) / 60;
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
    <div className={`${cardClass} p-5 rounded-lg border shadow-xs transition-all duration-200`}>
      <div className={`w-full flex items-center justify-between border-b pb-4 mb-4 ${borderClass}`}>
        <div className="flex items-center gap-2">
          <Settings className={`w-5 h-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
          <h3 className={`font-bold text-sm tracking-wide uppercase flex items-center gap-2 ${isDark ? "text-zinc-100" : "text-slate-800"}`}>
            Bombas de Infusão Contínua (BIC)
          </h3>
        </div>
        <div className="flex items-center gap-3 pr-8">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowPresets(!showPresets);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
              showPresets ? "bg-indigo-600 text-white" : isDark ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            {showPresets ? "Esconder Protocolos" : "Protocolos Rápidos"}
          </button>
        </div>
      </div>
      <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-5">

      {showPresets && (
        <div className={`p-4 rounded-lg mb-4 ${isDark ? "bg-indigo-900/10" : "bg-indigo-50/30"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex flex-wrap gap-2">
              {categories.map((cat: any) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    activeCategory === cat
                      ? "bg-indigo-600 text-white"
                      : isDark ? "bg-zinc-800/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200" : "bg-white text-slate-500 border hover:bg-slate-50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setIsEditingPresets(!isEditingPresets)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition border ${
                isEditingPresets 
                  ? isDark ? "bg-rose-950/40 text-rose-400 border-rose-900/50" : "bg-rose-50 text-rose-600 border-rose-200"
                  : isDark ? "bg-zinc-800/50 text-zinc-400 border-zinc-800 hover:text-zinc-200" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Edit2 className="w-3.5 h-3.5" />
              {isEditingPresets ? "Sair da Edição" : "Editar Protocolos"}
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {presets.filter((p: any) => p.category === activeCategory).map((preset: any) => {
              const isCurrentlySelected = newInfusion.name === preset.name && !isEditingPresets;
              return (
              <div
                key={preset.name}
                onClick={() => !isEditingPresets && selectPreset(preset)}
                className={`p-3 border rounded-lg text-left flex flex-col justify-between h-22 transition select-none relative group ${
                  isEditingPresets ? "cursor-default" : "cursor-pointer"
                } ${
                  isCurrentlySelected
                    ? isDark 
                      ? "bg-indigo-950/20 border-indigo-500/85 ring-1 ring-indigo-500/30"
                      : "bg-indigo-50/60 border-indigo-400 shadow-xs"
                    : isDark 
                      ? "bg-zinc-900/40 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700" 
                      : "bg-slate-50 border-slate-100 hover:bg-indigo-50/20 hover:border-indigo-100"
                }`}
              >
                <div className="w-full">
                  <div className="flex justify-between items-start w-full">
                    <span className={`font-bold text-xs truncate block pr-4 w-full ${isDark ? "text-zinc-100" : "text-slate-800"}`}>{preset.name}</span>
                    {isEditingPresets && (
                      <div className="flex gap-1 absolute top-2 right-2">
                        <div 
                          onClick={(e) => handleEditPreset(preset, e)}
                          className={`p-1 rounded cursor-pointer ${isDark ? "bg-zinc-800 text-zinc-400 hover:text-indigo-400" : "bg-slate-100 text-slate-500 hover:text-indigo-600"}`}
                        >
                          <Edit2 className="w-3 h-3" />
                        </div>
                        <div 
                          onClick={(e) => handleDeletePreset(preset.name, e)}
                          className={`p-1 rounded cursor-pointer ${isDark ? "bg-zinc-800 text-zinc-400 hover:text-rose-400" : "bg-slate-100 text-slate-500 hover:text-rose-600"}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-between items-center w-full mt-1.5">
                  <span className={`text-xs tabular-nums font-bold px-1.5 py-0.5 rounded ${
                    isCurrentlySelected
                      ? "text-indigo-600 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-950/60"
                      : isDark ? "text-zinc-400 bg-zinc-800/40" : "text-slate-500 bg-slate-100"
                  }`}>
                    {preset.concentration}
                  </span>
                </div>
              </div>
            );
            })}
            
            {isEditingPresets && (
              <button
                onClick={handleAddNewPreset}
                className={`p-3 rounded-lg border border-dashed flex flex-col items-center justify-center h-22 transition ${
                  isDark ? "border-zinc-700 bg-zinc-900/20 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500" : "border-slate-300 bg-slate-50 text-slate-400 hover:text-slate-600 hover:border-slate-400"
                }`}
              >
                <Plus className="w-5 h-5 mb-1" />
                <span className="text-xs font-bold uppercase">Adicionar</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* PRESET EDIT MODAL */}
      {editingPresetData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-xl rounded-lg border shadow-sm flex flex-col max-h-[90vh] overflow-hidden ${
            isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"
          }`}>
            <div className="p-4 border-b flex items-center justify-between dark:border-zinc-800">
              <h3 className="font-extrabold text-sm uppercase tracking-wider">
                {editingPresetData.isNew ? "Adicionar Protocolo" : "Editar Protocolo"}
              </h3>
              <button
                onClick={() => setEditingPresetData(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Nome do Fármaco</label>
                  <input
                    type="text"
                    value={editingPresetData.name}
                    onChange={(e) => setEditingPresetData({ ...editingPresetData, name: e.target.value })}
                    className={`w-full text-xs px-3 py-2 rounded-lg border outline-none font-bold ${
                      isDark ? "bg-zinc-900 border-zinc-800 focus:border-indigo-500" : "bg-white border-slate-200 focus:border-indigo-500"
                    }`}
                  />
                </div>
                
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Categoria</label>
                  <input
                    type="text"
                    value={editingPresetData.category}
                    onChange={(e) => setEditingPresetData({ ...editingPresetData, category: e.target.value })}
                    className={`w-full text-xs px-3 py-2 rounded-lg border outline-none font-bold ${
                      isDark ? "bg-zinc-900 border-zinc-800 focus:border-indigo-500" : "bg-white border-slate-200 focus:border-indigo-500"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Valor de Concentração</label>
                  <input
                    type="number"
                    step="any"
                    value={editingPresetData.concValue}
                    onChange={(e) => setEditingPresetData({ ...editingPresetData, concValue: parseFloat(e.target.value) || 0 })}
                    className={`w-full text-xs px-3 py-2 rounded-lg border outline-none font-bold ${
                      isDark ? "bg-zinc-900 border-zinc-800 focus:border-indigo-500" : "bg-white border-slate-200 focus:border-indigo-500"
                    }`}
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Unidade de Conc.</label>
                  <select
                    value={editingPresetData.concUnit}
                    onChange={(e) => setEditingPresetData({ ...editingPresetData, concUnit: e.target.value })}
                    className={`w-full text-xs px-3 py-2 rounded-lg border outline-none font-bold ${
                      isDark ? "bg-zinc-900 border-zinc-800 focus:border-indigo-500" : "bg-white border-slate-200 focus:border-indigo-500"
                    }`}
                  >
                    <option value="mcg">mcg</option>
                    <option value="mg">mg</option>
                  </select>
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Diluente</label>
                  <input
                    type="text"
                    value={editingPresetData.diluent}
                    onChange={(e) => setEditingPresetData({ ...editingPresetData, diluent: e.target.value })}
                    className={`w-full text-xs px-3 py-2 rounded-lg border outline-none font-bold ${
                      isDark ? "bg-zinc-900 border-zinc-800 focus:border-indigo-500" : "bg-white border-slate-200 focus:border-indigo-500"
                    }`}
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Vol. Preparado (ml)</label>
                  <input
                    type="number"
                    value={editingPresetData.totalVolumePrepared}
                    onChange={(e) => setEditingPresetData({ ...editingPresetData, totalVolumePrepared: parseFloat(e.target.value) || 0 })}
                    className={`w-full text-xs px-3 py-2 rounded-lg border outline-none font-bold ${
                      isDark ? "bg-zinc-900 border-zinc-800 focus:border-indigo-500" : "bg-white border-slate-200 focus:border-indigo-500"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Ampolas Usadas</label>
                  <input
                    type="number"
                    value={editingPresetData.ampoules}
                    onChange={(e) => setEditingPresetData({ ...editingPresetData, ampoules: parseInt(e.target.value) || 0 })}
                    className={`w-full text-xs px-3 py-2 rounded-lg border outline-none font-bold ${
                      isDark ? "bg-zinc-900 border-zinc-800 focus:border-indigo-500" : "bg-white border-slate-200 focus:border-indigo-500"
                    }`}
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Dose Padrão (Vazão)</label>
                  <input
                    type="number"
                    step="any"
                    value={editingPresetData.rate}
                    onChange={(e) => setEditingPresetData({ ...editingPresetData, rate: parseFloat(e.target.value) || 0 })}
                    className={`w-full text-xs px-3 py-2 rounded-lg border outline-none font-bold ${
                      isDark ? "bg-zinc-900 border-zinc-800 focus:border-indigo-500" : "bg-white border-slate-200 focus:border-indigo-500"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Unidade da Dose</label>
                  <select
                    value={editingPresetData.unit}
                    onChange={(e) => setEditingPresetData({ ...editingPresetData, unit: e.target.value })}
                    className={`w-full text-xs px-3 py-2 rounded-lg border outline-none font-bold ${
                      isDark ? "bg-zinc-900 border-zinc-800 focus:border-indigo-500" : "bg-white border-slate-200 focus:border-indigo-500"
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

            <div className="p-4 border-t dark:border-zinc-800 flex justify-end gap-3">
              <button
                onClick={() => setEditingPresetData(null)}
                className={`px-4 py-2 text-xs font-bold rounded-lg border transition ${
                  isDark ? "border-zinc-800 hover:bg-zinc-900 text-zinc-400" : "border-slate-200 hover:bg-slate-100 text-slate-600"
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePresetEdit}
                disabled={!editingPresetData.name}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition disabled:opacity-50"
              >
                Salvar Protocolo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Setup / Preparation Form */}
      <div className={`p-4 rounded-lg space-y-4 ${isDark ? "bg-indigo-900/10" : "bg-indigo-50/30"}`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold uppercase tracking-wider block ${isDark ? "text-indigo-400" : "text-indigo-600"}`}>Preparar Infusão</span>
          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${isDark ? "bg-indigo-900/40 text-indigo-300" : "bg-white border border-indigo-100 text-indigo-600"}`}>Peso Paciente: {patientWeight} kg</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          
          <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Drug Selector */}
            <div className="space-y-1 md:col-span-1">
              <label className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase">Fármaco / Solução</label>
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
              <label className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase">Concentração (p/ ml)</label>
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
              <label className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase">Diluente</label>
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
              <label className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase">Vol. Preparado (ml)</label>
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
              <label className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase">Unidade de Vazão</label>
              <select
                value={newInfusion.unit || "mcg/kg/min"}
                onChange={(e) => setNewInfusion((prev: any) => ({ ...prev, unit: e.target.value }))}
                className={`w-full text-xs px-2.5 py-2 rounded-lg border outline-none font-semibold ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-indigo-500" : "bg-white border-slate-200 text-slate-800 focus:border-indigo-500"}`}
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

            {/* Dose Rate Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase">Dose Atual ({newInfusion.unit || "ml/h"})</label>
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
              <label className="text-xs font-semibold text-emerald-600 dark:text-emerald-500 uppercase flex items-center gap-1"><Calculator className="w-3 h-3"/> Conversor Estimado (Bomba)</label>
              <div className={`w-full h-[34px] flex items-center px-3 rounded-lg border tabular-nums font-bold text-xs ${isDark ? "bg-emerald-950/20 border-emerald-900/40 text-emerald-400" : "bg-emerald-50/50 border-emerald-200 text-emerald-700"}`}>
                Equivalência: {conversionRate}
              </div>
            </div>
          </div>
          
          <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 border-t dark:border-zinc-800 mt-2">
            {/* Início Selector */}
            <div className="space-y-1.5 mt-2">
              <label className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase block">Horário de Início</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewInfusion((prev: any) => ({ ...prev, startTimeMode: "now" }))}
                  className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg border transition ${
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
                  className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg border transition ${
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
                    className={`px-2 py-1 text-xs rounded-md border tabular-nums outline-none ${
                      isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"
                    }`}
                  />
                </div>
              )}
            </div>

            {/* Fim Selector */}
            <div className="space-y-1.5 mt-2">
              <label className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase block">Horário de Término</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewInfusion((prev: any) => ({ ...prev, endTimeMode: "active" }))}
                  className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg border transition ${
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
                  className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg border transition ${
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
                    className={`px-2 py-1 text-xs rounded-md border tabular-nums outline-none ${
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
              disabled={!newInfusion.name || continuousInfusions.some(i => i.name === newInfusion.name)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold py-3 rounded-lg transition shadow-xs flex items-center justify-center gap-1.5 mt-2"
            >
              <Plus className="w-4 h-4" />
              {continuousInfusions.some(i => i.name === newInfusion.name) ? "Fármaco já em uso" : `Lançar na Ficha: ${newInfusion.name || "Selecione o fármaco"} (${newInfusion.rate} ${newInfusion.unit})`}
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Active and Recorded Pumps List */}
      {continuousInfusions.length > 0 && (
        <div className={`mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 `}>
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
              <div key={inf.id} className={`p-4 rounded-lg border transition flex flex-col justify-between space-y-3 ${
                active 
                  ? isDark ? "bg-indigo-950/20 border-indigo-900/50" : "bg-indigo-50/50 border-indigo-200" 
                  : isDark ? "bg-zinc-900/30 border-zinc-800 text-zinc-400" : "bg-slate-50 border-slate-200 text-slate-600"
              }`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className={`font-bold text-xs ${isDark ? "text-zinc-100" : "text-slate-800"}`}>{inf.name}</h4>
                    <p className={`text-xs tabular-nums ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
                      {inf.concentration} em {inf.diluent}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
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
                <div className="text-xs tabular-nums text-slate-400 dark:text-zinc-500 flex flex-col gap-1">
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="font-semibold uppercase text-xs text-slate-500 dark:text-zinc-400">Histórico:</span>
                    {hist.map((h: any, hIdx: number) => (
                      <span key={hIdx} className="bg-zinc-100/45 dark:bg-zinc-800/40 px-1 py-0.5 rounded border border-zinc-200/20 dark:border-zinc-700/50">
                        {new Date(h.timestamp).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})} [{h.status}: {h.rate}]
                      </span>
                    ))}
                    <button 
                      onClick={() => {
                        setEditingHistoryId(inf.id);
                        setEditingHistoryData(JSON.parse(JSON.stringify(hist)));
                      }}
                      className="ml-1 p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition text-indigo-500"
                      title="Editar Histórico"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                  {editingHistoryId === inf.id && (
                    <div className={`p-2 rounded-lg border ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-slate-50 border-slate-200"} text-xs flex flex-col gap-2 mt-1`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold">Editar Histórico</span>
                        <button onClick={() => setEditingHistoryId(null)}><X className="w-3.5 h-3.5" /></button>
                      </div>
                      {editingHistoryData.map((eh, ehIdx) => (
                        <div key={ehIdx} className="flex items-center gap-2">
                          <span className="w-16 truncate tabular-nums text-xs">{eh.status}</span>
                          <input 
                            type="time" 
                            value={new Date(eh.timestamp).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})} 
                            onChange={(e) => {
                              const newD = [...editingHistoryData];
                              const [hh, mm] = e.target.value.split(":");
                              const dt = new Date(eh.timestamp);
                              dt.setHours(parseInt(hh) || 0, parseInt(mm) || 0);
                              newD[ehIdx].timestamp = dt.toISOString();
                              setEditingHistoryData(newD);
                            }}
                            className={`w-20 px-1 py-0.5 rounded border tabular-nums text-center ${isDark ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-slate-300 text-slate-800"}`}
                          />
                          {eh.status !== "Pausado" && eh.status !== "Finalizado" && (
                            <>
                              <input 
                                type="number" 
                                value={eh.rate} 
                                step="any"
                                onChange={(e) => {
                                  const newD = [...editingHistoryData];
                                  newD[ehIdx].rate = parseFloat(e.target.value) || 0;
                                  setEditingHistoryData(newD);
                                }}
                                className={`w-16 px-1 py-0.5 rounded border tabular-nums text-center ${isDark ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-slate-300 text-slate-800"}`}
                              />
                              <span className="text-xs text-zinc-500">{inf.unit}</span>
                            </>
                          )}
                        </div>
                      ))}
                      <div className="flex justify-end mt-1">
                        <button
                          onClick={() => {
                            const sortedData = [...editingHistoryData].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                            handleUpdateInfusion(inf.id, { history: sortedData });
                            setEditingHistoryId(null);
                          }}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold transition"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  )}
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
                          className={`flex-1 w-full text-center bg-transparent tabular-nums font-bold text-xs outline-none ${isDark ? "text-zinc-100" : "text-slate-800"}`}
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
      )}
      {continuousInfusions.length === 0 && (
        <p className={`text-center text-xs py-4 font-medium ${isDark ? "text-zinc-500" : "text-slate-400"}`}>Nenhuma bomba de infusão em andamento.</p>
      )}
    </div>
  );
}
