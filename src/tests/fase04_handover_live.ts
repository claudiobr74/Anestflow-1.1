/**
 * Live A→B da Fase 4A contra o projeto Anestflow.
 * Paciente fictício. Sem PHI.
 *
 * A = ONDA3_TEST_EMAIL / ONDA3_TEST_PASSWORD
 * B = ONDA3_TEST_EMAIL_B / ONDA3_TEST_PASSWORD_B (e-mail confirmado, perfil existente)
 *
 * Cobre: claim_requires_pending (B participante sem pendência; A após o aceite),
 * request_transfer A→B, aceite via claim_responsibility, assume excepcional A.
 *
 * Sem ONDA3_TEST_EMAIL_B o script sai com FASE04_HANDOVER_SKIPPED (não falha).
 */
import dotenv from "dotenv";
import { getSupabase } from "../lib/supabase.ts";
import {
  addParticipantByEmail,
  assumeResponsibilityAtomic,
  claimResponsibilityAtomic,
  getProcedureById,
  requestTransferAtomic,
  resolveIncomingDoctorByEmail,
  saveProcedure,
} from "../lib/proceduresService.ts";
import { mapClinicalError } from "../lib/clinicalErrors.ts";
import { getBlankDocument } from "../mockData.ts";

dotenv.config({ path: ".env.local" });

const emailA = process.env.ONDA3_TEST_EMAIL || "";
const passA = process.env.ONDA3_TEST_PASSWORD || "";
const emailB = (process.env.ONDA3_TEST_EMAIL_B || "").trim().toLowerCase();
const passB = process.env.ONDA3_TEST_PASSWORD_B || "";

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

async function signIn(email: string, password: string, label: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) fail(`${label}: ${error?.message || "login falhou"}`);
  return data.user;
}

if (!emailA || !passA) fail("ONDA3_TEST_EMAIL / ONDA3_TEST_PASSWORD ausentes");
if (!emailB) {
  console.log("FASE04_HANDOVER_SKIPPED sem ONDA3_TEST_EMAIL_B");
  process.exit(0);
}
if (!passB) fail("ONDA3_TEST_PASSWORD_B ausente para o live A→B");

const userA = await signIn(emailA, passA, "login A");
const aUid = userA.id;
console.log("login A ok", aUid);

const incoming = await resolveIncomingDoctorByEmail(emailB, {
  name: "Dra. Colega Fase Quatro",
  crm: "8002",
  uf: "GO",
});
const bUid = incoming.uid;
if (bUid === aUid) fail("B não pode ser o mesmo UID de A");
console.log("lookup B ok", bUid);

const doc = getBlankDocument();
const stamp = Date.now();
doc.createdByUid = aUid;
doc.currentResponsibleUid = aUid;
doc.participantUids = [aUid];
doc.userId = aUid;
doc.status = "Draft";
doc.patient.fullName = `Paciente Handover Fase Quatro ${stamp}`;
doc.patient.recordNumber = `FASE04-HO-${stamp}`;
doc.patient.hospital = "Hospital Teste Fase 04 Handover";
doc.team.anesthesiologistLead = "Dr. Agente Fase Quatro";
doc.team.crmLead = "000001";
doc.team.ufLead = "SP";

await saveProcedure(doc, aUid);
await addParticipantByEmail(doc.id, emailB);
const afterAdd = await getProcedureById(doc.id);
if (!afterAdd?.participantUids?.includes(bUid)) fail("B não entrou como participante");
if (afterAdd.currentResponsibleUid !== aUid) fail("add participante mudou o responsável");
if (afterAdd.pendingTransfer) fail("add participante inventou pending_transfer");
console.log("setup ok", doc.id);

const userB = await signIn(emailB, passB, "login B");
if (userB.id !== bUid) fail("login B UID diverge do lookup");
console.log("login B ok", userB.id);

try {
  await claimResponsibilityAtomic(
    doc.id,
    { uid: bUid, name: incoming.name, crm: incoming.crm, uf: incoming.uf, email: emailB },
    { uid: aUid, name: "Dr. Agente Fase Quatro", crm: "000001", uf: "SP" }
  );
  fail("claim de B sem pending deveria falhar");
} catch (err) {
  assertMsg(err, "assumir", "B claim_requires_pending");
}

await signIn(emailA, passA, "relogin A");
const requested = await requestTransferAtomic(
  doc.id,
  aUid,
  incoming,
  { uid: aUid, name: "Dr. Agente Fase Quatro", crm: "000001", uf: "SP" },
  {
    clinicalConditions: "Paciente fictício estável no teste A para B.",
    incidentsReported: "Sem intercorrências.",
    ongoingInfusions: "Nenhuma.",
    pendingItems: "Aceite de teste Fase 4A.",
  }
);
if (!requested.pendingTransfer) fail("request_transfer não gravou pending_transfer");
if (requested.pendingTransfer.incomingUid !== bUid) fail("pending incomingUid não é B");
if (requested.currentResponsibleUid !== aUid) fail("request_transfer não deveria trocar o responsável");
console.log("request A→B ok");

const aNoop = await claimResponsibilityAtomic(
  doc.id,
  { uid: aUid, name: "Dr. Agente Fase Quatro", crm: "000001", uf: "SP", email: emailA },
  { uid: aUid, name: "Dr. Agente Fase Quatro", crm: "000001", uf: "SP" }
);
if (aNoop.currentResponsibleUid !== aUid) fail("claim de A (responsável) não deveria ser aceite");
if (!aNoop.pendingTransfer) fail("claim no-op de A limpou a pendência");
console.log("claim A no-op com pending ok");

await signIn(emailB, passB, "relogin B");
const accepted = await claimResponsibilityAtomic(
  doc.id,
  { uid: bUid, name: incoming.name, crm: incoming.crm, uf: incoming.uf, email: emailB },
  { uid: aUid, name: "Dr. Agente Fase Quatro", crm: "000001", uf: "SP" }
);
if (accepted.currentResponsibleUid !== bUid) fail("aceite não passou a responsabilidade para B");
if (accepted.pendingTransfer) fail("aceite não limpou pending_transfer");
console.log("aceite B ok");

await signIn(emailA, passA, "relogin A pos-aceite");
try {
  await claimResponsibilityAtomic(
    doc.id,
    { uid: aUid, name: "Dr. Agente Fase Quatro", crm: "000001", uf: "SP", email: emailA },
    { uid: bUid, name: incoming.name, crm: incoming.crm, uf: incoming.uf }
  );
  fail("claim de A sem pending após o aceite deveria falhar");
} catch (err) {
  assertMsg(err, "assumir", "A claim_requires_pending após aceite");
}

const assumed = await assumeResponsibilityAtomic(
  doc.id,
  { uid: aUid, name: "Dr. Agente Fase Quatro", crm: "000001", uf: "SP", email: emailA },
  { uid: bUid, name: incoming.name, crm: incoming.crm, uf: incoming.uf },
  "Retomada excepcional no teste live A após aceite B."
);
if (assumed.currentResponsibleUid !== aUid) fail("assume excepcional não devolveu A");
if (assumed.pendingTransfer) fail("assume deixou pending_transfer");
console.log("assume excepcional A ok");

console.log("FASE04_HANDOVER_LIVE_OK", doc.id);
process.exit(0);
