/**
 * Espelha supabase/config.toml [auth.sessions] no cliente.
 * Postos hospitalares compartilhados: encerra a sessão local mesmo se o
 * refresh token do Auth ainda for válido. Não grava PHI — só timestamps.
 */
import {
  clearClinicalSessionDrafts,
  purgeClinicalPhiFromLocalStorage,
} from "./clinicalStorageKeys";

export const SESSION_TIMEBOX_MS = 12 * 60 * 60 * 1000;
export const SESSION_INACTIVITY_MS = 8 * 60 * 60 * 1000;

export const SESSION_STARTED_KEY = "anestflow_session_started_at";
export const SESSION_ACTIVITY_KEY = "anestflow_session_activity_at";
export const SESSION_END_REASON_KEY = "anestflow_session_end_reason";

export type SessionViolation = "timebox" | "inactivity";

export function evaluateSession(args: {
  startedAt: number | null;
  lastActivityAt: number | null;
  now: number;
  timeboxMs?: number;
  inactivityMs?: number;
}): SessionViolation | null {
  const timeboxMs = args.timeboxMs ?? SESSION_TIMEBOX_MS;
  const inactivityMs = args.inactivityMs ?? SESSION_INACTIVITY_MS;
  if (args.startedAt != null && args.now - args.startedAt >= timeboxMs) {
    return "timebox";
  }
  const last = args.lastActivityAt ?? args.startedAt;
  if (last != null && args.now - last >= inactivityMs) {
    return "inactivity";
  }
  return null;
}

export function sessionEndMessage(reason: SessionViolation): string {
  if (reason === "timebox") {
    return "A sessão atingiu o limite de 12 horas neste posto. Entre novamente.";
  }
  return "A sessão encerrou após 8 horas sem atividade neste posto. Entre novamente.";
}

function readNumber(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeNumber(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore quota / private mode */
  }
}

function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function readSessionClock(): { startedAt: number | null; lastActivityAt: number | null } {
  return {
    startedAt: readNumber(SESSION_STARTED_KEY),
    lastActivityAt: readNumber(SESSION_ACTIVITY_KEY),
  };
}

export function beginSession(now = Date.now()): void {
  writeNumber(SESSION_STARTED_KEY, now);
  writeNumber(SESSION_ACTIVITY_KEY, now);
  removeKey(SESSION_END_REASON_KEY);
}

export function ensureSessionClock(now = Date.now()): void {
  const { startedAt } = readSessionClock();
  if (startedAt == null) beginSession(now);
}

export function touchSession(now = Date.now()): void {
  writeNumber(SESSION_ACTIVITY_KEY, now);
}

export function clearSessionClock(): void {
  removeKey(SESSION_STARTED_KEY);
  removeKey(SESSION_ACTIVITY_KEY);
}

export function persistSessionEndReason(reason: SessionViolation): void {
  try {
    localStorage.setItem(SESSION_END_REASON_KEY, reason);
  } catch {
    /* ignore */
  }
}

export function consumeSessionEndMessage(): string | null {
  try {
    const reason = localStorage.getItem(SESSION_END_REASON_KEY) as SessionViolation | null;
    if (reason !== "timebox" && reason !== "inactivity") return null;
    localStorage.removeItem(SESSION_END_REASON_KEY);
    return sessionEndMessage(reason);
  } catch {
    return null;
  }
}

export function clearSessionEndReason(): void {
  removeKey(SESSION_END_REASON_KEY);
}

/** Remove PHI de rascunho/fila. Não apaga tema, presets nem o motivo do encerramento. */
export function clearClinicalBrowserCache(): void {
  try {
    localStorage.removeItem("anesthesia_user");
  } catch {
    /* ignore */
  }
  purgeClinicalPhiFromLocalStorage();
  try {
    clearClinicalSessionDrafts();
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
}

export { clearClinicalSessionDrafts, purgeClinicalPhiFromLocalStorage };
