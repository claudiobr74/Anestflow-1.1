import type { AnesthesiaDocument } from "../types";

/**
 * Campos persistidos por saveProcedure / parentPayloadForWrite + filhos clínicos.
 * O debounce de 1,2s permanece no useSyncEngine; isto só detecta mudança real.
 */
export const CLINICAL_FINGERPRINT_FIELDS = [
  "id",
  "status",
  "currentResponsibleUid",
  "patient",
  "team",
  "preEvaluation",
  "technique",
  "airway",
  "vascularAccesses",
  "monitorConfig",
  "equipmentConfig",
  "vitals",
  "bolusDrugs",
  "continuousInfusions",
  "inhalationAgents",
  "fluids",
  "outputs",
  "events",
  "incidents",
  "timers",
  "transfers",
  "checklist",
  "recovery",
  "handover",
  "narrativeLaunches",
  "pendingTransfer",
] as const;

export type ClinicalFingerprintField = (typeof CLINICAL_FINGERPRINT_FIELDS)[number];

function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function clinicalChangeFingerprint(
  doc: AnesthesiaDocument | null | undefined
): string {
  if (!doc) return "";
  const slice: Record<string, unknown> = {};
  for (const key of CLINICAL_FINGERPRINT_FIELDS) {
    slice[key] = (doc as unknown as Record<string, unknown>)[key];
  }
  return JSON.stringify(slice, jsonReplacer);
}
