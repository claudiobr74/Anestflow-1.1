/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { AnesthesiaDocument, PatientInfo, PreAnestheticEvaluation, PostAnesthesiaRecovery, ASAClass, AnesthesiologistTransfer, PendingTransfer } from "./types";
import { getMockDocument, getBlankDocument, calculateAge } from "./mockData";
import PatientTab from "./components/PatientTab";
import PreEvaluationTab from "./components/PreEvaluationTab";
import IntraoperativeTab from "./components/IntraoperativeTab";
import RecoveryTab from "./components/RecoveryTab";
import ReviewTab from "./components/ReviewTab";
import PdfPreviewModal from "./components/PdfPreviewModal";
import AnestFlowLogo from "./components/AnestFlowLogo";
import LoginScreen from "./components/LoginScreen";
import { Clock, Printer, RotateCcw, AlertTriangle, CheckCircle, ShieldCheck, ShieldAlert, FileText, Sun, Moon, LogOut, Download, Database, Users, BrainCircuit, Activity, Syringe, Droplet, Flag, Settings, ArrowRightLeft, MoreHorizontal, Lock, Eye } from "lucide-react";
import ProceduresManagerModal from "./components/ProceduresManagerModal";
import ShareModal from "./components/ShareModal";
import SettingsModal, { AppSettings, DEFAULT_APP_SETTINGS } from "./components/SettingsModal";
import TransferResponsibilityModal from "./components/TransferResponsibilityModal";
import { PRESET_TEMPLATES } from "./components/AnesthesiaTemplatesModalData";
import { VoiceCommandButton } from "./components/VoiceCommandButton";
import { useSyncEngine } from "./lib/useSyncEngine";
import SyncStatusBadge from "./components/SyncStatusBadge";
import { claimResponsibilityAtomic, transferResponsibilityAtomic } from "./lib/proceduresService";
import { useSessionGuard } from "./lib/useSessionGuard";
import {
  beginSession,
  clearClinicalBrowserCache,
  clearSessionClock,
  clearSessionEndReason,
  persistSessionEndReason,
  type SessionViolation,
} from "./lib/sessionPolicy";

export default function App() {
  const [user, setUser] = useState<{ name: string; crm: string; uf: string; hospital: string; uid?: string } | null>(() => {
    const saved = localStorage.getItem("anesthesia_user");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.uid) return parsed;
      // If no UID (legacy local login), clear it to force real auth
      localStorage.removeItem("anesthesia_user");
    }
    return null;
  });

  const [document, setDocument] = useState<AnesthesiaDocument>(() => {
    // Purge legacy plain localStorage document if present to ensure no clinical data lingers in plain localStorage
    try {
      localStorage.removeItem("anesthesia_doc");
    } catch (e) {}

    // Restore active session copy from sessionStorage only if user is logged in
    const savedUser = localStorage.getItem("anesthesia_user");
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        if (u && u.uid) {
          const sessionSaved = sessionStorage.getItem(`anestflow_active_doc_${u.uid}`);
          if (sessionSaved) {
            const parsed = JSON.parse(sessionSaved);
            if (parsed && parsed.id && parsed.id !== "doc-9281-2026") {
              return parsed;
            }
          }
        }
      } catch (e) {
        console.error("Failed to parse session document.");
      }
    }
    return getBlankDocument();
  });

  const [pendingTemplateForReview, setPendingTemplateForReview] = useState<any>(null);
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
  const [showSaveNotice, setShowSaveNotice] = useState(false);
  const saveNoticeTimer = React.useRef<NodeJS.Timeout | null>(null);
  
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem("anesthesia_app_settings");
    return saved ? { ...DEFAULT_APP_SETTINGS, ...JSON.parse(saved) } : DEFAULT_APP_SETTINGS;
  });

  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showReloadConfirm, setShowReloadConfirm] = useState(false);

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

  // Save active document into UID-isolated sessionStorage ONLY (wiped on tab/session close and logout)
  useEffect(() => {
    // Ensure plain localStorage never retains clinical data
    try {
      localStorage.removeItem("anesthesia_doc");
    } catch (e) {}

    if (user?.uid && document) {
      try {
        sessionStorage.setItem(`anestflow_active_doc_${user.uid}`, JSON.stringify(document));
      } catch (e) {
        console.warn("Could not save session document cache:", e);
      }
    } else {
      try {
        sessionStorage.clear();
      } catch (e) {}
    }
    
    // Determine if we have any intraoperative data
    const hasIntraopData = Boolean(
      document.timers?.startAnesthesia ||
      document.timers?.startSurgery ||
      document.timers?.endSurgery ||
      document.timers?.endAnesthesia ||
      (document.vitals && document.vitals.length > 0) ||
      (document.events && document.events.length > 0) ||
      (document.bolusDrugs && document.bolusDrugs.length > 0) ||
      (document.continuousInfusions && document.continuousInfusions.length > 0) ||
      (document.inhalationAgents && document.inhalationAgents.length > 0) ||
      (document.fluids && document.fluids.length > 0)
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
  }, [document, user?.uid]);

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
          setDocument(getBlankDocument());
          setIsEmailVerified(true);
          return;
        }
        if (supabaseUser) {
          setIsEmailVerified(Boolean(supabaseUser.email_confirmed_at));
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
    setDocument(remoteDoc);
  }, []);

  const syncEngine = useSyncEngine(
    document,
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

  const setDocumentWithBroadcast = (docOrUpdater: React.SetStateAction<AnesthesiaDocument>) => {
    setDocument((prev) => {
      const nextDoc = typeof docOrUpdater === 'function' ? docOrUpdater(prev) : docOrUpdater;
      return nextDoc;
    });
  };

  const handleLogin = (doctor: { name: string; crm: string; uf: string; hospital: string; uid?: string }) => {
    const isNewUser = !user || user.uid !== doctor.uid;
    
    setUser(doctor);
    localStorage.setItem("anesthesia_user", JSON.stringify(doctor));
    beginSession();
    
    if (isNewUser) {
      // Clear all clinical session cache from previous user
      try {
        sessionStorage.clear();
        localStorage.removeItem("anesthesia_doc");
      } catch (e) {}

      // Initialize a fresh blank document specifically for the newly logged-in user.
      // NEVER adopt or auto-assign an existing document from a previous user's session!
      const newBlank = getBlankDocument();
      newBlank.createdByUid = doctor.uid || "";
      newBlank.currentResponsibleUid = doctor.uid || "";
      newBlank.participantUids = doctor.uid ? [doctor.uid] : [];
      newBlank.userId = doctor.uid || "";
      newBlank.patient.hospital = doctor.hospital || appSettings.defaultHospital;
      newBlank.team.anesthesiologistLead = doctor.name || appSettings.defaultAnesthesiologistName;
      newBlank.team.crmLead = doctor.crm || appSettings.defaultCrm;
      newBlank.team.ufLead = doctor.uf;

      setDocument(newBlank);
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
    setDocument(getBlankDocument());
    setActiveTab("patient");
  }, []);

  useSessionGuard(Boolean(user?.uid), (reason) => {
    void handleLogout(reason);
  });

  // Calculate dynamic elapsed timing of the surgery
  const getElapsedAnesthesiaString = () => {
    if (!document.timers.startAnesthesia) return "Não iniciada";
    const start = new Date(document.timers.startAnesthesia).getTime();
    const end = document.timers.endAnesthesia ? new Date(document.timers.endAnesthesia).getTime() : now.getTime();
    
    const diffMs = end - start;
    if (diffMs < 0) return "00:00";
    
    const diffMins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };

  // State modification wrappers
  const updatePatient = (patientData: Partial<PatientInfo>) => {
    if (document.status === "Signed") return; // locked
    setDocumentWithBroadcast(prev => ({
      ...prev,
      patient: { ...prev.patient, ...patientData }
    }));
  };

  const updateTeam = (teamData: Partial<AnesthesiaDocument["team"]>) => {
    if (document.status === "Signed") return; // locked
    setDocumentWithBroadcast(prev => ({
      ...prev,
      team: { ...prev.team, ...teamData }
    }));
  };

  const updatePreEvaluation = (evalData: Partial<PreAnestheticEvaluation>) => {
    if (document.status === "Signed") return; // locked
    setDocumentWithBroadcast(prev => ({
      ...prev,
      preEvaluation: { ...prev.preEvaluation, ...evalData } as any
    }));
  };

  const handleLoadWorklist = async (cpf: string) => {
    const { getFromWorklist } = await import("./lib/worklistService");
    const entry = await getFromWorklist(cpf);
    if (!entry) throw new Error("Paciente não encontrado na Worklist");
    setDocumentWithBroadcast(prev => ({
      ...prev,
      patient: { ...prev.patient, ...entry.patient },
      preEvaluation: { ...prev.preEvaluation, ...entry.preEvaluation }
    }));
  };

  const handleSaveWorklist = async () => {
    const { saveToWorklist } = await import("./lib/worklistService");
    const cpf = document.patient?.cpf;
    if (!cpf) throw new Error("CPF é obrigatório para salvar");
    await saveToWorklist(cpf, document.patient, document.preEvaluation);
  };

  const updateRecovery = (recoveryData: Partial<PostAnesthesiaRecovery>) => {
    if (document.status === "Signed") return; // locked
    setDocumentWithBroadcast(prev => ({
      ...prev,
      recovery: { ...prev.recovery, ...recoveryData }
    }));
  };

  const isCurrentResponsible = !user || !user.uid || !document.currentResponsibleUid || document.currentResponsibleUid === user.uid;

  const updateDocumentDirectly = (updates: Partial<AnesthesiaDocument>) => {
    if (document.status === "Signed") {
      alert("Esta ficha foi encerrada e assinada. Alterações não são permitidas.");
      return;
    }
    if (user && user.uid && document.currentResponsibleUid && document.currentResponsibleUid !== user.uid) {
      alert(`Somente o anestesiologista atualmente responsável (Dr. ${document.team?.anesthesiologistLead || 'Responsável'}) pode editar os dados clínicos.`);
      return;
    }
    if (updates.createdByUid && document.createdByUid && updates.createdByUid !== document.createdByUid) {
      delete updates.createdByUid;
    }
    setDocumentWithBroadcast(prev => ({ ...prev, ...updates }));
  };

  const [isClaiming, setIsClaiming] = useState(false);

  const handleClaimResponsibility = async () => {
    if (!user || !user.uid) {
      alert("É necessário estar autenticado com um e-mail válido para assumir a responsabilidade clínica.");
      return;
    }
    if (document.status === "Signed") {
      alert("Esta ficha foi encerrada e assinada. Alterações não são permitidas.");
      return;
    }

    const currentLead = document.team?.anesthesiologistLead || "outro anestesiologista";
    if (!confirm(`Deseja assumir formalmente a responsabilidade clínica desta ficha (atualmente com Dr(a). ${currentLead})?\n\nVocê (Dr(a). ${user.name}, CRM ${user.crm}/${user.uf}) passará a ser o único profissional autorizado a realizar alterações clínicas.`)) {
      return;
    }

    setIsClaiming(true);
    try {
      if (syncEngine.isOnline && document.id) {
        const updated = await claimResponsibilityAtomic(document.id, {
          uid: user.uid,
          name: user.name,
          crm: user.crm,
          uf: user.uf,
          email: user.hospital // user email if stored
        });
        if (updated) {
          setDocument(updated);
        }
      } else {
        const nowStr = new Date().toISOString();
        const timeStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const outgoingName = document.team?.anesthesiologistLead || "Anestesiologista Anterior";
        const outgoingCRM = document.team?.crmLead || "";
        const outgoingUF = document.team?.ufLead || "SP";

        setDocumentWithBroadcast(prev => ({
          ...prev,
          currentResponsibleUid: user.uid,
          team: {
            ...prev.team,
            anesthesiologistLead: user.name,
            crmLead: user.crm,
            ufLead: user.uf,
            anesthesiologistAssistant: `Anterior: ${outgoingName} (${outgoingCRM}/${outgoingUF})`
          },
          events: [
            ...(prev.events || []),
            {
              id: "evt-trf-" + Date.now().toString(),
              time: timeStr,
              name: `Assunção de Responsabilidade: Dr(a). ${user.name}`,
              category: "Equipe" as const,
              notes: `Responsabilidade clínica assumida por Dr(a). ${user.name} (CRM ${user.crm}/${user.uf}).`
            }
          ],
          updatedAt: nowStr
        }));
      }
      alert(`Você agora é o Anestesiologista Responsável por esta ficha!`);
    } catch (err: any) {
      console.error("Erro ao assumir responsabilidade:", err);
      alert(err?.message || "Ocorreu um erro ao assumir a responsabilidade no servidor.");
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
  }) => {
    if (document.status === "Signed") {
      alert("Esta ficha foi encerrada e não permite alterações.");
      return;
    }

    if (data.immediate && syncEngine.isOnline && document.id && user?.uid) {
      try {
        const updated = await transferResponsibilityAtomic(
          document.id,
          user.uid,
          {
            uid: user.uid,
            name: data.incomingName,
            crm: data.incomingCRM,
            uf: data.incomingUF,
            email: data.incomingEmail
          },
          {
            uid: document.currentResponsibleUid,
            name: data.outgoingName,
            crm: data.outgoingCRM,
            uf: data.outgoingUF
          },
          {
            clinicalConditions: data.clinicalConditions,
            incidentsReported: data.incidentsReported,
            ongoingInfusions: data.ongoingInfusions,
            pendingItems: data.pendingItems
          }
        );
        if (updated) {
          setDocument(updated);
        }
        alert(`Troca de responsabilidade realizada com sucesso! Dr(a). ${data.incomingName} é agora o responsável.`);
        return;
      } catch (err: any) {
        console.error("Erro na transferência atômica:", err);
        alert(err?.message || "Erro ao realizar transferência no servidor.");
        return;
      }
    }

    const nowStr = new Date().toISOString();
    const timeStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const sharedEmails = [...(document.sharedWithEmails || [])];
    if (data.incomingEmail && !sharedEmails.includes(data.incomingEmail)) {
      sharedEmails.push(data.incomingEmail);
    }

    if (data.immediate) {
      const transferRecord: AnesthesiologistTransfer = {
        id: "trf-" + Date.now().toString(),
        timestamp: nowStr,
        outgoingUid: user?.uid || document.currentResponsibleUid || document.createdByUid,
        outgoingName: data.outgoingName,
        outgoingCRM: data.outgoingCRM,
        outgoingUF: data.outgoingUF,
        incomingUid: user?.uid,
        incomingName: data.incomingName,
        incomingCRM: data.incomingCRM,
        incomingUF: data.incomingUF,
        clinicalConditions: data.clinicalConditions,
        incidentsReported: data.incidentsReported,
        ongoingInfusions: data.ongoingInfusions,
        pendingItems: data.pendingItems,
        acceptedAt: nowStr
      };

      const newEvent = {
        id: "evt-trf-" + Date.now().toString(),
        time: timeStr,
        name: `Troca de Responsabilidade Concluída: Dr(a). ${data.outgoingName} ➔ Dr(a). ${data.incomingName}`,
        category: "Equipe" as const,
        notes: `Entrante: CRM ${data.incomingCRM}/${data.incomingUF}. Condição: ${data.clinicalConditions || 'Estável'}. Pendências: ${data.pendingItems || 'Nenhuma'}`
      };

      setDocumentWithBroadcast(prev => {
        const creator = prev.createdByUid || prev.userId || user?.uid || "";
        const outgoing = prev.currentResponsibleUid || user?.uid || "";
        const participants = Array.from(new Set([...(prev.participantUids || []), creator, outgoing, user?.uid || ""]));

        return {
          ...prev,
          createdByUid: creator, // IMMUTABLE
          currentResponsibleUid: user?.uid || prev.currentResponsibleUid, // set new responsible
          participantUids: participants,
          pendingTransfer: undefined,
          team: {
            ...prev.team,
            anesthesiologistLead: data.incomingName,
            crmLead: data.incomingCRM,
            ufLead: data.incomingUF,
            anesthesiologistAssistant: prev.team.anesthesiologistLead ? `Anterior: ${data.outgoingName} (${data.outgoingCRM}/${data.outgoingUF})` : prev.team.anesthesiologistAssistant
          },
          transfers: [...(prev.transfers || []), transferRecord],
          events: [...(prev.events || []), newEvent],
          sharedWithEmails: sharedEmails,
          updatedAt: nowStr
        };
      });

      alert(`Troca de responsabilidade realizada com sucesso! Dr(a). ${data.incomingName} assumiu o caso.`);
    } else {
      const pendingReq: PendingTransfer = {
        id: "pt-" + Date.now().toString(),
        outgoingUid: user?.uid || document.currentResponsibleUid || "",
        outgoingName: data.outgoingName,
        outgoingCRM: data.outgoingCRM,
        outgoingUF: data.outgoingUF,
        incomingName: data.incomingName,
        incomingCRM: data.incomingCRM,
        incomingUF: data.incomingUF,
        incomingEmail: data.incomingEmail,
        clinicalConditions: data.clinicalConditions,
        incidentsReported: data.incidentsReported,
        ongoingInfusions: data.ongoingInfusions,
        pendingItems: data.pendingItems,
        requestedAt: nowStr
      };

      setDocumentWithBroadcast(prev => ({
        ...prev,
        pendingTransfer: pendingReq,
        sharedWithEmails: sharedEmails,
        updatedAt: nowStr
      }));

      alert(`Solicitação de troca de responsabilidade registrada! Aguardando aceite de Dr(a). ${data.incomingName}.`);
    }
  };

  const handleAcceptTransfer = () => {
    if (!document.pendingTransfer) return;
    if (document.status === "Signed") {
      alert("Ficha encerrada e assinada. Alterações não são permitidas.");
      return;
    }

    const pt = document.pendingTransfer;
    const nowStr = new Date().toISOString();
    const timeStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const transferRecord: AnesthesiologistTransfer = {
      id: "trf-" + Date.now().toString(),
      timestamp: nowStr,
      outgoingUid: pt.outgoingUid,
      outgoingName: pt.outgoingName,
      outgoingCRM: pt.outgoingCRM,
      outgoingUF: pt.outgoingUF,
      incomingUid: user?.uid || pt.incomingUid,
      incomingName: user?.name || pt.incomingName,
      incomingCRM: user?.crm || pt.incomingCRM,
      incomingUF: user?.uf || pt.incomingUF,
      clinicalConditions: pt.clinicalConditions,
      incidentsReported: pt.incidentsReported,
      ongoingInfusions: pt.ongoingInfusions,
      pendingItems: pt.pendingItems,
      acceptedAt: nowStr
    };

    const newEvent = {
      id: "evt-trf-" + Date.now().toString(),
      time: timeStr,
      name: `Troca de Responsabilidade Aceita: Dr(a). ${pt.outgoingName} ➔ Dr(a). ${user?.name || pt.incomingName}`,
      category: "Equipe" as const,
      notes: `Aceito por Dr(a). ${user?.name || pt.incomingName} (CRM ${user?.crm || pt.incomingCRM}/${user?.uf || pt.incomingUF}).`
    };

    setDocumentWithBroadcast(prev => {
      const creatorUid = prev.createdByUid || prev.userId || pt.outgoingUid;
      const outgoingUid = pt.outgoingUid;
      const newResponsibleUid = user?.uid || pt.incomingUid || outgoingUid;

      const participantUids = Array.from(new Set([
        ...(prev.participantUids || []),
        creatorUid,
        outgoingUid,
        newResponsibleUid
      ]));

      return {
        ...prev,
        createdByUid: creatorUid, // IMMUTABLE
        currentResponsibleUid: newResponsibleUid, // ATOMIC UPDATE
        participantUids,
        pendingTransfer: undefined,
        team: {
          ...prev.team,
          anesthesiologistLead: user?.name || pt.incomingName,
          crmLead: user?.crm || pt.incomingCRM,
          ufLead: user?.uf || pt.incomingUF,
          anesthesiologistAssistant: `Anterior: ${pt.outgoingName} (${pt.outgoingCRM}/${pt.outgoingUF})`
        },
        transfers: [...(prev.transfers || []), transferRecord],
        events: [...(prev.events || []), newEvent],
        updatedAt: nowStr
      };
    });

    alert(`Você aceitou a transferência e agora é o Anestesiologista Responsável por esta ficha.`);
  };

  const handleCancelTransfer = () => {
    setDocumentWithBroadcast(prev => ({
      ...prev,
      pendingTransfer: undefined,
      updatedAt: new Date().toISOString()
    }));
  };

  const extractNumber = (val: any) => {
    if (val === undefined || val === null) return undefined;
    const parsed = parseFloat(String(val).replace(/,/g, '.').replace(/[^\d.-]/g, ''));
    return isNaN(parsed) ? undefined : parsed;
  };

  const parseDateToYYYYMMDD = (val: string | undefined | null) => {
    if (!val) return undefined;
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }
    const matchDMY = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (matchDMY) {
      const day = matchDMY[1].padStart(2, "0");
      const month = matchDMY[2].padStart(2, "0");
      const year = matchDMY[3];
      return `${year}-${month}-${day}`;
    }
    
    // Suporte a datas escritas por extenso em português (ex: "12 de novembro de 1974")
    const months: { [key: string]: string } = {
      janeiro: "01", fev: "02", fevereiro: "02", mar: "03", marco: "03", março: "03",
      abr: "04", abril: "04", mai: "05", maio: "05", jun: "06", junho: "06",
      jul: "07", julho: "07", ago: "08", agosto: "08", set: "09", setembro: "09",
      out: "10", outubro: "10", nov: "11", novembro: "11", dez: "12", dezembro: "12"
    };
    
    const textMatch = str.toLowerCase().match(/^(\d{1,2})\s+(?:de\s+)?([a-zçáéíóú]+)\s+(?:de\s+)?(\d{4})$/i);
    if (textMatch) {
      const day = textMatch[1].padStart(2, "0");
      const monthStr = textMatch[2];
      const year = textMatch[3];
      const monthNum = months[monthStr];
      if (monthNum) {
        return `${year}-${monthNum}-${day}`;
      }
    }
    
    // Se for formato ISO completo (ex: "1974-11-12T00:00:00.000Z")
    if (str.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.slice(0, 10);
    }

    return str;
  };

  const sanitizeVoiceCommand = (actions: any) => {
    if (!actions || typeof actions !== 'object') return null;

    const result: any = {};
    let hasValidData = false;

    if (Array.isArray(actions.templates) && actions.templates.length > 0) {
      result.templates = actions.templates;
      hasValidData = true;
    }
    if (actions.patient && typeof actions.patient === 'object' && Object.keys(actions.patient).length > 0) {
      result.patient = actions.patient;
      hasValidData = true;
    }
    if (actions.timers && typeof actions.timers === 'object' && Object.keys(actions.timers).length > 0) {
      result.timers = actions.timers;
      hasValidData = true;
    }
    if (Array.isArray(actions.bolusDrugs) && actions.bolusDrugs.length > 0) {
      result.bolusDrugs = actions.bolusDrugs;
      hasValidData = true;
    }
    if (Array.isArray(actions.continuousInfusions) && actions.continuousInfusions.length > 0) {
      result.continuousInfusions = actions.continuousInfusions;
      hasValidData = true;
    }
    if (actions.vitals && typeof actions.vitals === 'object' && Object.keys(actions.vitals).length > 0) {
      result.vitals = actions.vitals;
      hasValidData = true;
    }
    if (Array.isArray(actions.events) && actions.events.length > 0) {
      result.events = actions.events;
      hasValidData = true;
    }

    return hasValidData ? result : null;
  };

  const handleVoiceCommand = (actions: any) => {
    console.log("[Diagnostic] Received voice command actions:", actions);
    const sanitized = sanitizeVoiceCommand(actions);
    if (!sanitized) {
      console.log("[Diagnostic] No valid actions to process from voice command.");
      return;
    }

    if (sanitized.templates) {
      console.log("[Diagnostic] Processing templates request:", sanitized.templates);
      try {
        const stored = localStorage.getItem("anesthesia_templates");
        let allTemplates: any[] = [...PRESET_TEMPLATES];
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              allTemplates = [...allTemplates, ...parsed];
            }
          } catch (err) {}
        }
        
        const requestedName = sanitized.templates[0];
        const nameStr = typeof requestedName === "string" ? requestedName : (requestedName?.name || "");
        const template = allTemplates.find(t => {
          if (!t?.name || !nameStr) return false;
          const removeAccents = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const tName = removeAccents(t.name.toLowerCase());
          const reqName = removeAccents(nameStr.toLowerCase());
          
          if (reqName.includes("cesarea") && tName.includes("cesariana")) return true;
          if (reqName.includes("cesariana") && tName.includes("cesarea")) return true;
          const isMatch = tName.includes(reqName) || reqName.includes(tName);
          if (isMatch) return true;
          const reqWords = reqName.split(" ").filter(w => w.length > 3);
          const tWords = tName.split(" ").filter(w => w.length > 3);
          if (reqWords.some(rw => tWords.some(tw => tw.includes(rw) || rw.includes(tw)))) return true;
          return false;
        });

        if (template) {
          console.log("[Diagnostic] Setting template:", template.name);
          setPendingTemplateForReview(template);
          setActiveTab("intra");
        } else {
          console.log("[Diagnostic] Template not found for:", nameStr);
        }
      } catch (e) {
        console.error("Error handling template from voice:", e);
      }
    }

    const hasDocUpdates = sanitized.patient || sanitized.timers || sanitized.bolusDrugs || sanitized.continuousInfusions || sanitized.vitals || sanitized.events;

    if (!hasDocUpdates) return;

    try {
      setDocumentWithBroadcast((prev) => {
        if (prev.status === "Signed") {
          console.warn("Document is signed. Voice updates ignored.");
          return prev;
        }
        let newDoc = { ...prev };
        
        if (sanitized.patient) {
          const getPatientProp = (keys: string[]) => {
            for (const key of keys) {
              if (sanitized.patient[key] !== undefined && sanitized.patient[key] !== null) {
                return sanitized.patient[key];
              }
            }
            return undefined;
          };

          const rawFullName = getPatientProp(["fullName", "fullname", "full_name", "nome", "nome_completo", "nomeCompleto"]);
          const rawDob = getPatientProp(["dob", "birthDate", "birthdate", "birth_date", "data_nascimento", "dataNascimento", "nascimento"]);
          const rawAge = getPatientProp(["age", "idade"]);
          const rawWeight = getPatientProp(["weight", "peso"]);
          const rawRecordNumber = getPatientProp(["recordNumber", "recordnumber", "record_number", "prontuario", "prontuário", "numero_prontuario", "num_prontuario", "numero", "número"]);
          const rawAdmissionNumber = getPatientProp(["admissionNumber", "admissionnumber", "admission_number", "atendimento", "numero_atendimento", "num_atendimento", "atendimentos"]);
          const rawBed = getPatientProp(["bed", "leito", "quarto"]);

          const parsedDob = parseDateToYYYYMMDD(rawDob);
          const newAge = rawAge !== undefined && rawAge !== null 
            ? extractNumber(rawAge) 
            : (parsedDob ? calculateAge(parsedDob) : undefined);
          const newWeight = extractNumber(rawWeight);

          newDoc.patient = {
            ...newDoc.patient,
            ...(rawFullName !== undefined && rawFullName !== null && { fullName: String(rawFullName) }),
            ...(newAge !== undefined && { age: newAge }),
            ...(newWeight !== undefined && { weight: newWeight }),
            ...(rawRecordNumber !== undefined && rawRecordNumber !== null && { recordNumber: String(rawRecordNumber) }),
            ...(rawAdmissionNumber !== undefined && rawAdmissionNumber !== null && { admissionNumber: String(rawAdmissionNumber) }),
            ...(rawBed !== undefined && rawBed !== null && { bed: String(rawBed) }),
            ...(parsedDob && { birthDate: parsedDob }),
          };
        }

        if (sanitized.timers) {
          newDoc.timers = { ...newDoc.timers };
          const now = new Date();
          if (sanitized.timers.startAnesthesia) {
            newDoc.timers.startAnesthesia = now.toISOString();
            newDoc.events = [
              ...(newDoc.events || []),
              {
                id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
                timestamp: now.toISOString(),
                minutesFromStart: 0,
                category: 'Marcador Temporal',
                name: 'Início Anestesia'
              }
            ];
          }
          if (sanitized.timers.startSurgeryMinutes !== undefined && sanitized.timers.startSurgeryMinutes !== null) {
            const futureTime = new Date(now.getTime() + sanitized.timers.startSurgeryMinutes * 60000);
            newDoc.timers.startSurgery = futureTime.toISOString();
            newDoc.events = [
              ...(newDoc.events || []),
              {
                id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
                timestamp: futureTime.toISOString(),
                minutesFromStart: newDoc.timers.startAnesthesia ? Math.floor((futureTime.getTime() - new Date(newDoc.timers.startAnesthesia).getTime()) / 60000) : 0,
                category: 'Marcador Temporal',
                name: 'Início Cirurgia'
              }
            ];
          } else if (sanitized.timers.startSurgery) {
            newDoc.timers.startSurgery = now.toISOString();
            newDoc.events = [
              ...(newDoc.events || []),
              {
                id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
                timestamp: now.toISOString(),
                minutesFromStart: newDoc.timers.startAnesthesia ? Math.floor((now.getTime() - new Date(newDoc.timers.startAnesthesia).getTime()) / 60000) : 0,
                category: 'Marcador Temporal',
                name: 'Início Cirurgia'
              }
            ];
          }
          if (sanitized.timers.endSurgery) {
            newDoc.timers.endSurgery = now.toISOString();
            newDoc.events = [
              ...(newDoc.events || []),
              {
                id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
                timestamp: now.toISOString(),
                minutesFromStart: newDoc.timers.startAnesthesia ? Math.floor((now.getTime() - new Date(newDoc.timers.startAnesthesia).getTime()) / 60000) : 0,
                category: 'Marcador Temporal',
                name: 'Fim Cirurgia'
              }
            ];
          }
          if (sanitized.timers.endAnesthesia) {
            newDoc.timers.endAnesthesia = now.toISOString();
            newDoc.events = [
              ...(newDoc.events || []),
              {
                id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
                timestamp: now.toISOString(),
                minutesFromStart: newDoc.timers.startAnesthesia ? Math.floor((now.getTime() - new Date(newDoc.timers.startAnesthesia).getTime()) / 60000) : 0,
                category: 'Marcador Temporal',
                name: 'Fim Anestesia'
              }
            ];
          }
        }

        const targetMins = selectedMinutes !== null ? selectedMinutes : (prev.timers.startAnesthesia ? Math.floor((Date.now() - new Date(prev.timers.startAnesthesia).getTime()) / 60000) : 0);

        if (sanitized.bolusDrugs) {
          newDoc.bolusDrugs = [
            ...(newDoc.bolusDrugs || []),
            ...sanitized.bolusDrugs.map((d: any) => ({
              id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
              timestamp: new Date().toISOString(),
              minutesFromStart: targetMins,
              name: String(d.name || ''),
              dose: extractNumber(d.dose) || 0,
              unit: String(d.unit || 'mg'),
              route: String(d.route || 'EV'),
            }))
          ];
        }
        
        if (sanitized.continuousInfusions) {
          newDoc.continuousInfusions = [
            ...(newDoc.continuousInfusions || []),
            ...sanitized.continuousInfusions.map((d: any) => ({
              id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
              name: String(d.name || ''),
              concentration: "1", 
              diluent: "",
              totalVolumePrepared: 100,
              unit: String(d.rateUnit || 'mcg/kg/min'),
              history: [{
                timestamp: new Date().toISOString(),
                minutesFromStart: targetMins,
                rate: extractNumber(d.rate) || 0,
                status: "Iniciado"
              }]
            }))
          ];
        }

        if (sanitized.vitals) {
          const snappedMinutes = prev.timers.startAnesthesia ? Math.round(Math.floor((Date.now() - new Date(prev.timers.startAnesthesia).getTime()) / 60000) / 5) * 5 : 0;
          const mins = selectedMinutes !== null ? selectedMinutes : Math.max(0, snappedMinutes);
          
          const vitalsUpdate: any = {
            ...(sanitized.vitals.hr && { fc: Number(sanitized.vitals.hr) }),
            ...(sanitized.vitals.systolic && { pas: Number(sanitized.vitals.systolic) }),
            ...(sanitized.vitals.diastolic && { pad: Number(sanitized.vitals.diastolic) }),
            ...(sanitized.vitals.spo2 && { spo2: Number(sanitized.vitals.spo2) }),
            ...(sanitized.vitals.etco2 && { etco2: Number(sanitized.vitals.etco2) }),
            ...(sanitized.vitals.temp && { temp: Number(sanitized.vitals.temp) })
          };

          const existingVitals = [...(newDoc.vitals || [])];
          const existingIndex = existingVitals.findIndex(v => v.minutesFromStart === mins);

          let finalPas = vitalsUpdate.pas;
          let finalPad = vitalsUpdate.pad;
          if (existingIndex >= 0) {
            if (finalPas === undefined) finalPas = existingVitals[existingIndex].pas;
            if (finalPad === undefined) finalPad = existingVitals[existingIndex].pad;
          }
          if (finalPas !== undefined && finalPad !== undefined) {
            vitalsUpdate.pam = Math.round(finalPad + (finalPas - finalPad) / 3);
          }

          if (existingIndex >= 0) {
            existingVitals[existingIndex] = {
              ...existingVitals[existingIndex],
              ...vitalsUpdate
            };
            newDoc.vitals = existingVitals;
          } else {
            newDoc.vitals = [
              ...existingVitals,
              {
                id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
                timestamp: new Date().toISOString(),
                minutesFromStart: mins,
                ...vitalsUpdate
              }
            ];
          }
        }

        if (sanitized.events) {
          newDoc.events = [
            ...(newDoc.events || []),
            ...sanitized.events.map((e: any) => ({
              id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
              timestamp: new Date().toISOString(),
              minutesFromStart: targetMins,
              category: String(e.category || 'Outro'),
              name: String(e.name || '')
            }))
          ];
        }

        return newDoc;
      });
    } catch (err) {
      console.error("Failed to process voice command in state:", err);
    }
  };

  const triggerResetToBlank = () => {
    setShowResetConfirm(true);
  };

  const handleResetToBlankConfirm = () => {
    setShowResetConfirm(false);
    const blank = getBlankDocument();
    if (user) {
      blank.team.anesthesiologistLead = user.name;
      blank.team.crmLead = user.crm;
      blank.team.ufLead = user.uf;
      blank.patient.hospital = user.hospital;
    }
    setDocumentWithBroadcast(blank);
    setActiveTab("patient");
  };

  const handleCloseProcedure = async () => {
    if (!user || !user.uid) {
      alert("Usuário não autenticado. É necessário estar logado para assinar a ficha.");
      return;
    }

    try {
      const { signAndLockDocument } = await import("./lib/signatureService");
      const closedDoc = await signAndLockDocument(document, {
        uid: user.uid,
        name: user.name,
        crm: user.crm,
        uf: user.uf,
        email: user.hospital
      });

      const { saveProcedure } = await import("./lib/proceduresService");
      await saveProcedure(closedDoc, user.uid);
      
      alert(`Procedimento encerrado com sucesso!\n\nAssinatura Digital SHA-256:\n${closedDoc.hash}\n\nO documento está homologado e imutável no servidor.`);
      setDocumentWithBroadcast(closedDoc);
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
    const mockDoc = getMockDocument();
    if (user) {
      mockDoc.team.anesthesiologistLead = user.name;
      mockDoc.team.crmLead = user.crm;
      mockDoc.team.ufLead = user.uf;
      mockDoc.patient.hospital = user.hospital;
    }
    setDocumentWithBroadcast(mockDoc);
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
              {document.status === "Signed" ? (
                <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Assinado
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
              {document.patient?.fullName || "Sem Identificação"}
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 truncate">
              <span>{document.patient?.age ? `${document.patient?.age}a` : "—"}</span>
              <span>•</span>
              <span>{document.patient?.weight ? `${document.patient?.weight}kg` : "—"}</span>
              <span>•</span>
              <span className="truncate">{document.patient?.hospital || "—"}</span>
            </div>
          </div>

          {/* TEMPO E STATUS */}
          <div className="flex flex-col items-end shrink-0">
            <div className="text-lg font-semibold tabular-nums leading-none mb-1">
              {getElapsedAnesthesiaString()}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <div className={`w-2 h-2 rounded-full ${document.timers.startAnesthesia ? "bg-emerald-500 animate-pulse" : "bg-zinc-300 dark:bg-zinc-600"}`}></div>
              <span className="text-zinc-600 dark:text-zinc-400">
                {document.timers.startAnesthesia ? "Anestesia em andamento" : "Aguardando início"}
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
              <button 
                onClick={() => setShowPrintModal(true)} 
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-sm font-medium transition-colors flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">PDF</span>
              </button>
              <button 
                onClick={() => setShowShareModal(true)} 
                disabled={!document.userId}
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
                      <button type="button" role="menuitem" onClick={() => { setOverflowMenuOpen(false); triggerReloadMockData(); }} className="px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Modelo Exemplo
                      </button>
                      <button type="button" role="menuitem" onClick={() => { setOverflowMenuOpen(false); triggerResetToBlank(); }} className="px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2 text-rose-600 dark:text-rose-400">
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

      {/* 2. SUB-BANNER / WARNING BAR (E.G. ALERT IF LOCKED) */}
      {document.status === "Signed" && (
        <div className={`border-b px-3 sm:px-5 py-1.5 sm:py-2 text-center text-xs sm:text-xs font-bold flex items-center justify-center gap-1.5 sm:gap-2 ${
          isDark ? "bg-indigo-950/20 border-indigo-900/50 text-indigo-300" : "bg-indigo-50 border-indigo-100 text-indigo-900"
        }`}>
          <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500 shrink-0" />
          <span className="truncate">Ficha assinada. Modificações apenas via adendo.</span>
        </div>
      )}



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
          {document.pendingTransfer && (
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
                    <strong>Dr(a). {document.pendingTransfer.outgoingName}</strong> solicitou a transferência do caso para <strong>Dr(a). {document.pendingTransfer.incomingName}</strong> (CRM {document.pendingTransfer.incomingCRM}/{document.pendingTransfer.incomingUF}).
                  </p>
                  <p className="text-xs opacity-75 mt-1">
                    Condições: {document.pendingTransfer.clinicalConditions || 'Estável'} | Pendências: {document.pendingTransfer.pendingItems || 'Nenhuma'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <button
                  onClick={handleCancelTransfer}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                    isDark ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300" : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-300"
                  }`}
                >
                  Recusar
                </button>
                <button
                  onClick={handleAcceptTransfer}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Aceitar e Assumir Ficha
                </button>
              </div>
            </div>
          )}

          {!isCurrentResponsible && document.status !== "Signed" && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-400 text-xs font-semibold flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 shrink-0 text-amber-500" />
                <span>
                  <strong>Modo de Leitura (Visualização):</strong> Você está visualizando a ficha sob responsabilidade do Dr(a). {document.team?.anesthesiologistLead || "outro anestesiologista"}. Apenas o responsável atual pode editar os dados clínicos.
                </span>
              </div>
              <button
                onClick={() => setShowTransferModal(true)}
                className="px-3 py-1 text-xs font-bold text-amber-900 dark:text-amber-100 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg shrink-0 transition"
              >
                Solicitar Troca
              </button>
            </div>
          )}

          {document.status === "Signed" && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center justify-center gap-2 shadow-sm">
              <Lock className="w-4 h-4 shrink-0" />
              <span>ESTA FICHA FOI ENCERRADA E ASSINADA — ALTERAÇÕES CLÍNICAS BLOQUEADAS PARA TODOS OS USUÁRIOS</span>
            </div>
          )}

          {activeTab === "patient" && (
            <PatientTab
              document={document}
              onChangePatient={updatePatient}
              onChangeTeam={updateTeam}
              onLoadWorklist={handleLoadWorklist}
              onSaveWorklist={handleSaveWorklist}
              theme={theme}
              user={user}
              onOpenTransferModal={() => setShowTransferModal(true)}
            />
          )}

          {activeTab === "preop" && (
            <PreEvaluationTab
              document={document}
              onChange={updatePreEvaluation}
              theme={theme}
            />
          )}

          {activeTab === "intra" && (
            <IntraoperativeTab
              document={document}
              onUpdateDocument={updateDocumentDirectly}
              selectedMinutes={selectedMinutes}
              onTimeSelect={setSelectedMinutes}
              theme={theme}
              pendingTemplateForReview={pendingTemplateForReview}
              onClearPendingTemplate={() => setPendingTemplateForReview(null)}
              startAiSupervisor={startAiSupervisor}
              stopAiSupervisor={stopAiSupervisor}
            />
          )}

          {activeTab === "recovery" && (
            <RecoveryTab
              document={document}
              onUpdateRecovery={updateRecovery}
              theme={theme}
            />
          )}

          {activeTab === "review" && (
            <ReviewTab
              document={document}
              onUpdateDocument={updateDocumentDirectly}
              onCloseProcedure={handleCloseProcedure}
              theme={theme}
              startAiSupervisor={startAiSupervisor}
              stopAiSupervisor={stopAiSupervisor}
              onOpenTransferModal={() => setShowTransferModal(true)}
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
        document={document}
      />

      {/* CLOUD PROCEDURES PERSISTENCE MANAGER MODAL */}
      <ProceduresManagerModal
        isOpen={showProceduresModal}
        onClose={() => setShowProceduresModal(false)}
        currentDocument={document}
        onLoadDocument={(loadedDoc) => {
          setDocument(loadedDoc);
          setActiveTab("patient");
        }}
        userId={user?.uid || ""}
        isDark={isDark}
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

      {showShareModal && document.userId && (
        <ShareModal
          document={document}
          isDark={isDark}
          onClose={() => setShowShareModal(false)}
          onUpdateDocument={updateDocumentDirectly}
          isSyncing={syncEngine.isOnline}
          toggleSync={syncEngine.retrySyncNow}
          onOpenTransferModal={() => setShowTransferModal(true)}
        />
      )}

      {showTransferModal && (
        <TransferResponsibilityModal
          document={document}
          isDark={isDark}
          onClose={() => setShowTransferModal(false)}
          onConfirmTransfer={handleConfirmTransfer}
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

    </div>
  );
}
