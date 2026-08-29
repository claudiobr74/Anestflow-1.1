import React from "react";
import { Layers, Clock, Plus, Search } from "lucide-react";
import { FAVORITE_DRUGS } from "../mockData";
import { BolusDrug } from "../types";

interface BolusDrugsPanelProps {
  isDark: boolean;
  bolusDrugs: BolusDrug[];
  selectedDrug: typeof FAVORITE_DRUGS[number];
  customRoute: string;
  setCustomRoute: (val: string) => void;
  customDose: string;
  setCustomDose: (val: string) => void;
  timeMode: "now" | "custom";
  setTimeMode: (val: "now" | "custom") => void;
  customTime: string;
  setCustomTime: (val: string) => void;
  drugSearchQuery: string;
  setDrugSearchQuery: (val: string) => void;
  selectedDrugCategory: string;
  setSelectedDrugCategory: (val: string) => void;
  handleSelectDrugForLaunch: (drug: typeof FAVORITE_DRUGS[number]) => void;
  handleConfirmLaunch: () => void;
}

export default function BolusDrugsPanel({
  isDark,
  bolusDrugs,
  selectedDrug,
  customRoute,
  setCustomRoute,
  customDose,
  setCustomDose,
  timeMode,
  setTimeMode,
  customTime,
  setCustomTime,
  drugSearchQuery,
  setDrugSearchQuery,
  selectedDrugCategory,
  setSelectedDrugCategory,
  handleSelectDrugForLaunch,
  handleConfirmLaunch,
}: BolusDrugsPanelProps) {
  return (
    <div className="space-y-4">
      {/* Active Launch Console / Configurator */}
      <div className={`p-4 rounded-lg border border-transparent dark:border-transparent space-y-3.5 ${isDark ? "bg-zinc-900/30" : "bg-slate-50/50"}`}>
        <div className="flex justify-between items-start gap-2">
          <div>
            <span className={`text-xs font-bold uppercase tracking-wider block mb-0.5 ${isDark ? "text-rose-400" : "text-rose-600"}`}>
              Fármaco Selecionado
            </span>
            <h4 className={`text-sm font-extrabold ${isDark ? "text-white" : "text-slate-800"}`}>
              {selectedDrug.name}
            </h4>
            <p className={`text-xs tabular-nums ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
              Categoria: {selectedDrug.category}
            </p>
          </div>
          
          <div className="flex gap-1.5 shrink-0">
            <select
              value={customRoute}
              onChange={(e) => setCustomRoute(e.target.value)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg border outline-none ${
                isDark ? "bg-zinc-900 border-zinc-800 text-zinc-200 focus:border-rose-500" : "bg-white border-slate-200 text-slate-700 focus:border-rose-500"
              }`}
            >
              <option value="EV">EV</option>
              <option value="IM">IM</option>
              <option value="SC">SC</option>
              <option value="Inalatório">Inalatório</option>
              <option value="ID">ID</option>
            </select>
          </div>
        </div>

        {/* Dose and Time inputs */}
        <div className="grid grid-cols-2 gap-3">
          {/* Dose Input */}
          <div className="space-y-1">
            <label className={`text-xs font-bold block ${isDark ? "text-zinc-400" : "text-slate-600"}`}>
              Dose ({selectedDrug.defaultUnit})
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(customDose);
                  if (!isNaN(val) && val > 0) {
                    const step = selectedDrug.defaultUnit === "mcg" ? 25 : selectedDrug.defaultUnit === "mg" ? 10 : selectedDrug.defaultUnit === "g" ? 0.5 : 1;
                    setCustomDose(Math.max(0, val - step).toString());
                  }
                }}
                className={`p-1.5 rounded-lg border text-xs font-bold transition select-none ${
                  isDark ? "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                -
              </button>
              <input
                type="number"
                step="any"
                value={customDose}
                onChange={(e) => setCustomDose(e.target.value)}
                className={`w-full text-center tabular-nums font-bold text-xs py-1.5 rounded-lg border focus:outline-none ${
                  isDark ? "bg-zinc-900 border-zinc-800 text-zinc-100 focus:border-rose-500" : "bg-white border-slate-200 text-slate-800 focus:border-rose-500"
                }`}
              />
              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(customDose);
                  if (!isNaN(val)) {
                    const step = selectedDrug.defaultUnit === "mcg" ? 25 : selectedDrug.defaultUnit === "mg" ? 10 : selectedDrug.defaultUnit === "g" ? 0.5 : 1;
                    setCustomDose((val + step).toString());
                  }
                }}
                className={`p-1.5 rounded-lg border text-xs font-bold transition select-none ${
                  isDark ? "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                +
              </button>
            </div>
          </div>

          {/* Time Mode and Input */}
          <div className="space-y-1">
            <label className={`text-xs font-bold block ${isDark ? "text-zinc-400" : "text-slate-600"}`}>
              Horário de Registro
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setTimeMode("now")}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg border transition ${
                  timeMode === "now"
                    ? "bg-rose-600 border-rose-600 text-white"
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
                  setTimeMode("custom");
                  if (!customTime) {
                    const dateObj = new Date();
                    const h = String(dateObj.getUTCHours()).padStart(2, "0");
                    const m = String(dateObj.getUTCMinutes()).padStart(2, "0");
                    setCustomTime(`${h}:${m}`);
                  }
                }}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg border transition ${
                  timeMode === "custom"
                    ? "bg-rose-600 border-rose-600 text-white"
                    : isDark
                      ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                }`}
              >
                Escolher
              </button>
            </div>
          </div>
        </div>

        {/* Custom Time Input Picker */}
        {timeMode === "custom" && (
          <div className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 transition-all ${
            isDark ? "bg-zinc-900/50 border-zinc-800/60" : "bg-slate-100/50 border-slate-200/60"
          }`}>
            <span className={`text-xs font-semibold flex items-center gap-1 ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
              <Clock className="w-3.5 h-3.5 text-rose-500" />
              Horário Realizado (UTC):
            </span>
            <input
              type="time"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              className={`px-2 py-1 text-xs rounded-md border tabular-nums outline-none focus:border-rose-500 ${
                isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"
              }`}
            />
          </div>
        )}

        {/* Action Launch Button */}
        <button
          type="button"
          onClick={handleConfirmLaunch}
          className="w-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold py-2 rounded-lg transition shadow-xs flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Lançar {selectedDrug.name} ({customDose} {selectedDrug.defaultUnit})
        </button>
      </div>

      {/* Search Box */}
      <div className="relative">
        <Search className={`absolute left-3 top-2.5 w-4 h-4 ${isDark ? "text-zinc-500" : "text-slate-400"}`} />
        <input
          type="text"
          placeholder="Buscar fármaco genérico..."
          value={drugSearchQuery}
          onChange={(e) => setDrugSearchQuery(e.target.value)}
          className={`w-full pl-9 pr-4 py-2 text-xs rounded-lg border outline-none transition ${
            isDark 
              ? "bg-zinc-950 border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:border-rose-500/50" 
              : "bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-rose-500/50"
          }`}
        />
      </div>

      {/* Category Quick Chips */}
      <div className="flex gap-1 overflow-x-auto pb-1 select-none scrollbar-none">
        {["Todos", "Sedativos / Indutores", "Bloqueadores Neuromusculares", "Opioides / Analgésicos", "Cardiovascular / Vasoativos", "Antieméticos", "Adjuvantes e Reversores"].map(cat => {
          const active = selectedDrugCategory === cat;
          const displayLabel = cat === "Bloqueadores Neuromusculares" ? "Bloqueadores"
            : cat === "Opioides / Analgésicos" ? "Opioides"
            : cat === "Cardiovascular / Vasoativos" ? "Cardio/Vasoat."
            : cat === "Adjuvantes e Reversores" ? "Adjuv./Revers."
            : cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedDrugCategory(cat)}
              className={`px-2.5 py-1 text-xs font-bold rounded-full transition shrink-0 border whitespace-nowrap ${
                active
                  ? "bg-rose-600 border-rose-600 text-white shadow-xs"
                  : isDark
                    ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              {displayLabel}
            </button>
          );
        })}
      </div>

      {/* Scrollable Drug List */}
      <div className="max-h-[300px] overflow-y-auto pr-1 space-y-1 scrollbar-thin">
        {(() => {
          const filteredDrugs = FAVORITE_DRUGS.filter(drug => {
            const matchesCategory = selectedDrugCategory === "Todos" || drug.category === selectedDrugCategory;
            const matchesSearch = drug.name.toLowerCase().includes(drugSearchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
          });

          return (
            <>
              <div className="grid grid-cols-2 gap-2">
                {filteredDrugs.map(drug => {
                  const isCurrentlySelected = selectedDrug.name === drug.name;
                  return (
                    <button
                      key={drug.name}
                      onClick={() => handleSelectDrugForLaunch(drug)}
                      className={`p-3 border rounded-lg text-left transition select-none flex flex-col justify-between h-22 ${
                        isCurrentlySelected
                          ? isDark
                            ? "bg-rose-950/20 border-rose-500/85 ring-1 ring-rose-500/30"
                            : "bg-rose-50/40 border-rose-400 shadow-xs"
                          : isDark 
                            ? "bg-zinc-900/40 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700" 
                            : "bg-slate-50 border-slate-100 hover:bg-rose-50/20 hover:border-rose-100"
                      }`}
                    >
                      <div className="w-full">
                        <span className={`font-bold text-xs truncate block w-full ${isDark ? "text-zinc-100" : "text-slate-800"}`}>{drug.name}</span>
                        <span className={`text-xs font-medium uppercase tracking-wide block mt-0.5 ${
                          isDark ? "text-zinc-500" : "text-slate-400"
                        }`}>
                          {drug.category.split(" / ")[0].split(" e ")[0]}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center w-full mt-1.5">
                        <span className={`text-xs tabular-nums font-bold px-1.5 py-0.5 rounded ${
                          isCurrentlySelected
                            ? "text-rose-600 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/40"
                            : isDark ? "text-indigo-300 bg-indigo-950/40" : "text-indigo-600 bg-indigo-50"
                        }`}>
                          {drug.defaultDose} {drug.defaultUnit}
                        </span>
                        <span className={`text-xs font-medium ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
                          {drug.defaultRoute}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {filteredDrugs.length === 0 && (
                <div className="text-center py-10 space-y-2">
                  <p className={`text-xs font-semibold ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
                    Nenhum fármaco encontrado.
                  </p>
                  <p className={`text-xs ${isDark ? "text-zinc-600" : "text-slate-400"}`}>
                    Tente digitar outra busca ou limpe o filtro.
                  </p>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}
