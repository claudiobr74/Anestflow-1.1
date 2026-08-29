/**
 * Live do checkpoint pós-Fase 4: uma ficha fictícia prova persistência,
 * encerramento server-side e selo A+B no projeto Anestflow. Sem PHI.
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
} from "../lib/proceduresService.ts";
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
const startAnesthesia = "2026-08-29T12:00:00.000Z";
const endAnesthesia = "2026-08-29T14:30:00.000Z";
const doc = getBlankDocument();
doc.createdByUid = uid;
doc.currentResponsibleUid = uid;
doc.participantUids = [uid];
doc.userId = uid;
doc.status = "Draft";
doc.patient.fullName = `Paciente Teste Checkpoint ${stamp}`;
doc.patient.recordNumber = `CHKPT-${stamp}`;
doc.patient.hospital = "Hospital Teste Checkpoint";
doc.team.anesthesiologistLead = "Dr. Agente Checkpoint";
doc.team.crmLead = "000040";
doc.team.ufLead = "SP";
doc.timers = { startAnesthesia, endAnesthesia };
doc.inhalationAgents = [
  {
    id: crypto.randomUUID(),
    agent: "Sevoflurano",
    startTime: startAnesthesia
  }
];
doc.recovery = {
  ...doc.recovery,
  pas: 112,
  pad: 68,
  fc: 74,
  spo2: 97,
  temp: 36.2,
  scoreActivity: 0
};
doc.vitals = [
  {
    id: crypto.randomUUID(),
    timestamp: startAnesthesia,
    minutesFromStart: 0,
    pas: 118,
    pad: 76,
    fc: 70
  }
];

await saveProcedure(doc, uid);
if (!doc.id.match(/^[0-9a-f-]{36}$/i)) fail(`id não virou UUID: ${doc.id}`);
console.log("save persistência", doc.id);

const round1 = await getProcedureById(doc.id);
if (!round1) fail("reload vazio após save");
if (round1.status !== "InProgress") fail(`Draft+timer deveria virar InProgress, veio ${round1.status}`);
if (!round1.inhalationAgents?.some((g) => g.agent === "Sevoflurano")) fail("Sevoflurano não persistiu");
if (round1.inhalationAgents.find((g) => g.agent === "Sevoflurano")?.inspiredConc === 2) {
  fail("reload inventou concentração 2% no Sevo");
}
if (round1.timers?.startAnesthesia !== startAnesthesia) fail("timer não persistiu");
if (round1.recovery?.pas !== 112 || round1.recovery?.fc !== 74) fail("SRPA não persistiu");
if (round1.recovery?.scoreActivity !== 0) fail("Aldrete 0 foi perdido");
console.log("persistência sevo/timer/srpa/aldrete0 ok");

round1.fluids = [
  ...(round1.fluids || []),
  {
    id: crypto.randomUUID(),
    type: "Cristaloide",
    name: "Ringer Lactato Checkpoint",
    volumePrepared: 500,
    volumeAdministered: 500,
    startTime: "2026-08-29T12:10:00.000Z"
  }
];
round1.airway = { ...round1.airway, deviceSize: "7.5 Checkpoint" };
round1.checklist = { ...round1.checklist, patientIdConfirmed: true, machineChecked: true };
await saveProcedure(round1, uid);

const round2 = await getProcedureById(doc.id);
if (!round2) fail("reload vazio após segundo save");
if (!round2.fluids?.some((f) => f.name === "Ringer Lactato Checkpoint")) fail("fluido não persistiu");
if (round2.airway?.deviceSize !== "7.5 Checkpoint") fail("via aérea não persistiu");
if (!round2.checklist?.patientIdConfirmed || !round2.checklist?.machineChecked) fail("checklist não persistiu");
console.log("persistência fluido/via aérea/checklist ok");

const { error: threeArgErr } = await supabase.rpc("sign_procedure", {
  p_procedure_id: doc.id,
  p_canonical: '{"evil":true}',
  p_signer: { name: "Hacker" }
});
if (!threeArgErr) fail("sign_procedure ainda aceita canonical do cliente");
console.log("canonical do cliente recusado");

const sealed = await closeProcedureAtomic(doc.id);
if (sealed.status !== "Signed" || !sealed.hash) fail("closeProcedureAtomic não selou");
if (!sealed.signatureSnapshot?.includes("SignedAnesthesiaRecordV1")) {
  fail("snapshot não é SignedAnesthesiaRecordV1");
}
console.log("selado", sealed.hash);

const report = await verifyProcedureIntegrity(doc.id);
if (!report.snapshotOk) fail("checagem A falhou");
if (report.persistedOk !== true) fail("checagem B falhou");
if (report.legacy) fail("V2 marcado como legacy");
if (!isProcedureIntegrityIntact(report)) fail("íntegro exige A e B");
if (isProcedureIntegrityIntact({ ...report, persistedOk: false })) {
  fail("A sem B não pode ser íntegro");
}
console.log("verify A+B ok");

sealed.patient.fullName = "tentativa de mutacao checkpoint";
await saveProcedure(sealed, uid);
const still = await getProcedureById(doc.id);
if (still?.patient.fullName === "tentativa de mutacao checkpoint") fail("ficha signed foi alterada");
if (still?.status !== "Signed") fail("status signed perdido");
console.log("imutabilidade ok");

console.log("CHECKPOINT_LIVE_OK", doc.id);
process.exit(0);
