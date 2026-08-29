import { jsPDF } from "jspdf";
import type { AnesthesiaDocument, VoiceTranscript } from "../types";
import { UNREGISTERED, displayBloodPressure, displayVital } from "./clinicalDisplay";
import { expectedProcedureRevision, toDbStatus } from "./procedureMapper";

export const SIGNED_RECORD_SCHEMA = "SignedAnesthesiaRecordV1" as const;

export const PDF_FINAL_CREATION_DATE = new Date("2026-01-01T00:00:00.000Z");

export type SignedProcedureSummary = {
  scheduled: string;
  actual: string;
  diagnosis: string;
};

export type SignedAnesthesiaRecordV1 = {
  schema: typeof SIGNED_RECORD_SCHEMA;
  schemaVersion: number;
  integrityAlgo: string;
  procedureId: string;
  status: string;
  revision: number;
  documentSchemaVersion: string;
  createdBy: string;
  responsibleId: string;
  createdAt: string;
  updatedAt: string;
  signedAt: string;
  signedBy: Record<string, unknown>;
  patient: Record<string, unknown>;
  procedure: SignedProcedureSummary;
  team: Record<string, unknown>;
  preEvaluation: Record<string, unknown>;
  technique: Record<string, unknown>;
  airway: Record<string, unknown>;
  monitorConfig: Record<string, unknown>;
  equipmentConfig: Record<string, unknown>;
  vascularAccesses: unknown[];
  vitals: unknown[];
  bolusDrugs: unknown[];
  continuousInfusions: unknown[];
  inhalationAgents: unknown[];
  fluids: unknown[];
  outputs: unknown[];
  events: unknown[];
  incidents: unknown[];
  timers: Record<string, unknown>;
  transfers: unknown[];
  checklist: Record<string, unknown>;
  recovery: Record<string, unknown>;
  handover: Record<string, unknown>;
  narrativeLaunches: unknown[];
  voiceTranscripts: VoiceTranscript[];
  /** Sidecar: SHA-256 do canonical. Não faz parte do JSON selado. */
  integrityHash: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isoish(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return asString(value);
}

function isAbsent(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function line(label: string, value: unknown): string {
  if (isAbsent(value)) return `${label}=${UNREGISTERED}`;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return `${label}=${value}`;
  }
  return `${label}=${JSON.stringify(value)}`;
}

function recordedNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

function vitalPasPad(row: unknown): { pas?: number; pad?: number; spo2?: number; fc?: number } {
  const rec = asRecord(row);
  const payload = asRecord(rec.payload);
  return {
    pas: recordedNumber(rec.pas ?? rec.systolic ?? payload.pas ?? payload.systolic),
    pad: recordedNumber(rec.pad ?? rec.diastolic ?? payload.pad ?? payload.diastolic),
    spo2: recordedNumber(rec.spo2 ?? payload.spo2),
    fc: recordedNumber(rec.fc ?? rec.hr ?? payload.fc ?? payload.hr),
  };
}

function voiceRows(value: unknown): VoiceTranscript[] {
  return asArray(value)
    .map((item, index) => {
      const rec = asRecord(item);
      const original = asString(rec.transcriptOriginal ?? rec.transcript_original);
      return {
        id: asString(rec.id, `vt-${index}`),
        transcriptOriginal: original,
        createdAt: isoish(rec.createdAt ?? rec.created_at),
      };
    })
    .filter((row) => row.transcriptOriginal.length > 0);
}

export function parseSignedAnesthesiaRecordV1(
  snapshot: string,
  integrityHash = ""
): SignedAnesthesiaRecordV1 | null {
  let raw: unknown;
  try {
    raw = JSON.parse(snapshot);
  } catch {
    return null;
  }
  const rec = asRecord(raw);
  if (asString(rec.schema) !== SIGNED_RECORD_SCHEMA) return null;
  const patient = asRecord(rec.patient);
  const procedureRec = asRecord(rec.procedure);
  return {
    schema: SIGNED_RECORD_SCHEMA,
    schemaVersion: asNumber(rec.schemaVersion, 1),
    integrityAlgo: asString(rec.integrityAlgo, "SHA-256"),
    procedureId: asString(rec.procedureId ?? rec.document_id),
    status: asString(rec.status, "signed"),
    revision: asNumber(rec.revision, 1),
    documentSchemaVersion: asString(rec.documentSchemaVersion, "2.0.0"),
    createdBy: asString(rec.createdBy),
    responsibleId: asString(rec.responsibleId),
    createdAt: isoish(rec.createdAt),
    updatedAt: isoish(rec.updatedAt),
    signedAt: isoish(rec.signedAt ?? rec.signed_at),
    signedBy: asRecord(rec.signedBy),
    patient,
    procedure: {
      scheduled: asString(procedureRec.scheduled ?? patient.scheduledProcedure),
      actual: asString(procedureRec.actual ?? patient.actualProcedure),
      diagnosis: asString(procedureRec.diagnosis ?? patient.diagnosis),
    },
    team: asRecord(rec.team),
    preEvaluation: asRecord(rec.preEvaluation),
    technique: asRecord(rec.technique),
    airway: asRecord(rec.airway),
    monitorConfig: asRecord(rec.monitorConfig),
    equipmentConfig: asRecord(rec.equipmentConfig),
    vascularAccesses: asArray(rec.vascularAccesses),
    vitals: asArray(rec.vitals),
    bolusDrugs: asArray(rec.bolusDrugs),
    continuousInfusions: asArray(rec.continuousInfusions),
    inhalationAgents: asArray(rec.inhalationAgents),
    fluids: asArray(rec.fluids),
    outputs: asArray(rec.outputs),
    events: asArray(rec.events),
    incidents: asArray(rec.incidents),
    timers: asRecord(rec.timers),
    transfers: asArray(rec.transfers),
    checklist: asRecord(rec.checklist),
    recovery: asRecord(rec.recovery),
    handover: asRecord(rec.handover),
    narrativeLaunches: asArray(rec.narrativeLaunches),
    voiceTranscripts: voiceRows(rec.voiceTranscripts),
    integrityHash: asString(rec.integrityHash ?? rec.integrity_hash, integrityHash),
  };
}

function assembleFromDocument(ficha: AnesthesiaDocument): SignedAnesthesiaRecordV1 {
  const patient = asRecord(ficha.patient as unknown);
  return {
    schema: SIGNED_RECORD_SCHEMA,
    schemaVersion: 1,
    integrityAlgo: "SHA-256",
    procedureId: ficha.id,
    status: toDbStatus(ficha.status),
    revision: expectedProcedureRevision(ficha),
    documentSchemaVersion: ficha.docVersion || "2.0.0",
    createdBy: ficha.createdByUid || "",
    responsibleId: ficha.currentResponsibleUid || "",
    createdAt: ficha.createdAt || "",
    updatedAt: ficha.updatedAt || "",
    signedAt: ficha.signedAt || "",
    signedBy: asRecord(ficha.signedBy),
    patient,
    procedure: {
      scheduled: asString(ficha.patient?.scheduledProcedure),
      actual: asString(ficha.patient?.actualProcedure),
      diagnosis: asString(ficha.patient?.diagnosis),
    },
    team: asRecord(ficha.team as unknown),
    preEvaluation: asRecord(ficha.preEvaluation as unknown),
    technique: asRecord(ficha.technique as unknown),
    airway: asRecord(ficha.airway as unknown),
    monitorConfig: asRecord(ficha.monitorConfig as unknown),
    equipmentConfig: asRecord(ficha.equipmentConfig as unknown),
    vascularAccesses: asArray(ficha.vascularAccesses),
    vitals: asArray(ficha.vitals),
    bolusDrugs: asArray(ficha.bolusDrugs),
    continuousInfusions: asArray(ficha.continuousInfusions),
    inhalationAgents: asArray(ficha.inhalationAgents),
    fluids: asArray(ficha.fluids),
    outputs: asArray(ficha.outputs),
    events: asArray(ficha.events),
    incidents: asArray(ficha.incidents),
    timers: asRecord(ficha.timers as unknown),
    transfers: asArray(ficha.transfers),
    checklist: asRecord(ficha.checklist as unknown),
    recovery: asRecord(ficha.recovery as unknown),
    handover: asRecord(ficha.handover as unknown),
    narrativeLaunches: asArray(ficha.narrativeLaunches),
    voiceTranscripts: voiceRows(ficha.voiceTranscripts),
    integrityHash: ficha.hash || "",
  };
}

export function toSignedAnesthesiaRecordV1(
  ficha: AnesthesiaDocument
): SignedAnesthesiaRecordV1 {
  if (ficha.signatureSnapshot) {
    const parsed = parseSignedAnesthesiaRecordV1(ficha.signatureSnapshot, ficha.hash || "");
    if (parsed) {
      if (parsed.voiceTranscripts.length === 0 && (ficha.voiceTranscripts || []).length > 0) {
        parsed.voiceTranscripts = voiceRows(ficha.voiceTranscripts);
      }
      if (!parsed.integrityHash && ficha.hash) parsed.integrityHash = ficha.hash;
      return parsed;
    }
  }
  return assembleFromDocument(ficha);
}

function responsibleLine(record: SignedAnesthesiaRecordV1): string {
  const signed = record.signedBy;
  const team = record.team;
  const name = asString(signed.name ?? team.anesthesiologistLead);
  const crm = asString(signed.crm ?? team.crmLead);
  const uf = asString(signed.uf ?? team.ufLead);
  return `responsible=${name || UNREGISTERED} CRM ${crm || UNREGISTERED}/${uf || UNREGISTERED}`;
}

function sectionCount(label: string, rows: unknown[]): string {
  if (rows.length === 0) return `${label}=${UNREGISTERED}`;
  return `${label}=${rows.length} registros`;
}

/** Texto pesquisável determinístico do PDF final. Ausência permanece ausência. */
export function pdfFinalSearchableText(record: SignedAnesthesiaRecordV1): string {
  const patient = record.patient;
  const vitals = record.vitals;
  const vitalBits: string[] = [];
  let anyPasPad = false;
  for (let i = 0; i < vitals.length; i += 1) {
    const v = vitalPasPad(vitals[i]);
    if (v.pas != null || v.pad != null) anyPasPad = true;
    const parts = [
      v.fc != null ? `FC ${v.fc}` : "",
      v.pas != null || v.pad != null ? `PA ${displayBloodPressure(v.pas, v.pad)}` : "",
      v.spo2 != null ? `SpO2 ${displayVital(v.spo2, "%")}` : "",
    ].filter(Boolean);
    if (parts.length) vitalBits.push(`${i}:${parts.join(" ")}`);
  }

  const transcripts = record.voiceTranscripts || [];
  const transcriptLines =
    transcripts.length === 0
      ? [`transcript_original=${UNREGISTERED}`]
      : transcripts.map(
          (row, index) => `transcript_original.${index}=${row.transcriptOriginal}`
        );

  const lines = [
    `schema=${record.schema}`,
    `schemaVersion=${record.schemaVersion}`,
    `integrityAlgo=${record.integrityAlgo}`,
    `procedureId=${record.procedureId}`,
    `status=${record.status || UNREGISTERED}`,
    `revision=${record.revision}`,
    `documentSchemaVersion=${record.documentSchemaVersion || UNREGISTERED}`,
    line("createdBy", record.createdBy),
    line("responsibleId", record.responsibleId),
    line("createdAt", record.createdAt),
    line("updatedAt", record.updatedAt),
    line("signedAt", record.signedAt),
    line("integrityHash", record.integrityHash),
    responsibleLine(record),
    line("patient.fullName", patient.fullName),
    line("patient.cpf", patient.cpf),
    line("patient.age", patient.age),
    line("patient.asa", patient.asa),
    line("patient.allergies", patient.allergies),
    line("procedure.scheduled", record.procedure.scheduled),
    line("procedure.actual", record.procedure.actual),
    line("procedure.diagnosis", record.procedure.diagnosis),
    line("inicio_anestesia", record.timers.startAnesthesia),
    line("inicio_cirurgia", record.timers.startSurgery),
    line("fim_cirurgia", record.timers.endSurgery),
    line("fim_anestesia", record.timers.endAnesthesia),
    sectionCount("vitais", vitals),
    ...vitalBits,
    `pa_ausente=${anyPasPad ? displayBloodPressure(vitalPasPad(vitals[0]).pas, vitalPasPad(vitals[0]).pad) : displayBloodPressure(undefined, undefined)}`,
    `spo2_ausente=${displayVital(undefined, "%")}`,
    sectionCount("bolus", record.bolusDrugs),
    sectionCount("infusoes", record.continuousInfusions),
    sectionCount("inalatorios", record.inhalationAgents),
    sectionCount("fluidos", record.fluids),
    sectionCount("debitos", record.outputs),
    sectionCount("eventos", record.events),
    sectionCount("incidentes", record.incidents),
    sectionCount("acessos", record.vascularAccesses),
    sectionCount("transferencias", record.transfers),
    sectionCount("narrativas", record.narrativeLaunches),
    ...transcriptLines,
  ];
  return lines.join("\n");
}

export function buildSignedRecordPdfBytes(record: SignedAnesthesiaRecordV1): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: false });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setCreationDate(PDF_FINAL_CREATION_DATE);
  const signedName = asString(record.signedBy.name ?? record.team.anesthesiologistLead, "AnestFlow");
  doc.setProperties({
    title: `AnestFlow ${record.procedureId}`,
    subject: SIGNED_RECORD_SCHEMA,
    author: signedName,
    keywords: `${record.integrityAlgo} ${record.integrityHash} revision ${record.revision}`,
    creator: "AnestFlow PDF Final",
  });
  const text = pdfFinalSearchableText(record);
  const wrapped = doc.splitTextToSize(text, 500);
  const lines = Array.isArray(wrapped) ? wrapped.map((item) => String(item)) : [String(wrapped)];
  let y = 48;
  const pageH = doc.internal.pageSize.getHeight();
  for (const row of lines) {
    if (y > pageH - 48) {
      doc.addPage();
      y = 48;
    }
    doc.text(row, 48, y);
    y += 12;
  }
  const buffer = doc.output("arraybuffer");
  return new Uint8Array(buffer);
}

export function downloadSignedRecordPdf(
  record: SignedAnesthesiaRecordV1,
  filename?: string
): void {
  const bytes = buildSignedRecordPdfBytes(record);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = globalThis.document.createElement("a");
  const safeId = record.procedureId.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 36) || "ficha";
  anchor.href = url;
  anchor.download = filename || `anestflow-${safeId}-r${record.revision}.pdf`;
  globalThis.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
