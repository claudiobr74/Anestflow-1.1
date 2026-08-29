import { VOICE_SCHEMA_INVALID } from "./aiErrorCodes";
import { voiceParserOutputSchema } from "./aiSchemas";
import { DRUG_GROUNDING_ALIASES } from "./anesthesiaVocabulary";
import {
  sanitizeVoiceCommand,
  type SanitizedVoiceActions,
  type VoiceBolusDrug,
  type VoiceInfusion,
  type VoiceInhalationAgent,
} from "./voiceCommand";

export type VoiceScribeResult = {
  transcript: string;
  commands: SanitizedVoiceActions;
  unparsedFragments: string[];
  warnings: string[];
};

const ROUTE_NEEDLES = [
  "endovenoso",
  "endovenosa",
  "intravenoso",
  "intravenosa",
  " ev ",
  " iv ",
  "im ",
  " intramuscular",
  " subcut",
  " sc ",
  "raqui",
  "peridural",
  "epidural",
  "inalatorio",
  "inalatório",
];

const CONC_NEEDLES = [
  "concentracao",
  "concentração",
  "mg/ml",
  "mg ml",
  "dilui",
  "diluí",
  "diluicao",
  "diluição",
];

export function foldClinicalText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[%]/g, " % ")
    .replace(/[^a-z0-9/,.]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function parseSpokenPortugueseNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const fold = foldClinicalText(String(raw));
  if (!fold) return null;

  const numeric = fold.replace(",", ".").replace(/[^\d.-]/g, "");
  if (/^-?\d+(?:\.\d+)?$/.test(fold.replace(",", "."))) {
    const n = Number(fold.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  const words: Record<string, number> = {
    zero: 0,
    um: 1,
    uma: 1,
    dois: 2,
    duas: 2,
    tres: 3,
    quatro: 4,
    cinco: 5,
    seis: 6,
    sete: 7,
    oito: 8,
    nove: 9,
    dez: 10,
    cem: 100,
    cento: 100,
    cinquenta: 50,
    cinqenta: 50,
    duzentos: 200,
    mil: 1000,
  };
  if (words[fold] != null) return words[fold];

  const virgula = fold.match(/^zero\s+virgula\s+(\w+)$/);
  if (virgula) {
    const frac = parseSpokenPortugueseNumber(virgula[1]);
    if (frac != null && frac >= 0 && frac < 10) return Number(`0.${frac}`);
  }

  const dotted = fold.match(/^zero\s+zero\s+(\w+)$/);
  if (dotted) {
    const frac = parseSpokenPortugueseNumber(dotted[1]);
    if (frac != null && frac >= 0 && frac < 10) return Number(`0.0${frac}`);
  }

  if (numeric && /^-?\d+(?:\.\d+)?$/.test(numeric)) {
    const n = Number(numeric);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function normalizeDoseUnit(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) return null;
  const fold = foldClinicalText(raw);
  if (fold === "mcg" || fold === "ug" || fold.includes("micrograma")) return "mcg";
  if (fold === "mg" || fold.startsWith("miligrama")) return "mg";
  if (fold === "g" || fold === "grama" || fold === "gramas") return "g";
  if (fold === "ml" || fold === "mililitro" || fold === "mililitros") return "ml";
  if (fold === "ui") return "UI";
  return String(raw).trim();
}

export function normalizeRoute(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) return null;
  const fold = foldClinicalText(raw);
  if (fold === "ev" || fold === "iv" || fold.includes("endoven") || fold.includes("intraven")) return "EV";
  if (fold === "im" || fold.includes("intramuscular")) return "IM";
  if (fold === "sc" || fold.includes("subcut")) return "SC";
  return String(raw).trim();
}

export function normalizeInfusionRateUnit(raw: string | null | undefined, transcript: string): string | null {
  const t = foldClinicalText(transcript);
  const spokenMcgKgMin =
    (t.includes("micrograma") && t.includes("quilo") && t.includes("minuto")) ||
    t.includes("mcg/kg/min") ||
    (t.includes("mcg") && t.includes("kg") && t.includes("min"));
  if (spokenMcgKgMin) return "mcg/kg/min";
  if (!raw || !String(raw).trim()) return null;
  return String(raw).trim();
}

function padded(fold: string): string {
  return ` ${fold} `;
}

export function transcriptMentionsRoute(transcript: string): boolean {
  const t = padded(foldClinicalText(transcript));
  return ROUTE_NEEDLES.some((needle) => t.includes(needle));
}

export function transcriptMentionsConcentration(transcript: string): boolean {
  const t = padded(foldClinicalText(transcript));
  if (CONC_NEEDLES.some((needle) => t.includes(needle))) return true;
  return /\d+(?:[.,]\d+)?\s*%/.test(t);
}

function aliasNeedles(name: string): string[] {
  const fold = foldClinicalText(name);
  const extra = DRUG_GROUNDING_ALIASES[fold];
  return extra ? [...extra] : [fold];
}

export function transcriptMentionsDrug(transcript: string, name: string): boolean {
  const t = padded(foldClinicalText(transcript));
  for (const needle of aliasNeedles(name)) {
    const n = foldClinicalText(needle);
    if (!n) continue;
    if (n.length <= 3) {
      if (t.includes(` ${n} `)) return true;
    } else if (t.includes(n)) {
      return true;
    }
  }
  return false;
}

function presentString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
}

function applyBolusGuard(transcript: string, drug: VoiceBolusDrug, warnings: string[]): VoiceBolusDrug | null {
  if (!transcriptMentionsDrug(transcript, drug.name)) {
    warnings.push(`Medicamento "${drug.name}" não está fundamentado no transcript.`);
    return null;
  }
  const next: VoiceBolusDrug = { name: drug.name };
  const numericDose = parseSpokenPortugueseNumber(drug.dose);
  if (numericDose != null) next.dose = String(numericDose);
  else if (presentString(drug.dose)) next.dose = String(drug.dose);

  const unit = normalizeDoseUnit(drug.unit ?? null);
  if (unit) {
    const t = foldClinicalText(transcript);
    const unitGrounded =
      (unit === "mcg" && (t.includes("micrograma") || t.includes("mcg"))) ||
      (unit === "mg" && (t.includes("miligrama") || t.includes(" mg") || t.endsWith(" mg") || /\bmg\b/.test(t))) ||
      t.includes(foldClinicalText(unit));
    if (unitGrounded || (unit === "mcg" && t.includes("micrograma"))) next.unit = unit;
  }

  if (transcriptMentionsRoute(transcript)) {
    const route = normalizeRoute(drug.route ?? null);
    if (route) next.route = route;
  } else if (presentString(drug.route)) {
    warnings.push(`Via omitida: não foi dita no transcript (${drug.name}).`);
  }
  return next;
}

function applyInfusionGuard(transcript: string, inf: VoiceInfusion, warnings: string[]): VoiceInfusion | null {
  if (!transcriptMentionsDrug(transcript, inf.name)) {
    warnings.push(`Infusão "${inf.name}" não está fundamentada no transcript.`);
    return null;
  }
  const next: VoiceInfusion = { name: inf.name };
  const rate = parseSpokenPortugueseNumber(inf.rate);
  if (rate != null) next.rate = String(rate);
  else if (presentString(inf.rate)) next.rate = String(inf.rate);

  const unit = normalizeInfusionRateUnit(inf.rateUnit ?? null, transcript);
  if (unit) next.rateUnit = unit;

  if (transcriptMentionsConcentration(transcript) && presentString(inf.concentration)) {
    next.concentration = String(inf.concentration);
  } else if (presentString(inf.concentration)) {
    warnings.push(`Concentração omitida: não foi dita no transcript (${inf.name}).`);
  }
  return next;
}

function applyInhalationGuard(transcript: string, gas: VoiceInhalationAgent, warnings: string[]): VoiceInhalationAgent | null {
  if (!transcriptMentionsDrug(transcript, gas.name)) {
    warnings.push(`Agente inalatório "${gas.name}" não está fundamentado no transcript.`);
    return null;
  }
  const next: VoiceInhalationAgent = { name: gas.name };
  if (transcriptMentionsConcentration(transcript)) {
    if (gas.inspiredConc !== undefined && gas.inspiredConc !== null) next.inspiredConc = gas.inspiredConc;
    if (gas.concentration !== undefined && gas.concentration !== null) next.concentration = gas.concentration;
  } else if (gas.inspiredConc != null || gas.concentration != null) {
    warnings.push(`Concentração de volátil omitida: não foi dita no transcript (${gas.name}).`);
  }
  return next;
}

export function applyVoiceSemanticGuard(
  transcript: string,
  actions: SanitizedVoiceActions,
  extras?: { unparsedFragments?: string[]; warnings?: string[] },
): VoiceScribeResult {
  const warnings = [...(extras?.warnings ?? [])];
  const unparsedFragments = [...(extras?.unparsedFragments ?? [])];
  const commands: SanitizedVoiceActions = {};

  if (actions.bolusDrugs?.length) {
    const kept: VoiceBolusDrug[] = [];
    for (const drug of actions.bolusDrugs) {
      const next = applyBolusGuard(transcript, drug, warnings);
      if (next) kept.push(next);
      else unparsedFragments.push(drug.name);
    }
    if (kept.length) commands.bolusDrugs = kept;
  }
  if (actions.continuousInfusions?.length) {
    const kept: VoiceInfusion[] = [];
    for (const inf of actions.continuousInfusions) {
      const next = applyInfusionGuard(transcript, inf, warnings);
      if (next) kept.push(next);
      else unparsedFragments.push(inf.name);
    }
    if (kept.length) commands.continuousInfusions = kept;
  }
  if (actions.inhalationAgents?.length) {
    const kept: VoiceInhalationAgent[] = [];
    for (const gas of actions.inhalationAgents) {
      const next = applyInhalationGuard(transcript, gas, warnings);
      if (next) kept.push(next);
      else unparsedFragments.push(gas.name);
    }
    if (kept.length) commands.inhalationAgents = kept;
  }
  if (actions.events) commands.events = actions.events;
  if (actions.vitals) commands.vitals = actions.vitals;
  if (actions.patient) commands.patient = actions.patient;
  if (actions.templates) commands.templates = actions.templates;
  if (actions.timers) commands.timers = actions.timers;

  if (!commands.bolusDrugs && !commands.continuousInfusions && !commands.inhalationAgents && !commands.events && !commands.vitals && !commands.patient && !commands.templates && !commands.timers) {
    if (!unparsedFragments.length && transcript.trim()) {
      unparsedFragments.push(transcript.trim());
      warnings.push("Fala não estruturada em comando clínico.");
    }
  }

  return { transcript, commands, unparsedFragments, warnings };
}

export function finalizeVoiceParse(
  transcript: string,
  raw: unknown,
): { ok: true; result: VoiceScribeResult } | { ok: false; error: typeof VOICE_SCHEMA_INVALID } {
  const parsed = voiceParserOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: VOICE_SCHEMA_INVALID };
  }
  const sanitized = sanitizeVoiceCommand(parsed.data.identifiedActions) ?? {};
  return {
    ok: true,
    result: applyVoiceSemanticGuard(transcript, sanitized, {
      unparsedFragments: parsed.data.unparsedFragments,
      warnings: parsed.data.warnings,
    }),
  };
}
