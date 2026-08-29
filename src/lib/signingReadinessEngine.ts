import type { AnesthesiaDocument, AnesthesiaTechnique } from "../types";

export type SigningReadinessLevel = "CRITICAL" | "IMPORTANT" | "INFO";

export type SigningReadinessAlert = {
  level: SigningReadinessLevel;
  /** Rótulo da UI existente em ReviewTab. */
  type: "Critico" | "Importante" | "Informativo";
  title: string;
  description: string;
  module: string;
};

export type SigningReadiness = {
  alerts: SigningReadinessAlert[];
  canClose: boolean;
  criticalCount: number;
};

const LEVEL_TO_TYPE: Record<SigningReadinessLevel, SigningReadinessAlert["type"]> = {
  CRITICAL: "Critico",
  IMPORTANT: "Importante",
  INFO: "Informativo",
};

function alert(
  level: SigningReadinessLevel,
  title: string,
  description: string,
  module: string
): SigningReadinessAlert {
  return { level, type: LEVEL_TO_TYPE[level], title, description, module };
}

export function hasSelectedAnestheticTechnique(
  technique: AnesthesiaTechnique | undefined | null
): boolean {
  if (!technique) return false;
  return Boolean(
    technique.generalIV ||
      technique.generalInhalational ||
      technique.balanced ||
      technique.sedation ||
      technique.local ||
      technique.spinal ||
      technique.epidural ||
      technique.combinedSpinalEpidural ||
      technique.regionalPeripheralBlock ||
      technique.regionalIV ||
      (typeof technique.other === "string" && technique.other.trim().length > 0)
  );
}

function infusionStillActive(status: string | undefined): boolean {
  return status === "Iniciado" || status === "Alterado";
}

/**
 * Critérios mínimos de encerramento, com contexto.
 * Capnografia NÃO é bloqueio universal (depende da técnica).
 */
export function evaluateSigningReadiness(
  ficha: AnesthesiaDocument
): SigningReadiness {
  const alerts: SigningReadinessAlert[] = [];
  const t = ficha.timers || {};
  const p = ficha.patient;
  const team = ficha.team;

  if (!t.startAnesthesia) {
    alerts.push(
      alert(
        "CRITICAL",
        "Início de Anestesia Pendente",
        "O horário de início da anestesia deve ser obrigatoriamente preenchido.",
        "Timing"
      )
    );
  }
  if (!t.endAnesthesia) {
    alerts.push(
      alert(
        "CRITICAL",
        "Término de Anestesia Pendente",
        "O horário de término da anestesia deve ser preenchido antes do encerramento.",
        "Timing"
      )
    );
  }
  if (t.startAnesthesia && t.endAnesthesia && new Date(t.endAnesthesia) < new Date(t.startAnesthesia)) {
    alerts.push(
      alert(
        "CRITICAL",
        "Incongruência de Anestesia",
        "O término da anestesia não pode ser anterior ao início da mesma.",
        "Timing"
      )
    );
  }
  if (t.startAnesthesia && t.startSurgery && new Date(t.startSurgery) < new Date(t.startAnesthesia)) {
    alerts.push(
      alert(
        "CRITICAL",
        "Incongruência Cronológica",
        "O início da cirurgia não pode ser anterior ao início da anestesia.",
        "Timing"
      )
    );
  }
  if (t.endSurgery && t.startSurgery && new Date(t.endSurgery) < new Date(t.startSurgery)) {
    alerts.push(
      alert(
        "CRITICAL",
        "Incongruência de Cirurgia",
        "O término da cirurgia não pode ser anterior ao início da mesma.",
        "Timing"
      )
    );
  }

  if (!p?.fullName || p.fullName.trim().length < 5) {
    alerts.push(
      alert(
        "CRITICAL",
        "Nome do Paciente Incompleto",
        "O nome completo do paciente deve ser fornecido para fins de identificação.",
        "Patient"
      )
    );
  }

  if (!ficha.currentResponsibleUid) {
    alerts.push(
      alert(
        "CRITICAL",
        "Responsável não definido",
        "A ficha precisa de um anestesiologista responsável autenticado antes do encerramento.",
        "Team"
      )
    );
  }

  if (!team?.anesthesiologistLead || !team?.crmLead) {
    alerts.push(
      alert(
        "CRITICAL",
        "Anestesiologista não cadastrado",
        "O nome e o CRM do anestesiologista principal responsável devem estar preenchidos.",
        "Team"
      )
    );
  }

  if (ficha.pendingTransfer) {
    alerts.push(
      alert(
        "CRITICAL",
        "Transferência pendente",
        "Há uma solicitação de transferência de responsabilidade em aberto. Aceite, recuse ou conclua a transferência antes de selar a ficha.",
        "Team"
      )
    );
  }

  if (!p?.recordNumber) {
    alerts.push(
      alert(
        "IMPORTANT",
        "Número de Prontuário Ausente",
        "O prontuário é um dado legal essencial para incorporação ao prontuário hospitalar.",
        "Patient"
      )
    );
  }
  if (!p?.weight || p.weight <= 0) {
    alerts.push(
      alert(
        "IMPORTANT",
        "Peso não cadastrado",
        "O peso do paciente é fundamental para cálculos de dosagem de medicamentos e ventilação.",
        "Patient"
      )
    );
  }

  if (!hasSelectedAnestheticTechnique(ficha.technique)) {
    alerts.push(
      alert(
        "IMPORTANT",
        "Técnica anestésica não registrada",
        "Registre a técnica efetivamente utilizada. Ausência permanece ausência — nenhuma técnica é presumida.",
        "Technique"
      )
    );
  }

  if (!ficha.vitals || ficha.vitals.length === 0) {
    alerts.push(
      alert(
        "IMPORTANT",
        "Sem Sinais Vitais Lançados",
        "Nenhum sinal vital foi anotado durante o intraoperatório na ficha gráfica.",
        "Vitals"
      )
    );
  }

  const openInfusions = (ficha.continuousInfusions || []).filter((inf) => {
    const hist = inf.history || [];
    const lastHist = hist[hist.length - 1];
    return lastHist && lastHist.status !== "Finalizado" && infusionStillActive(lastHist.status);
  });
  if (openInfusions.length > 0) {
    alerts.push(
      alert(
        "IMPORTANT",
        "Infusões Contínuas Ativas",
        "Existem bombas de infusão ativas que não foram finalizadas. Recomenda-se fechar todas ao término do procedimento.",
        "Drugs"
      )
    );
  }

  if (!ficha.bolusDrugs || ficha.bolusDrugs.length === 0) {
    alerts.push(
      alert(
        "INFO",
        "Sem Medicamentos em Bolus",
        "Não há registro de medicamentos administrados em bolus durante o procedimento.",
        "Drugs"
      )
    );
  }

  if (t.startAnesthesia && !ficha.recovery?.admissionTime && !ficha.recovery?.dischargeDestination) {
    alerts.push(
      alert(
        "INFO",
        "Recuperação sem registro de admissão",
        "Não há admissão na recuperação nem destino de alta preenchido. Não é bloqueio universal: o destino depende do caso.",
        "Recovery"
      )
    );
  }

  const criticalCount = alerts.filter((a) => a.level === "CRITICAL").length;
  return {
    alerts,
    canClose: criticalCount === 0,
    criticalCount,
  };
}
