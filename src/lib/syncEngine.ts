import { AnesthesiaDocument } from "../types";
import { newClientId } from "./procedureMapper";
import {
  CLINICAL_STORAGE_KEYS,
  purgeClinicalPhiFromLocalStorage,
} from "./clinicalStorageKeys";

export type SyncStatus = "saved" | "syncing" | "offline" | "error";

export interface SyncEngineState {
  status: SyncStatus;
  statusText: string;
  isOnline: boolean;
  pendingCount: number;
  lastSavedAt: Date | null;
  errorMessage: string | null;
}

const PENDING_QUEUE_KEY = CLINICAL_STORAGE_KEYS.pendingSyncQueue;

function readSessionJson<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeSessionJson(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("Error writing session draft:", e);
  }
}

/**
 * Garante IDs únicos nos arrays clínicos. Duplicata regenera ID — nunca descarta o lançamento.
 */
export function ensureUniqueClinicalEventIds(doc: AnesthesiaDocument): AnesthesiaDocument {
  if (!doc) return doc;

  const ensureIdsInArray = <T extends { id?: string }>(arr?: T[]): T[] => {
    if (!Array.isArray(arr)) return [];
    const seen = new Set<string>();
    return arr.filter(Boolean).map((item) => {
      let validId = item.id && item.id.trim() ? item.id : newClientId();
      while (seen.has(validId)) {
        validId = newClientId();
      }
      seen.add(validId);
      return { ...item, id: validId };
    });
  };

  return {
    ...doc,
    vitals: ensureIdsInArray(doc.vitals),
    bolusDrugs: ensureIdsInArray(doc.bolusDrugs),
    continuousInfusions: ensureIdsInArray(doc.continuousInfusions),
    inhalationAgents: ensureIdsInArray(doc.inhalationAgents),
    fluids: ensureIdsInArray(doc.fluids),
    outputs: ensureIdsInArray(doc.outputs),
    events: ensureIdsInArray(doc.events),
    incidents: ensureIdsInArray(doc.incidents),
    transfers: ensureIdsInArray(doc.transfers),
    amendments: ensureIdsInArray(doc.amendments),
    vascularAccesses: ensureIdsInArray(doc.vascularAccesses),
    narrativeLaunches: ensureIdsInArray(doc.narrativeLaunches)
  };
}

/**
 * Fila de sync pendente — só sessionStorage (some ao fechar a aba).
 * Nunca grava ficha em localStorage.
 */
export class SyncQueueManager {
  static getPendingQueue(): Record<string, { doc: AnesthesiaDocument; timestamp: string }> {
    return readSessionJson(PENDING_QUEUE_KEY, {});
  }

  static enqueue(ficha: AnesthesiaDocument) {
    purgeClinicalPhiFromLocalStorage();
    const queue = this.getPendingQueue();
    queue[ficha.id] = {
      doc: ficha,
      timestamp: new Date().toISOString()
    };
    writeSessionJson(PENDING_QUEUE_KEY, queue);
  }

  static dequeue(docId: string) {
    const queue = this.getPendingQueue();
    delete queue[docId];
    writeSessionJson(PENDING_QUEUE_KEY, queue);
  }

  static getPendingCount(): number {
    return Object.keys(this.getPendingQueue()).length;
  }
}
