import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import {
  AnesthesiaDocument,
  AnesthesiaDocumentPatch,
  PatientInfo,
  PostAnesthesiaRecovery,
  PreAnestheticEvaluation
} from "../types";
import { getBlankDocument, getMockDocument } from "../mockData";
import type { AppSettings } from "./appSettings";
import { assignNewDocumentOwner, canEditDocument, isClinicalEditor } from "./assertCanEdit";
import { activeDocSessionKey, purgeClinicalPhiFromLocalStorage } from "./clinicalStorageKeys";
import { needsSignatureStepUp, readSessionClock } from "./sessionPolicy";
import { withInProgressIfAnesthesiaStarted } from "./procedureStatus";
import type { SessionUser } from "./sessionUser";

export function useClinicalDocument(options: {
  user: SessionUser | null;
  appSettings: AppSettings;
  requestSignatureLock: () => void;
}) {
  const { user, appSettings, requestSignatureLock } = options;

  const [ficha, setFicha] = useState<AnesthesiaDocument>(() => {
    purgeClinicalPhiFromLocalStorage();
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

  const [showSaveNotice, setShowSaveNotice] = useState(false);
  const saveNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const setFichaWithBroadcast = (docOrUpdater: SetStateAction<AnesthesiaDocument>) => {
    setFicha((prev) => {
      const nextDoc = typeof docOrUpdater === "function" ? docOrUpdater(prev) : docOrUpdater;
      return withInProgressIfAnesthesiaStarted(nextDoc);
    });
  };

  const updatePatient = (patientData: Partial<PatientInfo>) => {
    if (!isClinicalEditor(ficha, user?.uid)) return;
    setFichaWithBroadcast((prev) => ({
      ...prev,
      patient: { ...prev.patient, ...patientData }
    }));
  };

  const updateTeam = (teamData: Partial<AnesthesiaDocument["team"]>) => {
    if (!isClinicalEditor(ficha, user?.uid)) return;
    setFichaWithBroadcast((prev) => ({
      ...prev,
      team: { ...prev.team, ...teamData }
    }));
  };

  const updatePreEvaluation = (evalData: Partial<PreAnestheticEvaluation>) => {
    if (!isClinicalEditor(ficha, user?.uid)) return;
    setFichaWithBroadcast((prev) => ({
      ...prev,
      preEvaluation: { ...prev.preEvaluation, ...evalData } as any
    }));
  };

  const updateRecovery = (
    recoveryData:
      | Partial<PostAnesthesiaRecovery>
      | ((prev: PostAnesthesiaRecovery) => Partial<PostAnesthesiaRecovery>)
  ) => {
    if (!isClinicalEditor(ficha, user?.uid)) return;
    setFichaWithBroadcast((prev) => {
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
    setFichaWithBroadcast((prev) => {
      const resolved = typeof updates === "function" ? updates(prev) : { ...updates };
      if (resolved.createdByUid && prev.createdByUid && resolved.createdByUid !== prev.createdByUid) {
        delete resolved.createdByUid;
      }
      return { ...prev, ...resolved };
    });
  };

  const handleLoadWorklist = async (cpf: string) => {
    const gate = canEditDocument(ficha, user?.uid);
    if (gate.ok === false) {
      throw new Error(gate.message);
    }
    const { getFromWorklist } = await import("./worklistService");
    const entry = await getFromWorklist(cpf);
    if (!entry) throw new Error("Paciente não encontrado na Worklist");
    setFichaWithBroadcast((prev) => ({
      ...prev,
      patient: { ...prev.patient, ...entry.patient },
      preEvaluation: { ...prev.preEvaluation, ...entry.preEvaluation }
    }));
  };

  const handleSaveWorklist = async () => {
    const gate = canEditDocument(ficha, user?.uid);
    if (gate.ok === false) throw new Error(gate.message);
    const { saveToWorklist } = await import("./worklistService");
    const cpf = ficha.patient?.cpf;
    if (!cpf) throw new Error("CPF é obrigatório para salvar");
    await saveToWorklist(cpf, ficha.patient, ficha.preEvaluation);
  };

  const startBlankForUser = useCallback((doctor: SessionUser) => {
    const newBlank = assignNewDocumentOwner(getBlankDocument(), doctor.uid || "");
    newBlank.patient.hospital = doctor.hospital || appSettings.defaultHospital;
    newBlank.team.anesthesiologistLead = doctor.name || appSettings.defaultAnesthesiologistName;
    newBlank.team.crmLead = doctor.crm || appSettings.defaultCrm;
    newBlank.team.ufLead = doctor.uf;
    setFicha(newBlank);
  }, [appSettings.defaultHospital, appSettings.defaultAnesthesiologistName, appSettings.defaultCrm]);

  const clearToBlankDocument = useCallback(() => {
    setFicha(getBlankDocument());
  }, []);

  const handleResetToBlankConfirm = () => {
    let blank = getBlankDocument();
    if (user?.uid) blank = assignNewDocumentOwner(blank, user.uid);
    if (user) {
      blank.team.anesthesiologistLead = user.name;
      blank.team.crmLead = user.crm;
      blank.team.ufLead = user.uf;
      blank.patient.hospital = user.hospital;
    }
    setFichaWithBroadcast(blank);
  };

  const handleReloadMockDataConfirm = () => {
    let mockDoc = getMockDocument();
    if (user?.uid) mockDoc = assignNewDocumentOwner(mockDoc, user.uid);
    if (user) {
      mockDoc.team.anesthesiologistLead = user.name;
      mockDoc.team.crmLead = user.crm;
      mockDoc.team.ufLead = user.uf;
      mockDoc.patient.hospital = user.hospital;
    }
    setFichaWithBroadcast(mockDoc);
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
      requestSignatureLock();
      return;
    }

    try {
      const { saveProcedure, closeProcedureAtomic } = await import("./proceduresService");
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

  const loadCloudFicha = useCallback((loadedDoc: AnesthesiaDocument) => {
    setFicha(withInProgressIfAnesthesiaStarted(loadedDoc));
  }, []);

  return {
    ficha,
    setFicha,
    setFichaWithBroadcast,
    showSaveNotice,
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
  };
}
