/**
 * Espelho Deno de src/lib/aiModelConfig.ts.
 * Manter os IDs e thinking levels idênticos — o teste de config compara os dois.
 */
export const GEMINI_TRANSCRIBE_MODEL = "gemini-3.5-transcribe" as const;
export const GEMINI_CLINICAL_MODEL = "gemini-3.6-flash" as const;

export const AI_MODEL_CONFIG = {
  transcription: {
    model: GEMINI_TRANSCRIBE_MODEL,
    mode: "verbatim" as const,
  },
  voiceParser: {
    model: GEMINI_CLINICAL_MODEL,
    thinkingLevel: "minimal" as const,
  },
  clinicalReview: {
    model: GEMINI_CLINICAL_MODEL,
    thinkingLevel: "medium" as const,
  },
  narrative: {
    model: GEMINI_CLINICAL_MODEL,
    thinkingLevel: "low" as const,
  },
} as const;

export const VOICE_PROMPT_VERSION = "voice-parser-v4";
export const CLINICAL_REVIEW_PROMPT_VERSION = "clinical-review-v4";
export const NARRATIVE_PROMPT_VERSION = "anesthesia-narrative-v2";

export const VOICE_SCHEMA_VERSION = "voice-command-schema-v4";
export const CLINICAL_REVIEW_SCHEMA_VERSION = "clinical-review-schema-v2";
export const NARRATIVE_SCHEMA_VERSION = "narrative-schema-v2";
