import React from "react";
import {
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
  MoreHorizontal,
  ChevronLeft
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

export function headerAnesthesiaChipLabel(ficha: AnesthesiaDocument, now: Date): string {
  if (isAnesthesiaInProgress(ficha.timers)) {
    const elapsed = getElapsedAnesthesiaString(ficha, now);
    return elapsed === "Não iniciada" ? "Anestesia em andamento" : elapsed;
  }
  return anesthesiaProgressLabel(ficha.timers);
}

function userInitials(name: string): string {
  const cleaned = name.replace(/^\s*(dra?\.?)\s+/i, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AF";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function StatusBadge({ ficha }: { ficha: AnesthesiaDocument }) {
  if (ficha.status === "Signed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-[3px] text-[11px] font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
        <ShieldCheck className="h-3 w-3" /> Assinado
      </span>
    );
  }
  if (ficha.status === "InProgress") {
    return (
      <span className="rounded-full bg-blue-100 px-2 py-[3px] text-[11px] font-semibold text-blue-800 dark:bg-blue-500/20 dark:text-blue-300">
        Em andamento
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[#FEF3C7] px-2 py-[3px] text-[11px] font-semibold text-[#D97706] dark:bg-amber-500/20 dark:text-amber-300">
      Rascunho
    </span>
  );
}

function PatientIdentity({ ficha }: { ficha: AnesthesiaDocument }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 xl:gap-2">
      <div className="flex items-center gap-2 xl:gap-2.5">
        <span className="text-[11px] font-bold uppercase tracking-[1px] text-[#9CA3AF] dark:text-zinc-500">
          Paciente
        </span>
        <StatusBadge ficha={ficha} />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="truncate text-2xl font-bold leading-tight text-[#111827] dark:text-zinc-50 xl:text-[28px]">
          {ficha.patient?.fullName || "Sem Identificação"}
        </h1>
        <p className="truncate text-[13px] font-normal text-[#4B5563] dark:text-zinc-400 xl:text-sm">
          {ficha.patient?.hospital || "—"}
        </p>
      </div>
    </div>
  );
}

const actionBtnClass =
  "inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-1.5 text-[13px] font-semibold text-[#4B5563] transition hover:bg-white disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 md:gap-1.5 md:px-3 md:py-2 xl:gap-2.5 xl:px-4 xl:py-2.5";

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
  user,
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
  const inProgress = isAnesthesiaInProgress(ficha.timers);
  const chipLabel = headerAnesthesiaChipLabel(ficha, now);
  const chipTitle = anesthesiaProgressLabel(ficha.timers);

  return (
    <header
      className={`relative z-30 shrink-0 bg-white dark:bg-zinc-950 ${
        isDark ? "text-zinc-100" : "text-[#111827]"
      }`}
    >
      <div className="flex h-14 items-center justify-between border-b border-[#E5E7EB] bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950 md:px-6 xl:h-16 xl:px-10">
        <div className="flex min-w-0 items-center gap-3 xl:gap-4">
          <button
            type="button"
            onClick={onOpenArchive}
            aria-label="Voltar ao arquivo de fichas"
            className="inline-flex shrink-0 items-center justify-center p-2 -m-2 text-[#7C3AED] transition hover:opacity-80"
          >
            <ChevronLeft className="h-5 w-5 xl:h-[22px] xl:w-[22px]" strokeWidth={2.25} />
          </button>
          <AnestFlowLogo
            className="shrink-0"
            imgClassName="h-[26px] w-[87px] md:h-7 md:w-24 xl:h-8 xl:w-[110px]"
          />
        </div>

        <div className="flex min-w-0 items-center gap-3 xl:gap-4">
          <span className="min-w-0 flex-1 truncate text-right text-xs font-medium text-[#4B5563] dark:text-zinc-400 md:text-sm">
            {user.name} (Anestesiologista)
          </span>
          <div
            aria-hidden
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F3E8FF] text-xs font-semibold text-[#7C3AED] xl:flex dark:bg-violet-500/20 dark:text-violet-300"
          >
            {userInitials(user.name)}
          </div>
          <div className="relative shrink-0" ref={overflowMenuRef}>
            <button
              type="button"
              aria-label="Mais opções"
              aria-haspopup="menu"
              aria-expanded={overflowMenuOpen}
              onClick={() => setOverflowMenuOpen((open) => !open)}
              className="inline-flex items-center justify-center p-2 -m-2 text-[#7C3AED] transition hover:opacity-80"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {overflowMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-[80] mt-3 w-48 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex flex-col py-1 text-sm text-[#4B5563] dark:text-zinc-300">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOverflowMenuOpen(false);
                      onOpenArchive();
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 text-left hover:bg-[#F9FAFB] dark:hover:bg-zinc-800"
                  >
                    <Database className="h-4 w-4" /> Arquivo
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!canEdit}
                    onClick={() => {
                      if (!canEdit) return;
                      setOverflowMenuOpen(false);
                      onReloadExample();
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 text-left hover:bg-[#F9FAFB] disabled:opacity-50 dark:hover:bg-zinc-800"
                  >
                    <FileText className="h-4 w-4" /> Modelo Exemplo
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!canEdit}
                    onClick={() => {
                      if (!canEdit) return;
                      setOverflowMenuOpen(false);
                      onResetBlank();
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 text-left text-rose-600 hover:bg-[#F9FAFB] disabled:opacity-50 dark:text-rose-400 dark:hover:bg-zinc-800"
                  >
                    <RotateCcw className="h-4 w-4" /> Limpar Tudo
                  </button>
                  <div className="my-1 h-px bg-[#E5E7EB] dark:bg-zinc-800" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOverflowMenuOpen(false);
                      onOpenSettings();
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 text-left hover:bg-[#F9FAFB] dark:hover:bg-zinc-800"
                  >
                    <Settings className="h-4 w-4" /> Configurações
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOverflowMenuOpen(false);
                      onToggleTheme();
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 text-left hover:bg-[#F9FAFB] dark:hover:bg-zinc-800"
                  >
                    {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{" "}
                    {isDark ? "Modo Claro" : "Modo Escuro"}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOverflowMenuOpen(false);
                      onLogout();
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 text-left text-rose-600 hover:bg-[#F9FAFB] dark:text-rose-400 dark:hover:bg-zinc-800"
                  >
                    <LogOut className="h-4 w-4" /> Sair
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col bg-white dark:bg-zinc-950 xl:flex-row xl:items-center xl:justify-between xl:gap-6 xl:border-b xl:border-[#E5E7EB] xl:px-10 xl:py-6 dark:xl:border-zinc-800">
        <div className="px-4 py-4 md:border-b md:border-[#E5E7EB] md:px-6 md:py-4 xl:border-0 xl:p-0 dark:md:border-zinc-800">
          <PatientIdentity ficha={ficha} />
        </div>

        <div className="flex items-center justify-between gap-1.5 border-b border-[#E5E7EB] px-3 py-3 dark:border-zinc-800 md:gap-4 md:px-6 xl:border-0 xl:p-0">
          <div className="flex min-w-0 items-center gap-2 md:gap-4">
            <span
              title={chipTitle}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900 md:px-3 md:py-1.5"
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  inProgress ? "bg-[#10B981] animate-pulse" : "bg-[#9CA3AF]"
                }`}
              />
              <span className="truncate text-xs font-medium text-[#4B5563] dark:text-zinc-300">
                {chipLabel}
              </span>
            </span>
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
              variant="plain"
            />
            {aiSupervisorActive && (
              <span className="hidden items-center gap-1 rounded-full bg-indigo-100 px-2 py-[3px] text-[11px] font-semibold text-indigo-700 animate-pulse sm:inline-flex dark:bg-indigo-500/20 dark:text-indigo-300">
                <BrainCircuit className="h-3 w-3" /> IA
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 md:gap-2 xl:gap-6">
            <div aria-hidden className="hidden h-8 w-px bg-[#E5E7EB] xl:block dark:bg-zinc-700" />
            <div className="flex items-center gap-1 md:gap-2 xl:gap-2.5">
              <VoiceCommandButton
                variant="header"
                isDark={isDark}
                disabled={!canEdit}
                startAiSupervisor={startAiSupervisor}
                stopAiSupervisor={stopAiSupervisor}
                onCommandProcessed={({ transcription, identifiedActions }) => {
                  onVoiceProcessed({ transcription, identifiedActions });
                }}
              />
              <button type="button" onClick={onOpenPdf} className={actionBtnClass}>
                <FileText className="h-4 w-4" />
                <span className="xl:hidden">PDF</span>
                <span className="hidden xl:inline">Visualizar PDF</span>
              </button>
              <button
                type="button"
                onClick={onOpenShare}
                disabled={!ficha.userId}
                className={actionBtnClass}
              >
                <Users className="h-4 w-4" />
                <span className="xl:hidden">Equipe</span>
                <span className="hidden xl:inline">Equipe Médica</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
