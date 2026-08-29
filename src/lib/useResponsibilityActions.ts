import { useState } from "react";
import {
  assumeResponsibilityAtomic,
  claimResponsibilityAtomic,
  declinePendingTransferAtomic,
  requestTransferAtomic,
  resolveIncomingDoctorByEmail,
  transferResponsibilityAtomic
} from "./proceduresService";
import { mapClinicalError } from "./clinicalErrors";
import { canEditDocument } from "./assertCanEdit";
import { isUuid } from "./procedureMapper";
import type { AnesthesiaDocument } from "../types";
import type { SessionUser } from "./sessionUser";

export function useResponsibilityActions(options: {
  ficha: AnesthesiaDocument;
  setFicha: (doc: AnesthesiaDocument) => void;
  user: SessionUser | null;
  isOnline: boolean;
}) {
  const { ficha, setFicha, user, isOnline } = options;
  const [isClaiming, setIsClaiming] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAssumeModal, setShowAssumeModal] = useState(false);

  const requireCloudProcedure = (action: string): boolean => {
    if (!isOnline) {
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

  return {
    isClaiming,
    showTransferModal,
    setShowTransferModal,
    showAssumeModal,
    setShowAssumeModal,
    handleClaimResponsibility,
    handleConfirmAssume,
    handleConfirmTransfer,
    handleAcceptTransfer,
    handleCancelTransfer
  };
}
