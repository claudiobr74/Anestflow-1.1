import { computeSHA256 } from "./signatureService";
import { getSupabase } from "./supabase";
import { PatientInfo, PreAnestheticEvaluation } from "../types";
import { throwClinical } from "./clinicalErrors";

export interface WorklistEntry {
  cpf: string;
  patient: PatientInfo;
  preEvaluation: PreAnestheticEvaluation;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

function cleanCpfDigits(cpf: string): string {
  const cleanCpf = cpf.replace(/\D/g, "");
  if (!cleanCpf || cleanCpf.length !== 11) {
    throw new Error("CPF inválido. Forneça um CPF válido com 11 dígitos numéricos.");
  }
  return cleanCpf;
}

export async function hashCpf(cpf: string): Promise<string> {
  return (await computeSHA256(cleanCpfDigits(cpf))).toLowerCase();
}

async function requireUserId(): Promise<string> {
  const { data, error } = await getSupabase().auth.getUser();
  if (error || !data.user) {
    throw new Error("Você precisa estar autenticado para usar a Worklist.");
  }
  return data.user.id;
}

export async function saveToWorklist(
  cpf: string,
  patient: PatientInfo,
  preEvaluation: PreAnestheticEvaluation
): Promise<void> {
  const userId = await requireUserId();
  const cleanCpf = cleanCpfDigits(cpf);
  const cpfHash = await hashCpf(cleanCpf);
  const supabase = getSupabase();

  const { data: existing, error: readError } = await supabase
    .from("worklist_entries")
    .select("id")
    .eq("created_by", userId)
    .eq("cpf_hash", cpfHash)
    .maybeSingle();
  if (readError) throwClinical(readError, "Erro ao consultar a worklist.");

  const payload = {
    created_by: userId,
    cpf_hash: cpfHash,
    patient: { ...patient, cpf: cleanCpf },
    pre_evaluation: preEvaluation
  };

  if (existing?.id) {
    const { error } = await supabase.from("worklist_entries").update(payload).eq("id", existing.id);
    if (error) throwClinical(error, "Erro ao atualizar a worklist.");
    return;
  }

  const { error } = await supabase.from("worklist_entries").insert(payload);
  if (error) throwClinical(error, "Erro ao salvar na worklist.");
}

export async function getFromWorklist(cpf: string): Promise<WorklistEntry | null> {
  const userId = await requireUserId();
  const cleanCpf = cleanCpfDigits(cpf);
  const cpfHash = await hashCpf(cleanCpf);

  const { data, error } = await getSupabase()
    .from("worklist_entries")
    .select("created_by, patient, pre_evaluation, created_at, updated_at")
    .eq("created_by", userId)
    .eq("cpf_hash", cpfHash)
    .maybeSingle();
  if (error) throwClinical(error, "Erro ao buscar na worklist.");
  if (!data) return null;

  const patient = (data.patient || {}) as PatientInfo;
  return {
    cpf: cleanCpf,
    patient: { ...patient, cpf: patient.cpf || cleanCpf },
    preEvaluation: (data.pre_evaluation || {}) as PreAnestheticEvaluation,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}
