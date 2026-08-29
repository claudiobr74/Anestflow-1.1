/**
 * Live: anestesia simulada ~2h30, vários saves, reload, conflito, SRPA,
 * handover, selo, PDF e integridade. Paciente sintético. Sem PHI.
 * Voice Scribe: transcrição original persistida após confirmação humana simulada
 * (a baseline Gemini permanece congelada; VOICE_COMMAND_E2E já é PASS).
 *
 * Uso: .env.local + ONDA3_TEST_EMAIL / ONDA3_TEST_PASSWORD
 */
import dotenv from "dotenv";
import { getSupabase } from "../lib/supabase.ts";
import {
  saveProcedure,
  getProcedureById,
  closeProcedureAtomic,
  verifyProcedureIntegrity,
  isProcedureIntegrityIntact
} from "../lib/proceduresService.ts";
import { isStaleRevisionError } from "../lib/clinicalErrors.ts";
import { evaluateSigningReadiness } from "../lib/signingReadinessEngine.ts";
import { pdfFinalSearchableText, toSignedAnesthesiaRecordV1 } from "../lib/pdfFinal.ts";
import { getBlankDocument } from "../mockData.ts";
import { UNREGISTERED } from "../lib/clinicalDisplay.ts";
import { ASAClass } from "../types.ts";

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
const start = new Date("2026-08-29T08:00:00.000Z");
const iso = (minutes: number) => new Date(start.getTime() + minutes * 60_000).toISOString();

const doc = getBlankDocument();
doc.createdByUid = uid;
doc.currentResponsibleUid = uid;
doc.participantUids = [uid];
doc.userId = uid;
doc.status = "Draft";
doc.patient = {
  ...doc.patient,
  fullName: `Paciente Sintetico Longo ${stamp}`,
  recordNumber: `LONG-${stamp}`,
  hospital: "Hospital Teste Longo",
  age: 54,
  gender: "Masculino",
  weight: 78,
  height: 172,
  asa: ASAClass.ASA_II,
  scheduledProcedure: "Colecistectomia videolaparoscópica",
  actualProcedure: "Colecistectomia videolaparoscópica",
  diagnosis: "Colelitíase"
};
doc.team.anesthesiologistLead = "Dr. Agente Longo";
doc.team.crmLead = "000077";
doc.team.ufLead = "SP";
doc.preEvaluation = {
  ...doc.preEvaluation,
  physicalExam: {
    ...doc.preEvaluation.physicalExam,
    cardiac: "Sopro mitral 2+/6+ (alteração proposital do default)"
  }
};
doc.technique = { ...doc.technique, balanced: true, generalInhalational: true };
doc.timers = {
  startAnesthesia: iso(0),
  startSurgery: iso(15),
  endSurgery: iso(140),
  endAnesthesia: iso(155)
};
doc.checklist = { ...doc.checklist, patientIdConfirmed: true, consentConfirmed: true, procedureConfirmed: true };
doc.vascularAccesses = [{
  id: crypto.randomUUID(),
  type: "Periférico",
  site: "Fossa cubital",
  side: "Esquerdo",
  gauge: "20G",
  attempts: 1,
  ultrasoundGuided: false,
  timestamp: iso(2),
  professional: "Dr. Agente Longo"
}];

const vitals = [];
for (let m = 0; m <= 150; m += 5) {
  vitals.push({
    id: crypto.randomUUID(),
    timestamp: iso(m),
    minutesFromStart: m,
    pas: 110 + (m % 12),
    pad: 68 + (m % 7),
    fc: 64 + (m % 15),
    spo2: m === 55 ? 91 : 98,
    etco2: 34 + (m % 4)
  });
}
doc.vitals = vitals;
doc.inhalationAgents = [{ id: crypto.randomUUID(), agent: "Sevoflurano", startTime: iso(0), inspiredConc: 1.8 }];
doc.fluids = [{
  id: crypto.randomUUID(),
  type: "Cristaloide",
  name: "Ringer Lactato",
  volumePrepared: 1000,
  volumeAdministered: 800,
  startTime: iso(0)
}];
doc.outputs = [{
  id: crypto.randomUUID(),
  type: "Diurese",
  volume: 220,
  timestamp: iso(90)
}];
const fentanylId = crypto.randomUUID();
doc.bolusDrugs = [
  { id: fentanylId, name: "Fentanil", dose: 100, unit: "mcg", timestamp: iso(3), minutesFromStart: 3, notes: "Confirmado via escriba" },
  { id: crypto.randomUUID(), name: "Propofol", dose: 120, unit: "mg", timestamp: iso(4), minutesFromStart: 4 }
];
doc.continuousInfusions = [{
  id: crypto.randomUUID(),
  name: "Remifentanil",
  unit: "mcg/kg/min",
  history: [
    { timestamp: iso(10), minutesFromStart: 10, rate: 0.1, status: "Iniciado" },
    { timestamp: iso(145), minutesFromStart: 145, rate: 0, status: "Finalizado" }
  ]
}];
doc.events = [
  { id: crypto.randomUUID(), name: "Indução", timestamp: iso(3), category: "Marcador Temporal" },
  { id: crypto.randomUUID(), name: "Hipotensão transitória", timestamp: iso(55), category: "Intercorrência", notes: "SpO2 91; efedrina" },
  { id: crypto.randomUUID(), name: "Efedrina 10 mg", timestamp: iso(56), category: "Procedimento" }
];
doc.voiceTranscripts = [{
  id: crypto.randomUUID(),
  transcriptOriginal: "fentanil cem microgramas",
  createdAt: iso(3)
}];
doc.recovery = {
  ...doc.recovery,
  admissionTime: iso(160),
  pas: 124,
  pad: 74,
  fc: 70,
  spo2: 97,
  temp: 36.4,
  scoreActivity: 2,
  scoreRespiration: 2,
  scoreCirculation: 2,
  scoreConsciousness: 2,
  scoreSaturation: 2,
  dischargeDestination: "Enfermaria (Quarto)",
  dischargeTime: iso(190),
  records: []
};
doc.handover = {
  dischargeCondition: "Acordado",
  destination: "Leito",
  notes: "SRPA sem intercorrência. Destino enfermaria."
};

await saveProcedure(doc, uid);
const rev1 = doc.revision;
console.log("save 1", doc.id, "revision", rev1, "vitals", doc.vitals.length);
if ((rev1 || 0) < 1) fail("primeiro save sem revision");

doc.events = [
  ...doc.events,
  { id: crypto.randomUUID(), name: "Incisão", timestamp: iso(15), category: "Marcador Temporal" }
];
await saveProcedure(doc, uid);
const rev2 = doc.revision;
if ((rev2 || 0) !== (rev1 || 0) + 1) fail(`save 2 deveria ser +1, ${rev1} → ${rev2}`);
console.log("save 2 revision", rev2);

const reloadedMid = await getProcedureById(doc.id);
if (!reloadedMid) fail("reload no meio do caso vazio");
if (reloadedMid.vitals.length < 30) fail(`reload perdeu vitais: ${reloadedMid.vitals.length}`);
if (!reloadedMid.bolusDrugs.some((b) => b.id === fentanylId && b.dose === 100)) fail("reload perdeu fentanil");
if (!reloadedMid.voiceTranscripts?.some((t) => t.transcriptOriginal === "fentanil cem microgramas")) {
  fail("reload perdeu transcript_original");
}
if (reloadedMid.recovery?.scoreActivity !== 2) fail("reload perdeu SRPA (0 seria válido; 2 precisa voltar)");
console.log("reload mid PASS", reloadedMid.vitals.length, "vitals");

const tabA = { ...reloadedMid, bolusDrugs: [...reloadedMid.bolusDrugs] };
const tabB = {
  ...reloadedMid,
  events: [
    ...reloadedMid.events,
    { id: crypto.randomUUID(), name: "Evento só da aba B", timestamp: iso(80), category: "Outro" as const }
  ]
};
tabA.bolusDrugs = [
  ...tabA.bolusDrugs,
  { id: crypto.randomUUID(), name: "Ondansetrona", dose: 4, unit: "mg", timestamp: iso(130), minutesFromStart: 130 }
];
await saveProcedure(tabA, uid);
let conflict = false;
try {
  await saveProcedure(tabB, uid);
} catch (err) {
  conflict = isStaleRevisionError(err);
  if (!conflict) fail(`conflito multiaba: ${err instanceof Error ? err.message : err}`);
}
if (!conflict) fail("aba B deveria tomar stale_revision");
const afterConflict = await getProcedureById(doc.id);
if (!afterConflict) fail("reload pós-conflito vazio");
if (afterConflict.events.some((e) => e.name === "Evento só da aba B")) fail("evento de B sobrescreveu A");
if (!afterConflict.bolusDrugs.some((b) => b.name === "Ondansetrona")) fail("ondansetrona de A não persistiu");
console.log("multiaba CONFLICT PASS", afterConflict.revision);

const forClose = await getProcedureById(doc.id);
if (!forClose) fail("ficha para encerrar sumiu");
const ready = evaluateSigningReadiness(forClose);
if (!ready.canClose) {
  fail(`SigningReadiness bloqueou: ${ready.alerts.filter((a) => a.level === "CRITICAL").map((a) => a.title).join(", ")}`);
}
const sealed = await closeProcedureAtomic(forClose.id);
if (sealed.status !== "Signed" || !sealed.hash) fail("selo falhou");
console.log("signed", sealed.hash);

sealed.patient.fullName = "tentativa pos assinatura";
await saveProcedure(sealed, uid);
const { error: vitalErr } = await supabase.from("procedure_vitals").insert({
  id: crypto.randomUUID(),
  procedure_id: sealed.id,
  created_by: uid,
  clinical_at: iso(200),
  payload: { fc: 99 }
});
if (!vitalErr) fail("INSERT de vital em ficha signed deveria falhar");
const { error: delErr, count } = await supabase.from("procedure_events").delete({ count: "exact" }).eq("procedure_id", sealed.id);
if (!delErr && (count || 0) > 0) fail("DELETE de evento em ficha signed foi permitido");
const still = await getProcedureById(sealed.id);
if (!still) fail("ficha signed sumiu");
if (still.patient.fullName === "tentativa pos assinatura") fail("paciente mudou após assinatura");
if (still.status !== "Signed") fail("status signed perdido");
console.log("imutabilidade PASS");

const report = await verifyProcedureIntegrity(sealed.id);
if (!isProcedureIntegrityIntact(report)) fail(`integridade ${JSON.stringify(report)}`);
console.log("integrity PASS", report.storedHash.slice(0, 12));

const record = toSignedAnesthesiaRecordV1(still);
const pdfText = pdfFinalSearchableText(record);
const snapshot = still.signatureSnapshot || "";
if (!snapshot.includes("Fentanil")) fail("snapshot sem Fentanil");
if (!snapshot.includes("Sevoflurano")) fail("snapshot sem Sevoflurano");
if (!snapshot.includes("SignedAnesthesiaRecordV1")) fail("snapshot sem schema");
if (!pdfText.includes(still.id)) fail("PDF sem procedureId");
if (!pdfText.includes(still.hash || "")) fail("PDF sem hash");
if (!pdfText.includes("SHA-256") && !pdfText.includes("integrityAlgo")) fail("PDF sem algoritmo de integridade");
if (!pdfText.includes("transcript_original.0=fentanil cem microgramas")) fail("PDF sem transcrição original");
if (pdfText.includes("120/80") && !still.vitals.some((v) => v.pas === 120 && v.pad === 80)) {
  fail("PDF inventou 120/80");
}
console.log("PDF PASS");

if (UNREGISTERED.includes("120")) fail("UNREGISTERED não deve conter 120");

console.log("FASE_LONGCASE_LIVE_OK", still.id);
process.exit(0);
