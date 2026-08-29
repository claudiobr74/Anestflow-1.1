/**
 * Live da Etapa 1 / fechamento da Fase 3: início da anestesia promove
 * Draft → InProgress no save + reload. Paciente fictício. Sem PHI.
 *
 * Uso: env de .env.local + ONDA3_TEST_EMAIL / ONDA3_TEST_PASSWORD
 */
import dotenv from "dotenv";
import { getSupabase } from "../lib/supabase.ts";
import { saveProcedure, getProcedureById } from "../lib/proceduresService.ts";
import { getBlankDocument } from "../mockData.ts";
import { assignNewDocumentOwner } from "../lib/assertCanEdit.ts";
import { withInProgressIfAnesthesiaStarted } from "../lib/procedureStatus.ts";
import { evaluateSigningReadiness } from "../lib/signingReadinessEngine.ts";

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

const blankEval = evaluateSigningReadiness(getBlankDocument());
if (blankEval.canClose) fail("ficha em branco não deveria encerrar");
if (!blankEval.alerts.some((a) => a.level === "CRITICAL")) fail("blank sem CRITICAL");
if (blankEval.alerts.some((a) => /capno/i.test(a.title))) fail("capnografia não pode ser critério");
console.log("1) SigningReadinessEngine recusa blank e não usa capnografia");

const stamp = Date.now();
let doc = assignNewDocumentOwner(getBlankDocument(), uid);
doc.status = "Draft";
doc.patient.fullName = `Paciente Teste Fase 3 Close ${stamp}`;
doc.patient.recordNumber = `FASE03-${stamp}`;
doc.team.anesthesiologistLead = "Teste";
doc.team.crmLead = "0000";
doc.timers = { startAnesthesia: "2026-08-29T15:00:00.000Z" };

const promoted = withInProgressIfAnesthesiaStarted(doc);
if (promoted.status !== "InProgress") fail("promotor local não virou InProgress");

await saveProcedure(doc, uid);
if (!doc.id) fail("save sem id");
console.log("save", doc.id, "status local", doc.status);

const loaded = await getProcedureById(doc.id);
if (!loaded) fail("reload vazio");
if (loaded.status !== "InProgress") fail(`status após reload: ${loaded.status}`);
if (loaded.timers?.startAnesthesia !== doc.timers.startAnesthesia) fail("timer não voltou");
console.log("2) reload InProgress + timer ok");

const ended = { ...loaded, timers: { ...loaded.timers, endAnesthesia: "2026-08-29T16:00:00.000Z" } };
if (ended.status !== "InProgress") fail("término não deve rebaixar status");
await saveProcedure(ended, uid);
const loadedEnd = await getProcedureById(doc.id);
if (!loadedEnd) fail("reload após término vazio");
if (loadedEnd.status !== "InProgress") fail("status após término deveria permanecer InProgress");
if (!loadedEnd.timers?.endAnesthesia) fail("endAnesthesia não persistiu");
console.log("3) término persiste; status continua InProgress (não Draft)");

console.log("FASE03_LIVE_OK", doc.id);
