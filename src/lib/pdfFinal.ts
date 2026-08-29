import type { AnesthesiaDocument } from "../types";
import { UNREGISTERED, displayBloodPressure, displayVital } from "./clinicalDisplay";
import { expectedProcedureRevision } from "./procedureMapper";

export const SIGNED_RECORD_SCHEMA = "SignedAnesthesiaRecordV1" as const;

export type SignedAnesthesiaRecordV1 = {
  schema: typeof SIGNED_RECORD_SCHEMA;
  document_id: string;
  revision: number;
  signed_at: string;
  responsible: {
    name: string;
    crm: string;
    uf: string;
  };
  integrity_hash: string;
  patient: {
    age: number | null;
    asa: string;
    procedure: string;
    allergies: string;
  };
  timers: AnesthesiaDocument["timers"];
  vitals_count: number;
};

export function toSignedAnesthesiaRecordV1(
  ficha: AnesthesiaDocument
): SignedAnesthesiaRecordV1 {
  return {
    schema: SIGNED_RECORD_SCHEMA,
    document_id: ficha.id,
    revision: expectedProcedureRevision(ficha),
    signed_at: ficha.signedAt || "",
    responsible: {
      name: ficha.signedBy?.name || ficha.team?.anesthesiologistLead || "",
      crm: ficha.signedBy?.crm || ficha.team?.crmLead || "",
      uf: ficha.signedBy?.uf || ficha.team?.ufLead || ""
    },
    integrity_hash: ficha.hash || "",
    patient: {
      age: ficha.patient?.age || null,
      asa: ficha.patient?.asa ? String(ficha.patient.asa) : "",
      procedure: ficha.patient?.actualProcedure || ficha.patient?.scheduledProcedure || "",
      allergies: ficha.patient?.allergies || ""
    },
    timers: ficha.timers || {},
    vitals_count: Array.isArray(ficha.vitals) ? ficha.vitals.length : 0
  };
}

/** Texto pesquisável determinístico do PDF final. Ausência permanece ausência. */
export function pdfFinalSearchableText(record: SignedAnesthesiaRecordV1): string {
  const lastVital = record.vitals_count > 0 ? `${record.vitals_count} registros` : UNREGISTERED;
  const lines = [
    `schema=${record.schema}`,
    `document_id=${record.document_id}`,
    `revision=${record.revision}`,
    `signed_at=${record.signed_at || UNREGISTERED}`,
    `hash=${record.integrity_hash || UNREGISTERED}`,
    `responsible=${record.responsible.name || UNREGISTERED} CRM ${record.responsible.crm || UNREGISTERED}/${record.responsible.uf || UNREGISTERED}`,
    `asa=${record.patient.asa || UNREGISTERED}`,
    `procedimento=${record.patient.procedure || UNREGISTERED}`,
    `alergias=${record.patient.allergies || UNREGISTERED}`,
    `inicio_anestesia=${record.timers.startAnesthesia || UNREGISTERED}`,
    `vitais=${lastVital}`,
    `pa_ausente=${displayBloodPressure(undefined, undefined)}`,
    `spo2_ausente=${displayVital(undefined, "%")}`
  ];
  return lines.join("\n");
}
