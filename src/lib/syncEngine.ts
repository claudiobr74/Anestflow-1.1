import { AnesthesiaDocument } from "../types";

export type SyncStatus = "saved" | "syncing" | "offline" | "error";

export interface SyncEngineState {
  status: SyncStatus;
  statusText: string;
  isOnline: boolean;
  pendingCount: number;
  lastSavedAt: Date | null;
  errorMessage: string | null;
}

const PENDING_QUEUE_KEY = "anestflow_pending_sync_queue";
const LOCAL_DOC_PREFIX = "anestflow_doc_local_";

/**
 * Ensures all nested clinical events in an AnesthesiaDocument have unique IDs and removes duplicate IDs.
 */
export function ensureUniqueClinicalEventIds(doc: AnesthesiaDocument): AnesthesiaDocument {
  if (!doc) return doc;

  const generateId = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "evt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
  };

  const ensureIdsInArray = <T extends { id?: string }>(arr?: T[]): T[] => {
    if (!Array.isArray(arr)) return [];
    const seen = new Set<string>();
    const deduplicated: T[] = [];

    for (const item of arr) {
      if (!item) continue;
      const validId = item.id && item.id.trim() ? item.id : generateId();
      if (!seen.has(validId)) {
        seen.add(validId);
        deduplicated.push({ ...item, id: validId });
      }
    }
    return deduplicated;
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
      localStorage.setItem(`${LOCAL_DOC_PREFIX}${document.id}`, JSON.stringify(document));
      localStorage.setItem("anesthesia_doc", JSON.stringify(document));
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
      localStorage.setItem(`${LOCAL_DOC_PREFIX}${document.id}`, JSON.stringify(document));
      localStorage.setItem("anesthesia_doc", JSON.stringify(document));
    } catch (e) {}
  }

  static getLocalCopy(docId: string): AnesthesiaDocument | null {
    try {
      const raw = localStorage.getItem(`${LOCAL_DOC_PREFIX}${docId}`);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
}
