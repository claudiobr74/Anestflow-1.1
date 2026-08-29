import { useState, useEffect, useRef, useCallback } from "react";
import { AnesthesiaDocument } from "../types";
import { getProcedureById, isMeaningfulDocument, saveProcedure } from "./proceduresService";
import {
  SyncStatus,
  SyncQueueManager,
  ensureUniqueClinicalEventIds
} from "./syncEngine";
import { subscribeProcedureRealtime } from "./procedureRealtime";
import { isUuid, expectedProcedureRevision } from "./procedureMapper";
import { clinicalChangeFingerprint } from "./clinicalChangeFingerprint";
import { canEditDocument } from "./assertCanEdit";
import { isStaleRevisionError, mapClinicalError, REMOTE_DIRTY_CONFLICT_MESSAGE } from "./clinicalErrors";

export function useSyncEngine(
  ficha: AnesthesiaDocument,
  userId: string | undefined,
  onRemoteUpdate?: (remoteDoc: AnesthesiaDocument) => void
) {
  const [status, setStatus] = useState<SyncStatus>(() => {
    return navigator.onLine ? "saved" : "offline";
  });
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== "undefined" ? navigator.onLine : true);
  const [autosavePaused, setAutosavePaused] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(() => SyncQueueManager.getPendingCount());
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLocalSavingRef = useRef<boolean>(false);
  const fichaRef = useRef<AnesthesiaDocument>(ficha);
  const lastDocStateHashRef = useRef<string>("");
  const autosavePausedRef = useRef(false);

  // Keep ficha ref current to avoid stale closure issues in debounced save
  useEffect(() => {
    fichaRef.current = ficha;
  }, [ficha]);

  // Status label calculation
  const getStatusText = (st: SyncStatus, online: boolean, paused: boolean): string => {
    if (!online || st === "offline") return "Offline — alterações nesta aba até sincronizar";
    if (paused) return "Autosave pausado — alterações neste dispositivo";
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

  const statusText = getStatusText(status, isOnline, autosavePaused);

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
    let staleConflict = false;

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

        const live = fichaRef.current;
        const next: AnesthesiaDocument = {
          ...live,
          id: cleanedDoc.id,
          revision: cleanedDoc.revision ?? live.revision,
          updatedAt: cleanedDoc.updatedAt || live.updatedAt
        };
        fichaRef.current = next;
        lastDocStateHashRef.current = clinicalChangeFingerprint(next);
        if (onRemoteUpdate) onRemoteUpdate(next);

        successCount++;
      } catch (err: unknown) {
        console.error(`[SyncEngine] Falha ao sincronizar documento ${docId}:`, err);
        if (isStaleRevisionError(err)) {
          const localDoc = item.doc;
          SyncQueueManager.dequeue(docId);
          staleConflict = true;
          autosavePausedRef.current = true;
          setAutosavePaused(true);
          const staleId = item.doc.id;
          if (isUuid(staleId)) {
            try {
              const remote = await getProcedureById(staleId);
              if (remote) {
                const localFp = clinicalChangeFingerprint(localDoc);
                const remoteFp = clinicalChangeFingerprint(remote);
                if (localFp === remoteFp) {
                  lastDocStateHashRef.current = remoteFp;
                  fichaRef.current = remote;
                  if (onRemoteUpdate) onRemoteUpdate(remote);
                  setErrorMessage(mapClinicalError(err).message);
                } else {
                  setErrorMessage(REMOTE_DIRTY_CONFLICT_MESSAGE);
                }
              } else {
                setErrorMessage(mapClinicalError(err).message);
              }
            } catch (reloadErr) {
              console.warn("[SyncEngine] Falha ao recarregar ficha após conflito de revision:", reloadErr);
              setErrorMessage(mapClinicalError(err).message);
            }
          } else {
            setErrorMessage(mapClinicalError(err).message);
          }
          continue;
        }
        hasFailure = true;
        const mapped = err instanceof Error ? err.message : mapClinicalError(err).message;
        setErrorMessage(mapped || "Erro de conexão ao salvar na nuvem");
      }
    }

    isLocalSavingRef.current = false;

    const remainingCount = SyncQueueManager.getPendingCount();
    setPendingCount(remainingCount);

    if (!hasFailure && remainingCount === 0) {
      if (staleConflict) {
        setStatus("error");
      } else {
        setStatus("saved");
        setLastSavedAt(new Date());
        setErrorMessage(null);
      }
    } else if (!navigator.onLine) {
      setStatus("offline");
    } else {
      setStatus("error");
      if (hasFailure && !autosavePausedRef.current) {
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          flushPendingQueue();
        }, 5000);
      }
    }
  }, [userId, onRemoteUpdate]);

  // Network online/offline event listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (autosavePausedRef.current) return;
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

  const isResponsible = canEditDocument(ficha, userId).ok;

  // Continuous Autosave effect triggered on ficha changes (ONLY for current responsible)
  const currentDocIdRef = useRef<string>("");

  useEffect(() => {
    if (!ficha || !ficha.id) return;

    // Fast state hashing to detect genuine changes
    const currentHash = clinicalChangeFingerprint(ficha);

    // On initial mount or ficha switch, record current state hash without triggering auto-sync
    if (currentDocIdRef.current !== ficha.id || !lastDocStateHashRef.current) {
      currentDocIdRef.current = ficha.id;
      lastDocStateHashRef.current = currentHash;
      return;
    }

    if (currentHash === lastDocStateHashRef.current) {
      return;
    }

    // Pausado: não atualiza o hash para o resume enxergar as mudanças.
    if (autosavePaused) {
      return;
    }

    lastDocStateHashRef.current = currentHash;

    // If ficha is signed or has no meaningful patient or clinical data, do NOT enqueue or save to cloud
    if (ficha.status === "Signed" || !isMeaningfulDocument(ficha)) {
      return;
    }

    // If user is NOT the responsible anesthesiologist, do NOT enqueue or save to cloud
    if (!isResponsible) {
      return;
    }

    // 1. Immediately normalize event IDs & save copy to sessionStorage queue
    const cleanedDoc = ensureUniqueClinicalEventIds(ficha);
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
  }, [ficha, flushPendingQueue, isResponsible, autosavePaused]);

  // Real-time remote listener (Supabase postgres_changes)
  useEffect(() => {
    if (!userId || !ficha.id || !isOnline || !isUuid(ficha.id)) return;

    const unsubscribe = subscribeProcedureRealtime(ficha.id, () => {
      if (isLocalSavingRef.current || !onRemoteUpdate) return;
      const procedureId = fichaRef.current.id;
      void getProcedureById(procedureId).then((remote) => {
        if (!remote || isLocalSavingRef.current) return;
        const localRev = expectedProcedureRevision(fichaRef.current);
        const remoteRev = expectedProcedureRevision(remote);
        if (remoteRev < localRev) return;
        const queued = SyncQueueManager.getPendingQueue()[procedureId];
        if (queued) {
          setStatus("error");
          setErrorMessage(REMOTE_DIRTY_CONFLICT_MESSAGE);
          return;
        }
        lastDocStateHashRef.current = clinicalChangeFingerprint(remote);
        onRemoteUpdate(remote);
      }).catch((error) => {
        console.warn("[SyncEngine] Aviso no listener remoto:", error);
      });
    });

    return () => unsubscribe();
  }, [ficha.id, userId, isOnline, onRemoteUpdate]);

  // Manual retry sync function
  const retrySyncNow = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    flushPendingQueue();
  }, [flushPendingQueue]);

  const pauseAutosave = useCallback(() => {
    autosavePausedRef.current = true;
    setAutosavePaused(true);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const resumeAutosave = useCallback(() => {
    autosavePausedRef.current = false;
    setAutosavePaused(false);
    void flushPendingQueue();
  }, [flushPendingQueue]);

  const toggleAutosavePause = useCallback(() => {
    if (autosavePausedRef.current) resumeAutosave();
    else pauseAutosave();
  }, [pauseAutosave, resumeAutosave]);

  return {
    status,
    statusText,
    isOnline,
    autosavePaused,
    pendingCount,
    lastSavedAt,
    errorMessage,
    retrySyncNow,
    pauseAutosave,
    resumeAutosave,
    toggleAutosavePause,
    isResponsible
  };
}
