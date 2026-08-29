import type { AnesthesiaDocument } from "../types";

/**
 * Ao registrar o início da anestesia, Draft vira InProgress.
 * Não rebaixa Signed. Não volta para Draft se o timer for limpo.
 */
export function withInProgressIfAnesthesiaStarted(
  doc: AnesthesiaDocument
): AnesthesiaDocument {
  if (doc.status === "Signed") return doc;
  if (doc.status === "Draft" && doc.timers?.startAnesthesia) {
    return { ...doc, status: "InProgress" };
  }
  return doc;
}

export function isAnesthesiaInProgress(timers: {
  startAnesthesia?: string;
  endAnesthesia?: string;
} | undefined): boolean {
  return Boolean(timers?.startAnesthesia && !timers.endAnesthesia);
}

export function anesthesiaProgressLabel(timers: {
  startAnesthesia?: string;
  endAnesthesia?: string;
} | undefined): string {
  if (isAnesthesiaInProgress(timers)) return "Anestesia em andamento";
  if (timers?.startAnesthesia && timers.endAnesthesia) return "Anestesia encerrada";
  return "Aguardando início";
}
