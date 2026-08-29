import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc,
  deleteDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  runTransaction
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { AnesthesiaDocument, AnesthesiologistTransfer, DocumentAmendment } from "../types";
import { ensureUniqueClinicalEventIds } from "./syncEngine";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export type ClinicalSubcollectionName = "vitals" | "medications" | "fluids" | "infusions" | "clinicalEvents" | "transfers";

/**
 * Persists all clinical events from an AnesthesiaDocument into individual subcollections:
 * - vitals: procedures/{id}/vitals/{vitalId}
 * - medications: procedures/{id}/medications/{medicationId}
 * - fluids: procedures/{id}/fluids/{fluidId}
 * - infusions: procedures/{id}/infusions/{infusionId}
 * - clinicalEvents: procedures/{id}/clinicalEvents/{eventId}
 * - transfers: procedures/{id}/transfers/{transferId}
 */
export async function persistClinicalEventsSubcollections(docObj: AnesthesiaDocument, userId: string): Promise<void> {
  if (!docObj || !docObj.id || docObj.id.startsWith("doc-mock") || docObj.id.includes("mock")) {
    return;
  }

  const procedureId = docObj.id;
  const currentUid = userId || auth.currentUser?.uid || docObj.currentResponsibleUid || docObj.createdByUid || "anon-uid";

  const buildSubdocPayload = (item: any, typePrefix: string) => {
    const itemId = item.id && item.id.trim() ? item.id : `${typePrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const clinicalTimestamp = item.timestamp || item.time || item.startTime || new Date().toISOString();
    
    // Omit undefined fields so Firestore doesn't complain
    const cleanItem: Record<string, any> = {};
    Object.keys(item).forEach(k => {
      if (item[k] !== undefined) cleanItem[k] = item[k];
    });

    return {
      ...cleanItem,
      id: itemId,
      procedureId,
      clinicalTimestamp,
      createdAt: item.createdAt || new Date().toISOString(),
      createdByUid: item.createdByUid || currentUid,
      serverTimestamp: serverTimestamp()
    };
  };

  const saveBatch = async (items: any[], subcollectionName: ClinicalSubcollectionName, typePrefix: string) => {
    if (!items || !Array.isArray(items) || items.length === 0) return;
    const promises = items.map(async (item) => {
      if (!item) return;
      const payload = buildSubdocPayload(item, typePrefix);
      const subDocRef = doc(db, "procedures", procedureId, subcollectionName, payload.id);
      try {
        await setDoc(subDocRef, payload, { merge: true });
      } catch (err) {
        console.warn(`[persistClinicalEventsSubcollections] Error saving ${subcollectionName}/${payload.id}:`, err);
      }
    });
    await Promise.all(promises);
  };

  try {
    await Promise.all([
      saveBatch(docObj.vitals || [], "vitals", "v"),
      saveBatch(docObj.bolusDrugs || [], "medications", "med"),
      saveBatch(docObj.fluids || [], "fluids", "fl"),
      saveBatch(docObj.continuousInfusions || [], "infusions", "inf"),
      saveBatch(docObj.events || [], "clinicalEvents", "evt"),
      saveBatch(docObj.transfers || [], "transfers", "trf")
    ]);
  } catch (err) {
    console.warn(`[persistClinicalEventsSubcollections] Partial warning during subcollection batch save:`, err);
  }
}

/**
 * Directly adds or updates a single clinical event item in its subcollection
 */
export async function addClinicalEventItem(
  procedureId: string,
  subcollectionName: ClinicalSubcollectionName,
  itemData: any,
  userId?: string
): Promise<void> {
  if (!procedureId || procedureId.startsWith("doc-mock") || procedureId.includes("mock")) {
    return;
  }

  const currentUid = userId || auth.currentUser?.uid || "anon-uid";
  const itemId = itemData.id || `${subcollectionName.substring(0, 3)}-${Date.now()}`;
  const clinicalTimestamp = itemData.timestamp || itemData.time || itemData.startTime || new Date().toISOString();

  const cleanData: Record<string, any> = {};
  Object.keys(itemData).forEach(k => {
    if (itemData[k] !== undefined) cleanData[k] = itemData[k];
  });

  const payload = {
    ...cleanData,
    id: itemId,
    procedureId,
    clinicalTimestamp,
    createdAt: itemData.createdAt || new Date().toISOString(),
    createdByUid: itemData.createdByUid || currentUid,
    serverTimestamp: serverTimestamp()
  };

  const path = `procedures/${procedureId}/${subcollectionName}/${itemId}`;
  try {
    const subDocRef = doc(db, "procedures", procedureId, subcollectionName, itemId);
    await setDoc(subDocRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Fetches all clinical event items from a specific subcollection
 */
export async function getClinicalEventItems<T>(
  procedureId: string,
  subcollectionName: ClinicalSubcollectionName
): Promise<T[]> {
  if (!procedureId || procedureId.startsWith("doc-mock") || procedureId.includes("mock")) {
    return [];
  }

  const path = `procedures/${procedureId}/${subcollectionName}`;
  try {
    const colRef = collection(db, "procedures", procedureId, subcollectionName);
    const snap = await getDocs(colRef);
    return snap.docs.map(docSnap => docSnap.data() as T);
  } catch (error) {
    console.warn(`[getClinicalEventItems] Could not fetch ${subcollectionName} for ${procedureId}:`, error);
    return [];
  }
}

/**
 * Deletes a single clinical event item from a subcollection
 */
export async function deleteClinicalEventItem(
  procedureId: string,
  subcollectionName: ClinicalSubcollectionName,
  itemId: string
): Promise<void> {
  if (!procedureId || procedureId.startsWith("doc-mock") || procedureId.includes("mock")) {
    return;
  }

  const path = `procedures/${procedureId}/${subcollectionName}/${itemId}`;
  try {
    const subDocRef = doc(db, "procedures", procedureId, subcollectionName, itemId);
    await deleteDoc(subDocRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Concurrently fetches subcollections for a procedure and merges subcollection items
 * with embedded array data, preserving 100% backwards compatibility with existing documents.
 */
export async function fetchProcedureSubcollections(procedureId: string, baseDoc: AnesthesiaDocument): Promise<AnesthesiaDocument> {
  if (!procedureId || procedureId.startsWith("doc-mock") || procedureId.includes("mock")) {
    return baseDoc;
  }

  try {
    const [vitalsSnap, medsSnap, fluidsSnap, infusionsSnap, eventsSnap, transfersSnap] = await Promise.all([
      getDocs(collection(db, "procedures", procedureId, "vitals")).catch(() => null),
      getDocs(collection(db, "procedures", procedureId, "medications")).catch(() => null),
      getDocs(collection(db, "procedures", procedureId, "fluids")).catch(() => null),
      getDocs(collection(db, "procedures", procedureId, "infusions")).catch(() => null),
      getDocs(collection(db, "procedures", procedureId, "clinicalEvents")).catch(() => null),
      getDocs(collection(db, "procedures", procedureId, "transfers")).catch(() => null)
    ]);

    const mergeArray = <T extends { id?: string }>(baseArray: T[] = [], snap: any): T[] => {
      const map = new Map<string, T>();
      (baseArray || []).forEach(item => { if (item && item.id) map.set(item.id, item); });
      if (snap && snap.docs) {
        snap.docs.forEach((docSnap: any) => {
          const data = docSnap.data() as T;
          if (data && data.id) {
            map.set(data.id, { ...map.get(data.id), ...data });
          }
        });
      }
      return Array.from(map.values());
    };

    const mergedVitals = mergeArray(baseDoc.vitals, vitalsSnap);
    mergedVitals.sort((a, b) => (a as any).minutesFromStart - (b as any).minutesFromStart);

    const mergedMeds = mergeArray(baseDoc.bolusDrugs, medsSnap);
    mergedMeds.sort((a, b) => (a as any).minutesFromStart - (b as any).minutesFromStart);

    const mergedFluids = mergeArray(baseDoc.fluids, fluidsSnap);

    const mergedInfusions = mergeArray(baseDoc.continuousInfusions, infusionsSnap);

    const mergedEvents = mergeArray(baseDoc.events, eventsSnap);
    mergedEvents.sort((a, b) => new Date((a as any).timestamp || 0).getTime() - new Date((b as any).timestamp || 0).getTime());

    const mergedTransfers = mergeArray(baseDoc.transfers, transfersSnap);
    mergedTransfers.sort((a, b) => new Date((a as any).timestamp || 0).getTime() - new Date((b as any).timestamp || 0).getTime());

    return {
      ...baseDoc,
      vitals: mergedVitals,
      bolusDrugs: mergedMeds,
      fluids: mergedFluids,
      continuousInfusions: mergedInfusions,
      events: mergedEvents,
      transfers: mergedTransfers
    };
  } catch (err) {
    console.warn(`[fetchProcedureSubcollections] Could not load subcollections for ${procedureId}:`, err);
    return baseDoc;
  }
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Evaluates whether an anesthesia document has meaningful patient or clinical data
 * to avoid persisting blank/empty template stubs.
 */
export function isMeaningfulDocument(docObj: Partial<AnesthesiaDocument>): boolean {
  if (!docObj) return false;
  const p = docObj.patient;
  if (p) {
    if (p.fullName && p.fullName.trim().length > 0) return true;
    if (p.recordNumber && p.recordNumber.trim().length > 0) return true;
    if (p.cpf && p.cpf.trim().length > 0) return true;
    if (p.admissionNumber && p.admissionNumber.trim().length > 0) return true;
  }
  if (docObj.vitals && docObj.vitals.length > 0) return true;
  if (docObj.events && docObj.events.length > 0) return true;
  if (docObj.bolusDrugs && docObj.bolusDrugs.length > 0) return true;
  if (docObj.continuousInfusions && docObj.continuousInfusions.length > 0) return true;
  if (docObj.fluids && docObj.fluids.length > 0) return true;
  if (docObj.timers && (docObj.timers.startAnesthesia || docObj.timers.startSurgery)) return true;
  if (docObj.preEvaluation && (docObj.preEvaluation.physicalExam?.respiratory || docObj.preEvaluation.airwayEvaluation || docObj.preEvaluation.currentMedications)) return true;
  return false;
}

/**
 * Saves or updates an anesthesia sheet in Firestore with single-writer concurrency check and safe array merging
 */
export async function saveProcedure(document: AnesthesiaDocument, userId: string): Promise<void> {
  if (!userId) {
    throw new Error("Usuário não autenticado.");
  }

  // Guard: Do NOT persist blank or uninitialized document stubs to Firestore
  if (!isMeaningfulDocument(document)) {
    return;
  }

  // Ensure unique IDs for all clinical events before saving to prevent duplication
  const cleanedDoc = ensureUniqueClinicalEventIds(document);

  // If this is a draft with a fresh local ID (e.g. doc-TIMESTAMP), attempt to bind to an existing Draft for the same patient
  if (cleanedDoc.status !== "Signed" && (cleanedDoc.id.startsWith("doc-") || cleanedDoc.id.includes("temp"))) {
    const recordNum = cleanedDoc.patient?.recordNumber?.trim();
    const cpf = cleanedDoc.patient?.cpf?.trim();
    const fullName = cleanedDoc.patient?.fullName?.trim().toLowerCase();

    if (recordNum || cpf || fullName) {
      try {
        const qCreated = query(collection(db, "procedures"), where("createdByUid", "==", userId));
        const userSnap = await getDocs(qCreated).catch(() => ({ docs: [] }));
        for (const dSnap of userSnap.docs) {
          const dData = dSnap.data() as AnesthesiaDocument;
          if (dData && dData.id && dData.status !== "Signed") {
            const sameRecord = recordNum && dData.patient?.recordNumber?.trim() === recordNum;
            const sameCpf = cpf && dData.patient?.cpf?.trim() === cpf;
            const sameNameAndDate = fullName && dData.patient?.fullName?.trim().toLowerCase() === fullName && dData.patient?.date === cleanedDoc.patient?.date;
            if (sameRecord || sameCpf || sameNameAndDate) {
              cleanedDoc.id = dData.id;
              document.id = dData.id;
              break;
            }
          }
        }
      } catch (e) {
        console.warn("[saveProcedure] Aviso ao verificar ficha pré-existente:", e);
      }
    }
  }
  
  // Ensure createdByUid and currentResponsibleUid are clean UIDs
  let createdByUid = cleanedDoc.createdByUid;
  if (!createdByUid || createdByUid === "mock-uid" || createdByUid === "anon-uid" || createdByUid === "user-123" || createdByUid === "Definido no registro") {
    createdByUid = userId;
  }
  let currentResponsibleUid = cleanedDoc.currentResponsibleUid;
  if (!currentResponsibleUid || currentResponsibleUid === "mock-uid" || currentResponsibleUid === "anon-uid" || currentResponsibleUid === "user-123") {
    currentResponsibleUid = createdByUid;
  }

  // Single-writer check: if document has a currentResponsibleUid set and it's not the user
  if (cleanedDoc.currentResponsibleUid && cleanedDoc.currentResponsibleUid !== userId && createdByUid !== userId && currentResponsibleUid !== userId) {
    throw new Error(`Apenas o anestesiologista responsável atual (Dr. ${cleanedDoc.team?.anesthesiologistLead || 'Responsável'}) pode salvar alterações nesta ficha.`);
  }

  const participantUids = Array.from(new Set([
    ...(cleanedDoc.participantUids || []).filter(u => u && u !== "mock-uid" && u !== "anon-uid"),
    createdByUid,
    currentResponsibleUid,
    userId
  ]));

  const path = `procedures/${cleanedDoc.id}`;
  const payload = {
    ...cleanedDoc,
    createdByUid,
    currentResponsibleUid,
    participantUids,
    userId: createdByUid, // preserve legacy userId pointing to creator
    updatedAt: new Date().toISOString(),
    updatedAtServer: serverTimestamp()
  };

  try {
    const docRef = doc(db, "procedures", cleanedDoc.id);

    await Promise.race([
      runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(docRef);
        let mergedPayload: Record<string, any> = { ...payload };

        if (sfDoc.exists()) {
          const serverData = sfDoc.data() as AnesthesiaDocument;

          // Immutability Guard: If document is already signed on server, prevent any modification unless it's a re-save of the signed state
          if (serverData.status === "Signed") {
            if (cleanedDoc.status === "Signed") {
              // Document is already signed in Firestore, no further modification needed
              return;
            }
            throw new Error("Ficha Assinada e Imutável: O documento foi assinado digitalmente e não pode mais sofrer alterações diretamente. Para correções, utilize o recurso de Adendo Retificatório Imutável.");
          }

          // Single-writer concurrency guard against race condition
          const serverResponsible = serverData.currentResponsibleUid || serverData.createdByUid || serverData.userId;
          if (serverResponsible && serverResponsible !== userId) {
            throw new Error(`Edição bloqueada: A ficha está sob a responsabilidade de Dr(a). ${serverData.team?.anesthesiologistLead || 'outro profissional'}.`);
          }

          // Smart array merge by item ID to avoid wiping out events added remotely
          const mergeArrayById = <T extends { id?: string }>(serverArr: T[] = [], localArr: T[] = []): T[] => {
            const map = new Map<string, T>();
            serverArr.forEach(item => { if (item && item.id) map.set(item.id, item); });
            localArr.forEach(item => { if (item && item.id) map.set(item.id, item); });
            return Array.from(map.values());
          };

          mergedPayload.vitals = mergeArrayById(serverData.vitals, cleanedDoc.vitals);
          mergedPayload.bolusDrugs = mergeArrayById(serverData.bolusDrugs, cleanedDoc.bolusDrugs);
          mergedPayload.continuousInfusions = mergeArrayById(serverData.continuousInfusions, cleanedDoc.continuousInfusions);
          mergedPayload.inhalationAgents = mergeArrayById(serverData.inhalationAgents, cleanedDoc.inhalationAgents);
          mergedPayload.events = mergeArrayById(serverData.events, cleanedDoc.events);
          mergedPayload.fluids = mergeArrayById(serverData.fluids, cleanedDoc.fluids);
          mergedPayload.outputs = mergeArrayById(serverData.outputs, cleanedDoc.outputs);
          mergedPayload.incidents = mergeArrayById(serverData.incidents, cleanedDoc.incidents);
          mergedPayload.transfers = mergeArrayById(serverData.transfers, cleanedDoc.transfers);
          mergedPayload.vascularAccesses = mergeArrayById(serverData.vascularAccesses, cleanedDoc.vascularAccesses);
        }

        transaction.set(docRef, mergedPayload, { merge: true });
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout ao salvar ficha no Firestore")), 8000))
    ]);

    // Incrementally persist clinical events into individual subcollections
    await persistClinicalEventsSubcollections(cleanedDoc, userId);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Atomically transfers responsibility of a procedure to another anesthesiologist in Firestore
 */
export async function transferResponsibilityAtomic(
  procedureId: string,
  currentUserId: string,
  incomingDoctor: {
    uid: string;
    name: string;
    crm: string;
    uf: string;
    email?: string;
  },
  outgoingDoctor: {
    uid?: string;
    name: string;
    crm: string;
    uf: string;
  },
  handoverDetails: {
    clinicalConditions: string;
    incidentsReported: string;
    ongoingInfusions: string;
    pendingItems: string;
  }
): Promise<AnesthesiaDocument> {
  if (!currentUserId) {
    throw new Error("Usuário não autenticado.");
  }

  const path = `procedures/${procedureId}`;
  const docRef = doc(db, "procedures", procedureId);

  try {
    const updatedDoc = await runTransaction(db, async (transaction) => {
      const sfDoc = await transaction.get(docRef);
      if (!sfDoc.exists()) {
        throw new Error("Ficha não encontrada no Firestore.");
      }

      const serverData = sfDoc.data() as AnesthesiaDocument;
      if (serverData.status === "Signed") {
        throw new Error("Ficha encerrada e assinada. A troca de responsabilidade não é permitida.");
      }

      const nowStr = new Date().toISOString();
      const timeStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      const transferRecord: AnesthesiologistTransfer = {
        id: "trf-" + Date.now().toString(),
        timestamp: nowStr,
        outgoingUid: outgoingDoctor.uid || serverData.currentResponsibleUid || serverData.createdByUid || currentUserId,
        outgoingName: outgoingDoctor.name || serverData.team?.anesthesiologistLead || "Anestesiologista Anterior",
        outgoingCRM: outgoingDoctor.crm || serverData.team?.crmLead || "",
        outgoingUF: outgoingDoctor.uf || serverData.team?.ufLead || "SP",
        incomingUid: incomingDoctor.uid,
        incomingName: incomingDoctor.name,
        incomingCRM: incomingDoctor.crm,
        incomingUF: incomingDoctor.uf,
        clinicalConditions: handoverDetails.clinicalConditions,
        incidentsReported: handoverDetails.incidentsReported,
        ongoingInfusions: handoverDetails.ongoingInfusions,
        pendingItems: handoverDetails.pendingItems,
        acceptedAt: nowStr
      };

      const newEvent = {
        id: "evt-trf-" + Date.now().toString(),
        timestamp: nowStr,
        time: timeStr,
        name: `Troca de Responsabilidade Concluída: Dr(a). ${outgoingDoctor.name || serverData.team?.anesthesiologistLead || 'Anterior'} ➔ Dr(a). ${incomingDoctor.name}`,
        category: "Equipe" as const,
        notes: `Novo responsável: CRM ${incomingDoctor.crm}/${incomingDoctor.uf}. Condições: ${handoverDetails.clinicalConditions || 'Estável'}.`
      };

      const creatorUid = serverData.createdByUid || serverData.userId || currentUserId;
      const participantUids = Array.from(new Set([
        ...(serverData.participantUids || []),
        creatorUid,
        serverData.currentResponsibleUid || "",
        incomingDoctor.uid,
        currentUserId
      ])).filter(Boolean);

      const sharedWithEmails = Array.from(new Set([
        ...(serverData.sharedWithEmails || []),
        ...(incomingDoctor.email ? [incomingDoctor.email.toLowerCase()] : [])
      ]));

      const updates: Partial<AnesthesiaDocument> = {
        currentResponsibleUid: incomingDoctor.uid,
        participantUids,
        sharedWithEmails,
        pendingTransfer: undefined,
        team: {
          ...serverData.team,
          anesthesiologistLead: incomingDoctor.name,
          crmLead: incomingDoctor.crm,
          ufLead: incomingDoctor.uf,
          anesthesiologistAssistant: `Anterior: ${outgoingDoctor.name || serverData.team?.anesthesiologistLead || ''} (${outgoingDoctor.crm || serverData.team?.crmLead || ''}/${outgoingDoctor.uf || serverData.team?.ufLead || ''})`
        },
        transfers: [...(serverData.transfers || []), transferRecord],
        events: [...(serverData.events || []), newEvent],
        updatedAt: nowStr,
        updatedAtServer: serverTimestamp() as any
      };

      transaction.update(docRef, updates);

      return {
        ...serverData,
        ...updates
      } as AnesthesiaDocument;
    });

    return updatedDoc;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Atomically claims responsibility of a procedure by the current logged-in user
 */
export async function claimResponsibilityAtomic(
  procedureId: string,
  user: {
    uid: string;
    name: string;
    crm: string;
    uf: string;
    email?: string;
  }
): Promise<AnesthesiaDocument> {
  if (!user || !user.uid) {
    throw new Error("Usuário não autenticado.");
  }

  const docRef = doc(db, "procedures", procedureId);
  try {
    const sfDoc = await getDoc(docRef);
    if (!sfDoc.exists()) {
      throw new Error("Ficha não encontrada.");
    }

    const serverData = sfDoc.data() as AnesthesiaDocument;
    if (serverData.status === "Signed") {
      throw new Error("Ficha encerrada e assinada. Alterações não são permitidas.");
    }

    const outgoingName = serverData.team?.anesthesiologistLead || "Anestesiologista Anterior";
    const outgoingCRM = serverData.team?.crmLead || "";
    const outgoingUF = serverData.team?.ufLead || "SP";
    const outgoingUid = serverData.currentResponsibleUid || serverData.createdByUid || "";

    return await transferResponsibilityAtomic(
      procedureId,
      user.uid,
      {
        uid: user.uid,
        name: user.name,
        crm: user.crm,
        uf: user.uf,
        email: user.email
      },
      {
        uid: outgoingUid,
        name: outgoingName,
        crm: outgoingCRM,
        uf: outgoingUF
      },
      {
        clinicalConditions: "Responsabilidade clínica assumida diretamente pelo profissional.",
        incidentsReported: "Sem intercorrências registradas na assunção de plantão.",
        ongoingInfusions: "Verificar infusões no gráfico intraoperatório.",
        pendingItems: "Assunção direta de responsabilidade."
      }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `procedures/${procedureId}`);
  }
}

/**
 * Fetches all saved procedures where user is creator, current responsible, participant, owner, or shared with
 */
export async function getProcedures(userId: string): Promise<AnesthesiaDocument[]> {
  if (!userId) {
    throw new Error("Usuário não autenticado.");
  }

  const path = "procedures";
  try {
    const qCreated = query(collection(db, "procedures"), where("createdByUid", "==", userId));
    const qResponsible = query(collection(db, "procedures"), where("currentResponsibleUid", "==", userId));
    const qParticipant = query(collection(db, "procedures"), where("participantUids", "array-contains", userId));
    const qLegacyUser = query(collection(db, "procedures"), where("userId", "==", userId));

    const [snap1, snap2, snap3, snap4] = await Promise.all([
      getDocs(qCreated).catch(() => ({ docs: [] })),
      getDocs(qResponsible).catch(() => ({ docs: [] })),
      getDocs(qParticipant).catch(() => ({ docs: [] })),
      getDocs(qLegacyUser).catch(() => ({ docs: [] }))
    ]);

    let sharedDocs: AnesthesiaDocument[] = [];
    const userEmail = auth.currentUser?.email?.toLowerCase();
    if (userEmail) {
      const qShared = query(
        collection(db, "procedures"),
        where("sharedWithEmails", "array-contains", userEmail)
      );
      const snapShared = await getDocs(qShared).catch(() => ({ docs: [] }));
      sharedDocs = snapShared.docs.map(docSnap => docSnap.data() as AnesthesiaDocument);
    }

    const allDocs = [
      ...snap1.docs.map(docSnap => docSnap.data() as AnesthesiaDocument),
      ...snap2.docs.map(docSnap => docSnap.data() as AnesthesiaDocument),
      ...snap3.docs.map(docSnap => docSnap.data() as AnesthesiaDocument),
      ...snap4.docs.map(docSnap => docSnap.data() as AnesthesiaDocument),
      ...sharedDocs
    ];

    // Deduplicate by document id & perform safe UID auto-migration for legacy documents
    const uniqueDocsMap = new Map<string, AnesthesiaDocument>();
    allDocs.forEach(d => {
      if (d && d.id) {
        let docObj = d;
        const existingParticipants = d.participantUids || [];
        const isParticipant = existingParticipants.includes(userId);
        const hasMatchingLegacyEmail = userEmail && d.sharedWithEmails?.map(e => e.toLowerCase()).includes(userEmail);

        // Safe migration: Add UID to participantUids and clean up legacy email
        if (!isParticipant && (hasMatchingLegacyEmail || d.createdByUid === userId || d.currentResponsibleUid === userId || d.userId === userId)) {
          const updatedParticipants = Array.from(new Set([...existingParticipants, userId]));
          const updatedEmails = (d.sharedWithEmails || []).filter(e => e.toLowerCase() !== userEmail);
          docObj = {
            ...d,
            participantUids: updatedParticipants,
            sharedWithEmails: updatedEmails
          };

          // Persist migrated UID access in background
          saveProcedure(docObj, userId).catch(err => {
            console.warn("Aviso na migração automática de UID:", err);
          });
        }

        uniqueDocsMap.set(d.id, docObj);
      }
    });

    // Filter out blank/meaningless documents and deduplicate Drafts by Patient Key
    const filteredDocs = Array.from(uniqueDocsMap.values()).filter(d => isMeaningfulDocument(d));

    // Group Drafts by Patient Key, keeping only the latest version per patient
    const draftByPatientMap = new Map<string, AnesthesiaDocument>();
    const finalDocs: AnesthesiaDocument[] = [];

    filteredDocs.forEach(docObj => {
      if (docObj.status === "Signed") {
        finalDocs.push(docObj);
      } else {
        const cpf = docObj.patient?.cpf?.trim();
        const rec = docObj.patient?.recordNumber?.trim();
        const name = docObj.patient?.fullName?.trim().toLowerCase();
        const date = docObj.patient?.date || "";

        let patientKey = docObj.id;
        if (cpf) {
          patientKey = `cpf:${cpf}`;
        } else if (rec) {
          patientKey = `rec:${rec}:${docObj.patient?.hospital || ""}`;
        } else if (name) {
          patientKey = `name:${name}:${date}`;
        }

        const existing = draftByPatientMap.get(patientKey);
        if (!existing) {
          draftByPatientMap.set(patientKey, docObj);
        } else {
          // Compare updatedAt and keep the latest draft
          const timeExisting = new Date(existing.updatedAt || 0).getTime();
          const timeCurrent = new Date(docObj.updatedAt || 0).getTime();
          if (timeCurrent > timeExisting) {
            draftByPatientMap.set(patientKey, docObj);
          }
        }
      }
    });

    const rawUniqueDocs = [...finalDocs, ...Array.from(draftByPatientMap.values())];

    // Enrich procedures with subcollection data (vitals, medications, fluids, infusions, clinicalEvents, transfers)
    const uniqueDocs = await Promise.all(
      rawUniqueDocs.map(d => fetchProcedureSubcollections(d.id, d))
    );
    
    // Sort combined results descending by updatedAt
    uniqueDocs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return uniqueDocs;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Deletes a saved procedure from Firestore
 */
export async function deleteProcedure(procedureId: string, userId: string): Promise<void> {
  if (!userId) {
    throw new Error("Usuário não autenticado.");
  }

  const path = `procedures/${procedureId}`;
  try {
    // Confirm ownership or existence if needed, but Firestore security rules will block if not owner
    const docRef = doc(db, "procedures", procedureId);
    await Promise.race([
      deleteDoc(docRef),
      new Promise((resolve) => setTimeout(resolve, 3000))
    ]);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Adds an immutable rectifying amendment to the subcollection procedures/{procedureId}/amendments/{amendmentId}
 * Does NOT modify the parent signed procedure document.
 */
export async function addProcedureAmendment(procedureId: string, amendment: DocumentAmendment): Promise<void> {
  const currentUserId = auth.currentUser?.uid;
  if (!currentUserId) {
    throw new Error("Usuário não autenticado.");
  }

  // Handle mock procedures locally
  if (!procedureId || procedureId.startsWith("doc-mock") || procedureId.includes("mock")) {
    console.log("[addProcedureAmendment] Mock procedure amendment recorded locally.");
    return;
  }

  const path = `procedures/${procedureId}/amendments/${amendment.id}`;

  try {
    // 1. Verify procedure exists and user is an authorized participant
    const procRef = doc(db, "procedures", procedureId);
    const procSnap = await getDoc(procRef);
    if (!procSnap.exists()) {
      throw new Error("Ficha anestésica não encontrada no servidor.");
    }

    const procData = procSnap.data() as AnesthesiaDocument;
    const participantUids = procData.participantUids || [
      procData.createdByUid,
      procData.currentResponsibleUid,
      procData.userId
    ].filter(Boolean);

    if (!participantUids.includes(currentUserId) && procData.createdByUid !== currentUserId && procData.currentResponsibleUid !== currentUserId) {
      throw new Error("Acesso negado: Apenas profissionais autorizados e vinculados a esta ficha podem adicionar adendos.");
    }

    // 2. Prepare payload for subcollection document
    const amendmentRef = doc(db, "procedures", procedureId, "amendments", amendment.id);
    const payload = {
      id: amendment.id,
      procedureId,
      docHashRef: procData.hash || amendment.docHashRef || "",
      text: amendment.text,
      reason: amendment.reason,
      createdAt: amendment.createdAt || new Date().toISOString(),
      createdByUid: currentUserId,
      authorName: amendment.authorName || auth.currentUser?.displayName || "Anestesiologista",
      authorCRM: amendment.authorCRM || procData.team?.crmLead || "",
      authorUF: amendment.authorUF || procData.team?.ufLead || "SP",
      hash: amendment.hash
    };

    await setDoc(amendmentRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Fetches all immutable amendments for a given procedure from procedures/{procedureId}/amendments subcollection
 */
export async function getProcedureAmendments(procedureId: string): Promise<DocumentAmendment[]> {
  if (!procedureId || procedureId.startsWith("doc-mock") || procedureId.includes("mock")) {
    return [];
  }
  const path = `procedures/${procedureId}/amendments`;
  try {
    const colRef = collection(db, "procedures", procedureId, "amendments");
    const q = query(colRef, orderBy("createdAt", "asc"));
    
    let snap;
    try {
      snap = await getDocs(q);
    } catch (err) {
      // Fallback without orderBy in case index is creating
      snap = await getDocs(colRef);
    }

    const amendments = snap.docs.map(docSnap => docSnap.data() as DocumentAmendment);
    // Ensure strict chronological sorting
    amendments.sort((a, b) => new Date(a.createdAt || a.timestamp || 0).getTime() - new Date(b.createdAt || b.timestamp || 0).getTime());
    return amendments;
  } catch (error) {
    console.warn(`[getProcedureAmendments] Could not fetch amendments for ${procedureId}:`, error);
    return [];
  }
}
