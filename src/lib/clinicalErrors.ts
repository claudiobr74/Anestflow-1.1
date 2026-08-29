import { ASSUME_REASON_REQUIRED_MESSAGE } from "./assumeResponsibility";

export const STALE_REVISION_MESSAGE =
  "Esta ficha foi atualizada em outro lugar. Recarregamos a versão mais recente para não sobrescrever o que já está na nuvem.";

export const CLAIM_REQUIRES_PENDING_MESSAGE =
  "Não há transferência pendente para aceitar. Para assumir o caso sem convite, use Assumir responsabilidade e informe o motivo.";

export function isStaleRevisionError(error: unknown): boolean {
  const err = error as { message?: string; details?: string; code?: string };
  const raw = `${err?.message || ""} ${err?.details || ""} ${err?.code || ""}`.toLowerCase();
  if (raw.includes("stale_revision")) return true;
  if (error instanceof Error && error.message.toLowerCase().includes("stale_revision")) return true;
  if (raw.includes("atualizada em outro lugar")) return true;
  return false;
}

export function mapClinicalError(error: unknown, fallback = "Erro ao gravar a ficha no Supabase."): Error {
  const err = error as { message?: string; code?: string; details?: string };
  const raw = `${err?.message || ""} ${err?.details || ""} ${err?.code || ""}`.toLowerCase();

  if (raw.includes("stale_revision") || raw.includes("atualizada em outro lugar")) {
    return new Error(STALE_REVISION_MESSAGE);
  }
  if (raw.includes("signed_procedure_immutable") || raw.includes("already_signed")) {
    return new Error("Ficha assinada e imutável. Use um adendo retificatório para correções.");
  }
  if (raw.includes("not_responsible")) {
    return new Error("Somente o anestesiologista responsável pode alterar esta ficha.");
  }
  if (raw.includes("not_participant")) {
    return new Error("Você não é participante desta ficha.");
  }
  if (raw.includes("cannot_remove_lead")) {
    return new Error("Não é possível remover o criador ou o responsável atual da ficha.");
  }
  if (raw.includes("pending_not_found")) {
    return new Error("Não há solicitação de transferência pendente nesta ficha.");
  }
  if (raw.includes("claim_requires_pending")) {
    return new Error(CLAIM_REQUIRES_PENDING_MESSAGE);
  }
  if (raw.includes("reason_required")) {
    return new Error(ASSUME_REASON_REQUIRED_MESSAGE);
  }
  if (raw.includes("incoming_required")) {
    return new Error("Informe o colega que vai assumir o caso.");
  }
  if (raw.includes("not_allowed")) {
    return new Error("Operação não permitida nesta ficha.");
  }
  if (raw.includes("incoming_must_differ")) {
    return new Error("A transferência deve ser para outro anestesiologista. Para assumir o caso, use Assumir responsabilidade.");
  }
  if (raw.includes("profile_not_found")) {
    return new Error("Colega não encontrado. O profissional precisa ter perfil confirmado no AnestFlow.");
  }
  if (raw.includes("email_not_confirmed")) {
    return new Error("Confirme seu e-mail antes de gravar fichas clínicas.");
  }
  if (raw.includes("amendment_requires_signed")) {
    return new Error("Adendos só podem ser adicionados depois que a ficha estiver assinada.");
  }
  if (raw.includes("row-level security") || raw.includes("42501")) {
    const hint = err?.message || fallback;
    return new Error(`Acesso recusado pelas políticas de segurança da ficha. ${hint}`);
  }
  if (err?.message) return new Error(err.message);
  if (error instanceof Error) return error;
  return new Error(fallback);
}

export function throwClinical(error: unknown, fallback?: string): never {
  throw mapClinicalError(error, fallback);
}
