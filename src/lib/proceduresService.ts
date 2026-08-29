import { AnesthesiaDocument, DocumentAmendment } from "../types";
import { getSupabase } from "./supabase";
import { ensureUniqueClinicalEventIds } from "./syncEngine";
import { throwClinical } from "./clinicalErrors";
import { assertCanEdit } from "./assertCanEdit";
import {
  loadClinicalChildren,
  persistClinicalChildren,
  type ClinicalSubcollectionName
} from "./clinicalChildren";
import {
  amendmentFromRow,
  isMockProcedureId,
  isUuid,
  parentPayloadForWrite,
  ProcedureRow,
  rowToDocumentBase,
  samePatientDraft,
  isMeaningfulDocument
} from "./procedureMapper";

export type { ClinicalSubcollectionName };
export { addClinicalEventItem, deleteClinicalEventItem, getClinicalEventItems } from "./clinicalChildren";
export { isMeaningfulDocument };

const SAVE_TIMEOUT_MS = 20000;

function placeholderUid(uid: string | undefined): boolean {
  return !uid || uid === "mock-uid" || uid === "anon-uid" || uid === "user-123" || uid === "Definido no registro";
}

async function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), SAVE_TIMEOUT_MS);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchParticipantIds(procedureId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("procedure_participants")
    .select("user_id")
    .eq("procedure_id", procedureId);
  if (error) throwClinical(error, "Erro ao listar participantes.");
  return (data || []).map((row) => row.user_id as string);
}

export async function hydrateProcedure(row: ProcedureRow): Promise<AnesthesiaDocument> {
  const [participantUids, children, amendments] = await Promise.all([
    fetchParticipantIds(row.id),
    loadClinicalChildren(row.id),
    getProcedureAmendments(row.id)
  ]);
  return {
    ...rowToDocumentBase(row, participantUids),
    ...children,
    amendments
  };
}

export async function getProcedureById(procedureId: string): Promise<AnesthesiaDocument | null> {
  if (!isUuid(procedureId) || isMockProcedureId(procedureId)) return null;
  const { data, error } = await getSupabase()
    .from("procedures")
    .select("*")
    .eq("id", procedureId)
    .maybeSingle();
  if (error) throwClinical(error, "Erro ao carregar a ficha.");
  if (!data) return null;
  return hydrateProcedure(data as ProcedureRow);
}

async function findExistingDraftId(cleanedDoc: AnesthesiaDocument, userId: string): Promise<string | null> {
  const recordNum = cleanedDoc.patient?.recordNumber?.trim();
  const cpf = cleanedDoc.patient?.cpf?.trim();
  const fullName = cleanedDoc.patient?.fullName?.trim().toLowerCase();
  if (!recordNum && !cpf && !fullName) return null;

  const { data, error } = await getSupabase()
    .from("procedures")
    .select("id, status, patient, created_by")
    .eq("created_by", userId)
    .neq("status", "signed");
  if (error) {
    console.warn("[saveProcedure] Aviso ao verificar ficha pré-existente:", error.message);
    return null;
  }
  for (const row of data || []) {
    if (samePatientDraft(cleanedDoc, (row.patient || {}) as Record<string, unknown>)) {
      return row.id as string;
    }
  }
  return null;
}

async function signOnServer(cleanedDoc: AnesthesiaDocument): Promise<void> {
  const canonical = cleanedDoc.signatureSnapshot;
  if (!canonical) {
    throw new Error("Canonical da assinatura ausente. Tente encerrar a ficha novamente.");
  }
  const { data, error } = await getSupabase().rpc("sign_procedure", {
    p_procedure_id: cleanedDoc.id,
    p_canonical: canonical,
    p_signer: cleanedDoc.signedBy || {}
  });
  if (error) throwClinical(error, "Erro ao assinar a ficha no servidor.");
  if (typeof data === "string" && data) {
    cleanedDoc.hash = data;
  }
}

/**
 * Grava a ficha no Supabase (tabela procedures + eventos filhos).
 * Assinatura usa a RPC sign_procedure (o cliente não pode UPDATE para signed).
 */
export async function saveProcedure(document: AnesthesiaDocument, userId: string): Promise<void> {
  if (!userId) throw new Error("Usuário não autenticado.");
  if (!isMeaningfulDocument(document)) return;
  if (isMockProcedureId(document.id)) return;

  const cleanedDoc = ensureUniqueClinicalEventIds(document);

  if (!isUuid(cleanedDoc.id) && (cleanedDoc.id.startsWith("doc-") || cleanedDoc.id.includes("temp"))) {
    const existingId = await findExistingDraftId(cleanedDoc, userId);
    if (existingId) {
      cleanedDoc.id = existingId;
      document.id = existingId;
    }
  }

  let createdByUid = cleanedDoc.createdByUid;
  if (placeholderUid(createdByUid) || !isUuid(createdByUid)) createdByUid = userId;
  let currentResponsibleUid = cleanedDoc.currentResponsibleUid;
  if (placeholderUid(currentResponsibleUid) || !isUuid(currentResponsibleUid)) {
    currentResponsibleUid = createdByUid;
  }

  cleanedDoc.createdByUid = createdByUid;
  cleanedDoc.currentResponsibleUid = currentResponsibleUid;
  cleanedDoc.userId = createdByUid;

  assertCanEdit(cleanedDoc, userId, { closingSignature: cleanedDoc.status === "Signed" });

  const write = async () => {
    const supabase = getSupabase();

    if (isUuid(cleanedDoc.id)) {
      const { data: existing, error: readError } = await supabase
        .from("procedures")
        .select("id, status, created_by, responsible_id")
        .eq("id", cleanedDoc.id)
        .maybeSingle();
      if (readError) throwClinical(readError);

      if (existing) {
        if (existing.status === "signed") {
          if (cleanedDoc.status === "Signed") return;
          throw new Error(
            "Ficha Assinada e Imutável: O documento foi assinado digitalmente e não pode mais sofrer alterações diretamente. Para correções, utilize o recurso de Adendo Retificatório Imutável."
          );
        }
        if (existing.responsible_id && existing.responsible_id !== userId) {
          throw new Error(
            `Edição bloqueada: A ficha está sob a responsabilidade de Dr(a). ${cleanedDoc.team?.anesthesiologistLead || "outro profissional"}.`
          );
        }

        const { error: updateError } = await supabase
          .from("procedures")
          .update(parentPayloadForWrite(cleanedDoc, userId, { includeStatus: true }))
          .eq("id", cleanedDoc.id);
        if (updateError) throwClinical(updateError);
      } else {
        const { error: insertError } = await supabase.from("procedures").insert({
          id: cleanedDoc.id,
          created_by: userId,
          responsible_id: userId,
          ...parentPayloadForWrite(cleanedDoc, userId, { includeStatus: true })
        });
        if (insertError) throwClinical(insertError);
        document.id = cleanedDoc.id;
      }
    } else {
      const newId = crypto.randomUUID();
      const { error: insertError } = await supabase.from("procedures").insert({
        id: newId,
        created_by: userId,
        responsible_id: userId,
        ...parentPayloadForWrite(cleanedDoc, userId, { includeStatus: true })
      });
      if (insertError) throwClinical(insertError);
      cleanedDoc.id = newId;
      document.id = newId;
    }

    await persistClinicalChildren(cleanedDoc, userId);

    if (cleanedDoc.status === "Signed") {
      await signOnServer(cleanedDoc);
      document.hash = cleanedDoc.hash;
      document.status = "Signed";
    }
  };

  try {
    await withTimeout(write(), "Timeout ao salvar ficha no Supabase");
  } catch (error) {
    throwClinical(error, "Erro ao salvar ficha no Supabase.");
  }
}

export async function persistClinicalEventsSubcollections(
  docObj: AnesthesiaDocument,
  userId: string
): Promise<void> {
  if (!docObj?.id || isMockProcedureId(docObj.id) || !isUuid(docObj.id)) return;
  await persistClinicalChildren(docObj, userId);
}

export async function fetchProcedureSubcollections(
  procedureId: string,
  baseDoc: AnesthesiaDocument
): Promise<AnesthesiaDocument> {
  if (!isUuid(procedureId) || isMockProcedureId(procedureId)) return baseDoc;
  try {
    const children = await loadClinicalChildren(procedureId);
    return { ...baseDoc, ...children };
  } catch (err) {
    console.warn(`[fetchProcedureSubcollections] ${procedureId}:`, err);
    return baseDoc;
  }
}

export async function transferResponsibilityAtomic(
  procedureId: string,
  currentUserId: string,
  incomingDoctor: { uid: string; name: string; crm: string; uf: string; email?: string },
  outgoingDoctor: { uid?: string; name: string; crm: string; uf: string },
  handoverDetails: {
    clinicalConditions: string;
    incidentsReported: string;
    ongoingInfusions: string;
    pendingItems: string;
  }
): Promise<AnesthesiaDocument> {
  if (!currentUserId) throw new Error("Usuário não autenticado.");
  if (!isUuid(procedureId)) throw new Error("Salve a ficha na nuvem antes de transferir a responsabilidade.");
  if (!isUuid(incomingDoctor.uid)) throw new Error("O colega precisa ter um usuário Supabase válido.");

  const handover = {
    ...handoverDetails,
    incomingName: incomingDoctor.name,
    incomingCRM: incomingDoctor.crm,
    incomingUF: incomingDoctor.uf,
    incomingUid: incomingDoctor.uid,
    incomingEmail: incomingDoctor.email || "",
    outgoingName: outgoingDoctor.name,
    outgoingCRM: outgoingDoctor.crm,
    outgoingUF: outgoingDoctor.uf,
    outgoingUid: outgoingDoctor.uid || currentUserId
  };

  const { error } = await getSupabase().rpc("transfer_responsibility", {
    p_procedure_id: procedureId,
    p_incoming_user_id: incomingDoctor.uid,
    p_handover: handover
  });
  if (error) throwClinical(error, "Erro ao transferir responsabilidade.");

  const updated = await getProcedureById(procedureId);
  if (!updated) throw new Error("Ficha não encontrada após a transferência.");
  return updated;
}

export async function claimResponsibilityAtomic(
  procedureId: string,
  user: { uid: string; name: string; crm: string; uf: string; email?: string }
): Promise<AnesthesiaDocument> {
  if (!user?.uid) throw new Error("Usuário não autenticado.");
  if (!isUuid(procedureId)) throw new Error("Salve a ficha na nuvem antes de assumir a responsabilidade.");

  const { error } = await getSupabase().rpc("claim_responsibility", {
    p_procedure_id: procedureId,
    p_handover: {
      incomingName: user.name,
      incomingCRM: user.crm,
      incomingUF: user.uf,
      incomingUid: user.uid,
      clinicalConditions: "Responsabilidade clínica assumida diretamente pelo profissional.",
      incidentsReported: "Sem intercorrências registradas na assunção de plantão.",
      ongoingInfusions: "Verificar infusões no gráfico intraoperatório.",
      pendingItems: "Assunção direta de responsabilidade."
    }
  });
  if (error) throwClinical(error, "Erro ao assumir responsabilidade.");

  const updated = await getProcedureById(procedureId);
  if (!updated) throw new Error("Ficha não encontrada após assumir a responsabilidade.");
  return updated;
}

export async function getProcedures(userId: string): Promise<AnesthesiaDocument[]> {
  if (!userId) throw new Error("Usuário não autenticado.");

  const { data, error } = await getSupabase()
    .from("procedures")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throwClinical(error, "Erro ao listar fichas.");

  const hydrated = await Promise.all((data || []).map((row) => hydrateProcedure(row as ProcedureRow)));
  const filtered = hydrated.filter((d) => isMeaningfulDocument(d));

  const draftByPatient = new Map<string, AnesthesiaDocument>();
  const signed: AnesthesiaDocument[] = [];

  for (const docObj of filtered) {
    if (docObj.status === "Signed") {
      signed.push(docObj);
      continue;
    }
    const cpf = docObj.patient?.cpf?.trim();
    const rec = docObj.patient?.recordNumber?.trim();
    const name = docObj.patient?.fullName?.trim().toLowerCase();
    const date = docObj.patient?.date || "";
    let patientKey = docObj.id;
    if (cpf) patientKey = `cpf:${cpf}`;
    else if (rec) patientKey = `rec:${rec}:${docObj.patient?.hospital || ""}`;
    else if (name) patientKey = `name:${name}:${date}`;

    const existing = draftByPatient.get(patientKey);
    if (!existing) {
      draftByPatient.set(patientKey, docObj);
    } else {
      const timeExisting = new Date(existing.updatedAt || 0).getTime();
      const timeCurrent = new Date(docObj.updatedAt || 0).getTime();
      if (timeCurrent > timeExisting) draftByPatient.set(patientKey, docObj);
    }
  }

  const uniqueDocs = [...signed, ...Array.from(draftByPatient.values())];
  uniqueDocs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return uniqueDocs;
}

export async function deleteProcedure(procedureId: string, userId: string): Promise<void> {
  if (!userId) throw new Error("Usuário não autenticado.");
  if (!isUuid(procedureId)) return;
  const { error } = await getSupabase().from("procedures").delete().eq("id", procedureId);
  if (error) throwClinical(error, "Erro ao excluir a ficha. Só rascunhos do criador podem ser apagados.");
}

export async function addProcedureAmendment(
  procedureId: string,
  amendment: DocumentAmendment
): Promise<DocumentAmendment> {
  if (isMockProcedureId(procedureId)) {
    return amendment;
  }
  if (!isUuid(procedureId)) {
    throw new Error("Salve e assine a ficha na nuvem antes de registrar um adendo.");
  }

  const { data, error } = await getSupabase().rpc("add_procedure_amendment", {
    p_procedure_id: procedureId,
    p_body: amendment.text,
    p_reason: amendment.reason,
    p_author_name: amendment.authorName,
    p_author_crm: amendment.authorCRM,
    p_author_uf: amendment.authorUF
  });
  if (error) throwClinical(error, "Erro ao gravar adendo.");

  const amendmentId = typeof data === "string" ? data : amendment.id;
  const { data: row, error: readError } = await getSupabase()
    .from("procedure_amendments")
    .select("*")
    .eq("id", amendmentId)
    .maybeSingle();
  if (readError) throwClinical(readError);
  if (!row) {
    return { ...amendment, id: amendmentId };
  }
  return amendmentFromRow(row as Parameters<typeof amendmentFromRow>[0]);
}

export async function getProcedureAmendments(procedureId: string): Promise<DocumentAmendment[]> {
  if (!isUuid(procedureId) || isMockProcedureId(procedureId)) return [];
  const { data, error } = await getSupabase()
    .from("procedure_amendments")
    .select("*")
    .eq("procedure_id", procedureId)
    .order("created_at", { ascending: true });
  if (error) {
    console.warn(`[getProcedureAmendments] ${procedureId}:`, error.message);
    return [];
  }
  return (data || []).map((row) => amendmentFromRow(row as Parameters<typeof amendmentFromRow>[0]));
}

export async function addParticipantByEmail(procedureId: string, email: string): Promise<string> {
  if (!isUuid(procedureId)) {
    throw new Error("Salve a ficha na nuvem antes de compartilhar.");
  }
  const { data, error } = await getSupabase().rpc("add_participant_by_email", {
    p_procedure_id: procedureId,
    p_email: email.trim().toLowerCase()
  });
  if (error) throwClinical(error, "Erro ao adicionar participante.");
  return data as string;
}

export async function removeProcedureCollaborator(procedureId: string, userId: string): Promise<void> {
  if (!isUuid(procedureId) || !isUuid(userId)) return;
  const { error } = await getSupabase().rpc("remove_procedure_collaborator", {
    p_procedure_id: procedureId,
    p_user_id: userId
  });
  if (error) throwClinical(error, "Erro ao remover participante.");
}

export async function listProcedureParticipantProfiles(procedureId: string): Promise<
  Array<{ id: string; full_name: string; crm: string; uf: string; email: string | null; role: string }>
> {
  if (!isUuid(procedureId)) return [];
  const { data, error } = await getSupabase().rpc("list_procedure_participant_profiles", {
    p_procedure_id: procedureId
  });
  if (error) throwClinical(error, "Erro ao listar participantes.");
  return (data || []) as Array<{
    id: string;
    full_name: string;
    crm: string;
    uf: string;
    email: string | null;
    role: string;
  }>;
}
