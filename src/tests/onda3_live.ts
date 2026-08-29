/**
 * Live check da onda 3 contra o projeto Anestflow.
 * Não copia PHI de produção. Paciente fictício.
 *
 * Encerramento = RPC sign_procedure(uuid) via closeProcedureAtomic
 * (Fase 4B). O cliente não envia canonical.
 *
 * Uso: env de .env.local + ONDA3_TEST_EMAIL / ONDA3_TEST_PASSWORD
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabase.ts";
import { saveProcedure, getProcedures, getProcedureById, closeProcedureAtomic } from "../lib/proceduresService.ts";
import { saveToWorklist, getFromWorklist, hashCpf } from "../lib/worklistService.ts";
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

const cpf = "39053344705";
const hash = await hashCpf(cpf);
if (!/^[0-9a-f]{64}$/.test(hash)) fail("cpf_hash inválido");

const stamp = Date.now();
const blank = getBlankDocument();
blank.createdByUid = uid;
blank.currentResponsibleUid = uid;
blank.participantUids = [uid];
blank.userId = uid;
blank.patient.fullName = `Paciente Teste Onda Tres ${stamp}`;
blank.patient.cpf = cpf;
blank.patient.recordNumber = `ONDA3-${stamp}`;
blank.patient.hospital = "Hospital Teste Onda 3";
blank.team.anesthesiologistLead = "Dr. Agente Onda Tres";
blank.team.crmLead = "123456";
blank.team.ufLead = "GO";
blank.timers.startAnesthesia = new Date().toISOString();
blank.timers.endAnesthesia = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
blank.vitals = [
  {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    minutesFromStart: 0,
    pas: 120,
    pad: 80,
    fc: 72
  }
];

await saveToWorklist(cpf, blank.patient, blank.preEvaluation);
const worklist = await getFromWorklist(cpf);
if (!worklist || worklist.patient.fullName !== blank.patient.fullName) fail("worklist roundtrip");
console.log("worklist ok");

await saveProcedure(blank, uid);
if (!blank.id.match(/^[0-9a-f-]{36}$/i)) fail(`id não virou UUID: ${blank.id}`);
console.log("save draft", blank.id);

const listed = await getProcedures(uid);
const found = listed.find((d) => d.id === blank.id);
if (!found) fail("getProcedures não retornou a ficha");
if (!found.vitals?.length) fail("vitals filhos não hidrataram");
console.log("list+hydrate ok", found.vitals.length, "vitals");

const reloaded = await getProcedureById(blank.id);
if (!reloaded || reloaded.patient.fullName !== blank.patient.fullName) fail("getProcedureById");

const afterSign = await closeProcedureAtomic(blank.id);
if (afterSign.status !== "Signed" || !afterSign.hash) fail("sign_procedure não fechou a ficha");
if (!afterSign.signatureSnapshot?.includes("SignedAnesthesiaRecordV1")) {
  fail("canonical selado não é SignedAnesthesiaRecordV1");
}
console.log("signed", afterSign.hash);

afterSign.patient.fullName = "tentativa de mutacao";
await saveProcedure(afterSign, uid);
const stillSigned = await getProcedureById(blank.id);
if (stillSigned?.patient.fullName === "tentativa de mutacao") fail("ficha signed foi alterada");
if (stillSigned?.status !== "Signed") fail("status signed perdido");
console.log("imutabilidade ok (re-save signed e no-op)");

const anon = createClient(url, key);
const { data: leaked, error: leakErr } = await anon.from("procedures").select("id");
if (leakErr && !String(leakErr.message).toLowerCase().includes("jwt")) {
  // anon sem sessão: RLS deve devolver lista vazia, não as fichas
}
if ((leaked || []).some((row) => row.id === blank.id)) fail("anon leu ficha clínica");
console.log("anon não lê a ficha");

await supabase.from("worklist_entries").delete().eq("created_by", uid).eq("cpf_hash", hash);
console.log("worklist de teste removida (ficha signed permanece imutável, sem delete)");

console.log("ONDA3_LIVE_OK", blank.id);
process.exit(0);
