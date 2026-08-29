import type { AnesthesiaDocument } from "../types";

const PATIENT_STRIP = [
  "id",
  "cpf",
  "fullName",
  "socialName",
  "admissionNumber",
  "recordNumber",
  "hospital",
  "unit",
  "sector",
  "operatingRoom",
  "bed",
  "email"
] as const;

function omitKeys<T extends Record<string, unknown>>(obj: T, keys: readonly string[]): Record<string, unknown> {
  const next: Record<string, unknown> = { ...obj };
  for (const key of keys) delete next[key];
  return next;
}

/**
 * Contexto clínico para IA: sem CPF, prontuário, leito, e-mail nem UIDs.
 * A ficha viva no React não é alterada.
 */
export function toAIClinicalContext(
  ficha: AnesthesiaDocument
): Record<string, unknown> {
  const patient = omitKeys(
    { ...(ficha.patient as unknown as Record<string, unknown>) },
    PATIENT_STRIP
  );
  return {
    status: ficha.status,
    docVersion: ficha.docVersion,
    revision: ficha.revision,
    timers: ficha.timers,
    patient,
    preEvaluation: ficha.preEvaluation,
    technique: ficha.technique,
    airway: ficha.airway,
    vascularAccesses: ficha.vascularAccesses,
    monitorConfig: ficha.monitorConfig,
    equipmentConfig: ficha.equipmentConfig,
    vitals: ficha.vitals,
    bolusDrugs: ficha.bolusDrugs,
    continuousInfusions: ficha.continuousInfusions,
    inhalationAgents: ficha.inhalationAgents,
    fluids: ficha.fluids,
    outputs: ficha.outputs,
    events: ficha.events,
    incidents: ficha.incidents,
    checklist: ficha.checklist,
    recovery: ficha.recovery,
    handover: ficha.handover,
    narrativeLaunches: ficha.narrativeLaunches
  };
}

export function aiContextOmitsIdentifiers(payload: Record<string, unknown>): boolean {
  const patient = payload.patient as Record<string, unknown> | undefined;
  if (!patient) return false;
  return (
    !("cpf" in patient) &&
    !("fullName" in patient) &&
    !("recordNumber" in patient) &&
    !("admissionNumber" in patient) &&
    !("email" in patient) &&
    !("id" in payload) &&
    !("currentResponsibleUid" in payload) &&
    !("participantUids" in payload)
  );
}
