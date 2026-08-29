import React from "react";
import { FileText, RotateCcw } from "lucide-react";
import PdfPreviewModal from "./PdfPreviewModal";
import ProceduresManagerModal from "./ProceduresManagerModal";
import { VoiceCommandConfirmModal } from "./VoiceCommandConfirmModal";
import ShareModal from "./ShareModal";
import SettingsModal, { AppSettings } from "./SettingsModal";
import TransferResponsibilityModal from "./TransferResponsibilityModal";
import AssumeResponsibilityModal from "./AssumeResponsibilityModal";
import WorkstationLockScreen from "./WorkstationLockScreen";
import type { AnesthesiaDocument, AnesthesiaDocumentPatch } from "../types";
import type { SessionUser } from "../lib/sessionUser";
import { summarizeVoiceActions, type SanitizedVoiceActions } from "../lib/voiceCommand";

type AppModalHostProps = {
  ficha: AnesthesiaDocument;
  user: SessionUser;
  isDark: boolean;
  canEdit: boolean;
  showPrintModal: boolean;
  onClosePrint: () => void;
  showProceduresModal: boolean;
  onCloseProcedures: () => void;
  onLoadDocument: (doc: AnesthesiaDocument) => void;
  pendingVoice: { transcription: string; actions: SanitizedVoiceActions | null } | null;
  onDismissVoice: () => void;
  onConfirmVoice: () => void;
  showResetConfirm: boolean;
  onCancelReset: () => void;
  onConfirmReset: () => void;
  showReloadConfirm: boolean;
  onCancelReload: () => void;
  onConfirmReload: () => void;
  showShareModal: boolean;
  onCloseShare: () => void;
  onUpdateDocument: (updates: AnesthesiaDocumentPatch) => void;
  autosavePaused: boolean;
  onToggleAutosavePause: () => void;
  isOnline: boolean;
  onOpenTransferModal?: () => void;
  showTransferModal: boolean;
  onCloseTransfer: () => void;
  onConfirmTransfer: (data: any) => Promise<boolean>;
  showAssumeModal: boolean;
  onCloseAssume: () => void;
  onConfirmAssume: (reason: string) => Promise<void>;
  isClaiming: boolean;
  showSettingsModal: boolean;
  onCloseSettings: () => void;
  appSettings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  toggleTheme: () => void;
  workstationLocked: boolean;
  lockReason: "idle" | "signature";
  onUnlocked: () => void;
  onLogout: () => void;
};

export default function AppModalHost({
  ficha,
  user,
  isDark,
  canEdit,
  showPrintModal,
  onClosePrint,
  showProceduresModal,
  onCloseProcedures,
  onLoadDocument,
  pendingVoice,
  onDismissVoice,
  onConfirmVoice,
  showResetConfirm,
  onCancelReset,
  onConfirmReset,
  showReloadConfirm,
  onCancelReload,
  onConfirmReload,
  showShareModal,
  onCloseShare,
  onUpdateDocument,
  autosavePaused,
  onToggleAutosavePause,
  isOnline,
  onOpenTransferModal,
  showTransferModal,
  onCloseTransfer,
  onConfirmTransfer,
  showAssumeModal,
  onCloseAssume,
  onConfirmAssume,
  isClaiming,
  showSettingsModal,
  onCloseSettings,
  appSettings,
  onSaveSettings,
  toggleTheme,
  workstationLocked,
  lockReason,
  onUnlocked,
  onLogout
}: AppModalHostProps) {
  return (
    <>
      <PdfPreviewModal
        isOpen={showPrintModal}
        onClose={onClosePrint}
        ficha={ficha}
        isDark={isDark}
      />

      <ProceduresManagerModal
        isOpen={showProceduresModal}
        onClose={onCloseProcedures}
        currentDocument={ficha}
        onLoadDocument={onLoadDocument}
        userId={user?.uid || ""}
        isDark={isDark}
      />

      <VoiceCommandConfirmModal
        isOpen={Boolean(pendingVoice)}
        transcription={pendingVoice?.transcription || ""}
        summaries={pendingVoice?.actions ? summarizeVoiceActions(pendingVoice.actions) : []}
        canApply={Boolean(pendingVoice?.actions) && canEdit}
        isDark={isDark}
        onDismiss={onDismissVoice}
        onConfirm={onConfirmVoice}
      />

      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className={`w-full max-w-sm rounded-xl p-5 shadow-lg border text-center transition-all ${
            isDark ? "bg-[#1C1C1E] border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900"
          }`}>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 mb-4">
              <RotateCcw className="h-6 w-6 animate-spin" />
            </div>
            <h3 className="text-lg font-bold">Iniciar Novo Prontuário?</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
              Deseja realmente apagar todas as anotações atuais e iniciar uma ficha em branco? Esta ação não pode ser desfeita.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={onCancelReset}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold border transition ${
                  isDark
                    ? "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                    : "bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={onConfirmReset}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold rounded-xl transition shadow-xs"
              >
                Apagar e Limpar
              </button>
            </div>
          </div>
        </div>
      )}

      {showReloadConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className={`w-full max-w-sm rounded-xl p-5 shadow-lg border text-center transition-all ${
            isDark ? "bg-[#1C1C1E] border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900"
          }`}>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mb-4">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold">Carregar Exemplo Clínico?</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
              Isso irá substituir o registro atual pelos dados demonstrativos completos (sinais vitais, infusões, etc). Deseja prosseguir?
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={onCancelReload}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold border transition ${
                  isDark
                    ? "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                    : "bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={onConfirmReload}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition shadow-xs"
              >
                Carregar Exemplo
              </button>
            </div>
          </div>
        </div>
      )}

      {showShareModal && ficha.userId && (
        <ShareModal
          ficha={ficha}
          isDark={isDark}
          onClose={onCloseShare}
          onUpdateDocument={onUpdateDocument}
          autosavePaused={autosavePaused}
          onToggleAutosavePause={onToggleAutosavePause}
          isOnline={isOnline}
          onOpenTransferModal={onOpenTransferModal}
        />
      )}

      {showTransferModal && (
        <TransferResponsibilityModal
          ficha={ficha}
          isDark={isDark}
          onClose={onCloseTransfer}
          onConfirmTransfer={onConfirmTransfer}
        />
      )}

      {showAssumeModal && (
        <AssumeResponsibilityModal
          isDark={isDark}
          leadName={ficha.team?.anesthesiologistLead || "outro anestesiologista"}
          isSubmitting={isClaiming}
          onClose={onCloseAssume}
          onConfirm={onConfirmAssume}
        />
      )}

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={onCloseSettings}
        settings={appSettings}
        onSaveSettings={onSaveSettings}
        isDark={isDark}
        toggleTheme={toggleTheme}
        userEmail={user?.email || undefined}
      />

      {workstationLocked && (
        <WorkstationLockScreen
          email={user.email}
          isDark={isDark}
          reason={lockReason}
          onUnlocked={onUnlocked}
          onLogout={onLogout}
        />
      )}
    </>
  );
}
