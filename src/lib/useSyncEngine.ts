import { useState, useEffect, useRef, useCallback } from "react";
import { AnesthesiaDocument } from "../types";
import { getProcedureById, isMeaningfulDocument, saveProcedure } from "./proceduresService";
import {
  SyncStatus,
  SyncQueueManager,
  ensureUniqueClinicalEventIds
} from "./syncEngine";
import { subscribeProcedureRealtime } from "./procedureRealtime";
import { isUuid } from "./procedureMapper";
import { clinicalChangeFingerprint } from "./clinicalChangeFingerprint";

export function useSyncEngine(
  document: AnesthesiaDocument,
  userId: string | undefined,
  onRemoteUpdate?: (remoteDoc: AnesthesiaDocument) => void
) {
  const [status, setStatus] = useState<SyncStatus>(() => {
    return navigator.onLine ? "saved" : "offline";
  });
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState<number>(() => SyncQueueManager.getPendingCount());
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLocalSavingRef = useRef<boolean>(false);
  const documentRef = useRef<AnesthesiaDocument>(document);

  // Keep document ref current to avoid stale closure issues in debounced save
  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  // Status label calculation
  const getStatusText = (st: SyncStatus, online: boolean): string => {
    if (!online || st === "offline") return "Offline — alterações nesta aba até sincronizar";
    switch (st) {
      case "syncing":
        return "Sincronizando...";
      case "saved":
        return "Salvo";
      case "error":
        return "Erro ao sincronizar";
      default:
        return "Salvo";
    }
  };

  const statusText = getStatusText(status, isOnline);

  // Function to flush all queued pending documents to Supabase
  const flushPendingQueue = useCallback(async () => {
    if (!userId || !navigator.onLine) {
      if (!navigator.onLine) setStatus("offline");
      return;
    }

    const queue = SyncQueueManager.getPendingQueue();
    const docIds = Object.keys(queue);

    if (docIds.length === 0) {
      setStatus("saved");
      setPendingCount(0);
      setErrorMessage(null);
      return;
    }

    setStatus("syncing");
    setErrorMessage(null);
    isLocalSavingRef.current = true;

    let successCount = 0;
    let hasFailure = false;

    for (const docId of docIds) {
      const item = queue[docId];
      if (!item || !item.doc) continue;

      try {
        const cleanedDoc = ensureUniqueClinicalEventIds(item.doc);
        if (!isMeaningfulDocument(cleanedDoc) || cleanedDoc.status === "Signed") {
          SyncQueueManager.dequeue(docId);
          continue;
        }
        await saveProcedure(cleanedDoc, userId);
        SyncQueueManager.dequeue(docId);

        if (cleanedDoc.id !== item.doc.id && onRemoteUpdate) {
          onRemoteUpdate(cleanedDoc);
        }

        successCount++;
      } catch (err: any) {
        console.error(`[SyncEngine] Falha ao sincronizar documento ${docId}:`, err);
        hasFailure = true;
        setErrorMessage(err?.message || "Erro de conexão ao salvar na nuvem");
      }
    }

    isLocalSavingRef.current = false;

    const remainingCount = SyncQueueManager.getPendingCount();
    setPendingCount(remainingCount);

    if (!hasFailure && remainingCount === 0) {
      setStatus("saved");
      setLastSavedAt(new Date());
      setErrorMessage(null);
    } else if (!navigator.onLine) {
      setStatus("offline");
    } else {
      setStatus("error");
      // Schedule auto-retry in 5 seconds
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        flushPendingQueue();
      }, 5000);
    }
  }, [userId]);

  // Network online/offline event listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (status === "offline" || SyncQueueManager.getPendingCount() > 0) {
        flushPendingQueue();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [status, flushPendingQueue]);

  // Single-writer check: Only currentResponsibleUid (or creator if unset) is authorized to save
  const currentResponsibleUid = document.currentResponsibleUid || document.createdByUid || document.userId;
  const isResponsible = !userId || !currentResponsibleUid || currentResponsibleUid === userId;

  // Continuous Autosave effect triggered on document changes (ONLY for current responsible)
  const currentDocIdRef = useRef<string>("");
  const lastDocStateHashRef = useRef<string>("");

  useEffect(() => {
    if (!document || !document.id) return;

    // Fast state hashing to detect genuine changes
    const currentHash = clinicalChangeFingerprint(document);

    // On initial mount or document switch, record current state hash without triggering auto-sync
    if (currentDocIdRef.current !== document.id || !lastDocStateHashRef.current) {
      currentDocIdRef.current = document.id;
      lastDocStateHashRef.current = currentHash;
      return;
    }

    if (currentHash === lastDocStateHashRef.current) {
      return;
    }
    lastDocStateHashRef.current = currentHash;

    // If document is signed or has no meaningful patient or clinical data, do NOT enqueue or save to cloud
    if (document.status === "Signed" || !isMeaningfulDocument(document)) {
      return;
    }

    // If user is NOT the responsible anesthesiologist, do NOT enqueue or save to cloud
    if (!isResponsible) {
      return;
    }

    // 1. Immediately normalize event IDs & save copy to sessionStorage queue
    const cleanedDoc = ensureUniqueClinicalEventIds(document);
    SyncQueueManager.enqueue(cleanedDoc);
    setPendingCount(SyncQueueManager.getPendingCount());

    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }

    // 2. Set status to syncing immediately for user feedback
    setStatus("syncing");

    // 3. Debounce cloud upload by 1200ms
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      flushPendingQueue();
    }, 1200);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [document, flushPendingQueue, isResponsible]);

  // Real-time remote listener (Supabase postgres_changes)
  useEffect(() => {
    if (!userId || !document.id || !isOnline || !isUuid(document.id)) return;

    const unsubscribe = subscribeProcedureRealtime(document.id, () => {
      if (isLocalSavingRef.current || !onRemoteUpdate) return;
      void getProcedureById(document.id).then((remote) => {
        if (!remote || isLocalSavingRef.current) return;
        lastDocStateHashRef.current = clinicalChangeFingerprint(remote);
        onRemoteUpdate(remote);
      }).catch((error) => {
        console.warn("[SyncEngine] Aviso no listener remoto:", error);
      });
    });

    return () => unsubscribe();
  }, [document.id, userId, isOnline, onRemoteUpdate]);

  // Manual retry sync function
  const retrySyncNow = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    flushPendingQueue();
  }, [flushPendingQueue]);

  return {
    status,
    statusText,
    isOnline,
    pendingCount,
    lastSavedAt,
    errorMessage,
    retrySyncNow,
    isResponsible
  };
}
