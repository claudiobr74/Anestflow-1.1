import React, { useState } from "react";
import { Droplets, Clock, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { FAVORITE_FLUIDS } from "../mockData";

interface HydrationPanelProps {
  isDark: boolean;
  borderClass?: string;
  cardClass?: string;
  newFluid: any;
  setNewFluid: React.Dispatch<React.SetStateAction<any>>;
  fluidTimeMode: "now" | "custom";
  setFluidTimeMode: (val: "now" | "custom") => void;
  customFluidTime: string;
  setCustomFluidTime: (val: string) => void;
  handleAddFluid: () => void;
  fluids: any[];
  handleRemoveFluid: (id: string) => void;
  getTimeString: (dateStr: string) => string;
  outputType: "Diurese" | "Perda Sanguínea Estimada";
  setOutputType: (val: "Diurese" | "Perda Sanguínea Estimada") => void;
  outputVal: string;
  setOutputVal: (val: string) => void;
  handleAddOutput: () => void;
  outputs: any[];
  handleRemoveOutput: (id: string) => void;
  totalInflow: number;
  totalOutflow: number;
  netBalance: number;
}

export default function HydrationPanel({
  isDark,
  borderClass = "border-slate-200 dark:border-zinc-800",
  cardClass = "bg-white dark:bg-zinc-950",
  newFluid,
  setNewFluid,
  fluidTimeMode,
  setFluidTimeMode,
  customFluidTime,
  setCustomFluidTime,
  handleAddFluid,
  fluids,
  handleRemoveFluid,
  getTimeString,
  outputType,
  setOutputType,
  outputVal,
  setOutputVal,
  handleAddOutput,
  outputs,
  handleRemoveOutput,
  totalInflow,
  totalOutflow,
  netBalance,
}: HydrationPanelProps) {
  
  return (
    <div className={`${cardClass} p-5 rounded-lg border shadow-xs transition-all duration-200`}>
      <div className="flex items-center gap-2 mb-4">
        <Droplets className={`w-5 h-5 ${isDark ? "text-sky-400" : "text-sky-600"}`} />
        <h3 className={`font-bold text-sm tracking-wide uppercase flex items-center gap-2 ${isDark ? "text-zinc-100" : "text-slate-800"}`}>
          Cristaloides, Sangue e Balanço Hídrico
        </h3>
      </div>
      <div className="space-y-5">
      {/* Fluid Configurator Console */}
      <div className={`p-4 rounded-lg space-y-3.5 ${isDark ? "bg-sky-900/10" : "bg-sky-50/30"}`}>
        <div className="space-y-1">
          <label className={`text-xs font-bold block uppercase tracking-wider ${isDark ? "text-sky-400" : "text-sky-600"}`}>
            Selecionar Solução / Sangue
          </label>
          <select
            value={newFluid.name}
            onChange={(e) => {
              const name = e.target.value;
              const found = FAVORITE_FLUIDS.find(f => f.name === name);
              if (found) {
                setNewFluid({
                  name,
                  type: found.type as any,
                  volume: found.defaultVolume
                });
              }
            }}
            className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none ${
              isDark ? "bg-sky-950/40 border border-sky-900/60 text-sky-100 focus:border-sky-500" : "bg-white border border-sky-200 text-sky-900 focus:border-sky-500"
            }`}
          >
            {FAVORITE_FLUIDS.map(f => (
              <option key={f.name} value={f.name}>{f.name}</option>
            ))}
          </select>
        </div>

        {/* Volume and Time settings */}
        <div className="grid grid-cols-2 gap-3">
          {/* Volume Input */}
          <div className="space-y-1">
            <label className={`text-xs font-bold block uppercase tracking-wider ${isDark ? "text-sky-400" : "text-sky-600"}`}>
              Volume (ml)
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const v = Math.max(0, newFluid.volume - 50);
                  setNewFluid(prev => ({ ...prev, volume: v }));
                }}
                className={`p-1.5 rounded-lg border text-xs font-bold transition select-none ${
                  isDark ? "bg-sky-950/40 border-sky-900/60 text-sky-300 hover:bg-sky-900/60" : "bg-white border-sky-200 text-sky-600 hover:bg-sky-50"
                }`}
              >
                -
              </button>
              <input
                type="number"
                value={newFluid.volume}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setNewFluid(prev => ({ ...prev, volume: val }));
                }}
                className={`w-full text-center tabular-nums font-bold text-xs py-1.5 rounded-lg border focus:outline-none ${
                  isDark ? "bg-sky-950/40 border-sky-900/60 text-sky-100 focus:border-sky-500" : "bg-white border-sky-200 text-sky-900 focus:border-sky-500"
                }`}
              />
              <button
                type="button"
                onClick={() => {
                  const v = newFluid.volume + 50;
                  setNewFluid(prev => ({ ...prev, volume: v }));
                }}
                className={`p-1.5 rounded-lg border text-xs font-bold transition select-none ${
                  isDark ? "bg-sky-950/40 border-sky-900/60 text-sky-300 hover:bg-sky-900/60" : "bg-white border-sky-200 text-sky-600 hover:bg-sky-50"
                }`}
              >
                +
              </button>
            </div>
          </div>

          {/* Time Mode Selection */}
          <div className="space-y-1">
            <label className={`text-xs font-bold block uppercase tracking-wider ${isDark ? "text-sky-400" : "text-sky-600"}`}>
              Horário de Registro
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setFluidTimeMode("now")}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg border transition ${
                  fluidTimeMode === "now"
                    ? "bg-sky-600 border-sky-600 text-white"
                    : isDark
                      ? "bg-sky-950/20 border-sky-900/40 text-sky-400 hover:bg-sky-950/40"
                      : "bg-white border-sky-200 text-sky-600 hover:bg-sky-50"
                }`}
              >
                Agora
              </button>
              <button
                type="button"
                onClick={() => {
                  setFluidTimeMode("custom");
                  if (!customFluidTime) {
                    const dateObj = new Date();
                    const h = String(dateObj.getUTCHours()).padStart(2, "0");
                    const m = String(dateObj.getUTCMinutes()).padStart(2, "0");
                    setCustomFluidTime(`${h}:${m}`);
                  }
                }}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg border transition ${
                  fluidTimeMode === "custom"
                    ? "bg-sky-600 border-sky-600 text-white"
                    : isDark
                      ? "bg-sky-950/20 border-sky-900/40 text-sky-400 hover:bg-sky-950/40"
                      : "bg-white border-sky-200 text-sky-600 hover:bg-sky-50"
                }`}
              >
                Escolher
              </button>
            </div>
          </div>
        </div>

        {/* Quick volume suggestions buttons */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {(
            newFluid.type === "Albumina" || newFluid.type === "Crioprecipitado"
              ? [40, 50, 100, 250]
              : newFluid.type === "Concentrado de Hemácias" || newFluid.type === "Plasma Fresco" || newFluid.type === "Plaquetas"
                ? [100, 200, 300, 500]
                : [100, 250, 500, 1000]
          ).map(vol => (
            <button
              key={vol}
              type="button"
              onClick={() => setNewFluid(prev => ({ ...prev, volume: vol }))}
              className={`px-2 py-1 text-xs font-bold rounded-md border transition ${
                newFluid.volume === vol
                  ? "bg-sky-500/20 border-sky-500 text-sky-500"
                  : isDark
                    ? "bg-sky-950/20 border-sky-900/40 text-sky-400 hover:text-sky-200"
                    : "bg-white border-sky-200 text-sky-600 hover:bg-sky-50"
              }`}
            >
              {vol}ml
            </button>
          ))}
        </div>

        {/* Custom Time Picker */}
        {fluidTimeMode === "custom" && (
          <div className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 transition-all ${
            isDark ? "bg-sky-950/20 border-sky-900/40" : "bg-sky-50/40 border-sky-200/60"
          }`}>
            <span className={`text-xs font-semibold flex items-center gap-1 ${isDark ? "text-sky-400" : "text-sky-600"}`}>
              <Clock className="w-3.5 h-3.5 text-sky-500" />
              Horário Realizado (UTC):
            </span>
            <input
              type="time"
              value={customFluidTime}
              onChange={(e) => setCustomFluidTime(e.target.value)}
              className={`px-2 py-1 text-xs rounded-md border tabular-nums outline-none focus:border-sky-500 ${
                isDark ? "bg-sky-950/40 border-sky-900/60 text-sky-100" : "bg-white border-sky-200 text-sky-800"
              }`}
            />
          </div>
        )}

        {/* Action launch button */}
        <button
          onClick={handleAddFluid}
          className="w-full bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold py-2 rounded-lg transition shadow-xs flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Lançar {newFluid.name} ({newFluid.volume}ml)
        </button>
      </div>

        {/* Real-time water output logger (Urine, Loss) form */}
        <div className={`${isDark ? "bg-sky-900/10" : "bg-sky-50/30"} p-4 rounded-lg space-y-3.5`}>
          <div className="space-y-1">
            <label className={`text-xs font-bold block uppercase tracking-wider ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>
              Registrar Perda / Diurese
            </label>
            <div className="flex gap-2">
              <select
                value={outputType}
                onChange={(e) => setOutputType(e.target.value as any)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none ${
                  isDark ? 'bg-sky-950/20 border border-sky-900/60 text-sky-100 focus:border-rose-500' : 'bg-white border border-sky-200 text-sky-900 focus:border-rose-500'
                }`}
              >
                <option value="Diurese">Diurese (ml)</option>
                <option value="Perda Sanguínea Estimada">Perda Sangue (ml)</option>
              </select>
              <input
                type="number"
                placeholder="Vol"
                value={outputVal}
                onChange={(e) => setOutputVal(e.target.value)}
                className={`w-16 rounded-lg px-2 py-1.5 text-xs text-center tabular-nums font-semibold focus:outline-none ${
                  isDark ? 'bg-sky-950/20 border border-sky-900/60 text-sky-100 focus:border-rose-500' : 'bg-white border border-sky-200 text-sky-900 focus:border-rose-500'
                }`}
              />
              <button
                onClick={handleAddOutput}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                  isDark ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-900/40' : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                Lançar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Active and Recorded Fluids/Outputs List */}
      {(fluids.length > 0 || outputs.length > 0) ? (
        <div className="space-y-4">
          {/* Fluid Entries List */}
          {fluids.length > 0 && (
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
              {fluids.map((fl) => (
                <div key={fl.id} className={`flex justify-between items-center text-xs p-2 rounded-lg border ${
                  isDark ? 'bg-sky-950/20 border-sky-900/40 text-sky-100' : 'bg-sky-50/40 border-sky-100 text-sky-900'
                }`}>
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="font-bold truncate text-xs">
                      {fl.name}
                    </div>
                    {fl.startTime && (
                      <span className={`text-xs tabular-nums flex items-center gap-0.5 mt-0.5 ${
                        isDark ? 'text-sky-400/70' : 'text-sky-600/70'
                      }`}>
                        <Clock className="w-2.5 h-2.5 text-sky-500/80" />
                        Reg: {getTimeString(fl.startTime)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="tabular-nums font-bold text-sky-500 text-xs">{fl.volumeAdministered}ml</span>
                    <button onClick={() => handleRemoveFluid(fl.id)} className="p-1 hover:bg-sky-100/30 text-sky-400 hover:text-sky-300 rounded transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Outputs Entries List */}
          {outputs.length > 0 && (
            <div className="space-y-1 max-h-[120px] overflow-y-auto">
              {outputs.map((out) => (
                <div key={out.id} className={`flex justify-between items-center text-xs p-1.5 rounded-lg border ${
                  isDark ? 'bg-rose-950/20 border-rose-900/40 text-rose-300' : 'bg-rose-50/40 border-rose-100 text-rose-800'
                }`}>
                  <span className="font-medium">{out.type}</span>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums font-bold text-rose-500">{out.volume}ml</span>
                    <button onClick={() => handleRemoveOutput(out.id)} className="p-0.5 text-rose-500 hover:bg-rose-100/20 rounded transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Interactive math totalizer */}
          <div className={`p-3 rounded-lg border grid grid-cols-3 gap-2 text-center select-none tabular-nums text-xs ${
            isDark ? 'bg-sky-950/20 border-sky-900/40' : 'bg-sky-50/40 border-sky-200/60'
          }`}>
            <div>
              <span className={`block mb-0.5 ${isDark ? 'text-sky-400/70' : 'text-sky-600/70'}`}>Total Infundido</span>
              <span className="font-bold text-xs text-sky-500">{totalInflow}ml</span>
            </div>
            <div>
              <span className={`block mb-0.5 ${isDark ? 'text-rose-400/70' : 'text-rose-600/70'}`}>Total Perdas</span>
              <span className="font-bold text-xs text-rose-500">{totalOutflow}ml</span>
            </div>
            <div>
              <span className={`block mb-0.5 ${isDark ? 'text-emerald-400/70' : 'text-emerald-600/70'}`}>Balanço Hídrico</span>
              <span className={`font-bold text-xs ${netBalance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {netBalance > 0 ? `+${netBalance}` : netBalance}ml
              </span>
            </div>
          </div>
        </div>
      ) : (
        <p className={`text-center text-xs py-4 font-medium ${isDark ? 'text-sky-600/50' : 'text-sky-600/50'}`}>Nenhum líquido ou perda registrados.</p>
      )}
    </div>
  );
}