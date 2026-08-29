import { useState, useEffect, useRef, useCallback } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "./firebase";
import { AnesthesiaDocument } from "../types";
import { saveProcedure, isMeaningfulDocument } from "./proceduresService";
import { 
  SyncStatus, 
  SyncEngineState, 
  SyncQueueManager, 
  ensureUniqueClinicalEventIds 
} from "./syncEngine";

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
    if (!online || st === "offline") return "Offline — alterações protegidas";
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

  // Function to flush all queued pending documents to Firestore
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
    const currentHash = JSON.stringify({
      id: document.id,
      patient: document.patient,
      vitalsLen: document.vitals?.length || 0,
      vitalsLast: document.vitals?.[document.vitals.length - 1],
      drugsLen: document.bolusDrugs?.length || 0,
      drugsLast: document.bolusDrugs?.[document.bolusDrugs.length - 1],
      infusionsLen: document.continuousInfusions?.length || 0,
      infusionsLast: document.continuousInfusions?.[document.continuousInfusions.length - 1],
      eventsLen: document.events?.length || 0,
      eventsLast: document.events?.[document.events.length - 1],
      preEvaluation: document.preEvaluation,
      status: document.status,
      currentResponsibleUid: document.currentResponsibleUid
    });

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

    // 1. Immediately normalize event IDs & save copy to localStorage queue
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

  // Real-time remote snapshot listener for multiplayer / remote changes
  useEffect(() => {
    if (!userId || !document.id || !isOnline) return;

    const docRef = doc(db, "procedures", document.id);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as AnesthesiaDocument;
        // Ignore remote update if we are currently saving locally
        if (!isLocalSavingRef.current && onRemoteUpdate) {
          // Update last hash ref to prevent loop
          lastDocStateHashRef.current = JSON.stringify({
            id: data.id,
            patient: data.patient,
            vitalsLen: data.vitals?.length || 0,
            vitalsLast: data.vitals?.[data.vitals.length - 1],
            drugsLen: data.bolusDrugs?.length || 0,
            drugsLast: data.bolusDrugs?.[data.bolusDrugs.length - 1],
            infusionsLen: data.continuousInfusions?.length || 0,
            infusionsLast: data.continuousInfusions?.[data.continuousInfusions.length - 1],
            eventsLen: data.events?.length || 0,
            eventsLast: data.events?.[data.events.length - 1],
            preEvaluation: data.preEvaluation,
            status: data.status,
            currentResponsibleUid: data.currentResponsibleUid
          });
          onRemoteUpdate(data);
        }
      }
    }, (error) => {
      console.warn("[SyncEngine] Aviso no listener de snapshots remotos:", error);
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
