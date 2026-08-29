/**
 * Live check da Fase 7 contra o projeto Anestflow.
 * Sem PHI. Não espera 20 minutos. JWT da Edge permanece obrigatório.
 *
 * Uso: env de .env.local + ONDA3_TEST_EMAIL / ONDA3_TEST_PASSWORD
 */
import dotenv from "dotenv";
import { getSupabase } from "../lib/supabase.ts";
import { getBlankDocument } from "../mockData.ts";
import { toAIClinicalContext, aiContextOmitsIdentifiers } from "../lib/aiClinicalContext.ts";

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

function functionsUrl(name: string): string {
  return `${url.replace(/\/$/, "")}/functions/v1/${name}`;
}

console.log("1) POST review sem JWT deve ser 401 (verify_jwt)");
const unauth = await fetch(functionsUrl("review"), {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: key,
  },
  body: JSON.stringify({ patient: { fullName: "Paciente Teste Fase Sete" } }),
});
if (unauth.status !== 401) fail(`esperado 401 sem JWT, veio ${unauth.status} ${await unauth.text()}`);
console.log("   401 ok");

const supabase = getSupabase();
const { data: session, error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError || !session.user) fail(authError?.message || "login falhou");
if (!session.user.email_confirmed_at) fail("usuário de teste sem e-mail confirmado");
console.log("2) login ok", session.user.id);

const ficha = getBlankDocument();
ficha.patient.fullName = "Paciente Teste Fase Sete";
ficha.patient.cpf = "39053344705";
ficha.patient.recordNumber = "FASE07-NAO-ENVIAR";
ficha.patient.admissionNumber = "ADM-7";
ficha.currentResponsibleUid = session.user.id;
ficha.participantUids = [session.user.id];
const ctx = toAIClinicalContext(ficha);
if (!aiContextOmitsIdentifiers(ctx)) fail("toAIClinicalContext ainda leva identificador");
if (ficha.patient.cpf !== "39053344705") fail("strip da IA não pode mutar a ficha viva");
console.log("3) toAIClinicalContext omite identificadores; ficha viva intacta");

await supabase.auth.signOut();
console.log("FASE07_LIVE_OK");
process.exit(0);
