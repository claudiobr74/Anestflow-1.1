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

function StatusBadge({ ficha, isDark }: { ficha: AnesthesiaDocument; isDark: boolean }) {
  if (ficha.status === "Signed") {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-semibold ${
        isDark ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 text-emerald-800"
      }`}>
        <ShieldCheck className="h-3 w-3" /> Assinado
      </span>
    );
  }
  if (ficha.status === "InProgress") {
    return (
      <span className={`rounded-full px-2 py-[3px] text-[11px] font-semibold ${
        isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-800"
      }`}>
        Em andamento
      </span>
    );
  }
  return (
    <span className={`rounded-full px-2 py-[3px] text-[11px] font-semibold ${
      isDark ? "bg-amber-500/20 text-amber-300" : "bg-[#FEF3C7] text-[#D97706]"
    }`}>
      Rascunho
    </span>
  );
}

function PatientIdentity({ ficha, isDark }: { ficha: AnesthesiaDocument; isDark: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 xl:gap-2">
      <div className="flex items-center gap-2 xl:gap-2.5">
        <span className={`text-[11px] font-bold uppercase tracking-[1px] ${
          isDark ? "text-zinc-500" : "text-[#9CA3AF]"
        }`}>
          Paciente
        </span>
        <StatusBadge ficha={ficha} isDark={isDark} />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className={`truncate text-2xl font-bold leading-tight xl:text-[28px] ${
          isDark ? "text-zinc-50" : "text-[#111827]"
        }`}>
          {ficha.patient?.fullName || "Sem Identificação"}
        </h1>
        <p className={`truncate text-[13px] font-normal xl:text-sm ${
          isDark ? "text-zinc-400" : "text-[#4B5563]"
        }`}>
          {ficha.patient?.hospital || "—"}
        </p>
      </div>
    </div>
  );
}

function actionBtnClass(isDark: boolean): string {
  return `inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border p-1.5 text-[13px] font-semibold transition disabled:opacity-50 md:gap-1.5 md:px-3 md:py-2 xl:gap-2.5 xl:px-4 xl:py-2.5 ${
    isDark
      ? "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
      : "border-[#E5E7EB] bg-[#F9FAFB] text-[#4B5563] hover:bg-white"
  }`;
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

  const border = isDark ? "border-zinc-800" : "border-[#E5E7EB]";
  const bg = isDark ? "bg-zinc-950" : "bg-white";
  const menuHover = isDark ? "hover:bg-zinc-800" : "hover:bg-[#F9FAFB]";
  const menuText = isDark ? "text-zinc-300" : "text-[#4B5563]";

  return (
    <header className={`relative z-30 shrink-0 ${bg} ${isDark ? "text-zinc-100" : "text-[#111827]"}`}>
      <div className={`flex h-14 items-center justify-between border-b px-4 md:px-6 xl:h-16 xl:px-10 ${border} ${bg}`}>
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
          <span className={`min-w-0 flex-1 truncate text-right text-xs font-medium md:text-sm ${
            isDark ? "text-zinc-400" : "text-[#4B5563]"
          }`}>
            {user.name} (Anestesiologista)
          </span>
          <div
            aria-hidden
            className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold xl:flex ${
              isDark ? "bg-violet-500/20 text-violet-300" : "bg-[#F3E8FF] text-[#7C3AED]"
            }`}
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
                className={`absolute right-0 top-full z-[80] mt-3 w-48 overflow-hidden rounded-xl border shadow-lg ${
                  isDark ? "border-zinc-800 bg-zinc-900" : "border-[#E5E7EB] bg-white"
                }`}
              >
                <div className={`flex flex-col py-1 text-sm ${menuText}`}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOverflowMenuOpen(false);
                      onOpenArchive();
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 text-left ${menuHover}`}
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
                    className={`flex items-center gap-2 px-4 py-2.5 text-left disabled:opacity-50 ${menuHover}`}
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
                    className={`flex items-center gap-2 px-4 py-2.5 text-left text-rose-600 disabled:opacity-50 ${menuHover} ${
                      isDark ? "text-rose-400" : ""
                    }`}
                  >
                    <RotateCcw className="h-4 w-4" /> Limpar Tudo
                  </button>
                  <div className={`my-1 h-px ${isDark ? "bg-zinc-800" : "bg-[#E5E7EB]"}`} />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOverflowMenuOpen(false);
                      onOpenSettings();
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 text-left ${menuHover}`}
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
                    className={`flex items-center gap-2 px-4 py-2.5 text-left ${menuHover}`}
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
                    className={`flex items-center gap-2 px-4 py-2.5 text-left text-rose-600 ${menuHover} ${
                      isDark ? "text-rose-400" : ""
                    }`}
                  >
                    <LogOut className="h-4 w-4" /> Sair
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`flex flex-col xl:flex-row xl:items-center xl:justify-between xl:gap-6 xl:border-b xl:px-10 xl:py-6 ${bg} ${isDark ? "xl:border-zinc-800" : "xl:border-[#E5E7EB]"}`}>
        <div className={`px-4 py-4 md:border-b md:px-6 md:py-4 xl:border-0 xl:p-0 ${isDark ? "md:border-zinc-800" : "md:border-[#E5E7EB]"}`}>
          <PatientIdentity ficha={ficha} isDark={isDark} />
        </div>

        <div className={`flex items-center justify-between gap-1.5 border-b px-3 py-3 md:gap-4 md:px-6 xl:border-0 xl:p-0 ${border}`}>
          <div className="flex min-w-0 items-center gap-2 md:gap-4">
            <span
              title={chipTitle}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 md:px-3 md:py-1.5 ${
                isDark ? "border-zinc-700 bg-zinc-900" : "border-[#E5E7EB] bg-[#F9FAFB]"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  inProgress ? "bg-[#10B981] animate-pulse" : "bg-[#9CA3AF]"
                }`}
              />
              <span className={`truncate text-xs font-medium ${isDark ? "text-zinc-300" : "text-[#4B5563]"}`}>
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
              <span className={`hidden items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-semibold animate-pulse sm:inline-flex ${
                isDark ? "bg-indigo-500/20 text-indigo-300" : "bg-indigo-100 text-indigo-700"
              }`}>
                <BrainCircuit className="h-3 w-3" /> IA
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 md:gap-2 xl:gap-6">
            <div aria-hidden className={`hidden h-8 w-px xl:block ${isDark ? "bg-zinc-700" : "bg-[#E5E7EB]"}`} />
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
              <button type="button" onClick={onOpenPdf} className={actionBtnClass(isDark)}>
                <FileText className="h-4 w-4" />
                <span className="xl:hidden">PDF</span>
                <span className="hidden xl:inline">Visualizar PDF</span>
              </button>
              <button
                type="button"
                onClick={onOpenShare}
                disabled={!ficha.userId}
                className={actionBtnClass(isDark)}
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
