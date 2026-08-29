/**
 * Live check da Fase 4 contra o projeto Anestflow.
 * Paciente fictício. Sem PHI. Um único usuário de teste:
 * claim na própria ficha = no-op; assume na própria ficha = no-op após motivo;
 * assume sem motivo = reason_required; transfer/request para si mesmo falha;
 * e-mail inexistente não resolve perfil. Sem segundo médico, não há
 * roundtrip real de handover nem claim_requires_pending.
 *
 * Uso: env de .env.local + ONDA3_TEST_EMAIL / ONDA3_TEST_PASSWORD
 */
import dotenv from "dotenv";
import { getSupabase } from "../lib/supabase.ts";
import {
  saveProcedure,
  getProcedureById,
  assumeResponsibilityAtomic,
  claimResponsibilityAtomic,
  transferResponsibilityAtomic,
  requestTransferAtomic,
  declinePendingTransferAtomic,
  resolveIncomingDoctorByEmail,
} from "../lib/proceduresService.ts";
import { mapClinicalError } from "../lib/clinicalErrors.ts";
import { getBlankDocument } from "../mockData.ts";

dotenv.config({ path: ".env.local" });

const url = process.env.VITE_SUPABASE_URL || "";
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const email = process.env.ONDA3_TEST_EMAIL || "";
const password = process.env.ONDA3_TEST_PASSWORD || "";
const missingUuid = "00000000-0000-4000-8000-000000000001";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assertMsg(err: unknown, needle: string, label: string) {
  const mapped = mapClinicalError(err).message;
  if (!mapped.toLowerCase().includes(needle.toLowerCase())) {
    fail(`${label}: esperado "${needle}", veio "${mapped}"`);
  }
  console.log("erro esperado", label, mapped);
}

if (!url || !key || key.includes("xxxxxxxx")) fail("VITE_SUPABASE_URL / PUBLISHABLE_KEY ausentes");
if (!email || !password) fail("ONDA3_TEST_EMAIL / ONDA3_TEST_PASSWORD ausentes");

const supabase = getSupabase();
const { data: session, error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError || !session.user) fail(authError?.message || "login falhou");
const uid = session.user.id;
console.log("login ok", uid);

const doc = getBlankDocument();
doc.createdByUid = uid;
doc.currentResponsibleUid = uid;
doc.participantUids = [uid];
doc.userId = uid;
doc.status = "Draft";
doc.patient.fullName = "Paciente Teste Fase Quatro";
doc.patient.recordNumber = "FASE04-001";
doc.patient.hospital = "Hospital Teste Fase 04";
doc.team.anesthesiologistLead = "Dr. Agente Fase Quatro";
doc.team.crmLead = "000001";
doc.team.ufLead = "SP";

await saveProcedure(doc, uid);
if (!doc.id.match(/^[0-9a-f-]{36}$/i)) fail(`id não virou UUID: ${doc.id}`);
console.log("save draft", doc.id);

const claimed = await claimResponsibilityAtomic(
  doc.id,
  { uid, name: "Dr. Agente Fase Quatro", crm: "000001", uf: "SP", email },
  { uid, name: "Dr. Agente Fase Quatro", crm: "000001", uf: "SP" }
);
if (claimed.currentResponsibleUid !== uid) fail("claim na própria ficha mudou o responsável");
if (claimed.pendingTransfer) fail("claim na própria ficha inventou pending_transfer");
console.log("claim no-op ok");

try {
  await assumeResponsibilityAtomic(
    doc.id,
    { uid, name: "Dr. Agente Fase Quatro", crm: "000001", uf: "SP", email },
    { uid, name: "Dr. Agente Fase Quatro", crm: "000001", uf: "SP" },
    "curto"
  );
  fail("assume com motivo curto deveria falhar");
} catch (err) {
  assertMsg(err, "motivo", "assume short reason");
}

const { error: rpcEmptyReason } = await supabase.rpc("assume_responsibility", {
  p_procedure_id: doc.id,
  p_reason: "   ",
  p_handover: { incomingName: "Dr. Agente Fase Quatro" },
});
if (!rpcEmptyReason) fail("RPC assume_responsibility sem motivo deveria falhar");
assertMsg(rpcEmptyReason, "motivo", "rpc assume empty reason");

const assumed = await assumeResponsibilityAtomic(
  doc.id,
  { uid, name: "Dr. Agente Fase Quatro", crm: "000001", uf: "SP", email },
  { uid, name: "Dr. Agente Fase Quatro", crm: "000001", uf: "SP" },
  "Motivo excepcional de teste live."
);
if (assumed.currentResponsibleUid !== uid) fail("assume na própria ficha mudou o responsável");
if (assumed.pendingTransfer) fail("assume na própria ficha inventou pending_transfer");
console.log("assume no-op ok");

try {
  await transferResponsibilityAtomic(
    doc.id,
    uid,
    { uid, name: "Eu Mesmo", crm: "1", uf: "SP", email },
    { uid, name: "Eu Mesmo", crm: "1", uf: "SP" },
    { clinicalConditions: "x", incidentsReported: "x", ongoingInfusions: "x", pendingItems: "x" }
  );
  fail("transfer para o próprio UID deveria falhar");
} catch (err) {
  assertMsg(err, "outro anestesiologista", "transfer self");
}

try {
  await requestTransferAtomic(
    doc.id,
    uid,
    { uid, name: "Eu Mesmo", crm: "1", uf: "SP", email },
    { uid, name: "Eu Mesmo", crm: "1", uf: "SP" },
    { clinicalConditions: "x", incidentsReported: "x", ongoingInfusions: "x", pendingItems: "x" }
  );
  fail("request_transfer para o próprio UID deveria falhar");
} catch (err) {
  assertMsg(err, "outro anestesiologista", "request self");
}

const { error: rpcSelf } = await supabase.rpc("transfer_responsibility", {
  p_procedure_id: doc.id,
  p_incoming_user_id: uid,
  p_handover: { incomingName: "self" },
});
if (!rpcSelf) fail("RPC transfer_responsibility para si mesmo deveria falhar");
assertMsg(rpcSelf, "outro anestesiologista", "rpc transfer self");

const { error: rpcMissing } = await supabase.rpc("request_transfer", {
  p_procedure_id: doc.id,
  p_incoming_user_id: missingUuid,
  p_handover: { incomingName: "Fantasma", incomingEmail: "nobody-fase4@anestflow.app" },
});
if (!rpcMissing) fail("RPC request_transfer para UUID inexistente deveria falhar");
assertMsg(rpcMissing, "não encontrado", "rpc request missing profile");

try {
  await resolveIncomingDoctorByEmail("nobody-fase4-ausente@anestflow.app");
  fail("lookup de e-mail inexistente deveria falhar");
} catch (err) {
  assertMsg(err, "não encontrado", "lookup missing email");
}

try {
  await declinePendingTransferAtomic(doc.id);
  fail("decline sem pending deveria falhar");
} catch (err) {
  assertMsg(err, "pendente", "decline empty");
}

const reloaded = await getProcedureById(doc.id);
if (!reloaded) fail("getProcedureById vazio");
if (reloaded.currentResponsibleUid !== uid) fail("responsável mudou sem handover real");
if (reloaded.pendingTransfer) fail("pending_transfer ficou sujo após os erros");
if (reloaded.patient.fullName !== "Paciente Teste Fase Quatro") fail("paciente fictício perdido");
console.log("estado final ok", reloaded.id);

console.log("FASE04_LIVE_OK", doc.id);
process.exit(0);
