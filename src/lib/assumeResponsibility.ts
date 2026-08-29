export const MIN_ASSUME_REASON_LENGTH = 10;

export const ASSUME_REASON_REQUIRED_MESSAGE =
  "Informe o motivo da assunção excepcional (pelo menos 10 caracteres).";

export function normalizeAssumeReason(reason: string | null | undefined): string {
  return (reason || "").trim().replace(/\s+/g, " ");
}

export function validateAssumeReason(
  reason: string | null | undefined
): { ok: true; reason: string } | { ok: false; message: string } {
  const normalized = normalizeAssumeReason(reason);
  if (normalized.length < MIN_ASSUME_REASON_LENGTH) {
    return { ok: false, message: ASSUME_REASON_REQUIRED_MESSAGE };
  }
  return { ok: true, reason: normalized };
}
