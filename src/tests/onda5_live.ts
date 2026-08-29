/**
 * Live check da onda 5 contra o projeto Anestflow.
 * Não copia PHI de produção. Paciente fictício.
 *
 * Uso: env de .env.local + ONDA5_TEST_EMAIL/PASSWORD (fallback ONDA3_*).
 */
import dotenv from "dotenv";
import { getSupabase } from "../lib/supabase.ts";
import { invokeAiFunction } from "../lib/aiFunctions.ts";
import { getBlankDocument } from "../mockData.ts";

dotenv.config({ path: ".env.local" });

const url = process.env.VITE_SUPABASE_URL || "";
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const email = process.env.ONDA5_TEST_EMAIL || process.env.ONDA3_TEST_EMAIL || "";
const password = process.env.ONDA5_TEST_PASSWORD || process.env.ONDA3_TEST_PASSWORD || "";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

if (!url || !key || key.includes("xxxxxxxx")) fail("VITE_SUPABASE_URL / PUBLISHABLE_KEY ausentes");
if (!email || !password) fail("ONDA5_TEST_EMAIL / ONDA5_TEST_PASSWORD (ou ONDA3_*) ausentes");

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
  body: JSON.stringify({ patient: { fullName: "Paciente Teste Onda Cinco" } }),
});
if (unauth.status !== 401) fail(`esperado 401 sem JWT, veio ${unauth.status} ${await unauth.text()}`);
console.log("   401 ok");

const supabase = getSupabase();
const { data: session, error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError || !session.user) fail(authError?.message || "login falhou");
if (!session.user.email_confirmed_at) fail("usuário de teste sem e-mail confirmado");
console.log("2) login ok", session.user.id);

const blank = getBlankDocument();
blank.patient.fullName = "Paciente Teste Onda Cinco";
blank.patient.recordNumber = "ONDA5-001";
blank.patient.hospital = "Hospital Teste Onda 5";
blank.vitals = [
  {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    minutesFromStart: 0,
    pas: 120,
    pad: 80,
    fc: 72,
  },
];

console.log("3) invoke review (ficha sintética)");
try {
  const review = await invokeAiFunction<{ alerts?: unknown[] }>("review", blank);
  if (!review || !Array.isArray(review.alerts)) {
    fail("review autenticado deveria devolver { alerts: [] }");
  }
  console.log("   review ok, alerts=", review.alerts.length);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const missingKey =
    message.includes("GEMINI_API_KEY") ||
    message.includes("não configurada");
  if (!missingKey) fail(`review falhou de forma inesperada: ${message}`);
  console.log("   review autenticado chegou na função; secret Gemini ausente (500 esperado):", message);
}

console.log("4) invoke voice-command sem áudio deve ser 400");
try {
  await invokeAiFunction("voice-command", { mimeType: "audio/webm" });
  fail("voice-command sem áudio deveria falhar");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (!message.toLowerCase().includes("áudio") && !message.toLowerCase().includes("audio")) {
    fail(`voice-command sem áudio: mensagem inesperada: ${message}`);
  }
  console.log("   400/erro de áudio ok");
}

console.log("5) invoke generate-description (ficha sintética)");
try {
  const generated = await invokeAiFunction<{ description?: string }>("generate-description", {
    document: blank,
    models: [],
  });
  if (typeof generated.description !== "string") {
    fail("generate-description deveria devolver { description }");
  }
  console.log("   generate-description ok, chars=", generated.description.length);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const missingKey =
    message.includes("GEMINI_API_KEY") ||
    message.includes("não configurada");
  if (!missingKey) fail(`generate-description falhou de forma inesperada: ${message}`);
  console.log("   generate-description autenticado; secret Gemini ausente (500 esperado):", message);
}

await supabase.auth.signOut();
console.log("PASS onda 5 live");
