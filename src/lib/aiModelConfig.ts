/**
 * Configuração canônica da IA clínica do AnestFlow.
 * Strings de modelo não devem ser espalhadas pelo React nem pelas Edge Functions.
 * Upgrade para Gemini 3.7 (ou outro ID) exige corpus de testes, benchmark e aprovação explícita.
 */

export const GEMINI_TRANSCRIBE_MODEL = "gemini-3.5-transcribe" as const;
export const GEMINI_TRANSCRIBE_LIVE_MODEL = "gemini-3.5-transcribe-live" as const;
export const GEMINI_CLINICAL_MODEL = "gemini-3.6-flash" as const;

export type AiThinkingLevel = "minimal" | "low" | "medium" | "high";

export const AI_MODEL_CONFIG = {
  transcription: {
    model: GEMINI_TRANSCRIBE_MODEL,
    mode: "verbatim" as const,
  },
  voiceParser: {
    model: GEMINI_CLINICAL_MODEL,
    thinkingLevel: "minimal" as const satisfies AiThinkingLevel,
  },
  clinicalReview: {
    model: GEMINI_CLINICAL_MODEL,
    thinkingLevel: "medium" as const satisfies AiThinkingLevel,
  },
  narrative: {
    model: GEMINI_CLINICAL_MODEL,
    thinkingLevel: "low" as const satisfies AiThinkingLevel,
  },
} as const;

export const VOICE_PROMPT_VERSION = "voice-parser-v4";
export const CLINICAL_REVIEW_PROMPT_VERSION = "clinical-review-v4";
export const NARRATIVE_PROMPT_VERSION = "anesthesia-narrative-v2";

export const VOICE_SCHEMA_VERSION = "voice-command-schema-v4";
export const CLINICAL_REVIEW_SCHEMA_VERSION = "clinical-review-schema-v2";
export const NARRATIVE_SCHEMA_VERSION = "narrative-schema-v2";

/**
 * IDs que o runtime clínico desta versão não pode usar.
 * gemini-3.5-transcribe-live existe, mas o fluxo atual é unary (áudio gravado) — não entra no config.
 */
export const FORBIDDEN_CLINICAL_MODELS = [
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-pro-latest",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.1-pro-preview",
] as const;

export function isForbiddenClinicalModel(model: string): boolean {
  const id = model.trim().toLowerCase();
  if ((FORBIDDEN_CLINICAL_MODELS as readonly string[]).includes(id)) return true;
  if (id.includes("preview")) return true;
  if (id.endsWith("-latest") || id.includes("flash-latest")) return true;
  if (id.startsWith("gemini-3.7")) return true;
  return false;
}

export function assertProductionAiModels(): void {
  const cfg = AI_MODEL_CONFIG;
  if (cfg.transcription.model !== GEMINI_TRANSCRIBE_MODEL) {
    throw new Error("Transcrição de produção deve usar gemini-3.5-transcribe.");
  }
  if (cfg.transcription.mode !== "verbatim") {
    throw new Error("Transcrição auditável deve ser verbatim.");
  }
  if (cfg.voiceParser.model !== GEMINI_CLINICAL_MODEL || cfg.voiceParser.thinkingLevel !== "minimal") {
    throw new Error("Voice parser de produção deve ser gemini-3.6-flash / thinking minimal.");
  }
  if (cfg.clinicalReview.model !== GEMINI_CLINICAL_MODEL || cfg.clinicalReview.thinkingLevel !== "medium") {
    throw new Error("Supervisor de produção deve ser gemini-3.6-flash / thinking medium.");
  }
  if (cfg.narrative.model !== GEMINI_CLINICAL_MODEL || cfg.narrative.thinkingLevel !== "low") {
    throw new Error("Narrativa de produção deve ser gemini-3.6-flash / thinking low.");
  }
  const models = [
    cfg.transcription.model,
    cfg.voiceParser.model,
    cfg.clinicalReview.model,
    cfg.narrative.model,
  ];
  for (const model of models) {
    if (isForbiddenClinicalModel(model)) {
      throw new Error(`Modelo clínico proibido em produção: ${model}`);
    }
  }
}

export type AiFeature = keyof typeof AI_MODEL_CONFIG;
