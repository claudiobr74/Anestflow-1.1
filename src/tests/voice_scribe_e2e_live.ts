/**
 * Validação E2E hospedada do Voice Scribe (somente leitura/invoke).
 * Não muta ficha. Não altera Edge Function. Frases sintéticas, sem PHI.
 *
 * Uso: npx tsx src/tests/voice_scribe_e2e_live.ts
 */
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { getSupabase } from "../lib/supabase.ts";
import { finalizeVoiceParse } from "../lib/voiceParserSemantics.ts";
import {
  AI_MODEL_CONFIG,
  GEMINI_CLINICAL_MODEL,
  GEMINI_TRANSCRIBE_MODEL,
  VOICE_PROMPT_VERSION,
  VOICE_SCHEMA_VERSION,
} from "../lib/aiModelConfig.ts";

dotenv.config({ path: ".env.local" });

const url = process.env.VITE_SUPABASE_URL || "";
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const email = process.env.ONDA5_TEST_EMAIL || process.env.ONDA3_TEST_EMAIL || "";
const password = process.env.ONDA5_TEST_PASSWORD || process.env.ONDA3_TEST_PASSWORD || "";
const AUDIO_DIR = process.env.VOICE_E2E_AUDIO_DIR || "/tmp/voice-e2e";
const ARTIFACT = "/opt/cursor/artifacts/voice_scribe_e2e/results.json";

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

function fold(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isAbsent(value: unknown): boolean {
  return value == null || value === "" || value === "null" || value === "não informada" || value === "nao informada";
}

function summarizeAi(ai: AiMeta | undefined) {
  if (!ai) return null;
  return {
    feature: ai.feature ?? null,
    provider: ai.provider ?? null,
    model: ai.model ?? null,
    thinking_level: ai.thinking_level ?? null,
    prompt_version: ai.prompt_version ?? null,
    schema_version: ai.schema_version ?? null,
    transcription_model: ai.transcription_model ?? null,
    status: ai.status ?? null,
    success: ai.success ?? null,
    transcription_model_nested: ai.transcription?.model ?? null,
  };
}

if (!url || !key || !email || !password) fail("env de smoke ausente");

const supabase = getSupabase();
const { data: session, error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError || !session.session) fail(authError?.message || "login falhou");
const token = session.session.access_token;
console.log("login ok", session.user.id);

async function invokeVoice(wavPath: string) {
  const audioBase64 = fs.readFileSync(wavPath).toString("base64");
  const started = Date.now();
  const res = await fetch(`${url.replace(/\/$/, "")}/functions/v1/voice-command`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ mimeType: "audio/wav", audioBase64 }),
  });
  const rawText = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    body = { parse_error: rawText.slice(0, 400) };
  }
  return { http: res.status, ms: Date.now() - started, body };
}

type CaseSpec = {
  id: string;
  title: string;
  phrase: string;
  wav: string;
  evaluate: (input: {
    transcript: string;
    actions: Record<string, unknown>;
    warnings: string[];
    fragments: string[];
    proposal: ReturnType<typeof finalizeVoiceParse>;
  }) => { ok: boolean; notes: string[] };
};

const cases: CaseSpec[] = [
  {
    id: "t1",
    title: "Medicamento sem via",
    phrase: "Fentanil cem microgramas.",
    wav: path.join(AUDIO_DIR, "t1_fentanil.wav"),
    evaluate: ({ transcript, actions, proposal }) => {
      const notes: string[] = [];
      const bolus = Array.isArray(actions.bolusDrugs) ? (actions.bolusDrugs as Record<string, unknown>[]) : [];
      const hit = bolus.find((d) => fold(d.name).includes("fentanil"));
      if (!fold(transcript).includes("fentanil")) notes.push("transcript não contém fentanil");
      if (!hit) notes.push("parser não identificou bolus de fentanil");
      else {
        const dose = num(hit.dose);
        const unit = fold(hit.unit);
        if (dose !== 100) notes.push(`dose esperada 100, veio ${String(hit.dose)}`);
        if (unit !== "mcg") notes.push(`unidade esperada mcg, veio ${String(hit.unit)}`);
        if (String(hit.unit ?? "").length > 16 || /\s/.test(String(hit.unit ?? ""))) {
          notes.push(`unit contém texto de raciocínio: ${String(hit.unit)}`);
        }
        if (!isAbsent(hit.route) && fold(hit.route) !== "") {
          notes.push(`via inferida indevidamente: ${String(hit.route)}`);
        }
        if (!isAbsent(hit.concentration) && hit.concentration != null) {
          notes.push(`concentração inventada: ${String(hit.concentration)}`);
        }
      }
      const t = fold(transcript);
      if (/\bev\b|\bintraven/.test(t) === false && bolus.some((d) => fold(d.route).includes("ev") || fold(d.route).includes("iv"))) {
        notes.push("rota EV/IV no structured command sem estar no transcript");
      }
      if (proposal.ok) {
        const pBolus = proposal.result.commands.bolusDrugs ?? [];
        const pHit = pBolus.find((d) => fold(d.name).includes("fentanil"));
        if (pHit?.route) notes.push(`proposta (guard) ainda tem via: ${pHit.route}`);
      }
      return { ok: notes.length === 0, notes };
    },
  },
  {
    id: "t2",
    title: "Volátil sem concentração",
    phrase: "Iniciar sevoflurano.",
    wav: path.join(AUDIO_DIR, "t2_sevoflurano.wav"),
    evaluate: ({ transcript, actions }) => {
      const notes: string[] = [];
      const gases = Array.isArray(actions.inhalationAgents)
        ? (actions.inhalationAgents as Record<string, unknown>[])
        : [];
      const hit = gases.find((g) => fold(g.name).includes("sevo"));
      if (!fold(transcript).includes("sevo")) notes.push("transcript não contém sevoflurano/sevo");
      if (!hit) notes.push("parser não identificou sevoflurano");
      else {
        if (!isAbsent(hit.concentration) && hit.concentration != null) {
          notes.push(`concentração inventada: ${String(hit.concentration)}`);
        }
        if (!isAbsent(hit.inspiredConc) && hit.inspiredConc != null) {
          notes.push(`inspiredConc inventado: ${String(hit.inspiredConc)}`);
        }
        if (!isAbsent(hit.flowO2) && hit.flowO2 != null) notes.push(`fluxo O2 inventado: ${String(hit.flowO2)}`);
      }
      const blob = fold(JSON.stringify(actions));
      if (blob.includes("1 mac") || blob.includes("2%") || blob.includes("fio2") || blob.includes("fi o2")) {
        notes.push("output contém MAC/FiO2/% não ditado");
      }
      return { ok: notes.length === 0, notes };
    },
  },
  {
    id: "t3",
    title: "Infusão sem concentração",
    phrase: "Noradrenalina zero vírgula um micrograma por quilo por minuto.",
    wav: path.join(AUDIO_DIR, "t3_noradrenalina.wav"),
    evaluate: ({ transcript, actions }) => {
      const notes: string[] = [];
      const infs = Array.isArray(actions.continuousInfusions)
        ? (actions.continuousInfusions as Record<string, unknown>[])
        : [];
      const hit = infs.find((d) => fold(d.name).includes("noradrena") || fold(d.name).includes("norepine"));
      if (!fold(transcript).includes("noradrena") && !fold(transcript).includes("nora")) {
        notes.push("transcript não contém noradrenalina");
      }
      if (!hit) notes.push("parser não identificou infusão de noradrenalina");
      else {
        const rate = num(hit.rate);
        if (rate !== 0.1) notes.push(`rate esperado 0.1, veio ${String(hit.rate)}`);
        const unit = fold(hit.rateUnit).replace(/\s+/g, "");
        if (!unit.includes("mcg") || !unit.includes("kg") || !unit.includes("min")) {
          notes.push(`rateUnit esperado mcg/kg/min, veio ${String(hit.rateUnit)}`);
        }
        if (!isAbsent(hit.concentration) && hit.concentration != null) {
          notes.push(`concentração default inventada: ${String(hit.concentration)}`);
        }
        if (!isAbsent(hit.diluent) && hit.diluent != null) notes.push(`diluente inventado: ${String(hit.diluent)}`);
        if (!isAbsent(hit.totalVolumePrepared) && hit.totalVolumePrepared != null) {
          notes.push(`volume preparado inventado: ${String(hit.totalVolumePrepared)}`);
        }
      }
      return { ok: notes.length === 0, notes };
    },
  },
  {
    id: "t4",
    title: "Múltiplos lançamentos",
    phrase: "Fentanil cem microgramas, dipirona dois gramas e dexametasona quatro miligramas.",
    wav: path.join(AUDIO_DIR, "t4_multiplos.wav"),
    evaluate: ({ transcript, actions }) => {
      const notes: string[] = [];
      const bolus = Array.isArray(actions.bolusDrugs) ? (actions.bolusDrugs as Record<string, unknown>[]) : [];
      const want = [
        { needle: "fentanil", dose: 100, unit: "mcg" },
        { needle: "dipirona", dose: 2, unit: "g" },
        { needle: "dexametasona", dose: 4, unit: "mg" },
      ];
      if (bolus.length < 3) notes.push(`esperados 3 bolus, vieram ${bolus.length}`);
      for (const w of want) {
        const hit = bolus.find((d) => fold(d.name).includes(w.needle));
        if (!hit) {
          notes.push(`faltou comando de ${w.needle}`);
          continue;
        }
        if (num(hit.dose) !== w.dose) notes.push(`${w.needle}: dose ${String(hit.dose)} != ${w.dose}`);
        if (fold(hit.unit) !== w.unit) notes.push(`${w.needle}: unit ${String(hit.unit)} != ${w.unit}`);
        if (!isAbsent(hit.route)) notes.push(`${w.needle}: via inferida ${String(hit.route)}`);
        const src = String(hit.sourceText ?? "");
        if (src && !fold(src).includes(w.needle) && !fold(transcript).includes(w.needle)) {
          notes.push(`${w.needle}: sourceText não corresponde`);
        }
      }
      return { ok: notes.length === 0, notes };
    },
  },
  {
    id: "t5",
    title: "Ambiguidade sem inventar medicamento",
    phrase: "Passa aquela medicação de sempre, você sabe qual.",
    wav: path.join(AUDIO_DIR, "t5_ambiguo.wav"),
    evaluate: ({ transcript, actions, warnings, fragments }) => {
      const notes: string[] = [];
      const invented = ["fentanil", "propofol", "midazolam", "noradrenalina", "sevoflurano", "dipirona", "dexametasona"];
      const bolus = Array.isArray(actions.bolusDrugs) ? (actions.bolusDrugs as Record<string, unknown>[]) : [];
      const infs = Array.isArray(actions.continuousInfusions)
        ? (actions.continuousInfusions as Record<string, unknown>[])
        : [];
      const gases = Array.isArray(actions.inhalationAgents)
        ? (actions.inhalationAgents as Record<string, unknown>[])
        : [];
      const names = [...bolus, ...infs, ...gases].map((d) => fold(d.name));
      for (const drug of invented) {
        if (names.some((n) => n.includes(drug)) && !fold(transcript).includes(drug)) {
          notes.push(`medicamento inventado sem suporte no transcript: ${drug}`);
        }
      }
      const preserved =
        warnings.length > 0 ||
        fragments.length > 0 ||
        (bolus.length === 0 && infs.length === 0 && gases.length === 0);
      if (!preserved) notes.push("ambiguidade não preservada (sem warning/fragmento/ausência)");
      return { ok: notes.length === 0, notes };
    },
  },
];

const report: Record<string, unknown> = {
  started_at: new Date().toISOString(),
  project_url: url,
  audio_source: "edge-tts pt-BR-AntonioNeural (frases sintéticas; ambiente cloud sem microfone)",
  applyVoiceActionsToDocument_called: false,
  cases: [],
};

let failed = 0;
for (const spec of cases) {
  console.log(`\n=== ${spec.id} ${spec.title} ===`);
  console.log("frase:", spec.phrase);
  if (!fs.existsSync(spec.wav)) fail(`áudio ausente: ${spec.wav}`);
  const invoked = await invokeVoice(spec.wav);
  const body = invoked.body;
  const transcript = String(body.transcript_original ?? body.transcription ?? "");
  const actions = (body.identifiedActions && typeof body.identifiedActions === "object"
    ? (body.identifiedActions as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const warnings = Array.isArray(body.warnings) ? body.warnings.map(String) : [];
  const fragments = Array.isArray(body.unparsedFragments) ? body.unparsedFragments.map(String) : [];
  const ai = body.ai as AiMeta | undefined;
  const proposal = finalizeVoiceParse(transcript, {
    identifiedActions: actions,
    warnings,
    unparsedFragments: fragments,
  });

  const metaNotes: string[] = [];
  if (invoked.http !== 200) metaNotes.push(`HTTP ${invoked.http} error=${String(body.error ?? "")} details=${String(body.details ?? "").slice(0, 240)}`);
  else {
    if (body.error === "VOICE_PARSE_INCOMPLETE" || body.actionable === false) {
      metaNotes.push(`VOICE_PARSE_INCOMPLETE missing=${JSON.stringify(body.missingEntities ?? [])}`);
    }
    if (ai?.model !== GEMINI_CLINICAL_MODEL) metaNotes.push(`parser model ${String(ai?.model)} != ${GEMINI_CLINICAL_MODEL}`);
    const repaired = Boolean((ai as { repair_attempted?: boolean } | undefined)?.repair_attempted);
    const thinking = String(ai?.thinking_level ?? "");
    if (!repaired && thinking !== AI_MODEL_CONFIG.voiceParser.thinkingLevel) {
      metaNotes.push(`thinking ${thinking}`);
    }
    if (repaired && thinking !== "low" && thinking !== "minimal") {
      metaNotes.push(`repair thinking ${thinking}`);
    }
    if (ai?.prompt_version !== VOICE_PROMPT_VERSION) metaNotes.push(`prompt ${String(ai?.prompt_version)}`);
    if (ai?.schema_version !== VOICE_SCHEMA_VERSION) metaNotes.push(`schema ${String(ai?.schema_version)}`);
    const asr = ai?.transcription_model ?? ai?.transcription?.model;
    if (asr !== GEMINI_TRANSCRIBE_MODEL) metaNotes.push(`asr model ${String(asr)}`);
    if (body.error && body.error !== "VOICE_PARSE_INCOMPLETE") metaNotes.push(`error code ${String(body.error)}`);
  }

  const judged = invoked.http === 200
    ? spec.evaluate({ transcript, actions, warnings, fragments, proposal })
    : { ok: false, notes: metaNotes };

  const ok = judged.ok && metaNotes.length === 0;
  if (!ok) failed += 1;
  console.log("http", invoked.http, "ms", invoked.ms, ok ? "PASS" : "FAIL");
  console.log("transcript:", transcript);
  console.log("identifiedActions:", JSON.stringify(actions));
  console.log("warnings:", warnings);
  console.log("unparsedFragments:", fragments);
  console.log("ai:", JSON.stringify(summarizeAi(ai)));
  if (proposal.ok) console.log("proposal_commands:", JSON.stringify(proposal.result.commands));
  else console.log("proposal_invalid");
  if (!ok) console.log("notes:", [...metaNotes, ...judged.notes].join(" | "));

  (report.cases as unknown[]).push({
    id: spec.id,
    title: spec.title,
    phrase: spec.phrase,
    http: invoked.http,
    ms: invoked.ms,
    ok,
    transcript,
    identifiedActions: actions,
    warnings,
    unparsedFragments: fragments,
    ai: summarizeAi(ai),
    proposal: proposal.ok
      ? { commands: proposal.result.commands, warnings: proposal.result.warnings, unparsedFragments: proposal.result.unparsedFragments }
      : { error: "VOICE_SCHEMA_INVALID" },
    notes: [...metaNotes, ...judged.notes],
    mutated_document: false,
  });
}

await supabase.auth.signOut();

const t1t4 = (report.cases as Array<{ id: string; ok: boolean }>).filter((c) => c.id !== "t5");
const t5 = (report.cases as Array<{ id: string; ok: boolean }>).find((c) => c.id === "t5");
const VOICE_COMMAND_E2E = t1t4.every((c) => c.ok) && Boolean(t5?.ok) ? "PASS" : "FAIL";
report.finished_at = new Date().toISOString();
report.VOICE_COMMAND_E2E = VOICE_COMMAND_E2E;
report.failed_count = failed;

fs.mkdirSync(path.dirname(ARTIFACT), { recursive: true });
fs.writeFileSync(ARTIFACT, JSON.stringify(report, null, 2));
console.log(`\nVOICE_COMMAND_E2E = ${VOICE_COMMAND_E2E}`);
console.log("artifact", ARTIFACT);
if (VOICE_COMMAND_E2E !== "PASS") process.exit(1);
