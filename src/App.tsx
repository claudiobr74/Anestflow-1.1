/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from "react";
import { AnesthesiaDocument } from "./types";
import PatientTab from "./components/PatientTab";
import PreEvaluationTab from "./components/PreEvaluationTab";
import IntraoperativeTab from "./components/IntraoperativeTab";
import RecoveryTab from "./components/RecoveryTab";
import ReviewTab from "./components/ReviewTab";
import LoginScreen from "./components/LoginScreen";
import { ShieldAlert, ShieldCheck, ArrowRightLeft } from "lucide-react";
import { AppSettings, DEFAULT_APP_SETTINGS } from "./components/SettingsModal";
import { PRESET_TEMPLATES } from "./components/AnesthesiaTemplatesModalData";
import {
  applyVoiceActionsToDocument,
  type SanitizedVoiceActions,
} from "./lib/voiceCommand";
import { finalizeVoiceParse } from "./lib/voiceParserSemantics";
import { useSyncEngine } from "./lib/useSyncEngine";
import { useSessionGuard } from "./lib/useSessionGuard";
import {
  beginSession,
  clearClinicalBrowserCache,
  clearSessionClock,
  clearSessionEndReason,
  persistSessionEndReason,
  type SessionViolation,
} from "./lib/sessionPolicy";
import {
  consumeOAuthReauthIfPresent,
  stripProviderOAuthTokensFromStorage,
} from "./lib/googleAuth";
import { purgeClinicalPhiFromLocalStorage } from "./lib/clinicalStorageKeys";
import {
  canEditDocument,
  isClinicalEditor,
  isCurrentResponsible,
} from "./lib/assertCanEdit";
import ResponsibilityBanner from "./components/ResponsibilityBanner";
import type { SessionUser } from "./lib/sessionUser";
import { useAiSupervisor } from "./lib/useAiSupervisor";
import { useClinicalDocument } from "./lib/useClinicalDocument";
import { useOverflowMenu } from "./lib/useOverflowMenu";
import { useResponsibilityActions } from "./lib/useResponsibilityActions";
import AppHeader from "./components/AppHeader";
import AppNav, { type AppTabId } from "./components/AppNav";
import AppModalHost from "./components/AppModalHost";

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(() => {
    consumeOAuthReauthIfPresent();
    const saved = localStorage.getItem("anesthesia_user");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.uid) return parsed;
      localStorage.removeItem("anesthesia_user");
    }
    return null;
  });

  const [pendingTemplateForReview, setPendingTemplateForReview] = useState<any>(null);
  const [pendingVoice, setPendingVoice] = useState<{
    transcription: string;
    actions: SanitizedVoiceActions | null;
    warnings?: string[];
    unparsedFragments?: string[];
    actionable?: boolean;
    missingEntities?: string[];
  } | null>(null);
  const [theme, setTheme] = useState<"light" | "dark" | "dark-clean">(() => {
    const saved = localStorage.getItem("anesthesia_theme");
    return (saved as "light" | "dark" | "dark-clean") || "light";
  });

  const [activeTab, setActiveTab] = useState<AppTabId>("patient");
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showProceduresModal, setShowProceduresModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showReloadConfirm, setShowReloadConfirm] = useState(false);
  const [workstationLocked, setWorkstationLocked] = useState(false);
  const [lockReason, setLockReason] = useState<"idle" | "signature">("idle");
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);

  const { overflowMenuOpen, setOverflowMenuOpen, overflowMenuRef } = useOverflowMenu();

  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem("anesthesia_app_settings");
    return saved ? { ...DEFAULT_APP_SETTINGS, ...JSON.parse(saved) } : DEFAULT_APP_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem("anesthesia_app_settings", JSON.stringify(appSettings));
  }, [appSettings]);

  const {
    ficha,
    setFicha,
    setFichaWithBroadcast,
    updatePatient,
    updateTeam,
    updatePreEvaluation,
    updateRecovery,
    updateDocumentDirectly,
    handleLoadWorklist,
    handleSaveWorklist,
    startBlankForUser,
    clearToBlankDocument,
    handleResetToBlankConfirm,
    handleReloadMockDataConfirm,
    handleCloseProcedure,
    loadCloudFicha
  } = useClinicalDocument({
    user,
    appSettings,
    requestSignatureLock: () => {
      setLockReason("signature");
      setWorkstationLocked(true);
    }
  });

  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(true);
  const [resendingEmail, setResendingEmail] = useState<boolean>(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    import("./lib/supabase").then(async ({ getSupabase, isSupabaseConfigured, ensureSupabaseConfig }) => {
      await ensureSupabaseConfig();
      if (!isSupabaseConfigured()) return;
      const supabase = getSupabase();
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        const supabaseUser = session?.user;
        if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !supabaseUser)) {
          clearClinicalBrowserCache();
          setUser(null);
          clearToBlankDocument();
          setIsEmailVerified(true);
          return;
        }
        if (supabaseUser) {
          stripProviderOAuthTokensFromStorage();
          setIsEmailVerified(Boolean(supabaseUser.email_confirmed_at));
          if (supabaseUser.email) {
            setUser((prev) => {
              if (!prev || prev.email) return prev;
              const next = { ...prev, email: supabaseUser.email };
              try {
                localStorage.setItem("anesthesia_user", JSON.stringify(next));
              } catch (e) {}
              return next;
            });
          }
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [clearToBlankDocument]);

  const handleResendVerificationEmail = async () => {
    setResendingEmail(true);
    try {
      const { getSupabase } = await import("./lib/supabase");
      const { data: userData } = await getSupabase().auth.getUser();
      const email = userData.user?.email;
      if (email) {
        const { error } = await getSupabase().auth.resend({ type: "signup", email });
        if (error) throw error;
        alert("E-mail de verificação reenviado com sucesso! Verifique sua caixa de entrada e pasta de spam.");
      }
    } catch (err: any) {
      alert("Erro ao reenviar e-mail de verificação: " + (err.message || err));
    } finally {
      setResendingEmail(false);
    }
  };

  const handleReloadAuthStatus = async () => {
    try {
      const { getSupabase } = await import("./lib/supabase");
      const { data, error } = await getSupabase().auth.refreshSession();
      if (error) throw error;
      const updatedStatus = Boolean(data.user?.email_confirmed_at);
      setIsEmailVerified(updatedStatus);
      if (updatedStatus) {
        alert("E-mail verificado com sucesso! Seu acesso a fichas clínicas foi ativado.");
      } else {
        alert("O e-mail ainda consta como não verificado. Verifique se clicou no link enviado para sua caixa de entrada.");
      }
    } catch (err: any) {
      console.error("Erro ao atualizar status de verificação:", err);
    }
  };

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRemoteUpdate = useCallback((remoteDoc: AnesthesiaDocument) => {
    setFicha(remoteDoc);
  }, [setFicha]);

  const syncEngine = useSyncEngine(ficha, user?.uid, handleRemoteUpdate);
  const { aiSupervisorActive, startAiSupervisor, stopAiSupervisor } = useAiSupervisor();

  const responsibility = useResponsibilityActions({
    ficha,
    setFicha,
    user,
    isOnline: syncEngine.isOnline
  });

  const handleLogin = (doctor: SessionUser) => {
    const isNewUser = !user || user.uid !== doctor.uid;
    setUser(doctor);
    localStorage.setItem("anesthesia_user", JSON.stringify(doctor));
    beginSession();
    if (isNewUser) {
      try {
        sessionStorage.clear();
      } catch (e) {}
      purgeClinicalPhiFromLocalStorage();
      startBlankForUser(doctor);
    }
  };

  const handleLogout = useCallback(async (policyReason?: SessionViolation) => {
    if (policyReason) persistSessionEndReason(policyReason);
    else clearSessionEndReason();
    clearSessionClock();
    clearClinicalBrowserCache();
    try {
      const { getSupabase } = await import("./lib/supabase");
      await getSupabase().auth.signOut();
    } catch (e) {
      console.error("Error signing out:", e);
    }
    setUser(null);
    clearToBlankDocument();
    setActiveTab("patient");
    setWorkstationLocked(false);
  }, [clearToBlankDocument]);

  useSessionGuard(Boolean(user?.uid), (reason) => {
    void handleLogout(reason);
  }, {
    locked: workstationLocked,
    onLock: () => {
      setLockReason("idle");
      setWorkstationLocked(true);
    },
  });

  const canEdit = isClinicalEditor(ficha, user?.uid);
  const pendingIncomingUid = ficha.pendingTransfer?.incomingUid;
  const isPendingIncoming = Boolean(
    user?.uid && (!pendingIncomingUid || user.uid === pendingIncomingUid)
  );
  const showAcceptPending = Boolean(ficha.pendingTransfer) && !isCurrentResponsible(ficha, user?.uid) && isPendingIncoming;
  const showDeclinePending = Boolean(ficha.pendingTransfer) && (
    isCurrentResponsible(ficha, user?.uid) || isPendingIncoming
  );
  const openTransferModalIfResponsible = canEdit ? () => responsibility.setShowTransferModal(true) : undefined;

  const applyPendingVoiceTemplate = (names: string[] | undefined) => {
    if (!names || names.length === 0) return;
    try {
      const stored = localStorage.getItem("anesthesia_templates");
      let allTemplates: any[] = [...PRESET_TEMPLATES];
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            allTemplates = [...allTemplates, ...parsed];
          }
        } catch {
          /* ignore malformed local templates */
        }
      }

      const requestedName = names[0];
      const nameStr = typeof requestedName === "string" ? requestedName : "";
      const template = allTemplates.find((t) => {
        if (!t?.name || !nameStr) return false;
        const removeAccents = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const tName = removeAccents(t.name.toLowerCase());
        const reqName = removeAccents(nameStr.toLowerCase());
        if (reqName.includes("cesarea") && tName.includes("cesariana")) return true;
        if (reqName.includes("cesariana") && tName.includes("cesarea")) return true;
        if (tName.includes(reqName) || reqName.includes(tName)) return true;
        const reqWords = reqName.split(" ").filter((w) => w.length > 3);
        const tWords = tName.split(" ").filter((w) => w.length > 3);
        return reqWords.some((rw) => tWords.some((tw) => tw.includes(rw) || rw.includes(tw)));
      });

      if (template) {
        setPendingTemplateForReview(template);
        setActiveTab("intra");
      }
    } catch {
      /* template lookup is best-effort */
    }
  };

  const handleVoiceCommandConfirm = () => {
    const pending = pendingVoice;
    setPendingVoice(null);
    if (!pending || pending.actionable === false) return;
    const gate = canEditDocument(ficha, user?.uid);
    if (gate.ok === false) {
      alert(gate.message);
      return;
    }
    applyPendingVoiceTemplate(pending.actions?.templates);
    const original = pending.transcription || "";
    const hasDocUpdates = Boolean(
      pending.actions?.patient ||
      pending.actions?.timers ||
      pending.actions?.bolusDrugs ||
      pending.actions?.continuousInfusions ||
      pending.actions?.inhalationAgents ||
      pending.actions?.vitals ||
      pending.actions?.events
    );
    if (!hasDocUpdates && !original.trim()) return;
    setFichaWithBroadcast((prev) =>
      applyVoiceActionsToDocument(
        prev,
        pending.actions ?? {},
        selectedMinutes,
        new Date(),
        original || undefined
      )
    );
  };

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark-clean" : "light";
      localStorage.setItem("anesthesia_theme", next);
      return next;
    });
  };

  const isDark = theme === "dark" || theme === "dark-clean";

  if (!user) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <div
      data-compact={appSettings.compactMode ? "true" : "false"}
      className={`min-h-screen flex flex-col font-sans select-none antialiased transition-colors duration-300 ${
      appSettings.compactMode ? "anestflow-compact" : ""
    } ${
      isDark
        ? "dark bg-[#09090B] text-zinc-100"
        : "bg-slate-50 text-slate-900"
    }`}>
      {!isEmailVerified && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-600 dark:text-amber-400 font-semibold flex flex-wrap items-center justify-between gap-2 shadow-sm z-50">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              <strong>Atenção (E-mail não verificado):</strong> Acesso a fichas clínicas compartilhadas e sincronização via UID exigem e-mail verificado na plataforma.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleResendVerificationEmail}
              disabled={resendingEmail}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition disabled:opacity-50"
            >
              {resendingEmail ? "Enviando..." : "Reenviar E-mail"}
            </button>
            <button
              onClick={handleReloadAuthStatus}
              className="px-3 py-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold rounded-lg transition"
            >
              Já Verifiquei
            </button>
          </div>
        </div>
      )}

      <AppHeader
        ficha={ficha}
        user={user}
        now={now}
        isDark={isDark}
        canEdit={canEdit}
        aiSupervisorActive={aiSupervisorActive}
        overflowMenuOpen={overflowMenuOpen}
        setOverflowMenuOpen={setOverflowMenuOpen}
        overflowMenuRef={overflowMenuRef}
        syncEngine={syncEngine}
        startAiSupervisor={startAiSupervisor}
        stopAiSupervisor={stopAiSupervisor}
        onVoiceProcessed={({ transcription, identifiedActions, warnings, unparsedFragments, actionable, missingEntities }) => {
          if (actionable === false) {
            setPendingVoice({
              transcription,
              actions: null,
              warnings: warnings?.length
                ? warnings
                : ["Não foi possível interpretar todos os itens mencionados. Revise o transcript e faça os lançamentos manualmente ou repita o comando."],
              unparsedFragments: unparsedFragments ?? [],
              actionable: false,
              missingEntities: missingEntities ?? [],
            });
            return;
          }
          const finalized = finalizeVoiceParse(transcription, {
            identifiedActions,
            warnings,
            unparsedFragments,
          });
          if (!finalized.ok) {
            setPendingVoice({
              transcription,
              actions: null,
              warnings: ["Estrutura de voz inválida. Nenhum lançamento será aplicado."],
              unparsedFragments: unparsedFragments ?? [],
              actionable: false,
            });
            return;
          }
          setPendingVoice({
            transcription: finalized.result.transcript,
            actions: Object.keys(finalized.result.commands).length ? finalized.result.commands : null,
            warnings: finalized.result.warnings,
            unparsedFragments: finalized.result.unparsedFragments,
            actionable: true,
          });
        }}
        onOpenPdf={() => setShowPrintModal(true)}
        onOpenShare={() => setShowShareModal(true)}
        onOpenArchive={() => setShowProceduresModal(true)}
        onReloadExample={() => setShowReloadConfirm(true)}
        onResetBlank={() => setShowResetConfirm(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onToggleTheme={toggleTheme}
        onLogout={() => { void handleLogout(); }}
      />

      <AppNav activeTab={activeTab} onChangeTab={setActiveTab} isDark={isDark} />

      <main className={`anestflow-main flex-1 overflow-y-auto pb-6 ${
        appSettings.compactMode ? "p-1 sm:p-2" : "p-2 sm:p-4 md:p-6"
      }`}>
        <div className="max-w-7xl mx-auto space-y-4">
          {ficha.pendingTransfer && (
            <div className={`p-4 rounded-xl border shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              isDark ? "bg-indigo-950/40 border-indigo-700/60 text-indigo-100" : "bg-indigo-50 border-indigo-200 text-indigo-900"
            }`}>
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    Solicitação de Troca de Responsabilidade Anestésica Pendente
                  </h4>
                  <p className="text-xs opacity-90 mt-0.5">
                    <strong>Dr(a). {ficha.pendingTransfer.outgoingName}</strong> solicitou a transferência do caso para <strong>Dr(a). {ficha.pendingTransfer.incomingName}</strong> (CRM {ficha.pendingTransfer.incomingCRM}/{ficha.pendingTransfer.incomingUF}).
                  </p>
                  <p className="text-xs opacity-75 mt-1">
                    Condições: {ficha.pendingTransfer.clinicalConditions || 'Estável'} | Pendências: {ficha.pendingTransfer.pendingItems || 'Nenhuma'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                {showDeclinePending && (
                  <button
                    onClick={responsibility.handleCancelTransfer}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                      isDark ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300" : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-300"
                    }`}
                  >
                    Recusar
                  </button>
                )}
                {showAcceptPending && (
                  <button
                    onClick={responsibility.handleAcceptTransfer}
                    disabled={responsibility.isClaiming}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Aceitar e Assumir Ficha
                  </button>
                )}
              </div>
            </div>
          )}

          <ResponsibilityBanner
            ficha={ficha}
            user={user}
            isDark={isDark}
            onOpenTransferModal={() => responsibility.setShowTransferModal(true)}
            onClaimResponsibility={responsibility.handleClaimResponsibility}
            isClaiming={responsibility.isClaiming}
          />

          {activeTab === "patient" && (
            <PatientTab
              ficha={ficha}
              onChangePatient={updatePatient}
              onChangeTeam={updateTeam}
              onLoadWorklist={handleLoadWorklist}
              onSaveWorklist={handleSaveWorklist}
              theme={theme}
              user={user}
              onOpenTransferModal={openTransferModalIfResponsible}
            />
          )}

          {activeTab === "preop" && (
            <PreEvaluationTab
              ficha={ficha}
              onChange={updatePreEvaluation}
              theme={theme}
              canEdit={canEdit}
            />
          )}

          {activeTab === "intra" && (
            <IntraoperativeTab
              ficha={ficha}
              onUpdateDocument={updateDocumentDirectly}
              selectedMinutes={selectedMinutes}
              onTimeSelect={setSelectedMinutes}
              theme={theme}
              pendingTemplateForReview={pendingTemplateForReview}
              onClearPendingTemplate={() => setPendingTemplateForReview(null)}
              startAiSupervisor={startAiSupervisor}
              stopAiSupervisor={stopAiSupervisor}
              canEdit={canEdit}
              vitalIntervalMinutes={appSettings.vitalIntervalMinutes}
              soundAlertsEnabled={appSettings.soundAlertsEnabled}
              compactMode={appSettings.compactMode}
              onPatchAppSettings={(patch) => setAppSettings((prev) => ({ ...prev, ...patch }))}
            />
          )}

          {activeTab === "recovery" && (
            <RecoveryTab
              ficha={ficha}
              onUpdateRecovery={updateRecovery}
              theme={theme}
              canEdit={canEdit}
            />
          )}

          {activeTab === "review" && (
            <ReviewTab
              ficha={ficha}
              onUpdateDocument={updateDocumentDirectly}
              onCloseProcedure={handleCloseProcedure}
              theme={theme}
              startAiSupervisor={startAiSupervisor}
              stopAiSupervisor={stopAiSupervisor}
              onOpenTransferModal={openTransferModalIfResponsible}
              canEdit={canEdit}
            />
          )}
        </div>
      </main>

      <footer className={`border-t px-5 py-3.5 shrink-0 text-center text-xs font-semibold transition hidden lg:block ${
        isDark ? "bg-[#1C1C1E] border-zinc-800 text-zinc-500" : "bg-white border-zinc-200 text-zinc-400"
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-1.5 justify-between items-center">
          <span className="tabular-nums">REGISTRO ANESTÉSICO DIGITAL v2.1 (CFM 2.174/2017)</span>
          <span className={`${isDark ? "text-indigo-400" : "text-indigo-600"} font-bold`}>Resolução Anestésica Hospitalar Segura • iOS Style Layout</span>
        </div>
      </footer>

      <AppModalHost
        ficha={ficha}
        user={user}
        isDark={isDark}
        canEdit={canEdit}
        showPrintModal={showPrintModal}
        onClosePrint={() => setShowPrintModal(false)}
        showProceduresModal={showProceduresModal}
        onCloseProcedures={() => setShowProceduresModal(false)}
        onLoadDocument={(loadedDoc) => {
          loadCloudFicha(loadedDoc);
          setActiveTab("patient");
        }}
        pendingVoice={pendingVoice}
        onDismissVoice={() => setPendingVoice(null)}
        onConfirmVoice={handleVoiceCommandConfirm}
        showResetConfirm={showResetConfirm}
        onCancelReset={() => setShowResetConfirm(false)}
        onConfirmReset={() => {
          setShowResetConfirm(false);
          handleResetToBlankConfirm();
          setActiveTab("patient");
        }}
        showReloadConfirm={showReloadConfirm}
        onCancelReload={() => setShowReloadConfirm(false)}
        onConfirmReload={() => {
          setShowReloadConfirm(false);
          handleReloadMockDataConfirm();
          setActiveTab("intra");
        }}
        showShareModal={showShareModal}
        onCloseShare={() => setShowShareModal(false)}
        onUpdateDocument={updateDocumentDirectly}
        autosavePaused={syncEngine.autosavePaused}
        onToggleAutosavePause={syncEngine.toggleAutosavePause}
        isOnline={syncEngine.isOnline}
        onOpenTransferModal={openTransferModalIfResponsible}
        showTransferModal={responsibility.showTransferModal}
        onCloseTransfer={() => responsibility.setShowTransferModal(false)}
        onConfirmTransfer={responsibility.handleConfirmTransfer}
        showAssumeModal={responsibility.showAssumeModal}
        onCloseAssume={() => responsibility.setShowAssumeModal(false)}
        onConfirmAssume={responsibility.handleConfirmAssume}
        isClaiming={responsibility.isClaiming}
        showSettingsModal={showSettingsModal}
        onCloseSettings={() => setShowSettingsModal(false)}
        appSettings={appSettings}
        onSaveSettings={(newSettings) => setAppSettings(newSettings)}
        toggleTheme={toggleTheme}
        workstationLocked={workstationLocked}
        lockReason={lockReason}
        onUnlocked={() => setWorkstationLocked(false)}
        onLogout={() => { void handleLogout(); }}
      />
    </div>
  );
}
