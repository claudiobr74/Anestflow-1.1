export const AI_REVIEW_FAILED = "AI_REVIEW_FAILED";
export const AI_REVIEW_SCHEMA_INVALID = "AI_REVIEW_SCHEMA_INVALID";
export const AI_REVIEW_PARSE_FAILED = "AI_REVIEW_PARSE_FAILED";

export const VOICE_TRANSCRIPTION_FAILED = "VOICE_TRANSCRIPTION_FAILED";
export const VOICE_PARSE_FAILED = "VOICE_PARSE_FAILED";
export const VOICE_SCHEMA_INVALID = "VOICE_SCHEMA_INVALID";
export const VOICE_PARSE_INCOMPLETE = "VOICE_PARSE_INCOMPLETE";

export const AI_NARRATIVE_FAILED = "AI_NARRATIVE_FAILED";
export const AI_NARRATIVE_SCHEMA_INVALID = "AI_NARRATIVE_SCHEMA_INVALID";

export const AI_REVIEW_UNAVAILABLE_MESSAGE =
  "Auditoria de IA indisponível. Nenhuma conclusão foi produzida.";

export const VOICE_UNAVAILABLE_MESSAGE =
  "Interpretação de voz indisponível. Nenhum lançamento foi produzido.";

export const VOICE_PARSE_INCOMPLETE_MESSAGE =
  "Não foi possível interpretar todos os itens mencionados. Revise o transcript e faça os lançamentos manualmente ou repita o comando.";

export const NARRATIVE_UNAVAILABLE_MESSAGE =
  "Narrativa de IA indisponível. Nenhuma descrição foi produzida.";

export const AI_REVIEW_NO_ALERTS_MESSAGE = "Nenhum alerta encontrado.";

const REVIEW_CODES = [AI_REVIEW_FAILED, AI_REVIEW_SCHEMA_INVALID, AI_REVIEW_PARSE_FAILED] as const;

export type AiReviewErrorCode = (typeof REVIEW_CODES)[number];

export function isAiReviewErrorCode(value: unknown): value is AiReviewErrorCode {
  return typeof value === "string" && (REVIEW_CODES as readonly string[]).includes(value);
}

export function isAiReviewUnavailableMessage(message: string | undefined | null): boolean {
  if (!message) return false;
  return REVIEW_CODES.some((code) => message.includes(code)) || message.includes(AI_REVIEW_UNAVAILABLE_MESSAGE);
}

export function isVoiceAiErrorCode(value: unknown): boolean {
  return (
    value === VOICE_TRANSCRIPTION_FAILED ||
    value === VOICE_PARSE_FAILED ||
    value === VOICE_SCHEMA_INVALID ||
    value === VOICE_PARSE_INCOMPLETE
  );
}
