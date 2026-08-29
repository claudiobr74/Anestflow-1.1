import { getBlankDocument } from "../mockData";
import {
  AnesthesiaDocument,
  AnesthesiologistTransfer,
  ClinicalEvent,
  DocumentAmendment
} from "../types";

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DbProcedureStatus = "draft" | "in_progress" | "signed";

export function isUuid(value: string | undefined | null): boolean {
  return Boolean(value && UUID_RE.test(value));
}

export function isMockProcedureId(id: string | undefined | null): boolean {
  if (!id) return true;
  return id.startsWith("doc-mock") || id.includes("mock");
}

export function toDbStatus(status: AnesthesiaDocument["status"]): DbProcedureStatus {
  if (status === "Signed") return "signed";
  if (status === "InProgress") return "in_progress";
  return "draft";
}

export function fromDbStatus(status: string | null | undefined): AnesthesiaDocument["status"] {
  if (status === "signed") return "Signed";
  if (status === "in_progress") return "InProgress";
  return "Draft";
}

export function toIso(value: unknown, fallback?: string): string {
  if (!value) return fallback || new Date().toISOString();
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const raw = String(value);
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return fallback || new Date().toISOString();
}

export function clinicalAtFromItem(item: Record<string, unknown>): string {
  return toIso(item.timestamp || item.time || item.startTime || item.clinicalTimestamp);
}

export function newClientId(prefix = "evt"): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type ProcedureRow = {
  id: string;
  created_by: string;
  responsible_id: string;
  status: string;
  schema_version: string | null;
  signed_at: string | null;
  signed_by: AnesthesiaDocument["signedBy"] | null;
  content_hash: string | null;
  signed_canonical: string | null;
  patient: AnesthesiaDocument["patient"] | Record<string, unknown>;
  team: AnesthesiaDocument["team"] | Record<string, unknown>;
  pre_evaluation: AnesthesiaDocument["preEvaluation"] | Record<string, unknown>;
  technique: AnesthesiaDocument["technique"] | Record<string, unknown>;
  airway: AnesthesiaDocument["airway"] | Record<string, unknown>;
  checklist: AnesthesiaDocument["checklist"] | Record<string, unknown>;
  recovery: AnesthesiaDocument["recovery"] | Record<string, unknown>;
  handover: AnesthesiaDocument["handover"] | Record<string, unknown>;
  timers: AnesthesiaDocument["timers"] | Record<string, unknown>;
  monitor_config: AnesthesiaDocument["monitorConfig"] | Record<string, unknown>;
  equipment_config: AnesthesiaDocument["equipmentConfig"] | Record<string, unknown>;
  vascular_accesses: AnesthesiaDocument["vascularAccesses"];
  incidents: AnesthesiaDocument["incidents"];
  outputs: AnesthesiaDocument["outputs"];
  inhalation_agents: AnesthesiaDocument["inhalationAgents"];
  narratives: AnesthesiaDocument["narrativeLaunches"];
  pending_transfer: AnesthesiaDocument["pendingTransfer"] | null;
  created_at: string;
  updated_at: string;
};

export function isMeaningfulDocument(docObj: Partial<AnesthesiaDocument>): boolean {
  if (!docObj) return false;
  const p = docObj.patient;
  if (p) {
    if (p.fullName && p.fullName.trim().length > 0) return true;
    if (p.recordNumber && p.recordNumber.trim().length > 0) return true;
    if (p.cpf && p.cpf.trim().length > 0) return true;
    if (p.admissionNumber && p.admissionNumber.trim().length > 0) return true;
  }
  if (docObj.vitals && docObj.vitals.length > 0) return true;
  if (docObj.events && docObj.events.length > 0) return true;
  if (docObj.bolusDrugs && docObj.bolusDrugs.length > 0) return true;
  if (docObj.continuousInfusions && docObj.continuousInfusions.length > 0) return true;
  if (docObj.inhalationAgents && docObj.inhalationAgents.length > 0) return true;
  if (docObj.fluids && docObj.fluids.length > 0) return true;
  if (docObj.outputs && docObj.outputs.length > 0) return true;
  if (docObj.timers && (docObj.timers.startAnesthesia || docObj.timers.startSurgery || docObj.timers.endSurgery || docObj.timers.endAnesthesia)) return true;
  if (docObj.checklist && Object.values(docObj.checklist).some(Boolean)) return true;
  const airway = docObj.airway;
  if (airway && ((airway.deviceSize && String(airway.deviceSize).trim()) || (airway.incidents && String(airway.incidents).trim()))) return true;
  const recovery = docObj.recovery;
  if (recovery && (
    recovery.admissionTime ||
    (recovery.records && recovery.records.length > 0) ||
    typeof recovery.pas === "number" ||
    typeof recovery.fc === "number" ||
    typeof recovery.spo2 === "number" ||
    typeof recovery.temp === "number"
  )) return true;
  if (docObj.preEvaluation && (docObj.preEvaluation.physicalExam?.respiratory || docObj.preEvaluation.airwayEvaluation || docObj.preEvaluation.currentMedications)) return true;
  return false;
}

export function parentPayloadForWrite(
  doc: AnesthesiaDocument,
  _userId: string,
  options: { includeStatus: boolean }
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    patient: doc.patient || {},
    team: doc.team || {},
    pre_evaluation: doc.preEvaluation || {},
    technique: doc.technique || {},
    airway: doc.airway || {},
    checklist: doc.checklist || {},
    recovery: doc.recovery || {},
    handover: doc.handover || {},
    timers: doc.timers || {},
    monitor_config: doc.monitorConfig || {},
    equipment_config: doc.equipmentConfig || {},
    vascular_accesses: doc.vascularAccesses || [],
    incidents: doc.incidents || [],
    outputs: doc.outputs || [],
    inhalation_agents: doc.inhalationAgents || [],
    narratives: doc.narrativeLaunches || [],
    pending_transfer: doc.pendingTransfer || null,
    schema_version: doc.docVersion || "2.0.0"
  };
  if (options.includeStatus) {
    const writeStatus = doc.status === "Signed" ? "in_progress" : toDbStatus(doc.status);
    payload.status = writeStatus === "signed" ? "in_progress" : writeStatus;
  }
  return payload;
}

export function rowToDocumentBase(
  row: ProcedureRow,
  participantUids: string[]
): AnesthesiaDocument {
  const blank = getBlankDocument();
  return {
    ...blank,
    id: row.id,
    createdByUid: row.created_by,
    currentResponsibleUid: row.responsible_id,
    participantUids,
    userId: row.created_by,
    status: fromDbStatus(row.status),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    signedAt: row.signed_at ? toIso(row.signed_at) : undefined,
    signedBy: row.signed_by || undefined,
    hash: row.content_hash || undefined,
    signatureSnapshot: row.signed_canonical || undefined,
    docVersion: row.schema_version || "2.0.0",
    patient: { ...blank.patient, ...(row.patient as object) },
    team: { ...blank.team, ...(row.team as object) },
    preEvaluation: { ...blank.preEvaluation, ...(row.pre_evaluation as object) },
    technique: { ...blank.technique, ...(row.technique as object) },
    airway: { ...blank.airway, ...(row.airway as object) },
    checklist: { ...blank.checklist, ...(row.checklist as object) },
    recovery: { ...blank.recovery, ...(row.recovery as object) },
    handover: { ...blank.handover, ...(row.handover as object) },
    timers: { ...blank.timers, ...(row.timers as object) },
    monitorConfig: { ...blank.monitorConfig, ...(row.monitor_config as object) },
    equipmentConfig: { ...blank.equipmentConfig, ...(row.equipment_config as object) },
    vascularAccesses: Array.isArray(row.vascular_accesses) ? row.vascular_accesses : [],
    incidents: Array.isArray(row.incidents) ? row.incidents : [],
    outputs: Array.isArray(row.outputs) ? row.outputs : [],
    inhalationAgents: Array.isArray(row.inhalation_agents) ? row.inhalation_agents : [],
    narrativeLaunches: Array.isArray(row.narratives) ? row.narratives : [],
    pendingTransfer: row.pending_transfer || undefined,
    vitals: [],
    bolusDrugs: [],
    fluids: [],
    continuousInfusions: [],
    events: [],
    transfers: [],
    amendments: []
  };
}

export function payloadToItem<T extends { id?: string }>(
  row: { id: string; payload?: Record<string, unknown> | null }
): T {
  const payload = (row.payload || {}) as T;
  const id = (payload as { id?: string }).id || row.id;
  return { ...payload, id };
}

export function transferFromRow(row: {
  id: string;
  clinical_at: string;
  outgoing_user_id: string | null;
  incoming_user_id: string;
  payload: Record<string, unknown> | null;
}): AnesthesiologistTransfer {
  const p = row.payload || {};
  return {
    id: (p.id as string) || row.id,
    timestamp: (p.timestamp as string) || toIso(row.clinical_at),
    outgoingUid: (p.outgoingUid as string) || row.outgoing_user_id || undefined,
    outgoingName: (p.outgoingName as string) || "",
    outgoingCRM: (p.outgoingCRM as string) || "",
    outgoingUF: (p.outgoingUF as string) || "",
    incomingUid: (p.incomingUid as string) || row.incoming_user_id,
    incomingName: (p.incomingName as string) || "",
    incomingCRM: (p.incomingCRM as string) || "",
    incomingUF: (p.incomingUF as string) || "",
    clinicalConditions: (p.clinicalConditions as string) || "",
    incidentsReported: (p.incidentsReported as string) || "",
    ongoingInfusions: (p.ongoingInfusions as string) || "",
    pendingItems: (p.pendingItems as string) || "",
    acceptedAt: (p.acceptedAt as string) || toIso(row.clinical_at)
  };
}

export function amendmentFromRow(row: {
  id: string;
  procedure_id: string;
  created_by: string;
  body: string;
  reason: string;
  hash: string;
  doc_hash_ref: string | null;
  author_name: string;
  author_crm: string;
  author_uf: string;
  created_at: string;
}): DocumentAmendment {
  return {
    id: row.id,
    procedureId: row.procedure_id,
    text: row.body,
    reason: row.reason,
    createdAt: toIso(row.created_at),
    createdByUid: row.created_by,
    authorName: row.author_name,
    authorCRM: row.author_crm,
    authorUF: row.author_uf,
    hash: row.hash,
    docHashRef: row.doc_hash_ref || undefined,
    timestamp: toIso(row.created_at)
  };
}

export function eventFromRow(row: {
  id: string;
  clinical_at: string;
  payload: Record<string, unknown> | null;
}): ClinicalEvent {
  const item = payloadToItem<ClinicalEvent>(row);
  if (!item.timestamp) item.timestamp = toIso(row.clinical_at);
  if (!item.category) item.category = "Outro";
  if (!item.name) item.name = "";
  return item;
}

export function samePatientDraft(
  local: AnesthesiaDocument,
  remotePatient: Record<string, unknown> | AnesthesiaDocument["patient"]
): boolean {
  const recordNum = local.patient?.recordNumber?.trim();
  const cpf = local.patient?.cpf?.trim();
  const fullName = local.patient?.fullName?.trim().toLowerCase();
  const rp = remotePatient as { recordNumber?: string; cpf?: string; fullName?: string; date?: string };
  const sameRecord = Boolean(recordNum && rp.recordNumber?.trim() === recordNum);
  const sameCpf = Boolean(cpf && rp.cpf?.trim() === cpf);
  const sameNameAndDate = Boolean(
    fullName &&
    rp.fullName?.trim().toLowerCase() === fullName &&
    rp.date === local.patient?.date
  );
  return sameRecord || sameCpf || sameNameAndDate;
}
