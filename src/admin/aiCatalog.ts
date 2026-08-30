export {
  AI_MODEL_CONFIG,
  CLINICAL_REVIEW_PROMPT_VERSION,
  CLINICAL_REVIEW_SCHEMA_VERSION,
  FORBIDDEN_CLINICAL_MODELS,
  GEMINI_CLINICAL_MODEL,
  GEMINI_TRANSCRIBE_MODEL,
  GEMINI_TRANSCRIBE_LIVE_MODEL,
  NARRATIVE_PROMPT_VERSION,
  NARRATIVE_SCHEMA_VERSION,
  VOICE_PROMPT_VERSION,
  VOICE_SCHEMA_VERSION,
  assertProductionAiModels,
  isForbiddenClinicalModel,
} from "../lib/aiModelConfig";

export type { AiFeature, AiThinkingLevel } from "../lib/aiModelConfig";

import {
  AI_MODEL_CONFIG,
  CLINICAL_REVIEW_PROMPT_VERSION,
  CLINICAL_REVIEW_SCHEMA_VERSION,
  NARRATIVE_PROMPT_VERSION,
  NARRATIVE_SCHEMA_VERSION,
  VOICE_PROMPT_VERSION,
  VOICE_SCHEMA_VERSION,
} from "../lib/aiModelConfig";

export type AdminAiCatalogCard = {
  id: "transcription" | "voiceParser" | "clinicalReview" | "narrative";
  title: string;
  model: string;
  thinking: string | null;
  prompt: string | null;
  schema: string | null;
  mode: string | null;
  description: string;
};

export const ADMIN_AI_MODEL_CARDS: AdminAiCatalogCard[] = [
  {
    id: "transcription",
    title: "Voice ASR",
    model: AI_MODEL_CONFIG.transcription.model,
    thinking: null,
    prompt: "transcribe-verbatim-v1",
    schema: null,
    mode: AI_MODEL_CONFIG.transcription.mode,
    description: "Transcrição verbatim do áudio clínico. Sem interpretação.",
  },
  {
    id: "voiceParser",
    title: "Voice Parser",
    model: AI_MODEL_CONFIG.voiceParser.model,
    thinking: AI_MODEL_CONFIG.voiceParser.thinkingLevel,
    prompt: VOICE_PROMPT_VERSION,
    schema: VOICE_SCHEMA_VERSION,
    mode: null,
    description: "Interpretação estruturada do Voice Scribe.",
  },
  {
    id: "clinicalReview",
    title: "Supervisor",
    model: AI_MODEL_CONFIG.clinicalReview.model,
    thinking: AI_MODEL_CONFIG.clinicalReview.thinkingLevel,
    prompt: CLINICAL_REVIEW_PROMPT_VERSION,
    schema: CLINICAL_REVIEW_SCHEMA_VERSION,
    mode: null,
    description: "Revisão clínica automatizada da ficha.",
  },
  {
    id: "narrative",
    title: "Narrativa",
    model: AI_MODEL_CONFIG.narrative.model,
    thinking: AI_MODEL_CONFIG.narrative.thinkingLevel,
    prompt: NARRATIVE_PROMPT_VERSION,
    schema: NARRATIVE_SCHEMA_VERSION,
    mode: null,
    description: "Descrição do ato anestésico a partir da ficha.",
  },
];

export type AdminAiPromptRow = {
  id: string;
  prompt: string;
  version: string;
  model: string;
  schema: string;
  status: "Production";
};

export const ADMIN_AI_PROMPT_ROWS: AdminAiPromptRow[] = [
  {
    id: "voice",
    prompt: VOICE_PROMPT_VERSION,
    version: VOICE_PROMPT_VERSION,
    model: AI_MODEL_CONFIG.voiceParser.model,
    schema: VOICE_SCHEMA_VERSION,
    status: "Production",
  },
  {
    id: "review",
    prompt: CLINICAL_REVIEW_PROMPT_VERSION,
    version: CLINICAL_REVIEW_PROMPT_VERSION,
    model: AI_MODEL_CONFIG.clinicalReview.model,
    schema: CLINICAL_REVIEW_SCHEMA_VERSION,
    status: "Production",
  },
  {
    id: "narrative",
    prompt: NARRATIVE_PROMPT_VERSION,
    version: NARRATIVE_PROMPT_VERSION,
    model: AI_MODEL_CONFIG.narrative.model,
    schema: NARRATIVE_SCHEMA_VERSION,
    status: "Production",
  },
  {
    id: "transcription",
    prompt: "transcribe-verbatim-v1",
    version: AI_MODEL_CONFIG.transcription.mode,
    model: AI_MODEL_CONFIG.transcription.model,
    schema: "—",
    status: "Production",
  },
];
