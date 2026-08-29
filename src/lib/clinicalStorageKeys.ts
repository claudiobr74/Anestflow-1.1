/**
 * Chaves de cache clínico no navegador.
 *
 * PHI da ficha (paciente, vitais, fármacos, SRPA…) só vive em sessionStorage:
 * some ao fechar a aba. localStorage guarda tema, presets e relógio de sessão —
 * nunca a ficha. Chaves legado em localStorage existem só para purge na subida.
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

/** Chave de localStorage que já guardou PHI e não deve mais ser gravada. */
export function isLegacyClinicalPhiLocalStorageKey(key: string): boolean {
  return (
    key === CLINICAL_STORAGE_KEYS.anesthesiaDoc ||
    key === CLINICAL_STORAGE_KEYS.pendingSyncQueue ||
    key.startsWith(CLINICAL_STORAGE_KEYS.localDocPrefix)
  );
}

export function isClinicalSessionDraftKey(key: string): boolean {
  return (
    key === CLINICAL_STORAGE_KEYS.pendingSyncQueue ||
    key.startsWith(CLINICAL_STORAGE_KEYS.activeDocPrefix)
  );
}

function collectMatchingKeys(storage: Storage, match: (key: string) => boolean): string[] {
  const found: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && match(key)) found.push(key);
  }
  return found;
}

/** Apaga cópias legado de ficha/fila no localStorage. Não toca tema nem presets. */
export function purgeClinicalPhiFromLocalStorage(): string[] {
  const removed: string[] = [];
  try {
    const stale = collectMatchingKeys(localStorage, isLegacyClinicalPhiLocalStorageKey);
    stale.forEach((key) => {
      localStorage.removeItem(key);
      removed.push(key);
    });
  } catch {
    /* ignore quota / private mode */
  }
  return removed;
}

export function localStorageHoldsClinicalPhi(): boolean {
  try {
    return collectMatchingKeys(localStorage, isLegacyClinicalPhiLocalStorageKey).length > 0;
  } catch {
    return false;
  }
}

/** Fila offline + rascunho ativo da aba. Não encerra a sessão Auth. */
export function clearClinicalSessionDrafts(): string[] {
  const removed: string[] = [];
  try {
    const stale = collectMatchingKeys(sessionStorage, isClinicalSessionDraftKey);
    stale.forEach((key) => {
      sessionStorage.removeItem(key);
      removed.push(key);
    });
  } catch {
    /* ignore */
  }
  return removed;
}

/** Lista estável para testes e README. */
export const CLINICAL_CACHE_KEY_INVENTORY = [
  CLINICAL_STORAGE_KEYS.anesthesiaDoc,
  `${CLINICAL_STORAGE_KEYS.localDocPrefix}<procedureId>`,
  CLINICAL_STORAGE_KEYS.pendingSyncQueue,
  `${CLINICAL_STORAGE_KEYS.activeDocPrefix}<uid>`,
] as const;
