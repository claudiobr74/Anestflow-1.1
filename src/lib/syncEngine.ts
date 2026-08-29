import { AnesthesiaDocument } from "../types";
import { newClientId } from "./procedureMapper";
import {
  CLINICAL_STORAGE_KEYS,
  localDocStorageKey,
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
 * Manages local persistence for pending changes queue in localStorage
 */
export class SyncQueueManager {
  static getPendingQueue(): Record<string, { doc: AnesthesiaDocument; timestamp: string }> {
    try {
      const raw = localStorage.getItem(PENDING_QUEUE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn("Error reading pending sync queue:", e);
      return {};
    }
  }

  static enqueue(document: AnesthesiaDocument) {
    try {
      const queue = this.getPendingQueue();
      queue[document.id] = {
        doc: document,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
      
      // Also cache local document
      localStorage.setItem(localDocStorageKey(document.id), JSON.stringify(document));
      localStorage.setItem(CLINICAL_STORAGE_KEYS.anesthesiaDoc, JSON.stringify(document));
    } catch (e) {
      console.warn("Error enqueueing pending document:", e);
    }
  }

  static dequeue(docId: string) {
    try {
      const queue = this.getPendingQueue();
      delete queue[docId];
      localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.warn("Error dequeueing pending document:", e);
    }
  }

  static getPendingCount(): number {
    return Object.keys(this.getPendingQueue()).length;
  }

  static saveLocalCopy(document: AnesthesiaDocument) {
    try {
      localStorage.setItem(localDocStorageKey(document.id), JSON.stringify(document));
      localStorage.setItem(CLINICAL_STORAGE_KEYS.anesthesiaDoc, JSON.stringify(document));
    } catch (e) {}
  }

  static getLocalCopy(docId: string): AnesthesiaDocument | null {
    try {
      const raw = localStorage.getItem(localDocStorageKey(docId));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
}
