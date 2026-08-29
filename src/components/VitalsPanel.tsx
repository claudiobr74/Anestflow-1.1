import React from "react";
import { Sliders, Bell, BellOff, AlertTriangle, Zap, Info, Clock, RefreshCw, CheckCircle } from "lucide-react";

interface VitalsPanelProps {
  isDark: boolean;
  isOverdue: boolean;
  selectedMinutes: number | null;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  loggingInterval: number;
  setLoggingInterval: (val: number) => void;
  isCustomInterval: boolean;
  setIsCustomInterval: (val: boolean) => void;
  customIntervalVal: string;
  setCustomIntervalVal: (val: string) => void;
  activeInterval: number;
  simulatedDelayMs: number;
  setSimulatedDelayMs: (val: number) => void;
  timers: any;
  timeString: string;
  percent: number;
  elapsedMins: number;
  activeField: string;
  setActiveField: (field: any) => void;
  activeVitalsInput: any;
  handleKeyBackspace: () => void;
  handleKeyPress: (key: string) => void;
  repeatLastVitals: () => void;
  handleRegisterVitals: () => void;
}

export default function VitalsPanel({
  isDark,
  isOverdue,
  selectedMinutes,
  soundEnabled,
  setSoundEnabled,
  loggingInterval,
  setLoggingInterval,
  isCustomInterval,
  setIsCustomInterval,
  customIntervalVal,
  setCustomIntervalVal,
  activeInterval,
  simulatedDelayMs,
  setSimulatedDelayMs,
  timers,
  timeString,
  percent,
  elapsedMins,
  activeField,
  setActiveField,
  activeVitalsInput,
  handleKeyBackspace,
  handleKeyPress,
  repeatLastVitals,
  handleRegisterVitals,
}: VitalsPanelProps) {
  return (
    <div className="space-y-4">
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
              type="button"
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
          type="button"
          onClick={repeatLastVitals}
          className={`py-2 px-3 transition font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 ${
            isDark ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300" : "bg-zinc-100 hover:bg-zinc-200 border border-zinc-250 text-zinc-600"
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Repetir Último
        </button>
        <button
          type="button"
          onClick={handleRegisterVitals}
          className="py-2 px-3 bg-indigo-600 hover:bg-indigo-500 transition font-bold text-xs text-white rounded-lg flex items-center justify-center gap-1 shadow-xs"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          Registrar Agora
        </button>
      </div>
    </div>
  );
}
