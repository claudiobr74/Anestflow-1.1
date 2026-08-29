export const AI_REVIEW_PARSE_FAILED = "AI_REVIEW_PARSE_FAILED";
export const AI_REVIEW_UNAVAILABLE_MESSAGE =
  "Auditoria de IA indisponível. Nenhuma conclusão foi produzida.";

export type AiReviewAlert = {
  type: string;
  title: string;
  description: string;
  module: string;
};

export type AiReviewParseResult =
  | { ok: true; alerts: AiReviewAlert[] }
  | { ok: false; error: typeof AI_REVIEW_PARSE_FAILED };

export function isAiReviewParseFailedMessage(message: string | undefined | null): boolean {
  if (!message) return false;
  return message.includes(AI_REVIEW_PARSE_FAILED);
}

export function parseAiReviewPayload(data: unknown): AiReviewParseResult {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: AI_REVIEW_PARSE_FAILED };
  }
  const rec = data as Record<string, unknown>;
  if (rec.error === AI_REVIEW_PARSE_FAILED) {
    return { ok: false, error: AI_REVIEW_PARSE_FAILED };
  }
  if (!Array.isArray(rec.alerts)) {
    return { ok: false, error: AI_REVIEW_PARSE_FAILED };
  }
  return { ok: true, alerts: rec.alerts as AiReviewAlert[] };
}
