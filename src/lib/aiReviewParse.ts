import { z } from "zod";
import {
  AI_REVIEW_FAILED,
  AI_REVIEW_NO_ALERTS_MESSAGE,
  AI_REVIEW_PARSE_FAILED,
  AI_REVIEW_SCHEMA_INVALID,
  AI_REVIEW_UNAVAILABLE_MESSAGE,
  isAiReviewErrorCode,
  isAiReviewUnavailableMessage,
  type AiReviewErrorCode,
} from "./aiErrorCodes";
import { clinicalReviewAlertSchema, clinicalReviewOutputSchema } from "./aiSchemas";

export {
  AI_REVIEW_FAILED,
  AI_REVIEW_PARSE_FAILED,
  AI_REVIEW_SCHEMA_INVALID,
  AI_REVIEW_UNAVAILABLE_MESSAGE,
  AI_REVIEW_NO_ALERTS_MESSAGE,
  isAiReviewUnavailableMessage,
};

/** Compat: qualquer código de falha de auditoria. */
export function isAiReviewParseFailedMessage(message: string | undefined | null): boolean {
  return isAiReviewUnavailableMessage(message);
}

export type AiReviewAlert = {
  type: string;
  title: string;
  description: string;
  module: string;
};

export type AiReviewParseResult =
  | { ok: true; alerts: AiReviewAlert[] }
  | { ok: false; error: AiReviewErrorCode };

export function parseAiReviewPayload(data: unknown): AiReviewParseResult {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: AI_REVIEW_PARSE_FAILED };
  }
  const rec = data as Record<string, unknown>;
  if (isAiReviewErrorCode(rec.error)) {
    return { ok: false, error: rec.error };
  }
  const parsed = clinicalReviewOutputSchema.safeParse(rec);
  if (!parsed.success) {
    return { ok: false, error: AI_REVIEW_SCHEMA_INVALID };
  }
  return {
    ok: true,
    alerts: parsed.data.alerts.map((alert) => ({
      type: String(alert.type),
      title: String(alert.title),
      description: String(alert.description),
      module: String(alert.module),
    })),
  };
}

export function reviewAlertsAreStructurallyValid(alerts: unknown): boolean {
  return z.array(clinicalReviewAlertSchema).safeParse(alerts).success;
}
