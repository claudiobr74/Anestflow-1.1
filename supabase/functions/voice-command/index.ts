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

const VOICE_PARSER_PROMPT = `Você é o Voice Parser do AnestFlow. Recebe APENAS o transcript verbatim já produzido pelo modelo de transcrição.

CADEIA: áudio → transcrição verbatim → interpretação → proposta → confirmação humana → registro.
Você NÃO altera a ficha. Você NÃO recebe áudio. Você NÃO reescreve o transcript.
NÃO converta o transcript verbatim: "tem ta" permanece "tem ta"; a interpretação clínica vai só em identifiedActions.

PROIBIDO inferir silenciosamente:
dose, unidade, concentração, diluição, volume preparado, fluxo, FiO2, concentração de volátil, rota, frequência, diagnóstico, valor de monitor, horário não informado.

Ausência na fala → null / omitir o campo. Nunca preencher por costume anestésico.
Exemplo: "noradrenalina zero vírgula um micrograma por quilo por minuto"
→ rate 0.1, rateUnit mcg/kg/min, concentration null.

NORMALIZAÇÃO permitida (inequívoca): "microgramas"→"mcg". "endovenoso"→"EV" só se a palavra foi dita.
Se houver ambiguidade, preserve e coloque o trecho em unparsedFragments com warning.

Jargão brasileiro para INTERPRETAR (sem alterar o transcript, que você não devolve):
fenta=fentanil; remi=remifentanil; nora/norinha=noradrenalina; sevo=sevoflurano; des=desflurano; keta=cetamina.

Devolva identifiedActions no domínio AnestFlow (bolusDrugs, continuousInfusions, inhalationAgents, events, vitals, patient, templates, timers), mais unparsedFragments e warnings.
Não invente medicamento que o transcript não suporte.`;

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
  let parsed: Record<string, unknown>;
  try {
    const interpreted = await invokeGeminiGateway({
      feature: "voiceParser",
      promptVersion: VOICE_PROMPT_VERSION,
      schemaVersion: VOICE_SCHEMA_VERSION,
      errorCode: "VOICE_PARSE_FAILED",
      systemInstruction: "Retorne exclusivamente JSON válido no schema pedido. Sem chain-of-thought.",
      input: `${VOICE_PARSER_PROMPT}\n\nTRANSCRIPT VERBATIM (não altere, não corrija jargão fonético):\n${transcriptOriginal}`,
      responseSchema: VOICE_PARSER_JSON_SCHEMA as unknown as Record<string, unknown>,
    });
    parseMeta = interpreted.meta;
    parsed = JSON.parse(interpreted.text || "");
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

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !parsed.identifiedActions || typeof parsed.identifiedActions !== "object") {
    return jsonResponse({
      error: "VOICE_SCHEMA_INVALID",
      transcript_original: transcriptOriginal,
      ai: { ...parseMeta, success: false, error_code: "VOICE_SCHEMA_INVALID" },
    }, 502);
  }

  return jsonResponse({
    transcript_original: transcriptOriginal,
    transcription: transcriptOriginal,
    identifiedActions: parsed.identifiedActions,
    unparsedFragments: Array.isArray(parsed.unparsedFragments) ? parsed.unparsedFragments : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    ai: {
      ...parseMeta,
      transcription_model: AI_MODEL_CONFIG.transcription.model,
      transcription: transcribeMeta,
    },
  });
}, "O tempo limite para processamento do áudio foi excedido.");
