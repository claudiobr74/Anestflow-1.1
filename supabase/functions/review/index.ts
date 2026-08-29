import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { CLINICAL_REVIEW_JSON_SCHEMA } from "../_shared/aiJsonSchemas.ts";
import {
  CLINICAL_REVIEW_PROMPT_VERSION,
  CLINICAL_REVIEW_SCHEMA_VERSION,
} from "../_shared/aiModelConfig.ts";
import { stripClinicalIdentifiers } from "../_shared/aiStrip.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { GeminiFeatureError } from "../_shared/gemini.ts";
import { invokeGeminiGateway } from "../_shared/geminiGateway.ts";
import { serveAiFunction } from "../_shared/serve.ts";

const REVIEW_SYSTEM = `Você é o Supervisor clínico do AnestFlow. Nunca altera a ficha.
Produza apenas alertas estruturados (inconsistência, omissão potencial, pergunta, sugestão, revisão cronológica).
Nunca lance droga, complete dose, mude técnica, altere sinal vital, altere checklist, encerre documento ou corrija registro.
Não invente diagnósticos nem prescreva condutas.
Defaults qualitativos do template AnestFlow (campos já inicializados como "normal"/padrão do produto) são estado informado pelo produto/usuário — NÃO gere dezenas de alertas dizendo que "campo normal pode não ter sido avaliado".
A responsabilidade da revisão final é do médico no encerramento.
Respostas exclusivamente em JSON no schema pedido, em português. Sem chain-of-thought.`;

serveAiFunction("review", async (_user, body) => {
  const raw = body as { patient?: unknown } | null;
  if (!raw || !raw.patient) {
    return jsonResponse({ error: "Documento inválido ou ausente." }, 400);
  }
  const document = stripClinicalIdentifiers(raw);

  const prompt = `Analise a ficha anestésica digital (contexto já sem identificadores administrativos) e encontre:
1. Inconsistências cronológicas (ex.: cirurgia antes da anestesia).
2. Lapsos documentais realmente relevantes (peso zero, alergia grave sem destaque, técnica regional com cateter sem descrição, BNM sem TOF quando o restante da ficha indica que deveria haver).
3. Riscos potenciais baseados em jejum ou alergias documentadas.

Não alerte em massa só porque um campo qualitativo veio com o default do template.

Documento JSON:
${JSON.stringify(document)}`;

  let meta;
  let text: string;
  try {
    const result = await invokeGeminiGateway({
      feature: "clinicalReview",
      promptVersion: CLINICAL_REVIEW_PROMPT_VERSION,
      schemaVersion: CLINICAL_REVIEW_SCHEMA_VERSION,
      errorCode: "AI_REVIEW_FAILED",
      systemInstruction: REVIEW_SYSTEM,
      input: prompt,
      responseSchema: CLINICAL_REVIEW_JSON_SCHEMA as unknown as Record<string, unknown>,
    });
    meta = result.meta;
    text = result.text;
  } catch (error) {
    if (error instanceof GeminiFeatureError) throw error;
    throw new GeminiFeatureError(
      "AI_REVIEW_FAILED",
      error instanceof Error ? error.message : "Falha na auditoria de IA.",
      502,
    );
  }

  try {
    const parsed = JSON.parse(text || "");
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.alerts)) {
      return jsonResponse({ error: "AI_REVIEW_SCHEMA_INVALID", ai: { ...meta, success: false, error_code: "AI_REVIEW_SCHEMA_INVALID" } }, 502);
    }
    return jsonResponse({ ...parsed, ai: meta });
  } catch {
    return jsonResponse({ error: "AI_REVIEW_PARSE_FAILED", ai: { ...meta, success: false, error_code: "AI_REVIEW_PARSE_FAILED" } }, 502);
  }
}, "O tempo limite para revisão do documento foi excedido.");
