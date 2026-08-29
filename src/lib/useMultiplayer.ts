import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import { AnesthesiaDocument } from '../types';

export function useMultiplayer(
  documentId: string | null,
  initialDocument: AnesthesiaDocument,
  onRemoteUpdate: (doc: AnesthesiaDocument) => void
) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const isLocalUpdate = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isSyncing || !documentId || !auth.currentUser) return;

    const docRef = doc(db, 'procedures', documentId);
    
    // Listen for remote changes
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as AnesthesiaDocument;
        // Only update if it wasn't our own recent save (optimistic)
        if (!isLocalUpdate.current) {
          onRemoteUpdate(data);
        }
      }
    });

    return () => unsubscribe();
  }, [documentId, isSyncing]);

  // Call this function whenever local document changes
  const broadcastChange = (newDoc: AnesthesiaDocument) => {
    if (!isSyncing || !documentId || !auth.currentUser) return;

    isLocalUpdate.current = true;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const docRef = doc(db, 'procedures', documentId);
        await setDoc(docRef, {
          ...newDoc,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error("Multiplayer sync error:", err);
      } finally {
        isLocalUpdate.current = false;
      }
    }, 1500); // Debounce to prevent excessive writes
  };

  const toggleSync = () => setIsSyncing(!isSyncing);

  return { isSyncing, toggleSync, broadcastChange, activeUsers };
}
