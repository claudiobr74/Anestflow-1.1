/** Espelho Deno de src/lib/voiceUnits.ts — enums do Structured Output. */

export const MEDICATION_DOSE_UNITS = ["mcg", "mg", "g", "ml", "UI", "ampola", "mEq"] as const;
export const INFUSION_RATE_UNITS = [
  "mcg/kg/min",
  "mcg/kg/h",
  "mg/kg/min",
  "mg/kg/h",
  "mg/h",
  "ml/h",
  "mcg/min",
] as const;
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
