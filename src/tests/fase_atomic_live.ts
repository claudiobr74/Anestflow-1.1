/**
 * Live: save atômico, rollback, conflito, idempotência, DELETE negado, void.
 * Paciente fictício. Sem PHI.
 *
 * Uso: .env.local + ONDA3_TEST_EMAIL / ONDA3_TEST_PASSWORD
 */
import dotenv from "dotenv";
import { getSupabase } from "../lib/supabase.ts";
import {
  saveProcedure,
  getProcedureById,
  voidClinicalItem
} from "../lib/proceduresService.ts";
import {
  childrenPayloadForWrite,
  parentPayloadForWrite
} from "../lib/procedureMapper.ts";
import { isStaleRevisionError, mapClinicalError } from "../lib/clinicalErrors.ts";
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
const start = "2026-08-29T10:00:00.000Z";

function baseDoc() {
  const doc = getBlankDocument();
  doc.createdByUid = uid;
  doc.currentResponsibleUid = uid;
  doc.participantUids = [uid];
  doc.userId = uid;
  doc.status = "Draft";
  doc.patient.fullName = `Paciente Teste Atomico ${stamp}`;
  doc.patient.recordNumber = `ATOM-${stamp}`;
  doc.patient.hospital = "Hospital Teste Atomico";
  doc.team.anesthesiologistLead = "Dr. Agente Atomico";
  doc.team.crmLead = "000010";
  doc.team.ufLead = "SP";
  doc.timers = { startAnesthesia: start };
  return doc;
}

const sevoId = crypto.randomUUID();
const fcId = crypto.randomUUID();
const fluidId = crypto.randomUUID();
const eventId = crypto.randomUUID();
const bolusId = crypto.randomUUID();

const doc = baseDoc();
doc.inhalationAgents = [{ id: sevoId, agent: "Sevoflurano", startTime: start }];
doc.vitals = [{ id: fcId, timestamp: start, minutesFromStart: 0, fc: 78, spo2: 98 }];
doc.fluids = [{
  id: fluidId,
  type: "Cristaloide",
  name: "Ringer Lactato",
  volumePrepared: 500,
  volumeAdministered: 250,
  startTime: start
}];
doc.events = [{
  id: eventId,
  name: "Indução",
  timestamp: start,
  category: "Marcador Temporal"
}];
doc.bolusDrugs = [{
  id: bolusId,
  name: "Fentanil",
  dose: 100,
  unit: "mcg",
  timestamp: start,
  minutesFromStart: 0
}];

await saveProcedure(doc, uid);
const revInsert = doc.revision ?? 0;
if (revInsert !== 1) fail(`TESTE A insert: revision ${revInsert}, esperado 1`);
console.log("TESTE A insert", doc.id, "revision", revInsert);

doc.vitals = [{ ...doc.vitals[0], fc: 82 }];
doc.inhalationAgents = [{ ...doc.inhalationAgents[0], inspiredConc: 2 }];
await saveProcedure(doc, uid);
const revUpdate = doc.revision ?? 0;
if (revUpdate !== 2) fail(`TESTE A update: revision ${revUpdate}, esperado 2`);

const loadedA = await getProcedureById(doc.id);
if (!loadedA) fail("reload A vazio");
if (loadedA.revision !== 2) fail(`reload A revision ${loadedA.revision}`);
if (loadedA.vitals.find((v) => v.id === fcId)?.fc !== 82) fail("FC não persistiu");
if (!loadedA.inhalationAgents.some((a) => a.agent === "Sevoflurano" && a.inspiredConc === 2)) fail("Sevo não persistiu");
if (!loadedA.fluids.some((f) => f.id === fluidId && f.volumeAdministered === 250)) fail("fluido não persistiu");
if (!loadedA.events.some((e) => e.id === eventId)) fail("evento não persistiu");
if (!loadedA.bolusDrugs.some((b) => b.id === bolusId && b.dose === 100)) fail("bolus não persistiu");
console.log("TESTE A PASS revision", loadedA.revision);

const beforeB = loadedA.patient.fullName;
const { error: rollbackErr } = await supabase.rpc("save_procedure_atomic", {
  p_procedure_id: doc.id,
  p_expected_revision: loadedA.revision,
  p_parent: {
    ...parentPayloadForWrite({ ...loadedA, patient: { ...loadedA.patient, fullName: "NAO DEVE GRAVAR ROLLBACK" } }, uid, { includeStatus: true }),
  },
  p_children: {
    ...childrenPayloadForWrite(loadedA),
    events: "payload-invalido"
  }
});
if (!rollbackErr) fail("TESTE B deveria falhar no child inválido");
const mappedB = mapClinicalError(rollbackErr).message.toLowerCase();
if (!mappedB.includes("inválido") && !String(rollbackErr.message || "").includes("invalid_child_payload")) {
  fail(`TESTE B erro inesperado: ${mappedB}`);
}
const afterB = await getProcedureById(doc.id);
if (!afterB) fail("reload B vazio");
if (afterB.revision !== loadedA.revision) fail(`TESTE B mudou revision para ${afterB.revision}`);
if (afterB.patient.fullName !== beforeB) fail("TESTE B atualizou o pai");
if (afterB.events.filter((e) => e.id === eventId).length !== 1) fail("TESTE B alterou eventos");
console.log("TESTE B PASS rollback", afterB.revision);

const copyC = {
  ...afterB,
  revision: afterB.revision,
  patient: { ...afterB.patient, fullName: `Paciente Teste Atomico A ${stamp}` }
};
await saveProcedure(copyC, uid);
const afterASave = await getProcedureById(doc.id);
if (!afterASave) fail("reload após A concorrente vazio");
const staleB = {
  ...afterB,
  revision: afterB.revision,
  events: [
    ...afterB.events,
    { id: crypto.randomUUID(), name: "Evento da aba B", timestamp: start, category: "Outro" as const }
  ]
};
let staleThrew = false;
try {
  await saveProcedure(staleB, uid);
} catch (err) {
  staleThrew = true;
  if (!isStaleRevisionError(err)) fail(`TESTE C esperado stale_revision, veio ${mapClinicalError(err).message}`);
}
if (!staleThrew) fail("TESTE C deveria recusar a aba B");
const afterC = await getProcedureById(doc.id);
if (!afterC) fail("reload C vazio");
if (afterC.patient.fullName !== copyC.patient.fullName) fail("TESTE C sobrescreveu o nome de A");
if (afterC.events.some((e) => e.name === "Evento da aba B")) fail("TESTE C gravou o evento de B");
console.log("TESTE C PASS stale_revision", afterC.revision);

const bolusCount = afterC.bolusDrugs.filter((b) => b.id === bolusId).length;
afterC.bolusDrugs = [...afterC.bolusDrugs];
await saveProcedure(afterC, uid);
await saveProcedure(afterC, uid);
const afterD = await getProcedureById(doc.id);
if (!afterD) fail("reload D vazio");
const bolusAfter = afterD.bolusDrugs.filter((b) => b.id === bolusId).length;
if (bolusAfter !== bolusCount) fail(`TESTE D duplicou bolus: ${bolusCount} → ${bolusAfter}`);
const eventAfter = afterD.events.filter((e) => e.id === eventId).length;
if (eventAfter !== 1) fail(`TESTE D duplicou evento: ${eventAfter}`);
const fluidAfter = afterD.fluids.filter((f) => f.id === fluidId).length;
if (fluidAfter !== 1) fail(`TESTE D duplicou fluido: ${fluidAfter}`);
console.log("TESTE D PASS idempotência", afterD.revision);

const { error: delErr, count } = await supabase
  .from("procedure_events")
  .delete({ count: "exact" })
  .eq("id", eventId);
if (!delErr && (count || 0) > 0) fail("DELETE direto de evento clínico foi permitido");
const { data: stillEvent, error: stillErr } = await supabase
  .from("procedure_events")
  .select("id")
  .eq("id", eventId)
  .maybeSingle();
if (stillErr) fail(`leitura após DELETE: ${stillErr.message}`);
if (!stillEvent) fail("DELETE direto apagou o evento");
console.log("DELETE bypass NEGADO");

const voided = await voidClinicalItem("events", eventId, "Lançamento duplicado");
if (voided.already_voided) fail("primeiro void não deveria ser already_voided");
const { data: voidRow } = await supabase
  .from("procedure_events")
  .select("voided_at, voided_by, void_reason")
  .eq("id", eventId)
  .maybeSingle();
if (!voidRow?.voided_at) fail("voided_at ausente");
if (voidRow.voided_by !== uid) fail(`voided_by ${voidRow.voided_by} != auth.uid()`);
if (voidRow.void_reason !== "Lançamento duplicado") fail("void_reason incorreto");
const reloadedVoid = await getProcedureById(doc.id);
if (!reloadedVoid?.events.find((e) => e.id === eventId)?.voidedAt) fail("void não voltou na hidratação");
console.log("VOID PASS", voidRow.voided_by);

console.log("FASE_ATOMIC_LIVE_OK", doc.id);
process.exit(0);
