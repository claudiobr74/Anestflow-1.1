/**
 * Inventário das chaves de cache clínico atuais.
 * Documenta o que existe hoje; a limpeza correta (PHI/localStorage) é a Fase 2.
 */
export const CLINICAL_STORAGE_KEYS = {
  anesthesiaDoc: "anesthesia_doc",
  pendingSyncQueue: "anestflow_pending_sync_queue",
  localDocPrefix: "anestflow_doc_local_",
  activeDocPrefix: "anestflow_active_doc_",
} as const;

export function localDocStorageKey(procedureId: string): string {
  return `${CLINICAL_STORAGE_KEYS.localDocPrefix}${procedureId}`;
}

export function activeDocSessionKey(uid: string): string {
  return `${CLINICAL_STORAGE_KEYS.activeDocPrefix}${uid}`;
}

/** Lista estável para testes e README — não inclui limpeza automática. */
export const CLINICAL_CACHE_KEY_INVENTORY = [
  CLINICAL_STORAGE_KEYS.anesthesiaDoc,
  `${CLINICAL_STORAGE_KEYS.localDocPrefix}<procedureId>`,
  CLINICAL_STORAGE_KEYS.pendingSyncQueue,
  `${CLINICAL_STORAGE_KEYS.activeDocPrefix}<uid>`,
] as const;
