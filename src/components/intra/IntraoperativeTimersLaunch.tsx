import React from "react";
import { Clock, Square, Play, CheckCircle, Layers } from "lucide-react";
import { DraggablePanel } from "../DraggablePanel";
import { useIntraUi } from "./IntraoperativeUiContext";
import { getLocalTimeStringNow } from "../../utils/timezone";

export default function IntraoperativeTimersLaunch() {
  const {
    borderClass, cardClass, getTimeString, handleUpdateTimerValue, inputClass, isDark, setShowTemplatesModal, timers
  } = useIntraUi();

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
}
