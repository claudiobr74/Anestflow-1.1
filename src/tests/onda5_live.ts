/**
 * Live check da onda 5 contra o projeto Anestflow.
 * Não copia PHI de produção. Paciente fictício.
 *
 * Uso: env de .env.local + ONDA5_TEST_EMAIL/PASSWORD (fallback ONDA3_*).
 */
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { getSupabase } from "../lib/supabase.ts";
import { invokeAiFunction } from "../lib/aiFunctions.ts";
import { getBlankDocument } from "../mockData.ts";
import {
  AI_MODEL_CONFIG,
  CLINICAL_REVIEW_PROMPT_VERSION,
  CLINICAL_REVIEW_SCHEMA_VERSION,
  GEMINI_CLINICAL_MODEL,
  GEMINI_TRANSCRIBE_MODEL,
  NARRATIVE_PROMPT_VERSION,
  NARRATIVE_SCHEMA_VERSION,
  VOICE_PROMPT_VERSION,
  VOICE_SCHEMA_VERSION,
} from "../lib/aiModelConfig.ts";

dotenv.config({ path: ".env.local" });

const url = process.env.VITE_SUPABASE_URL || "";
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const email = process.env.ONDA5_TEST_EMAIL || process.env.ONDA3_TEST_EMAIL || "";
const password = process.env.ONDA5_TEST_PASSWORD || process.env.ONDA3_TEST_PASSWORD || "";

type AiMeta = {
  feature?: string;
  provider?: string;
  model?: string;
  prompt_version?: string;
  schema_version?: string;
  thinking_level?: string;
  transcription_model?: string;
  status?: string;
  success?: boolean;
  error_code?: string;
  transcription?: AiMeta;
};

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function summarizeAi(ai: AiMeta | undefined): Record<string, unknown> {
  if (!ai) return { present: false };
  return {
    present: true,
    feature: ai.feature ?? null,
    provider: ai.provider ?? null,
    model: ai.model ?? null,
    thinking_level: ai.thinking_level ?? null,
    prompt_version: ai.prompt_version ?? null,
    schema_version: ai.schema_version ?? null,
    transcription_model: ai.transcription_model ?? null,
    status: ai.status ?? null,
    success: ai.success ?? null,
    error_code: ai.error_code ?? null,
    transcription: ai.transcription ? summarizeAi(ai.transcription) : null,
  };
}

function assertAiMeta(
  label: string,
  ai: AiMeta | undefined,
  expected: {
    model: string;
    thinking_level?: string;
    prompt_version: string;
    schema_version: string;
    feature: string;
  },
): void {
  if (!ai) {
    fail(`${label}: metadado ai ausente — a versão hospedada antiga (sem GeminiGateway) ainda está ativa?`);
  }
  const got = summarizeAi(ai);
  console.log(`   ${label} ai=`, JSON.stringify(got));
  if (ai.model !== expected.model) {
    fail(`${label}: model esperado ${expected.model}, veio ${String(ai.model)}`);
  }
  if (expected.thinking_level && ai.thinking_level !== expected.thinking_level) {
    fail(`${label}: thinking_level esperado ${expected.thinking_level}, veio ${String(ai.thinking_level)}`);
  }
  if (ai.prompt_version !== expected.prompt_version) {
    fail(`${label}: prompt_version esperado ${expected.prompt_version}, veio ${String(ai.prompt_version)}`);
  }
  if (ai.schema_version !== expected.schema_version) {
    fail(`${label}: schema_version esperado ${expected.schema_version}, veio ${String(ai.schema_version)}`);
  }
  if (ai.feature !== expected.feature) {
    fail(`${label}: feature esperado ${expected.feature}, veio ${String(ai.feature)}`);
  }
  if (ai.provider !== "google-gemini") {
    fail(`${label}: provider esperado google-gemini, veio ${String(ai.provider)}`);
  }
  if (String(ai.model).includes("preview") || String(ai.model).includes("flash-latest") || String(ai.model).includes("3.1-flash-lite")) {
    fail(`${label}: modelo proibido ainda ativo: ${String(ai.model)}`);
  }
}

/** WAV PCM16 sintético (não é fala). Serve para exercitar o ramo de transcrição hospedado. */
function syntheticWavBase64(durationSec = 1.1, sampleRate = 16000): string {
  const samples = Math.floor(durationSec * sampleRate);
  const dataSize = samples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 220 * t) * 0.15 + Math.sin(2 * Math.PI * 880 * t) * 0.05;
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(sample * 32767))), 44 + i * 2);
  }
  return buf.toString("base64");
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

const smoke: Record<string, unknown> = {
  started_at: new Date().toISOString(),
  project_url: url,
  results: {},
};

console.log("3) invoke review (ficha sintética)");
try {
  const review = await invokeAiFunction<{ alerts?: unknown[]; ai?: AiMeta }>("review", blank);
  if (!review || !Array.isArray(review.alerts)) {
    fail("review autenticado deveria devolver { alerts }");
  }
  assertAiMeta("review", review.ai, {
    model: GEMINI_CLINICAL_MODEL,
    thinking_level: AI_MODEL_CONFIG.clinicalReview.thinkingLevel,
    prompt_version: CLINICAL_REVIEW_PROMPT_VERSION,
    schema_version: CLINICAL_REVIEW_SCHEMA_VERSION,
    feature: "clinicalReview",
  });
  console.log("   review ok, alerts=", review.alerts.length);
  smoke.results = {
    ...(smoke.results as object),
    review: { ok: true, alerts: review.alerts.length, ai: summarizeAi(review.ai) },
  };
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fail(`review autenticado falhou: ${message}`);
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
  smoke.results = { ...(smoke.results as object), voice_no_audio: { ok: true, message } };
}

console.log("5) invoke voice-command com WAV sintético (transcrição hospedada)");
try {
  const voiced = await invokeAiFunction<{
    transcript_original?: string;
    identifiedActions?: unknown;
    ai?: AiMeta;
    error?: string;
  }>("voice-command", {
    mimeType: "audio/wav",
    audioBase64: syntheticWavBase64(),
  });
  if (typeof voiced.transcript_original !== "string" || !voiced.transcript_original.trim()) {
    fail("voice-command com áudio deveria devolver transcript_original na versão nova");
  }
  assertAiMeta("voice-command parser", voiced.ai, {
    model: GEMINI_CLINICAL_MODEL,
    thinking_level: AI_MODEL_CONFIG.voiceParser.thinkingLevel,
    prompt_version: VOICE_PROMPT_VERSION,
    schema_version: VOICE_SCHEMA_VERSION,
    feature: "voiceParser",
  });
  if (voiced.ai?.transcription_model !== GEMINI_TRANSCRIBE_MODEL) {
    fail(`voice-command: transcription_model esperado ${GEMINI_TRANSCRIBE_MODEL}, veio ${String(voiced.ai?.transcription_model)}`);
  }
  if (voiced.ai?.transcription?.model !== GEMINI_TRANSCRIBE_MODEL) {
    fail(`voice-command: ai.transcription.model esperado ${GEMINI_TRANSCRIBE_MODEL}`);
  }
  console.log("   voice-command ok, transcript_chars=", voiced.transcript_original.trim().length);
  smoke.results = {
    ...(smoke.results as object),
    voice_with_audio: {
      ok: true,
      transcript_chars: voiced.transcript_original.trim().length,
      ai: summarizeAi(voiced.ai),
    },
  };
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const newStack = message.includes("VOICE_TRANSCRIPTION_FAILED") || message.includes("VOICE_PARSE_FAILED") || message.includes("VOICE_SCHEMA_INVALID");
  smoke.results = {
    ...(smoke.results as object),
    voice_with_audio: { ok: false, error: message, new_error_codes: newStack },
  };
  if (!newStack) {
    fail(`voice-command com áudio falhou com código legado (versão nova não ativa?): ${message}`);
  }
  console.log("   voice-command áudio sintético falhou no ramo novo:", message);
}

console.log("6) invoke generate-description (ficha sintética)");
try {
  const generated = await invokeAiFunction<{ description?: string; ai?: AiMeta }>("generate-description", {
    document: blank,
    models: [],
  });
  if (typeof generated.description !== "string" || !generated.description.trim()) {
    fail("generate-description deveria devolver { description } não vazia");
  }
  assertAiMeta("generate-description", generated.ai, {
    model: GEMINI_CLINICAL_MODEL,
    thinking_level: AI_MODEL_CONFIG.narrative.thinkingLevel,
    prompt_version: NARRATIVE_PROMPT_VERSION,
    schema_version: NARRATIVE_SCHEMA_VERSION,
    feature: "narrative",
  });
  console.log("   generate-description ok, chars=", generated.description.length);
  smoke.results = {
    ...(smoke.results as object),
    generate_description: {
      ok: true,
      description_chars: generated.description.length,
      ai: summarizeAi(generated.ai),
    },
  };
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fail(`generate-description autenticado falhou: ${message}`);
}

await supabase.auth.signOut();
smoke.finished_at = new Date().toISOString();
const artifactDir = "/opt/cursor/artifacts";
try {
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(path.join(artifactDir, "gemini_remote_smoke.json"), JSON.stringify(smoke, null, 2));
} catch (error) {
  console.warn("não gravou artifact de smoke:", error instanceof Error ? error.message : error);
}
console.log("PASS onda 5 live");
