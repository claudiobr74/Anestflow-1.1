import type { AnesthesiaDocument } from "../types";

export const EDIT_BLOCKED_UNAUTHENTICATED =
  "É necessário estar autenticado para alterar esta ficha.";
export const EDIT_BLOCKED_SIGNED =
  "Esta ficha foi encerrada e assinada. Alterações não são permitidas.";

export function editBlockedNotResponsible(leadName?: string): string {
  const lead = leadName?.trim();
  return lead
    ? `Somente o anestesiologista atualmente responsável (Dr(a). ${lead}) pode editar os dados clínicos.`
    : "Somente o anestesiologista atualmente responsável pode editar os dados clínicos.";
}

function isPlaceholderUid(uid: string | undefined | null): boolean {
  return (
    !uid ||
    uid === "mock-uid" ||
    uid === "anon-uid" ||
    uid === "user-123" ||
    uid === "Definido no registro"
  );
}

export function responsibleUidOf(
  doc: { currentResponsibleUid?: string | null }
): string | undefined {
  const uid = doc.currentResponsibleUid;
  if (isPlaceholderUid(uid) || !uid) return undefined;
  return uid;
}

export type ClinicalEditDenial = {
  ok: false;
  reason: "unauthenticated" | "signed" | "not_responsible";
  message: string;
};

export type ClinicalEditResult = { ok: true } | ClinicalEditDenial;

export type AssertCanEditOptions = {
  /** Gravação que fecha a ficha: o cliente já veio com status Signed. */
  closingSignature?: boolean;
};

/**
 * Fail-closed: só o responsável atual edita. Criador que não é responsável não edita.
 * Ficha assinada só passa com closingSignature (RPC de assinatura).
 * Claim/transfer não usam isto — são a forma de passar a ser responsável.
 */
export function canEditDocument(
  doc: {
    status?: AnesthesiaDocument["status"];
    currentResponsibleUid?: string | null;
    team?: { anesthesiologistLead?: string } | null;
  },
  userId: string | null | undefined,
  options?: AssertCanEditOptions
): ClinicalEditResult {
  if (isPlaceholderUid(userId)) {
    return { ok: false, reason: "unauthenticated", message: EDIT_BLOCKED_UNAUTHENTICATED };
  }
  const responsible = responsibleUidOf(doc);
  if (!responsible || responsible !== userId) {
    return {
      ok: false,
      reason: "not_responsible",
      message: editBlockedNotResponsible(doc.team?.anesthesiologistLead),
    };
  }
  if (doc.status === "Signed" && !options?.closingSignature) {
    return { ok: false, reason: "signed", message: EDIT_BLOCKED_SIGNED };
  }
  return { ok: true };
}

export function isCurrentResponsible(
  doc: Pick<AnesthesiaDocument, "currentResponsibleUid">,
  userId: string | null | undefined
): boolean {
  const responsible = responsibleUidOf(doc);
  return Boolean(userId && responsible && responsible === userId);
}

export function isClinicalEditor(
  doc: {
    status?: AnesthesiaDocument["status"];
    currentResponsibleUid?: string | null;
    team?: { anesthesiologistLead?: string } | null;
  },
  userId: string | null | undefined
): boolean {
  return canEditDocument(doc, userId).ok;
}

export function assertCanEdit(
  doc: {
    status?: AnesthesiaDocument["status"];
    currentResponsibleUid?: string | null;
    team?: { anesthesiologistLead?: string } | null;
  },
  userId: string | null | undefined,
  options?: AssertCanEditOptions
): void {
  const result = canEditDocument(doc, userId, options);
  if (result.ok === false) throw new Error(result.message);
}

export function assignNewDocumentOwner(
  doc: AnesthesiaDocument,
  uid: string
): AnesthesiaDocument {
  if (isPlaceholderUid(uid)) return doc;
  return {
    ...doc,
    createdByUid: uid,
    currentResponsibleUid: uid,
    userId: uid,
    participantUids: [uid],
  };
}
