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
  "email",
] as const;

const TOP_STRIP = ["id", "userId", "createdByUid", "currentResponsibleUid", "participantUids"] as const;

function omitKeys(obj: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const next: Record<string, unknown> = { ...obj };
  for (const key of keys) delete next[key];
  return next;
}

/** Defesa na Edge: não encaminha identificadores desnecessários ao Gemini. */
export function stripClinicalIdentifiers(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  const rec = omitKeys(payload as Record<string, unknown>, TOP_STRIP);
  if (rec.patient && typeof rec.patient === "object" && !Array.isArray(rec.patient)) {
    rec.patient = omitKeys(rec.patient as Record<string, unknown>, PATIENT_STRIP);
  }
  return rec;
}
