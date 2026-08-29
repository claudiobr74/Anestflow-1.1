import { useState, useEffect, useRef } from "react";
import { AnesthesiaDocument } from "../types";
import { getProcedureById, saveProcedure } from "./proceduresService";
import { subscribeProcedureRealtime } from "./procedureRealtime";
import { isUuid } from "./procedureMapper";

export function useMultiplayer(
  documentId: string | null,
  _initialDocument: AnesthesiaDocument,
  onRemoteUpdate: (doc: AnesthesiaDocument) => void
) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeUsers] = useState<string[]>([]);
  const isLocalUpdate = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isSyncing || !documentId || !isUuid(documentId)) return;

    const unsubscribe = subscribeProcedureRealtime(documentId, () => {
      if (isLocalUpdate.current) return;
      void getProcedureById(documentId).then((remote) => {
        if (remote && !isLocalUpdate.current) onRemoteUpdate(remote);
      });
    });

    return () => unsubscribe();
  }, [documentId, isSyncing, onRemoteUpdate]);

  const broadcastChange = (newDoc: AnesthesiaDocument) => {
    if (!isSyncing || !documentId || !isUuid(documentId)) return;
    isLocalUpdate.current = true;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const { data } = await import("./supabase").then((m) => m.getSupabase().auth.getUser());
        const uid = data.user?.id;
        if (!uid) return;
        await saveProcedure(newDoc, uid);
      } catch (err) {
        console.error("Multiplayer sync error:", err);
      } finally {
        isLocalUpdate.current = false;
      }
    }, 1500);
  };

  const toggleSync = () => setIsSyncing(!isSyncing);

  return { isSyncing, toggleSync, broadcastChange, activeUsers };
}
