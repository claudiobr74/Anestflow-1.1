/** Unidades reais do domínio AnestFlow (`BolusDrug.unit` / `ContinuousInfusion.unit`). */

export const MEDICATION_DOSE_UNITS = ["mcg", "mg", "g", "ml", "UI", "ampola", "mEq"] as const;
export type MedicationDoseUnit = (typeof MEDICATION_DOSE_UNITS)[number];

export const INFUSION_RATE_UNITS = [
  "mcg/kg/min",
  "mcg/kg/h",
  "mg/kg/min",
  "mg/kg/h",
  "mg/h",
  "ml/h",
  "mcg/min",
] as const;
export type InfusionRateUnit = (typeof INFUSION_RATE_UNITS)[number];

export const MEDICATION_ROUTES = [
  "EV",
  "IM",
  "SC",
  "IO",
  "Raqui",
  "Peridural",
  "Bloqueio",
  "Inalatório",
  "ID",
] as const;
export type MedicationRoute = (typeof MEDICATION_ROUTES)[number];

function foldUnit(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function coerceMedicationDoseUnit(value: unknown): MedicationDoseUnit | null {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (raw.length > 16) return null;
  if ((MEDICATION_DOSE_UNITS as readonly string[]).includes(raw)) {
    return raw as MedicationDoseUnit;
  }
  const folded = foldUnit(raw);
  if (folded === "mcg" || folded === "ug" || folded === "micrograma" || folded === "microgramas") return "mcg";
  if (folded === "mg" || folded === "miligrama" || folded === "miligramas") return "mg";
  if (folded === "g" || folded === "grama" || folded === "gramas") return "g";
  if (folded === "ml" || folded === "mililitro" || folded === "mililitros") return "ml";
  if (folded === "ui") return "UI";
  if (folded === "ampola") return "ampola";
  if (folded === "meq") return "mEq";
  return null;
}

export function coerceInfusionRateUnit(value: unknown): InfusionRateUnit | null {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (raw.length > 16) return null;
  const compact = raw.replace(/\s+/g, "");
  return (INFUSION_RATE_UNITS as readonly string[]).includes(compact)
    ? (compact as InfusionRateUnit)
    : null;
}

export function coerceMedicationRoute(value: unknown): MedicationRoute | null {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (raw.length > 16) return null;
  if ((MEDICATION_ROUTES as readonly string[]).includes(raw)) return raw as MedicationRoute;
  const folded = foldUnit(raw);
  if (folded === "ev" || folded === "iv" || folded.includes("endoven") || folded.includes("intraven")) return "EV";
  if (folded === "im" || folded.includes("intramuscular")) return "IM";
  if (folded === "sc" || folded.includes("subcut")) return "SC";
  if (folded === "io") return "IO";
  if (folded.includes("raqui")) return "Raqui";
  if (folded.includes("peridural") || folded.includes("epidural")) return "Peridural";
  if (folded.includes("bloqueio")) return "Bloqueio";
  if (folded.includes("inalator")) return "Inalatório";
  if (folded === "id") return "ID";
  return null;
}
