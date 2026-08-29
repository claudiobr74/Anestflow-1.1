/**
 * Live check da Fase 6 contra o projeto Anestflow.
 * Paciente fictício. Sem PHI. Um único usuário de teste:
 * INSERT nasce com revision 1; UPDATE incrementa; UPDATE com revision velha
 * falha com stale_revision e não sobrescreve o nome já gravado.
 *
 * Uso: env de .env.local + ONDA3_TEST_EMAIL / ONDA3_TEST_PASSWORD
 */
import dotenv from "dotenv";
import { getSupabase } from "../lib/supabase.ts";
import { saveProcedure, getProcedureById } from "../lib/proceduresService.ts";
import { mapClinicalError, isStaleRevisionError } from "../lib/clinicalErrors.ts";
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

const stamp = Date.now();
const nameV1 = `Paciente Teste Fase Seis ${stamp}`;
const nameV2 = `Paciente Teste Fase Seis Rev2 ${stamp}`;
const nameStale = `NAO DEVE GRAVAR Fase Seis ${stamp}`;

const doc = getBlankDocument();
doc.createdByUid = uid;
doc.currentResponsibleUid = uid;
doc.participantUids = [uid];
doc.userId = uid;
doc.status = "Draft";
doc.patient.fullName = nameV1;
doc.patient.recordNumber = `FASE06-${stamp}`;
doc.patient.hospital = "Hospital Teste Fase 06";
doc.team.anesthesiologistLead = "Dr. Agente Fase Seis";
doc.team.crmLead = "000001";
doc.team.ufLead = "SP";

await saveProcedure(doc, uid);
if (!doc.id.match(/^[0-9a-f-]{36}$/i)) fail(`id não virou UUID: ${doc.id}`);
if (doc.revision !== 1) fail(`INSERT deveria nascer com revision 1, veio ${doc.revision}`);
console.log("save insert", doc.id, "revision", doc.revision);

const loaded1 = await getProcedureById(doc.id);
if (!loaded1) fail("getProcedureById vazio após insert");
if (loaded1.revision !== 1) fail(`reload após insert: revision ${loaded1.revision}, esperado 1`);
if (loaded1.patient.fullName !== nameV1) fail("nome v1 perdido após insert");
console.log("reload v1 ok", loaded1.revision);

loaded1.patient = { ...loaded1.patient, fullName: nameV2 };
await saveProcedure(loaded1, uid);
console.log("save update", loaded1.id, "revision in-memory", loaded1.revision);

const loaded2 = await getProcedureById(doc.id);
if (!loaded2) fail("getProcedureById vazio após update");
if (loaded2.revision !== 2) fail(`reload após update: revision ${loaded2.revision}, esperado 2`);
if (loaded2.patient.fullName !== nameV2) fail("nome v2 perdido após update");
console.log("reload v2 ok", loaded2.revision);

const stale = {
  ...loaded2,
  revision: 1,
  patient: { ...loaded2.patient, fullName: nameStale },
};
let staleThrew = false;
try {
  await saveProcedure(stale, uid);
} catch (err) {
  staleThrew = true;
  if (!isStaleRevisionError(err)) {
    fail(`esperado stale_revision, veio ${mapClinicalError(err).message}`);
  }
  const mapped = mapClinicalError(err).message;
  if (!mapped.toLowerCase().includes("outro lugar")) {
    fail(`mensagem de conflito inesperada: ${mapped}`);
  }
  console.log("stale_revision ok", mapped);
}
if (!staleThrew) fail("save com revision velha deveria falhar");

const reloaded = await getProcedureById(doc.id);
if (!reloaded) fail("getProcedureById vazio após conflito");
if (reloaded.revision !== 2) fail(`conflito gravou: revision ${reloaded.revision}, esperado 2`);
if (reloaded.patient.fullName !== nameV2) fail("nome stale sobrescreveu a nuvem");
if (reloaded.patient.fullName === nameStale) fail("nome stale apareceu na nuvem");
console.log("estado final ok", reloaded.id, "revision", reloaded.revision);

console.log("FASE06_LIVE_OK", doc.id);
process.exit(0);
