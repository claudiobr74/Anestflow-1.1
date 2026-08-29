import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { VOICE_PARSER_JSON_SCHEMA } from "../_shared/aiJsonSchemas.ts";
import {
  AI_MODEL_CONFIG,
  VOICE_PROMPT_VERSION,
  VOICE_SCHEMA_VERSION,
} from "../_shared/aiModelConfig.ts";
import { transcriptionVocabulary } from "../_shared/anesthesiaVocabulary.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { GeminiFeatureError } from "../_shared/gemini.ts";
import { invokeGeminiGateway, parseTranscriptText } from "../_shared/geminiGateway.ts";
import { serveAiFunction } from "../_shared/serve.ts";
import { validateVoiceCommandCoverage } from "../_shared/voiceCommandCoverage.ts";

const VOICE_PARSER_PROMPT = `Você é o Voice Parser do AnestFlow. Recebe APENAS o transcript verbatim já produzido pelo modelo de transcrição.

CADEIA: áudio → transcrição verbatim → interpretação → proposta → confirmação humana → registro.
Você NÃO altera a ficha. Você NÃO recebe áudio. Você NÃO reescreve o transcript.
NÃO converta o transcript verbatim: "tem ta" permanece "tem ta"; a interpretação clínica vai só em identifiedActions.

Retorne SOMENTE o JSON do schema. Sem explicações, sem justificativas, sem raciocínio visível em qualquer campo.

MULTI-AÇÃO: uma mesma fala frequentemente contém vários lançamentos.
Extraia TODAS as ações clínicas explicitamente mencionadas no transcript.
Produza UM item independente para CADA medicamento, infusão, gás, fluido, sinal vital ou evento explicitamente mencionado.
Preserve a ordem em que aparecem no transcript.
Nunca resuma uma lista de ações em um único item.
Nunca omita uma ação apenas porque outra ação da mesma categoria já foi extraída.
Nunca escolha só a primeira, só a última ou a "mais importante".

Exemplo: "Fentanil cem microgramas, dipirona dois gramas e dexametasona quatro miligramas."
→ três bolus distintos (fentanil, dipirona, dexametasona).

Antes de finalizar, confira internamente se cada entidade clínica explicitamente mencionada no transcript possui representação correspondente no output. Não exponha essa conferência.

PROIBIDO inferir silenciosamente:
dose, unidade, concentração, diluição, volume preparado, fluxo, FiO2, concentração de volátil, rota, frequência, diagnóstico, valor de monitor, horário não informado.

Ausência na fala → null / omitir o campo. Nunca preencher por costume anestésico.
Exemplo: "noradrenalina zero vírgula um micrograma por quilo por minuto"
→ rate 0.1, rateUnit mcg/kg/min, concentration null.

NORMALIZAÇÃO permitida (inequívoca): "microgramas"→"mcg". "endovenoso"→"EV" só se a palavra foi dita.
unit e rateUnit aceitam SOMENTE os valores do schema (enum). Nunca escreva frase, comentário ou raciocínio nesses campos.
Se houver ambiguidade, preserve e coloque o trecho em unparsedFragments com warning.

Jargão brasileiro para INTERPRETAR (sem alterar o transcript, que você não devolve):
fenta=fentanil; remi=remifentanil; nora/norinha=noradrenalina; sevo=sevoflurano; des=desflurano; keta=cetamina.

Devolva identifiedActions no domínio AnestFlow (bolusDrugs, continuousInfusions, inhalationAgents, events, vitals, patient, templates, timers), mais unparsedFragments e warnings.
Não invente medicamento que o transcript não suporte.`;

const INCOMPLETE_MESSAGE =
  "Não foi possível interpretar todos os itens mencionados. Revise o transcript e faça os lançamentos manualmente ou repita o comando.";

type ParsedVoice = {
  identifiedActions: Record<string, unknown>;
  unparsedFragments: string[];
  warnings: string[];
};

function asParsedVoice(parsed: Record<string, unknown>): ParsedVoice | null {
  if (!parsed.identifiedActions || typeof parsed.identifiedActions !== "object" || Array.isArray(parsed.identifiedActions)) {
    return null;
  }
  return {
    identifiedActions: parsed.identifiedActions as Record<string, unknown>,
    unparsedFragments: Array.isArray(parsed.unparsedFragments) ? parsed.unparsedFragments.map(String) : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
  };
}

async function runVoiceParser(
  transcript: string,
  thinkingLevel: "minimal" | "low",
  extraInstruction?: string,
) {
  const interpreted = await invokeGeminiGateway({
    feature: "voiceParser",
    promptVersion: VOICE_PROMPT_VERSION,
    schemaVersion: VOICE_SCHEMA_VERSION,
    errorCode: "VOICE_PARSE_FAILED",
    thinkingLevel,
    systemInstruction: "Retorne exclusivamente JSON válido no schema pedido. Apenas dados. Sem chain-of-thought. Sem explicações em qualquer campo.",
    input: `${VOICE_PARSER_PROMPT}\n\n${extraInstruction ?? ""}\nTRANSCRIPT VERBATIM (não altere, não corrija jargão fonético):\n${transcript}`,
    responseSchema: VOICE_PARSER_JSON_SCHEMA as unknown as Record<string, unknown>,
  });
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(interpreted.text || "") as Record<string, unknown>;
  } catch {
    throw new SyntaxError("VOICE_SCHEMA_INVALID");
  }
  const voice = asParsedVoice(parsed);
  if (!voice) {
    throw new SyntaxError("VOICE_SCHEMA_INVALID");
  }
  return { voice, meta: interpreted.meta };
}

serveAiFunction("voice-command", async (_user, body) => {
  const payload = body as { audioBase64?: string; mimeType?: string } | null;
  if (!payload?.audioBase64) {
    return jsonResponse({ error: "Áudio não fornecido." }, 400);
  }

  let transcriptOriginal = "";
  let transcribeMeta;
  try {
    const transcribed = await invokeGeminiGateway({
      feature: "transcription",
      promptVersion: "transcribe-verbatim-v1",
      schemaVersion: "transcript-verbatim-v1",
      errorCode: "VOICE_TRANSCRIPTION_FAILED",
      audio: {
        mimeType: payload.mimeType || "audio/webm",
        data: payload.audioBase64,
        vocabulary: transcriptionVocabulary(),
      },
    });
    transcribeMeta = transcribed.meta;
    transcriptOriginal = parseTranscriptText(transcribed.text);
  } catch (error) {
    if (error instanceof GeminiFeatureError) throw error;
    throw new GeminiFeatureError(
      "VOICE_TRANSCRIPTION_FAILED",
      error instanceof Error ? error.message : "Falha na transcrição de voz.",
      502,
    );
  }

  if (!transcriptOriginal) {
    throw new GeminiFeatureError(
      "VOICE_TRANSCRIPTION_FAILED",
      "A transcrição verbatim veio vazia.",
      502,
    );
  }

  let parseMeta;
  let voice: ParsedVoice;
  try {
    const primary = await runVoiceParser(transcriptOriginal, "minimal");
    parseMeta = primary.meta;
    voice = primary.voice;
  } catch (error) {
    if (error instanceof GeminiFeatureError) throw error;
    if (error instanceof SyntaxError) {
      return jsonResponse({
        error: "VOICE_SCHEMA_INVALID",
        transcript_original: transcriptOriginal,
        ai: { ...transcribeMeta, success: false, error_code: "VOICE_SCHEMA_INVALID" },
      }, 502);
    }
    throw new GeminiFeatureError(
      "VOICE_PARSE_FAILED",
      error instanceof Error ? error.message : "Falha na interpretação de voz.",
      502,
    );
  }

  let coverage = validateVoiceCommandCoverage(transcriptOriginal, voice.identifiedActions);
  let repairAttempted = false;

  if (!coverage.ok) {
    repairAttempted = true;
    const repairInstruction = `MODO coverage-repair.
Sua resposta anterior omitiu entidades explicitamente presentes no transcript:
${coverage.missing.map((name) => `- ${name}`).join("\n")}

Output anterior:
${JSON.stringify(voice)}

Reextraia TODAS as ações do transcript. Não invente informações não presentes. Não explique.\n\n`;
    try {
      const repaired = await runVoiceParser(transcriptOriginal, "low", repairInstruction);
      parseMeta = repaired.meta;
      voice = repaired.voice;
      coverage = validateVoiceCommandCoverage(transcriptOriginal, voice.identifiedActions);
    } catch (error) {
      if (error instanceof GeminiFeatureError) throw error;
      if (error instanceof SyntaxError) {
        return jsonResponse({
          error: "VOICE_SCHEMA_INVALID",
          transcript_original: transcriptOriginal,
          ai: { ...parseMeta, success: false, error_code: "VOICE_SCHEMA_INVALID", repair_attempted: true },
        }, 502);
      }
      throw new GeminiFeatureError(
        "VOICE_PARSE_FAILED",
        error instanceof Error ? error.message : "Falha na interpretação de voz.",
        502,
      );
    }
  }

  const ai = {
    ...parseMeta,
    transcription_model: AI_MODEL_CONFIG.transcription.model,
    transcription: transcribeMeta,
    coverage,
    repair_attempted: repairAttempted,
  };

  if (!coverage.ok) {
    return jsonResponse({
      error: "VOICE_PARSE_INCOMPLETE",
      status: "incomplete",
      transcript_original: transcriptOriginal,
      transcription: transcriptOriginal,
      missingEntities: coverage.missing,
      identifiedActions: voice.identifiedActions,
      proposedActions: voice.identifiedActions,
      actionable: false,
      unparsedFragments: voice.unparsedFragments,
      warnings: [...voice.warnings, INCOMPLETE_MESSAGE],
      ai: { ...ai, success: false, status: "error", error_code: "VOICE_PARSE_INCOMPLETE" },
    }, 200);
  }

  return jsonResponse({
    transcript_original: transcriptOriginal,
    transcription: transcriptOriginal,
    identifiedActions: voice.identifiedActions,
    unparsedFragments: voice.unparsedFragments,
    warnings: voice.warnings,
    actionable: true,
    status: "ok",
    ai,
  });
}, "O tempo limite para processamento do áudio foi excedido.");
