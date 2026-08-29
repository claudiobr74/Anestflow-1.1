import React, { useState, useEffect, useMemo } from "react";
import { Wind, Clock, Plus, Trash2, Square, Activity, Beaker, Minus, Edit2, X } from "lucide-react";
import { InhalationAgent } from "../types";
import { getTzParts } from "../utils/timezone";

interface GasesPanelProps {
  isDark: boolean;
  borderClass?: string;
  cardClass?: string;
  inhalationAgents: InhalationAgent[];
  newAgent: any;
  setNewAgent: React.Dispatch<React.SetStateAction<any>>;
  handleStartInhalationAgent: () => void;
  handleStopInhalationAgent: (id: string) => void;
  handleRemoveInhalationAgent: (id: string) => void;
  handleUpdateAgent: (id: string, updates: any) => void;
  isExpanded?: boolean;
}

export default function GasesPanel({
  isDark,
  borderClass = "border-slate-200 dark:border-zinc-800",
  cardClass = "bg-white dark:bg-zinc-950",
  inhalationAgents,
  newAgent,
  setNewAgent,
  handleStartInhalationAgent,
  handleStopInhalationAgent,
  handleRemoveInhalationAgent,
  handleUpdateAgent,
  isExpanded = true
}: GasesPanelProps) {
  
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");

  useEffect(() => {
    const interval = setInterval(() => setCurrentTimeMs(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const getVolatileConsumption = (agentName: string, conc: number, flow: number, durationMs: number) => {
    if (!["Sevoflurano", "Desflurano", "Isoflurano"].includes(agentName)) return null;
    if (!conc || !flow) return null;
    
    // Formula de Dion simplificada: Consumo Líquido (ml/h) ≈ 3 * FGF (L/min) * % do gás
    const mlPerHour = 3 * flow * conc;
    const durationHours = Math.max(0, durationMs) / 3600000;
    
    return {
      mlPerHour: mlPerHour.toFixed(1),
      totalMl: (mlPerHour * durationHours).toFixed(1)
    };
  };

  const currentNewAgentConsumption = useMemo(() => {
    return getVolatileConsumption(newAgent.agent, newAgent.inspiredConc, newAgent.flowO2, 3600000); // Exibe consumo / h
  }, [newAgent.agent, newAgent.inspiredConc, newAgent.flowO2]);

  // Preset handlers
  const handleSetAgent = (agent: string) => {
    const isGas = agent === "Oxigênio (O₂)" || agent === "Ar Comprimido";
    setNewAgent((prev: any) => ({ 
      ...prev, 
      agent,
      inspiredConc: isGas ? 100 : prev.inspiredConc
    }));
  };

  const handleSetConc = (conc: number) => setNewAgent((prev: any) => ({ ...prev, inspiredConc: conc }));
  const handleSetFlow = (flow: number) => setNewAgent((prev: any) => ({ ...prev, flowO2: flow }));

  const displayedAgents = isExpanded 
    ? inhalationAgents 
    : inhalationAgents.filter(ia => !ia.endTime);

  return (
    <div className={`${cardClass} p-5 rounded-lg border ${borderClass} shadow-xs space-y-5`}>
      <div className="flex items-center gap-2 mb-2">
        <Wind className={`w-5 h-5 ${isDark ? "text-teal-400" : "text-teal-600"}`} />
        <h3 className={`font-bold text-sm tracking-wide uppercase flex items-center gap-2 ${isDark ? "text-zinc-100" : "text-slate-800"}`}>
          Gases e Anestésicos Inalatórios
        </h3>
      </div>
      {/* Setup / Preparation Form */}
      {isExpanded && (
        <div className={`p-4 rounded-lg space-y-4 ${isDark ? "bg-teal-900/10" : "bg-teal-50/30"}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider block ${isDark ? "text-teal-400" : "text-teal-600"}`}>Registrar Novo Lançamento</span>
            {currentNewAgentConsumption && (
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold ${isDark ? "bg-indigo-950/40 text-indigo-300" : "bg-indigo-50 text-indigo-700"}`}>
                <Beaker className="w-3 h-3" />
                Consumo Estimado: {currentNewAgentConsumption.mlPerHour} ml/h
              </div>
            )}
          </div>
          
          {/* Quick Presets */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {["Sevoflurano", "Desflurano", "Isoflurano", "Óxido Nitroso", "Oxigênio (O₂)", "Ar Comprimido"].map(a => (
                <button
                  key={a}
                  onClick={() => handleSetAgent(a)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
                    newAgent.agent === a
                      ? "bg-teal-600 text-white border-teal-600"
                      : isDark ? "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>

            {/* Conc & FGF Presets - Only if volatile */}
            {["Sevoflurano", "Desflurano", "Isoflurano"].includes(newAgent.agent) && (
              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 border-t mt-2 border-dashed dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase">Conc. (%)</span>
                  {[1.0, 2.0, 3.0, 4.0, 6.0, 8.0].map(c => (
                    <button
                      key={c}
                      onClick={() => handleSetConc(c)}
                      className={`px-2 py-1 text-xs font-bold rounded border transition ${
                        newAgent.inspiredConc === c
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : isDark ? "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {c}%
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase">FGF (L/min)</span>
                  {[0.5, 1.0, 1.5, 2.0, 3.0].map(f => (
                    <button
                      key={f}
                      onClick={() => handleSetFlow(f)}
                      className={`px-2 py-1 text-xs font-bold rounded border transition ${
                        newAgent.flowO2 === f
                          ? "bg-teal-600 text-white border-teal-600"
                          : isDark ? "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Agent Selector (Dropdown) */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase">Agente / Gás</label>
              <select
                value={newAgent.agent}
                onChange={(e) => handleSetAgent(e.target.value)}
                className={`w-full text-xs px-2.5 py-2 rounded-lg border outline-none font-semibold ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-teal-500" : "bg-white border-slate-200 text-slate-800 focus:border-teal-500"}`}
              >
                <option value="Sevoflurano">Sevoflurano</option>
                <option value="Desflurano">Desflurano</option>
                <option value="Isoflurano">Isoflurano</option>
                <option value="Óxido Nitroso">Óxido Nitroso</option>
                <option value="Oxigênio (O₂)">Oxigênio (O₂)</option>
                <option value="Ar Comprimido">Ar Comprimido</option>
              </select>
            </div>

            {/* Concentration - Only visible if not pure gas */}
            {!(newAgent.agent === "Oxigênio (O₂)" || newAgent.agent === "Ar Comprimido") ? (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase">Concentração (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={newAgent.inspiredConc}
                  onChange={(e) => handleSetConc(parseFloat(e.target.value) || 0)}
                  className={`w-full text-xs px-2.5 py-2 rounded-lg border outline-none font-semibold ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"}`}
                />
              </div>
            ) : (
              <div className="flex items-center px-3 py-1 bg-teal-500/10 border border-teal-500/20 rounded-lg text-xs font-medium text-teal-400">
                {newAgent.agent === "Oxigênio (O₂)" 
                  ? "Oxigênio puro (100%). Informe apenas o fluxo de oxigênio desejado."
                  : "Ar comprimido puro. Informe apenas o fluxo de ar comprimido desejado."
                }
              </div>
            )}

            {/* Flow - Always visible to allow FGF configuration for volatile agents too */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase">
                {newAgent.agent === "Oxigênio (O₂)" ? "Fluxo de O₂ (L/min)" : newAgent.agent === "Ar Comprimido" ? "Fluxo de Ar Comprimido (L/min)" : "FGF O₂/Ar (L/min)"}
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={newAgent.flowO2}
                onChange={(e) => handleSetFlow(parseFloat(e.target.value) || 0)}
                className={`w-full text-xs px-2.5 py-2 rounded-lg border outline-none font-semibold ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"}`}
              />
            </div>
          </div>

          {/* Início & Fim selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Início Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase block">Horário de Início</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewAgent((prev: any) => ({ ...prev, startTimeMode: "now" }))}
                  className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg border transition ${
                    newAgent.startTimeMode === "now"
                      ? "bg-teal-600 border-teal-600 text-white shadow-xs"
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
                    setNewAgent((prev: any) => {
                      const dateObj = new Date();
                      const h = String(dateObj.getUTCHours()).padStart(2, "0");
                      const m = String(dateObj.getUTCMinutes()).padStart(2, "0");
                      return { ...prev, startTimeMode: "custom", customStartTime: `${h}:${m}` };
                    });
                  }}
                  className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg border transition ${
                    newAgent.startTimeMode === "custom"
                      ? "bg-teal-600 border-teal-600 text-white shadow-xs"
                      : isDark
                        ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  Especificar hora
                </button>
              </div>
              {newAgent.startTimeMode === "custom" && (
                <div className="flex items-center gap-1.5 pt-1">
                  <Clock className="w-3.5 h-3.5 text-teal-500" />
                  <input
                    type="time"
                    value={newAgent.customStartTime}
                    onChange={(e) => setNewAgent((prev: any) => ({ ...prev, customStartTime: e.target.value }))}
                    className={`px-2 py-1 text-xs rounded-md border tabular-nums outline-none ${
                      isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"
                    }`}
                  />
                </div>
              )}
            </div>

            {/* Fim Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase block">Horário de Término</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewAgent((prev: any) => ({ ...prev, endTimeMode: "active" }))}
                  className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg border transition ${
                    newAgent.endTimeMode === "active"
                      ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                      : isDark
                        ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  Ativo (Em andamento)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewAgent((prev: any) => {
                      const dateObj = new Date();
                      const h = String(dateObj.getUTCHours()).padStart(2, "0");
                      const m = String(dateObj.getUTCMinutes()).padStart(2, "0");
                      return { ...prev, endTimeMode: "custom", customEndTime: `${h}:${m}` };
                    });
                  }}
                  className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg border transition ${
                    newAgent.endTimeMode === "custom"
                      ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                      : isDark
                        ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  Registrar término
                </button>
              </div>
              {newAgent.endTimeMode === "custom" && (
                <div className="flex items-center gap-1.5 pt-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-500" />
                  <input
                    type="time"
                    value={newAgent.customEndTime}
                    onChange={(e) => setNewAgent((prev: any) => ({ ...prev, customEndTime: e.target.value }))}
                    className={`px-2 py-1 text-xs rounded-md border tabular-nums outline-none ${
                      isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-slate-800"
                    }`}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action launcher button */}
          <button
              onClick={handleStartInhalationAgent}
              disabled={inhalationAgents.some(ia => ia.agent === newAgent.agent)}
              className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold py-3 rounded-lg transition shadow-xs flex items-center justify-center gap-1.5 mt-2"
            >
              <Plus className="w-4 h-4" />
              {inhalationAgents.some(ia => ia.agent === newAgent.agent) ? "Gás/Agente já lançado" : `Lançar na Ficha: ${newAgent.agent}`}
            </button>
        </div>
      )}
      
      {/* Active and Recorded Agents/Gases List */}
      {displayedAgents.length > 0 ? (
        <div className={`grid grid-cols-1 gap-4 ${!isExpanded ? 'pt-4 border-t border-zinc-200 dark:border-zinc-800' : ''}`}>
          {displayedAgents.map((ia) => {
            const active = !ia.endTime;
            const formattedStart = new Date(ia.startTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
            const formattedEnd = ia.endTime ? new Date(ia.endTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : null;
            const isO2 = ia.agent === "Oxigênio (O₂)";
            const isAir = ia.agent === "Ar Comprimido";
            const isGas = isO2 || isAir;
            const isVolatile = !isGas && ia.agent !== "Óxido Nitroso";
            
            const durationMs = ia.endTime 
              ? new Date(ia.endTime).getTime() - new Date(ia.startTime).getTime() 
              : currentTimeMs - new Date(ia.startTime).getTime();
              
            const consumption = getVolatileConsumption(ia.agent, ia.inspiredConc, ia.flowO2, durationMs);

            return (
              <div key={ia.id} className={`p-4 rounded-lg border transition flex flex-col space-y-4 relative overflow-hidden ${
                active 
                  ? isDark ? "bg-teal-950/20 border-teal-900/50" : "bg-teal-50/50 border-teal-200" 
                  : isDark ? "bg-zinc-900/30 border-zinc-800 text-zinc-400" : "bg-slate-50 border-slate-200 text-slate-600"
              }`}>
                {active && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 animate-pulse opacity-50"></div>
                )}
                
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      isGas 
                        ? isDark ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-600"
                        : isDark ? "bg-teal-900/30 text-teal-400" : "bg-teal-100 text-teal-600"
                    }`}>
                      <Wind className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className={`font-bold text-sm ${isDark ? "text-zinc-100" : "text-slate-800"}`}>
                          {ia.agent}
                        </h4>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                          active 
                            ? isDark ? "bg-emerald-950 text-emerald-300 border border-emerald-900/40" : "bg-emerald-100 text-emerald-800" 
                            : isDark ? "bg-zinc-800 text-zinc-500" : "bg-slate-200 text-slate-600"
                        }`}>
                          {active ? "Ativo" : "Finalizado"}
                        </span>
                      </div>
                      
                      <div className="flex flex-col gap-1 mt-1">
                        <div className="text-xs tabular-nums text-slate-400 flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          <span>{formattedStart} {formattedEnd ? `— ${formattedEnd}` : "(em andamento)"}</span>
                          <button 
                            onClick={() => {
                              setEditingTimeId(ia.id);
                              setEditStartTime(formattedStart);
                              setEditEndTime(formattedEnd || "");
                            }}
                            className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition text-indigo-500"
                            title="Editar Horários"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                        {editingTimeId === ia.id && (
                          <div className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-1 p-1.5 rounded ${isDark ? "bg-zinc-900 border border-zinc-800" : "bg-white border border-slate-200"} text-xs`}>
                            <div className="flex items-center gap-1">
                              <span>Início:</span>
                              <input 
                                type="time" 
                                value={editStartTime}
                                onChange={e => setEditStartTime(e.target.value)}
                                className={`w-20 px-1 py-0.5 rounded border tabular-nums ${isDark ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-slate-300 text-slate-800"}`}
                              />
                            </div>
                            {formattedEnd && (
                              <>
                                <div className="flex items-center gap-1">
                                  <span>Fim:</span>
                                  <input 
                                    type="time" 
                                    value={editEndTime}
                                    onChange={e => setEditEndTime(e.target.value)}
                                    className={`w-20 px-1 py-0.5 rounded border tabular-nums ${isDark ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-slate-300 text-slate-800"}`}
                                  />
                                </div>
                              </>
                            )}
                            <button 
                              onClick={() => {
                                const combine = (baseIso: string, newTime: string) => {
                                  const date = new Date(baseIso);
                                  const [hh, mm] = newTime.split(":");
                                  date.setHours(parseInt(hh, 10));
                                  date.setMinutes(parseInt(mm, 10));
                                  date.setSeconds(0);
                                  return date.toISOString();
                                };
                                const updates: any = {};
                                if (editStartTime && editStartTime !== formattedStart) {
                                  updates.startTime = combine(ia.startTime, editStartTime);
                                }
                                if (ia.endTime && editEndTime && editEndTime !== formattedEnd) {
                                  updates.endTime = combine(ia.endTime, editEndTime);
                                }
                                if (Object.keys(updates).length > 0) {
                                  handleUpdateAgent(ia.id, updates);
                                }
                                setEditingTimeId(null);
                              }}
                              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold flex-shrink-0"
                            >
                              OK
                            </button>
                            <button onClick={() => setEditingTimeId(null)} className="p-0.5">
                              <X className="w-3.5 h-3.5 text-zinc-400 hover:text-zinc-500" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Remove button */}
                  <button
                    onClick={() => handleRemoveInhalationAgent(ia.id)}
                    className="p-1.5 rounded hover:bg-rose-500/10 hover:text-rose-500 transition text-slate-400"
                    title="Remover Registro"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-3">
                  {/* Concentration Editor */}
                  {!isGas && (
                    <div className={`flex-1 min-w-[140px] p-3 rounded-lg border ${isDark ? "bg-zinc-900/50 border-zinc-800/80" : "bg-white border-slate-200"}`}>
                      <div className="text-xs font-bold text-slate-400 uppercase mb-2">Concentração (%)</div>
                      <div className="flex items-center gap-2">
                        {active && (
                          <button 
                            onClick={() => handleUpdateAgent(ia.id, { inspiredConc: Math.max(0, (ia.inspiredConc || 0) - 0.5), flowO2: ia.flowO2 || 0 })}
                            className={`p-1 rounded ${isDark ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className={`tabular-nums font-bold ${isDark ? "text-teal-300" : "text-teal-700"}`}>
                          {(ia.inspiredConc || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%
                        </span>
                        {active && (
                          <button 
                            onClick={() => handleUpdateAgent(ia.id, { inspiredConc: (ia.inspiredConc || 0) + 0.5, flowO2: ia.flowO2 || 0 })}
                            className={`p-1 rounded ${isDark ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Flow Editor */}
                  <div className={`flex-1 min-w-[140px] p-3 rounded-lg border ${isDark ? "bg-zinc-900/50 border-zinc-800/80" : "bg-white border-slate-200"}`}>
                    <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                      FGF (L/min)
                    </div>
                    <div className="flex items-center gap-2">
                      {active && (
                        <button 
                          onClick={() => handleUpdateAgent(ia.id, { inspiredConc: ia.inspiredConc || 0, flowO2: Math.max(0, (ia.flowO2 || 0) - 0.5) })}
                          className={`p-1 rounded ${isDark ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span className={`tabular-nums font-bold ${isDark ? "text-blue-400" : "text-blue-600"}`}>
                        {(ia.flowO2 || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1 })} L/min
                      </span>
                      {active && (
                        <button 
                          onClick={() => handleUpdateAgent(ia.id, { inspiredConc: ia.inspiredConc || 0, flowO2: (ia.flowO2 || 0) + 0.5 })}
                          className={`p-1 rounded ${isDark ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dion Consumption */}
                  {isVolatile && consumption && (
                    <div className={`flex-1 min-w-[140px] p-3 rounded-lg border flex flex-col justify-center ${isDark ? "bg-indigo-950/20 border-indigo-900/40" : "bg-indigo-50 border-indigo-100"}`}>
                      <div className="text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                        <Beaker className="w-3 h-3" /> Consumo (Dion)
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`font-bold text-sm ${isDark ? "text-indigo-300" : "text-indigo-700"}`}>
                          {consumption.totalMl} ml
                        </span>
                        <span className={`text-xs tabular-nums ${isDark ? "text-indigo-400/60" : "text-indigo-500/60"}`}>
                          ({consumption.mlPerHour} ml/h)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {active && (
                  <div className={`flex items-center justify-end gap-2 mt-2 pt-3 border-t ${isDark ? "border-zinc-800/80" : "border-slate-100"}`}>
                    <button
                      onClick={() => handleStopInhalationAgent(ia.id)}
                      className={`px-4 py-2 rounded-lg transition font-bold text-xs flex items-center justify-center gap-1.5 ${
                        isDark ? "bg-rose-950/45 hover:bg-rose-900/60 text-rose-300" : "bg-rose-100 hover:bg-rose-200 text-rose-800"
                      }`}
                      title="Finalizar fluxo"
                    >
                      <Square className="w-3.5 h-3.5" />
                      Finalizar Lançamento / Desligar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : isExpanded ? (
        <p className={`text-center text-xs py-4 font-medium ${isDark ? "text-zinc-500" : "text-slate-400"}`}>Nenhum anestésico inalatório ou fluxo de gases ativo.</p>
      ) : null}
    </div>
  );
}

