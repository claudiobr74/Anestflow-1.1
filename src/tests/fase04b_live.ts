/**
 * Live check da Fase 4B contra o projeto Anestflow.
 * Paciente fictício. Sem PHI.
 *
 * - close sem startAnesthesia → signing_not_ready
 * - sign_procedure só com p_procedure_id (3 args recusado)
 * - selo SignedAnesthesiaRecordV1 no servidor
 * - verify A e B
 * - adendo ignora p_author_name do cliente
 *
 * Uso: env de .env.local + ONDA3_TEST_EMAIL / ONDA3_TEST_PASSWORD
 */
import dotenv from "dotenv";
import { getSupabase } from "../lib/supabase.ts";
import {
  saveProcedure,
  getProcedureById,
  closeProcedureAtomic,
  verifyProcedureIntegrity,
  isProcedureIntegrityIntact,
  addProcedureAmendment,
} from "../lib/proceduresService.ts";
import { mapClinicalError } from "../lib/clinicalErrors.ts";
import { getBlankDocument } from "../mockData.ts";

dotenv.config({ path: ".env.local" });

const url = process.env.VITE_SUPABASE_URL || "";
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const email = process.env.ONDA3_TEST_EMAIL || "";
const password = process.env.ONDA3_TEST_PASSWORD || "";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

if (!url || !key || key.includes("xxxxxxxx")) fail("VITE_SUPABASE_URL / PUBLISHABLE_KEY ausentes");
if (!email || !password) fail("ONDA3_TEST_EMAIL / ONDA3_TEST_PASSWORD ausentes");

const supabase = getSupabase();
const { data: session, error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError || !session.user) fail(authError?.message || "login falhou");
const uid = session.user.id;
console.log("login ok", uid);

const { data: profile, error: profileErr } = await supabase
  .from("profiles")
  .select("full_name, crm, uf, email")
  .eq("id", uid)
  .maybeSingle();
if (profileErr || !profile) fail("perfil do usuário de teste ausente");
console.log("profile", profile.full_name, profile.crm, profile.uf);

const stamp = Date.now();

function baseDoc(label: string) {
  const doc = getBlankDocument();
  doc.createdByUid = uid;
  doc.currentResponsibleUid = uid;
  doc.participantUids = [uid];
  doc.userId = uid;
  doc.status = "Draft";
  doc.patient.fullName = `Paciente Teste Fase 4B ${label} ${stamp}`;
  doc.patient.recordNumber = `FASE04B-${label}-${stamp}`;
  doc.patient.hospital = "Hospital Teste Fase 04B";
  doc.team.anesthesiologistLead = "Dr. Agente Fase 4B";
  doc.team.crmLead = "000004";
  doc.team.ufLead = "SP";
  return doc;
}

const blocked = baseDoc("blocked");
await saveProcedure(blocked, uid);
if (!blocked.id.match(/^[0-9a-f-]{36}$/i)) fail(`id blocked não virou UUID: ${blocked.id}`);
try {
  await closeProcedureAtomic(blocked.id);
  fail("close sem startAnesthesia deveria falhar");
} catch (err) {
  const mapped = mapClinicalError(err).message.toLowerCase();
  if (!mapped.includes("critérios mínimos") && !mapped.includes("signing_not_ready")) {
    fail(`close incompleto: esperado signing_not_ready, veio "${mapped}"`);
  }
  console.log("erro esperado signing_not_ready", mapped);
}

const ready = baseDoc("ready");
ready.timers.startAnesthesia = new Date().toISOString();
ready.vitals = [
  {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    minutesFromStart: 0,
    pas: 118,
    pad: 76,
    fc: 68
  }
];
await saveProcedure(ready, uid);
if (!ready.id.match(/^[0-9a-f-]{36}$/i)) fail(`id ready não virou UUID: ${ready.id}`);
console.log("save ready", ready.id);

const { error: threeArgErr } = await supabase.rpc("sign_procedure", {
  p_procedure_id: ready.id,
  p_canonical: '{"evil":true}',
  p_signer: { name: "Hacker", crm: "999", uf: "XX" }
});
if (!threeArgErr) fail("sign_procedure ainda aceita p_canonical/p_signer do cliente");
console.log("3-arg recusado", threeArgErr.message);

const sealed = await closeProcedureAtomic(ready.id);
if (sealed.status !== "Signed" || !sealed.hash) fail("closeProcedureAtomic não selou");
if (!/^[0-9A-F]{64}$/.test(sealed.hash)) fail(`hash inválido: ${sealed.hash}`);
if (!sealed.signatureSnapshot?.includes("SignedAnesthesiaRecordV1")) {
  fail("snapshot não é SignedAnesthesiaRecordV1");
}
if (sealed.signedBy?.name && profile.full_name && sealed.signedBy.name !== profile.full_name) {
  fail(`signatário veio do cliente/browser: ${sealed.signedBy.name} != ${profile.full_name}`);
}
console.log("selado", sealed.hash, "signer", sealed.signedBy?.name);

const report = await verifyProcedureIntegrity(ready.id);
if (!report.snapshotOk) fail("checagem A falhou");
if (report.persistedOk !== true) fail("checagem B falhou");
if (report.legacy) fail("V2 marcado como legacy");
if (report.schema !== "SignedAnesthesiaRecordV1") fail(`schema inesperado: ${report.schema}`);
if (!isProcedureIntegrityIntact(report)) fail("isProcedureIntegrityIntact deveria ser true só com A+B");
console.log("verify A+B ok");

const { data: mutated, error: updateErr } = await supabase
  .from("procedures")
  .update({ patient: { fullName: "tentativa de adulteracao 4B" } })
  .eq("id", ready.id)
  .select("id");
if (updateErr) {
  console.log("UPDATE signed bloqueado", updateErr.message);
} else if (mutated && mutated.length > 0) {
  fail("UPDATE direto alterou a ficha signed");
} else {
  console.log("UPDATE signed sem linhas (RLS/imutável)");
}

const still = await getProcedureById(ready.id);
if (still?.patient.fullName === "tentativa de adulteracao 4B") {
  fail("nome do paciente mudou após UPDATE em ficha signed");
}
if (still?.status !== "Signed") fail("status signed perdido após UPDATE");
console.log("imutabilidade ok");

const amendment = await addProcedureAmendment(ready.id, {
  id: "local-ignored",
  procedureId: ready.id,
  text: "Correção de teste Fase 4B: via aérea sem intercorrência.",
  reason: "Validação de autor oficial via profiles",
  createdAt: new Date().toISOString(),
  createdByUid: uid,
  authorName: "Hacker Fake Name",
  authorCRM: "000000",
  authorUF: "XX",
  hash: "client-hash-ignored"
});
if (amendment.authorName === "Hacker Fake Name") {
  fail(`adendo gravou o nome do navegador: ${amendment.authorName}`);
}
if (profile.full_name && amendment.authorName !== profile.full_name) {
  fail(`adendo deveria usar profile.full_name (${profile.full_name}), veio ${amendment.authorName}`);
}
if (amendment.docHashRef && amendment.docHashRef !== sealed.hash) {
  fail("adendo não vinculou content_hash da ficha");
}
console.log("adendo autor oficial", amendment.authorName, "hash", amendment.hash);

console.log("FASE04B_LIVE_OK", ready.id);
process.exit(0);
