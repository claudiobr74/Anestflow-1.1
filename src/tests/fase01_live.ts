/**
 * Live check da Fase 0+1: Sevo, timer, SRPA, fluido, via aérea e checklist
 * sobrevivem a save + reload no Anestflow. Paciente fictício. Sem PHI.
 *
 * Uso: env de .env.local + ONDA3_TEST_EMAIL / ONDA3_TEST_PASSWORD
 */
import dotenv from "dotenv";
import { getSupabase } from "../lib/supabase.ts";
import { saveProcedure, getProcedureById } from "../lib/proceduresService.ts";
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

const doc = getBlankDocument();
doc.createdByUid = uid;
doc.currentResponsibleUid = uid;
doc.participantUids = [uid];
doc.userId = uid;
doc.status = "Draft";
doc.patient.fullName = "Paciente Teste Fase Zero Um";
doc.patient.recordNumber = "FASE01-001";
doc.patient.hospital = "Hospital Teste Fase 01";
doc.timers = { startAnesthesia: "2026-08-29T12:00:00.000Z" };
doc.inhalationAgents = [
  {
    id: crypto.randomUUID(),
    agent: "Sevoflurano",
    startTime: "2026-08-29T12:00:00.000Z",
  },
];
doc.recovery = {
  ...doc.recovery,
  pas: 112,
  pad: 68,
  fc: 74,
  spo2: 97,
  temp: 36.2,
  scoreActivity: 0,
};

await saveProcedure(doc, uid);
if (!doc.id.match(/^[0-9a-f-]{36}$/i)) fail(`id não virou UUID: ${doc.id}`);
console.log("save sevo+timer+srpa", doc.id);

const round1 = await getProcedureById(doc.id);
if (!round1) fail("getProcedureById vazio após primeiro save");
if (!round1.inhalationAgents?.some((g) => g.agent === "Sevoflurano")) fail("Sevoflurano não voltou no reload");
if (round1.inhalationAgents.find((g) => g.agent === "Sevoflurano")?.inspiredConc === 2) {
  fail("reload inventou concentração 2% no Sevo");
}
if (round1.timers?.startAnesthesia !== doc.timers.startAnesthesia) fail("timer startAnesthesia não voltou");
if (round1.recovery?.pas !== 112 || round1.recovery?.fc !== 74) fail("SRPA PA/FC não voltaram");
if (round1.recovery?.scoreActivity !== 0) fail("Aldrete 0 foi perdido ou virado vazio");
console.log("roundtrip sevo/timer/srpa ok");

round1.fluids = [
  ...(round1.fluids || []),
  {
    id: crypto.randomUUID(),
    type: "Cristaloide",
    name: "Ringer Lactato Fase01",
    volumePrepared: 500,
    volumeAdministered: 500,
    startTime: "2026-08-29T12:10:00.000Z",
  },
];
round1.airway = { ...round1.airway, deviceSize: "7.5 Fase01" };
round1.checklist = { ...round1.checklist, patientIdConfirmed: true, machineChecked: true };

await saveProcedure(round1, uid);
const round2 = await getProcedureById(doc.id);
if (!round2) fail("getProcedureById vazio após segundo save");
if (!round2.fluids?.some((f) => f.name === "Ringer Lactato Fase01")) fail("fluido não voltou");
if (round2.airway?.deviceSize !== "7.5 Fase01") fail("via aérea não voltou");
if (!round2.checklist?.patientIdConfirmed || !round2.checklist?.machineChecked) fail("checklist não voltou");
if (!round2.inhalationAgents?.some((g) => g.agent === "Sevoflurano")) fail("Sevo perdido no segundo save");
if (round2.timers?.startAnesthesia !== doc.timers.startAnesthesia) fail("timer perdido no segundo save");
if (round2.recovery?.pas !== 112) fail("SRPA perdido no segundo save");
console.log("roundtrip fluido/via aérea/checklist ok");

console.log("FASE01_LIVE_OK", doc.id);
process.exit(0);
