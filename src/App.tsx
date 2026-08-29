/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { AnesthesiaDocument, AnesthesiaDocumentPatch, PatientInfo, PreAnestheticEvaluation, PostAnesthesiaRecovery, ASAClass } from "./types";
import { getMockDocument, getBlankDocument } from "./mockData";
import PatientTab from "./components/PatientTab";
import PreEvaluationTab from "./components/PreEvaluationTab";
import IntraoperativeTab from "./components/IntraoperativeTab";
import RecoveryTab from "./components/RecoveryTab";
import ReviewTab from "./components/ReviewTab";
import PdfPreviewModal from "./components/PdfPreviewModal";
import AnestFlowLogo from "./components/AnestFlowLogo";
import LoginScreen from "./components/LoginScreen";
import WorkstationLockScreen from "./components/WorkstationLockScreen";
import { Clock, Printer, RotateCcw, AlertTriangle, CheckCircle, ShieldCheck, ShieldAlert, FileText, Sun, Moon, LogOut, Download, Database, Users, BrainCircuit, Activity, Syringe, Droplet, Flag, Settings, ArrowRightLeft, MoreHorizontal } from "lucide-react";
import ProceduresManagerModal from "./components/ProceduresManagerModal";
import ShareModal from "./components/ShareModal";
import SettingsModal, { AppSettings, DEFAULT_APP_SETTINGS } from "./components/SettingsModal";
import TransferResponsibilityModal from "./components/TransferResponsibilityModal";
import AssumeResponsibilityModal from "./components/AssumeResponsibilityModal";
import { PRESET_TEMPLATES } from "./components/AnesthesiaTemplatesModalData";
import { VoiceCommandButton } from "./components/VoiceCommandButton";
import { VoiceCommandConfirmModal } from "./components/VoiceCommandConfirmModal";
import {
  applyVoiceActionsToDocument,
  sanitizeVoiceCommand,
  summarizeVoiceActions,
  type SanitizedVoiceActions,
} from "./lib/voiceCommand";
import { useSyncEngine } from "./lib/useSyncEngine";
import SyncStatusBadge from "./components/SyncStatusBadge";
import {
  assumeResponsibilityAtomic,
  claimResponsibilityAtomic,
  declinePendingTransferAtomic,
  requestTransferAtomic,
  resolveIncomingDoctorByEmail,
  transferResponsibilityAtomic,
} from "./lib/proceduresService";
import { mapClinicalError } from "./lib/clinicalErrors";
import { isUuid } from "./lib/procedureMapper";
import { useSessionGuard } from "./lib/useSessionGuard";
import {
  beginSession,
  clearClinicalBrowserCache,
  clearSessionClock,
  clearSessionEndReason,
  needsSignatureStepUp,
  persistSessionEndReason,
  readSessionClock,
  type SessionViolation,
} from "./lib/sessionPolicy";
import {
  activeDocSessionKey,
  purgeClinicalPhiFromLocalStorage,
} from "./lib/clinicalStorageKeys";
import {
  assignNewDocumentOwner,
  canEditDocument,
  isClinicalEditor,
  isCurrentResponsible,
} from "./lib/assertCanEdit";
import {
  anesthesiaProgressLabel,
  isAnesthesiaInProgress,
  withInProgressIfAnesthesiaStarted,
} from "./lib/procedureStatus";
import ResponsibilityBanner from "./components/ResponsibilityBanner";

type SessionUser = { name: string; crm: string; uf: string; hospital: string; uid?: string; email?: string | null };

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(() => {
    const saved = localStorage.getItem("anesthesia_user");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.uid) return parsed;
      // If no UID (legacy local login), clear it to force real auth
      localStorage.removeItem("anesthesia_user");
    }
    return null;
  });

  const [ficha, setFicha] = useState<AnesthesiaDocument>(() => {
    purgeClinicalPhiFromLocalStorage();

    // Restore active session copy from sessionStorage only if user is logged in
    const savedUser = localStorage.getItem("anesthesia_user");
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        if (u && u.uid) {
          const sessionSaved = sessionStorage.getItem(activeDocSessionKey(u.uid));
          if (sessionSaved) {
            const parsed = JSON.parse(sessionSaved);
            if (parsed && parsed.id && parsed.id !== "doc-9281-2026") {
              return parsed;
            }
          }
        }
      } catch (e) {
        console.error("Failed to parse session ficha.");
      }
    }
    return getBlankDocument();
  });

  const [pendingTemplateForReview, setPendingTemplateForReview] = useState<any>(null);
  const [pendingVoice, setPendingVoice] = useState<{
    transcription: string;
    actions: SanitizedVoiceActions | null;
  } | null>(null);
  const [theme, setTheme] = useState<"light" | "dark" | "dark-clean">(() => {
    const saved = localStorage.getItem("anesthesia_theme");
    return (saved as "light" | "dark" | "dark-clean") || "light";
  });

  const [activeTab, setActiveTab] = useState<"patient" | "preop" | "intra" | "recovery" | "review">("patient");
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showProceduresModal, setShowProceduresModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  const overflowMenuRef = useRef<HTMLDivElement | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAssumeModal, setShowAssumeModal] = useState(false);
  const [showSaveNotice, setShowSaveNotice] = useState(false);
  const saveNoticeTimer = React.useRef<NodeJS.Timeout | null>(null);
  
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem("anesthesia_app_settings");
    return saved ? { ...DEFAULT_APP_SETTINGS, ...JSON.parse(saved) } : DEFAULT_APP_SETTINGS;
  });

  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showReloadConfirm, setShowReloadConfirm] = useState(false);
  const [workstationLocked, setWorkstationLocked] = useState(false);
  const [lockReason, setLockReason] = useState<"idle" | "signature">("idle");

  useEffect(() => {
    if (!overflowMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(event.target as Node)) {
        setOverflowMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOverflowMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [overflowMenuOpen]);

  // Auto-save settings to localStorage (non-clinical UI settings)
  useEffect(() => {
    localStorage.setItem("anesthesia_app_settings", JSON.stringify(appSettings));
  }, [appSettings]);

  // Save active ficha into UID-isolated sessionStorage ONLY (wiped on tab/session close and logout)
  useEffect(() => {
    purgeClinicalPhiFromLocalStorage();

    if (user?.uid && ficha) {
      try {
        sessionStorage.setItem(activeDocSessionKey(user.uid), JSON.stringify(ficha));
      } catch (e) {
        console.warn("Could not save session ficha cache:", e);
      }
    } else {
      try {
        sessionStorage.clear();
      } catch (e) {}
    }
    
    // Determine if we have any intraoperative data
    const hasIntraopData = Boolean(
      ficha.timers?.startAnesthesia ||
      ficha.timers?.startSurgery ||
      ficha.timers?.endSurgery ||
      ficha.timers?.endAnesthesia ||
      (ficha.vitals && ficha.vitals.length > 0) ||
      (ficha.events && ficha.events.length > 0) ||
      (ficha.bolusDrugs && ficha.bolusDrugs.length > 0) ||
      (ficha.continuousInfusions && ficha.continuousInfusions.length > 0) ||
      (ficha.inhalationAgents && ficha.inhalationAgents.length > 0) ||
      (ficha.fluids && ficha.fluids.length > 0)
    );

    if (hasIntraopData) {
      setShowSaveNotice(true);
      if (saveNoticeTimer.current) {
        clearTimeout(saveNoticeTimer.current);
      }
      saveNoticeTimer.current = setTimeout(() => {
        setShowSaveNotice(false);
      }, 5000);
    }
  }, [ficha, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    setFicha((prev) => {
      if (prev.currentResponsibleUid || prev.createdByUid) return prev;
      return assignNewDocumentOwner(prev, user.uid!);
    });
  }, [user?.uid]);

  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(true);
  const [resendingEmail, setResendingEmail] = useState<boolean>(false);

  // Monitor Supabase Auth state to ensure immediate, complete cleanup of session clinical data when unauthenticated
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
          setFicha(getBlankDocument());
          setIsEmailVerified(true);
          return;
        }
        if (supabaseUser) {
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
  }, []);

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

  // Timers and clock ticking state
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Continuous Autosave & Cloud Synchronization Engine
  const handleRemoteUpdate = useCallback((remoteDoc: AnesthesiaDocument) => {
    setFicha(remoteDoc);
  }, []);

  const syncEngine = useSyncEngine(
    ficha,
    user?.uid,
    handleRemoteUpdate
  );

  // =========================================================================
  // SUPERVISOR DE IA (AI SUPERVISOR) SYSTEM
  // Enforces a strict 60-second execution limit on all asynchronous Gemini AI 
  // operations, prints detailed diagnostics, and avoids indefinite hangs.
  // =========================================================================
  const [aiSupervisorActive, setAiSupervisorActive] = useState(false);
  const [aiSupervisorTask, setAiSupervisorTask] = useState<string>("");
  const [aiSupervisorElapsed, setAiSupervisorElapsed] = useState<number>(0);
  const aiSupervisorTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const aiSupervisorStartRef = React.useRef<number | null>(null);

  const stopAiSupervisor = useCallback((reason: string = "Concluído com sucesso") => {
    if (aiSupervisorTimerRef.current) {
      clearInterval(aiSupervisorTimerRef.current);
      aiSupervisorTimerRef.current = null;
    }
    const totalElapsed = aiSupervisorStartRef.current ? Math.floor((Date.now() - aiSupervisorStartRef.current) / 1000) : 0;
    console.log(`[Supervisor de IA] <<< PARANDO monitoramento. Motivo: "${reason}". Tempo total monitorado: ${totalElapsed}s.`);
    setAiSupervisorActive(false);
    setAiSupervisorTask("");
    setAiSupervisorElapsed(0);
    aiSupervisorStartRef.current = null;
  }, []);

  const startAiSupervisor = useCallback((taskName: string, onTimeout: () => void) => {
    console.log(`[Supervisor de IA] >>> INICIANDO monitoramento para a tarefa: "${taskName}"`);
    setAiSupervisorActive(true);
    setAiSupervisorTask(taskName);
    setAiSupervisorElapsed(0);
    aiSupervisorStartRef.current = Date.now();

    if (aiSupervisorTimerRef.current) {
      clearInterval(aiSupervisorTimerRef.current);
    }

    aiSupervisorTimerRef.current = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - (aiSupervisorStartRef.current || Date.now())) / 1000);
      setAiSupervisorElapsed(elapsedSeconds);
      
      console.log(`[Supervisor de IA - Diagnóstico] Estado: ATIVO | Tarefa: "${taskName}" | Tempo Decorrido: ${elapsedSeconds}s / 60s`);

      if (elapsedSeconds >= 60) {
        console.warn(`[Supervisor de IA - ALERTA] Limite de tempo de 60 segundos ATINGIDO para a tarefa: "${taskName}". Forçando interrupção do processo!`);
        try {
          onTimeout();
        } catch (e) {
          console.error(`[Supervisor de IA - Erro] Falha ao invocar callback de interrupção:`, e);
        }
        stopAiSupervisor("Timeout atingido (60s)");
      }
    }, 1000);
  }, [stopAiSupervisor]);

  useEffect(() => {
    return () => {
      if (aiSupervisorTimerRef.current) {
        clearInterval(aiSupervisorTimerRef.current);
      }
    };
  }, []);
  // =========================================================================

  const setFichaWithBroadcast = (docOrUpdater: React.SetStateAction<AnesthesiaDocument>) => {
    setFicha((prev) => {
      const nextDoc = typeof docOrUpdater === 'function' ? docOrUpdater(prev) : docOrUpdater;
      return withInProgressIfAnesthesiaStarted(nextDoc);
    });
  };

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

      // Initialize a fresh blank ficha specifically for the newly logged-in user.
      // NEVER adopt or auto-assign an existing ficha from a previous user's session!
      const newBlank = assignNewDocumentOwner(getBlankDocument(), doctor.uid || "");
      newBlank.patient.hospital = doctor.hospital || appSettings.defaultHospital;
      newBlank.team.anesthesiologistLead = doctor.name || appSettings.defaultAnesthesiologistName;
      newBlank.team.crmLead = doctor.crm || appSettings.defaultCrm;
      newBlank.team.ufLead = doctor.uf;

      setFicha(newBlank);
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
    } catch(e) {
      console.error("Error signing out:", e);
    }

    setUser(null);
    setFicha(getBlankDocument());
    setActiveTab("patient");
    setWorkstationLocked(false);
  }, []);

  useSessionGuard(Boolean(user?.uid), (reason) => {
    void handleLogout(reason);
  }, {
    locked: workstationLocked,
    onLock: () => {
      setLockReason("idle");
      setWorkstationLocked(true);
    },
  });

  // Calculate dynamic elapsed timing of the surgery
  const getElapsedAnesthesiaString = () => {
    if (!ficha.timers.startAnesthesia) return "Não iniciada";
    const start = new Date(ficha.timers.startAnesthesia).getTime();
    const end = ficha.timers.endAnesthesia ? new Date(ficha.timers.endAnesthesia).getTime() : now.getTime();
    
    const diffMs = end - start;
    if (diffMs < 0) return "00:00";
    
    const diffMins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };

  // State modification wrappers
  const canEdit = isClinicalEditor(ficha, user?.uid);
  const pendingIncomingUid = ficha.pendingTransfer?.incomingUid;
  const isPendingIncoming = Boolean(
    user?.uid && (!pendingIncomingUid || user.uid === pendingIncomingUid)
  );
  const showAcceptPending = Boolean(ficha.pendingTransfer) && !isCurrentResponsible(ficha, user?.uid) && isPendingIncoming;
  const showDeclinePending = Boolean(ficha.pendingTransfer) && (
    isCurrentResponsible(ficha, user?.uid) || isPendingIncoming
  );
  const openTransferModalIfResponsible = canEdit ? () => setShowTransferModal(true) : undefined;

  const updatePatient = (patientData: Partial<PatientInfo>) => {
    if (!canEdit) return;
    setFichaWithBroadcast(prev => ({
      ...prev,
      patient: { ...prev.patient, ...patientData }
    }));
  };

  const updateTeam = (teamData: Partial<AnesthesiaDocument["team"]>) => {
    if (!canEdit) return;
    setFichaWithBroadcast(prev => ({
      ...prev,
      team: { ...prev.team, ...teamData }
    }));
  };

  const updatePreEvaluation = (evalData: Partial<PreAnestheticEvaluation>) => {
    if (!canEdit) return;
    setFichaWithBroadcast(prev => ({
      ...prev,
      preEvaluation: { ...prev.preEvaluation, ...evalData } as any
    }));
  };

  const handleLoadWorklist = async (cpf: string) => {
    if (!canEdit) {
      const gate = canEditDocument(ficha, user?.uid);
      throw new Error(gate.ok === false ? gate.message : "Edição não permitida.");
    }
    const { getFromWorklist } = await import("./lib/worklistService");
    const entry = await getFromWorklist(cpf);
    if (!entry) throw new Error("Paciente não encontrado na Worklist");
    setFichaWithBroadcast(prev => ({
      ...prev,
      patient: { ...prev.patient, ...entry.patient },
      preEvaluation: { ...prev.preEvaluation, ...entry.preEvaluation }
    }));
  };

  const handleSaveWorklist = async () => {
    const gate = canEditDocument(ficha, user?.uid);
    if (gate.ok === false) throw new Error(gate.message);
    const { saveToWorklist } = await import("./lib/worklistService");
    const cpf = ficha.patient?.cpf;
    if (!cpf) throw new Error("CPF é obrigatório para salvar");
    await saveToWorklist(cpf, ficha.patient, ficha.preEvaluation);
  };

  const updateRecovery = (
    recoveryData: Partial<PostAnesthesiaRecovery> | ((prev: PostAnesthesiaRecovery) => Partial<PostAnesthesiaRecovery>)
  ) => {
    if (!canEdit) return;
    setFichaWithBroadcast(prev => {
      const patch = typeof recoveryData === "function" ? recoveryData(prev.recovery) : recoveryData;
      return {
        ...prev,
        recovery: { ...prev.recovery, ...patch }
      };
    });
  };

  const updateDocumentDirectly = (updates: AnesthesiaDocumentPatch) => {
    const gate = canEditDocument(ficha, user?.uid);
    if (gate.ok === false) {
      alert(gate.message);
      return;
    }
    setFichaWithBroadcast(prev => {
      const resolved = typeof updates === "function" ? updates(prev) : { ...updates };
      if (resolved.createdByUid && prev.createdByUid && resolved.createdByUid !== prev.createdByUid) {
        delete resolved.createdByUid;
      }
      return { ...prev, ...resolved };
    });
  };

  const [isClaiming, setIsClaiming] = useState(false);

  const requireCloudProcedure = (action: string): boolean => {
    if (!syncEngine.isOnline) {
      alert(`${action} exige conexão com a nuvem.`);
      return false;
    }
    if (!isUuid(ficha.id)) {
      alert(`Salve a ficha na nuvem antes de ${action.toLowerCase()}.`);
      return false;
    }
    return true;
  };

  const claimUserPayload = () => ({
    uid: user?.uid || "",
    name: user?.name || "",
    crm: user?.crm || "",
    uf: user?.uf || "",
    email: user?.email || undefined
  });

  const outgoingFromDocument = () => ({
    uid: ficha.currentResponsibleUid,
    name: ficha.team?.anesthesiologistLead || "",
    crm: ficha.team?.crmLead || "",
    uf: ficha.team?.ufLead || ""
  });

  const handleClaimResponsibility = () => {
    if (!user || !user.uid) {
      alert("É necessário estar autenticado com um e-mail válido para assumir a responsabilidade clínica.");
      return;
    }
    if (ficha.status === "Signed") {
      alert("Esta ficha foi encerrada e assinada. Alterações não são permitidas.");
      return;
    }
    if (ficha.currentResponsibleUid === user.uid) return;
    if (!requireCloudProcedure("Assumir a responsabilidade")) return;
    setShowAssumeModal(true);
  };

  const handleConfirmAssume = async (reason: string) => {
    if (!user || !user.uid) {
      alert("É necessário estar autenticado com um e-mail válido para assumir a responsabilidade clínica.");
      return;
    }
    if (!requireCloudProcedure("Assumir a responsabilidade")) return;

    setIsClaiming(true);
    try {
      const updated = await assumeResponsibilityAtomic(
        ficha.id,
        claimUserPayload(),
        outgoingFromDocument(),
        reason
      );
      setFicha(updated);
      setShowAssumeModal(false);
      alert("Você agora é o Anestesiologista Responsável por esta ficha.");
    } catch (err: unknown) {
      console.error("Erro ao assumir responsabilidade:", err);
      alert(mapClinicalError(err).message);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleConfirmTransfer = async (data: {
    outgoingName: string;
    outgoingCRM: string;
    outgoingUF: string;
    incomingName: string;
    incomingCRM: string;
    incomingUF: string;
    incomingEmail?: string;
    clinicalConditions: string;
    incidentsReported: string;
    ongoingInfusions: string;
    pendingItems: string;
    immediate?: boolean;
  }): Promise<boolean> => {
    if (!user?.uid) {
      alert("É necessário estar autenticado para transferir a responsabilidade.");
      return false;
    }
    const gate = canEditDocument(ficha, user.uid);
    if (gate.ok === false) {
      alert(gate.message);
      return false;
    }
    if (!requireCloudProcedure(data.immediate ? "Transferir a responsabilidade" : "Solicitar a transferência")) {
      return false;
    }

    const email = (data.incomingEmail || "").trim();
    if (!email) {
      alert("Informe o e-mail do colega que vai assumir o caso. Ele precisa ter perfil confirmado no AnestFlow.");
      return false;
    }

    try {
      const incomingDoctor = await resolveIncomingDoctorByEmail(email, {
        name: data.incomingName,
        crm: data.incomingCRM,
        uf: data.incomingUF
      });
      const outgoingDoctor = {
        uid: ficha.currentResponsibleUid,
        name: data.outgoingName,
        crm: data.outgoingCRM,
        uf: data.outgoingUF
      };
      const handoverDetails = {
        clinicalConditions: data.clinicalConditions,
        incidentsReported: data.incidentsReported,
        ongoingInfusions: data.ongoingInfusions,
        pendingItems: data.pendingItems
      };

      if (data.immediate) {
        const updated = await transferResponsibilityAtomic(
          ficha.id,
          user.uid,
          incomingDoctor,
          outgoingDoctor,
          handoverDetails
        );
        setFicha(updated);
        alert(`Troca de responsabilidade realizada com sucesso! Dr(a). ${incomingDoctor.name} é agora o responsável.`);
        return true;
      }

      const updated = await requestTransferAtomic(
        ficha.id,
        user.uid,
        incomingDoctor,
        outgoingDoctor,
        handoverDetails
      );
      setFicha(updated);
      alert(`Solicitação de troca de responsabilidade registrada! Aguardando aceite de Dr(a). ${incomingDoctor.name}.`);
      return true;
    } catch (err: unknown) {
      console.error("Erro na transferência:", err);
      alert(mapClinicalError(err).message);
      return false;
    }
  };

  const handleAcceptTransfer = async () => {
    if (!ficha.pendingTransfer) return;
    if (!user?.uid) {
      alert("É necessário estar autenticado para aceitar a transferência.");
      return;
    }
    if (ficha.status === "Signed") {
      alert("Ficha encerrada e assinada. Alterações não são permitidas.");
      return;
    }
    if (!requireCloudProcedure("Aceitar a transferência")) return;

    setIsClaiming(true);
    try {
      const pt = ficha.pendingTransfer;
      const updated = await claimResponsibilityAtomic(
        ficha.id,
        {
          uid: user.uid,
          name: user.name || pt.incomingName,
          crm: user.crm || pt.incomingCRM,
          uf: user.uf || pt.incomingUF,
          email: user.email || pt.incomingEmail
        },
        {
          uid: pt.outgoingUid,
          name: pt.outgoingName,
          crm: pt.outgoingCRM,
          uf: pt.outgoingUF
        }
      );
      setFicha(updated);
      alert("Você aceitou a transferência e agora é o Anestesiologista Responsável por esta ficha.");
    } catch (err: unknown) {
      console.error("Erro ao aceitar transferência:", err);
      alert(mapClinicalError(err).message);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleCancelTransfer = async () => {
    if (!requireCloudProcedure("Recusar a transferência")) return;
    try {
      const updated = await declinePendingTransferAtomic(ficha.id);
      setFicha(updated);
    } catch (err: unknown) {
      console.error("Erro ao recusar transferência:", err);
      alert(mapClinicalError(err).message);
    }
  };

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
    if (!pending?.actions) return;
    const gate = canEditDocument(ficha, user?.uid);
    if (gate.ok === false) {
      alert(gate.message);
      return;
    }

    applyPendingVoiceTemplate(pending.actions.templates);

    const hasDocUpdates = Boolean(
      pending.actions.patient ||
      pending.actions.timers ||
      pending.actions.bolusDrugs ||
      pending.actions.continuousInfusions ||
      pending.actions.inhalationAgents ||
      pending.actions.vitals ||
      pending.actions.events
    );
    if (!hasDocUpdates) return;

    setFichaWithBroadcast((prev) =>
      applyVoiceActionsToDocument(prev, pending.actions!, selectedMinutes)
    );
  };

  const triggerResetToBlank = () => {
    setShowResetConfirm(true);
  };

  const handleResetToBlankConfirm = () => {
    setShowResetConfirm(false);
    let blank = getBlankDocument();
    if (user?.uid) blank = assignNewDocumentOwner(blank, user.uid);
    if (user) {
      blank.team.anesthesiologistLead = user.name;
      blank.team.crmLead = user.crm;
      blank.team.ufLead = user.uf;
      blank.patient.hospital = user.hospital;
    }
    setFichaWithBroadcast(blank);
    setActiveTab("patient");
  };

  const handleCloseProcedure = async () => {
    if (!user || !user.uid) {
      alert("Usuário não autenticado. É necessário estar logado para assinar a ficha.");
      return;
    }
    const gate = canEditDocument(ficha, user.uid);
    if (gate.ok === false) {
      alert(gate.message);
      return;
    }
    if (needsSignatureStepUp({ ...readSessionClock(), now: Date.now() })) {
      setLockReason("signature");
      setWorkstationLocked(true);
      return;
    }

    try {
      const { saveProcedure, closeProcedureAtomic } = await import("./lib/proceduresService");
      const toFlush = {
        ...ficha,
        status: ficha.status === "Signed" ? "InProgress" : ficha.status
      };
      await saveProcedure(toFlush, user.uid);
      const sealed = await closeProcedureAtomic(toFlush.id);

      alert(
        `Procedimento encerrado com sucesso!\n\nSelo criptográfico de integridade (SHA-256):\n${sealed.hash || ""}\n\nO registro clínico foi selado no servidor e tornou-se imutável.`
      );
      setFichaWithBroadcast(sealed);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Ocorreu um erro ao tentar salvar o encerramento do procedimento na nuvem.");
    }
  };

  const triggerReloadMockData = () => {
    setShowReloadConfirm(true);
  };

  const handleReloadMockDataConfirm = () => {
    setShowReloadConfirm(false);
    let mockDoc = getMockDocument();
    if (user?.uid) mockDoc = assignNewDocumentOwner(mockDoc, user.uid);
    if (user) {
      mockDoc.team.anesthesiologistLead = user.name;
      mockDoc.team.crmLead = user.crm;
      mockDoc.team.ufLead = user.uf;
      mockDoc.patient.hospital = user.hospital;
    }
    setFichaWithBroadcast(mockDoc);
    setActiveTab("intra");
  };

  const toggleTheme = () => {
    setTheme(prev => {
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
    <div className={`min-h-screen flex flex-col font-sans select-none antialiased transition-colors duration-300 ${
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

      {/* 1. CLINICAL HEADER & ACTIVE TIMER MONITOR */}
      <header className={`relative shrink-0 transition-all duration-300 border-b z-30 backdrop-blur-md bg-white/80 dark:bg-zinc-950/80 ${
        isDark 
          ? "bg-zinc-950/90 border-zinc-800 text-zinc-100" 
          : "bg-white/95 backdrop-blur-md border-slate-200 text-slate-900"
      }`}>
        <div className="relative max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          
          <AnestFlowLogo height={28} className="shrink-0 hidden lg:block mr-2" />
          {/* IDENTIFICAÇÃO DO PACIENTE */}
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

          {/* TEMPO E STATUS */}
          <div className="flex flex-col items-end shrink-0">
            <div className="text-lg font-semibold tabular-nums leading-none mb-1">
              {getElapsedAnesthesiaString()}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <div className={`w-2 h-2 rounded-full ${isAnesthesiaInProgress(ficha.timers) ? "bg-emerald-500 animate-pulse" : "bg-zinc-300 dark:bg-zinc-600"}`}></div>
              <span className="text-zinc-600 dark:text-zinc-400">
                {anesthesiaProgressLabel(ficha.timers)}
              </span>
            </div>
          </div>

          {/* AÇÕES E SINCRONIZAÇÃO */}
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
                  setPendingVoice({
                    transcription,
                    actions: sanitizeVoiceCommand(identifiedActions),
                  });
                }}
              />
              <button 
                onClick={() => setShowPrintModal(true)} 
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-sm font-medium transition-colors flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">PDF</span>
              </button>
              <button 
                onClick={() => setShowShareModal(true)} 
                disabled={!ficha.userId}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Equipe</span>
              </button>
              
              {/* Menu secundário: clique (touch não tem hover). */}
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
                      <button type="button" role="menuitem" onClick={() => { setOverflowMenuOpen(false); setShowProceduresModal(true); }} className="px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2">
                        <Database className="w-4 h-4" /> Arquivo
                      </button>
                      <button type="button" role="menuitem" disabled={!canEdit} onClick={() => { if (!canEdit) return; setOverflowMenuOpen(false); triggerReloadMockData(); }} className="px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2 disabled:opacity-50">
                        <FileText className="w-4 h-4" /> Modelo Exemplo
                      </button>
                      <button type="button" role="menuitem" disabled={!canEdit} onClick={() => { if (!canEdit) return; setOverflowMenuOpen(false); triggerResetToBlank(); }} className="px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2 text-rose-600 dark:text-rose-400 disabled:opacity-50">
                        <RotateCcw className="w-4 h-4" /> Limpar Tudo
                      </button>
                      <div className="h-px bg-slate-200 dark:bg-zinc-800 my-1"></div>
                      <button type="button" role="menuitem" onClick={() => { setOverflowMenuOpen(false); setShowSettingsModal(true); }} className="px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2">
                        <Settings className="w-4 h-4" /> Configurações
                      </button>
                      <button type="button" role="menuitem" onClick={() => { setOverflowMenuOpen(false); toggleTheme(); }} className="px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2">
                        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />} {isDark ? 'Modo Claro' : 'Modo Escuro'}
                      </button>
                      <button type="button" role="menuitem" onClick={() => { setOverflowMenuOpen(false); void handleLogout(); }} className="px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2 text-rose-600 dark:text-rose-400">
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

      {/* 3. CORE LAYOUT NAVIGATION BAR (Responsive grid/flex wrap) */}
      <nav className={`border-b px-4 py-2 shrink-0 transition ${
        isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200"
      }`}>
        <div className="max-w-7xl mx-auto overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-2 min-w-max">
            {[
              { id: "patient", label: "Admissão e Equipe", shortLabel: "Admissão" },
              { id: "preop", label: "Avaliação Pré-Anestésica", shortLabel: "Pré-Anestésica" },
              { id: "intra", label: "Registro Intraoperatório", shortLabel: "Intraoperatório" },
              { id: "recovery", label: "Recuperação (SRPA)", shortLabel: "SRPA" },
              { id: "review", label: "Auditoria & Assinatura", shortLabel: "Auditoria" }
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 select-none cursor-pointer flex items-center justify-center ${
                    active 
                      ? isDark 
                        ? "bg-indigo-500/10 text-indigo-300" 
                        : "bg-indigo-50 text-indigo-700"
                      : isDark
                        ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* 4. MAIN ACTION SCREEN VIEWPORT */}
      <main className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6 pb-6">
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
                    onClick={handleCancelTransfer}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                      isDark ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300" : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-300"
                    }`}
                  >
                    Recusar
                  </button>
                )}
                {showAcceptPending && (
                  <button
                    onClick={handleAcceptTransfer}
                    disabled={isClaiming}
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
            onOpenTransferModal={() => setShowTransferModal(true)}
            onClaimResponsibility={handleClaimResponsibility}
            isClaiming={isClaiming}
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



      {/* 5. FLOATING FOOTER INDICATORS */}
      <footer className={`border-t px-5 py-3.5 shrink-0 text-center text-xs font-semibold transition hidden lg:block ${
        isDark ? "bg-[#1C1C1E] border-zinc-800 text-zinc-500" : "bg-white border-zinc-200 text-zinc-400"
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-1.5 justify-between items-center">
          <span className="tabular-nums">REGISTRO ANESTÉSICO DIGITAL v2.1 (CFM 2.174/2017)</span>
          <span className={`${isDark ? "text-indigo-400" : "text-indigo-600"} font-bold`}>Resolução Anestésica Hospitalar Segura • iOS Style Layout</span>
        </div>
      </footer>

      {/* 6. FULLSCREEN PRINT ENGINE MODAL OVERLAY */}
      <PdfPreviewModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        ficha={ficha}
      />

      {/* CLOUD PROCEDURES PERSISTENCE MANAGER MODAL */}
      <ProceduresManagerModal
        isOpen={showProceduresModal}
        onClose={() => setShowProceduresModal(false)}
        currentDocument={ficha}
        onLoadDocument={(loadedDoc) => {
          setFicha(withInProgressIfAnesthesiaStarted(loadedDoc));
          setActiveTab("patient");
        }}
        userId={user?.uid || ""}
        isDark={isDark}
      />

      <VoiceCommandConfirmModal
        isOpen={Boolean(pendingVoice)}
        transcription={pendingVoice?.transcription || ""}
        summaries={pendingVoice?.actions ? summarizeVoiceActions(pendingVoice.actions) : []}
        canApply={Boolean(pendingVoice?.actions) && canEdit}
        isDark={isDark}
        onDismiss={() => setPendingVoice(null)}
        onConfirm={handleVoiceCommandConfirm}
      />

      {/* CUSTOM CONFIRMATION DIALOG: RESET TO BLANK */}
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
                onClick={() => setShowResetConfirm(false)}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold border transition ${
                  isDark 
                    ? "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700" 
                    : "bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={handleResetToBlankConfirm}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold rounded-xl transition shadow-xs"
              >
                Apagar e Limpar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION DIALOG: RELOAD MOCK DATA */}
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
                onClick={() => setShowReloadConfirm(false)}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold border transition ${
                  isDark 
                    ? "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700" 
                    : "bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={handleReloadMockDataConfirm}
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
          onClose={() => setShowShareModal(false)}
          onUpdateDocument={updateDocumentDirectly}
          autosavePaused={syncEngine.autosavePaused}
          onToggleAutosavePause={syncEngine.toggleAutosavePause}
          isOnline={syncEngine.isOnline}
          onOpenTransferModal={openTransferModalIfResponsible}
        />
      )}

      {showTransferModal && (
        <TransferResponsibilityModal
          ficha={ficha}
          isDark={isDark}
          onClose={() => setShowTransferModal(false)}
          onConfirmTransfer={handleConfirmTransfer}
        />
      )}

      {showAssumeModal && (
        <AssumeResponsibilityModal
          isDark={isDark}
          leadName={ficha.team?.anesthesiologistLead || "outro anestesiologista"}
          isSubmitting={isClaiming}
          onClose={() => setShowAssumeModal(false)}
          onConfirm={handleConfirmAssume}
        />
      )}

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={appSettings}
        onSaveSettings={(newSettings) => setAppSettings(newSettings)}
        isDark={isDark}
        toggleTheme={toggleTheme}
        userEmail={user?.email || undefined}
      />

      {workstationLocked && (
        <WorkstationLockScreen
          email={user.email}
          isDark={isDark}
          reason={lockReason}
          onUnlocked={() => setWorkstationLocked(false)}
          onLogout={() => { void handleLogout(); }}
        />
      )}

    </div>
  );
}
