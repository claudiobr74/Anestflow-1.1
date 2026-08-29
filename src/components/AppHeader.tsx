import React from "react";
import {
  Printer,
  RotateCcw,
  ShieldCheck,
  FileText,
  Sun,
  Moon,
  LogOut,
  Database,
  Users,
  BrainCircuit,
  Settings,
  MoreHorizontal
} from "lucide-react";
import AnestFlowLogo from "./AnestFlowLogo";
import { VoiceCommandButton } from "./VoiceCommandButton";
import SyncStatusBadge from "./SyncStatusBadge";
import { anesthesiaProgressLabel, isAnesthesiaInProgress } from "../lib/procedureStatus";
import type { AnesthesiaDocument } from "../types";
import type { SessionUser } from "../lib/sessionUser";

export function getElapsedAnesthesiaString(ficha: AnesthesiaDocument, now: Date): string {
  if (!ficha.timers.startAnesthesia) return "Não iniciada";
  const start = new Date(ficha.timers.startAnesthesia).getTime();
  const end = ficha.timers.endAnesthesia ? new Date(ficha.timers.endAnesthesia).getTime() : now.getTime();
  const diffMs = end - start;
  if (diffMs < 0) return "00:00";
  const diffMins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

type AppHeaderProps = {
  ficha: AnesthesiaDocument;
  user: SessionUser;
  now: Date;
  isDark: boolean;
  canEdit: boolean;
  aiSupervisorActive: boolean;
  overflowMenuOpen: boolean;
  setOverflowMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  overflowMenuRef: React.RefObject<HTMLDivElement | null>;
  syncEngine: {
    status: any;
    statusText: string;
    isOnline: boolean;
    pendingCount: number;
    lastSavedAt: any;
    errorMessage?: string | null;
    retrySyncNow: () => void;
  };
  startAiSupervisor: (taskName: string, onTimeout: () => void) => void;
  stopAiSupervisor: (reason?: string) => void;
  onVoiceProcessed: (payload: { transcription: string; identifiedActions: any }) => void;
  onOpenPdf: () => void;
  onOpenShare: () => void;
  onOpenArchive: () => void;
  onReloadExample: () => void;
  onResetBlank: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
};

export default function AppHeader({
  ficha,
  now,
  isDark,
  canEdit,
  aiSupervisorActive,
  overflowMenuOpen,
  setOverflowMenuOpen,
  overflowMenuRef,
  syncEngine,
  startAiSupervisor,
  stopAiSupervisor,
  onVoiceProcessed,
  onOpenPdf,
  onOpenShare,
  onOpenArchive,
  onReloadExample,
  onResetBlank,
  onOpenSettings,
  onToggleTheme,
  onLogout
}: AppHeaderProps) {
  return (
    <header className={`relative shrink-0 transition-all duration-300 border-b z-30 backdrop-blur-md bg-white/80 dark:bg-zinc-950/80 ${
      isDark
        ? "bg-zinc-950/90 border-zinc-800 text-zinc-100"
        : "bg-white/95 backdrop-blur-md border-slate-200 text-slate-900"
    }`}>
      <div className="relative max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        <AnestFlowLogo height={28} className="shrink-0 hidden lg:block mr-2" />
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-zinc-500 tracking-wide">PACIENTE</span>
            {ficha.status === "Signed" ? (
              <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Assinado
              </span>
            ) : ficha.status === "InProgress" ? (
              <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                Em andamento
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                Rascunho
              </span>
            )}
            {aiSupervisorActive && (
              <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 flex items-center gap-1 animate-pulse">
                <BrainCircuit className="w-3 h-3" /> IA
              </span>
            )}
          </div>
          <h1 className="text-base font-semibold truncate">
            {ficha.patient?.fullName || "Sem Identificação"}
          </h1>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 truncate">
            <span>{ficha.patient?.age ? `${ficha.patient?.age}a` : "—"}</span>
            <span>•</span>
            <span>{ficha.patient?.weight ? `${ficha.patient?.weight}kg` : "—"}</span>
            <span>•</span>
            <span className="truncate">{ficha.patient?.hospital || "—"}</span>
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0">
          <div className="text-lg font-semibold tabular-nums leading-none mb-1">
            {getElapsedAnesthesiaString(ficha, now)}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <div className={`w-2 h-2 rounded-full ${isAnesthesiaInProgress(ficha.timers) ? "bg-emerald-500 animate-pulse" : "bg-zinc-300 dark:bg-zinc-600"}`}></div>
            <span className="text-zinc-600 dark:text-zinc-400">
              {anesthesiaProgressLabel(ficha.timers)}
            </span>
          </div>
        </div>

        <div className="w-full flex items-center justify-between sm:w-auto sm:justify-end gap-3 mt-2 sm:mt-0">
          <div className="flex items-center">
            <SyncStatusBadge
              status={syncEngine.status}
              statusText={syncEngine.statusText}
              isOnline={syncEngine.isOnline}
              pendingCount={syncEngine.pendingCount}
              lastSavedAt={syncEngine.lastSavedAt}
              errorMessage={syncEngine.errorMessage}
              onRetry={syncEngine.retrySyncNow}
              isDark={isDark}
              compact
            />
          </div>

          <div className="flex items-center gap-1.5">
            <VoiceCommandButton
              isDark={isDark}
              disabled={!canEdit}
              startAiSupervisor={startAiSupervisor}
              stopAiSupervisor={stopAiSupervisor}
              onCommandProcessed={({ transcription, identifiedActions }) => {
                onVoiceProcessed({ transcription, identifiedActions });
              }}
            />
            <button
              onClick={onOpenPdf}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </button>
            <button
              onClick={onOpenShare}
              disabled={!ficha.userId}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Equipe</span>
            </button>

            <div className="relative" ref={overflowMenuRef}>
              <button
                type="button"
                aria-label="Mais opções"
                aria-haspopup="menu"
                aria-expanded={overflowMenuOpen}
                onClick={() => setOverflowMenuOpen((open) => !open)}
                className="p-2.5 min-h-11 min-w-11 rounded-lg border border-transparent hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center"
              >
                <MoreHorizontal className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
              </button>
              {overflowMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-slate-200 dark:border-zinc-800 z-[80] overflow-hidden"
                >
                  <div className="py-1 flex flex-col text-sm text-zinc-700 dark:text-zinc-300">
                    <button type="button" role="menuitem" onClick={() => { setOverflowMenuOpen(false); onOpenArchive(); }} className="px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2">
                      <Database className="w-4 h-4" /> Arquivo
                    </button>
                    <button type="button" role="menuitem" disabled={!canEdit} onClick={() => { if (!canEdit) return; setOverflowMenuOpen(false); onReloadExample(); }} className="px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2 disabled:opacity-50">
                      <FileText className="w-4 h-4" /> Modelo Exemplo
                    </button>
                    <button type="button" role="menuitem" disabled={!canEdit} onClick={() => { if (!canEdit) return; setOverflowMenuOpen(false); onResetBlank(); }} className="px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2 text-rose-600 dark:text-rose-400 disabled:opacity-50">
                      <RotateCcw className="w-4 h-4" /> Limpar Tudo
                    </button>
                    <div className="h-px bg-slate-200 dark:bg-zinc-800 my-1"></div>
                    <button type="button" role="menuitem" onClick={() => { setOverflowMenuOpen(false); onOpenSettings(); }} className="px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2">
                      <Settings className="w-4 h-4" /> Configurações
                    </button>
                    <button type="button" role="menuitem" onClick={() => { setOverflowMenuOpen(false); onToggleTheme(); }} className="px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2">
                      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />} {isDark ? "Modo Claro" : "Modo Escuro"}
                    </button>
                    <button type="button" role="menuitem" onClick={() => { setOverflowMenuOpen(false); onLogout(); }} className="px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2 text-rose-600 dark:text-rose-400">
                      <LogOut className="w-4 h-4" /> Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
