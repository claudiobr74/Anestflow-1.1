import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { NARRATIVE_JSON_SCHEMA } from "../_shared/aiJsonSchemas.ts";
import {
  NARRATIVE_PROMPT_VERSION,
  NARRATIVE_SCHEMA_VERSION,
} from "../_shared/aiModelConfig.ts";
import { stripClinicalIdentifiers } from "../_shared/aiStrip.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { GeminiFeatureError } from "../_shared/gemini.ts";
import { invokeGeminiGateway } from "../_shared/geminiGateway.ts";
import { serveAiFunction } from "../_shared/serve.ts";

serveAiFunction("generate-description", async (_user, body) => {
  const payload = body as { document?: unknown; models?: unknown } | null;
  if (!payload?.document) {
    return jsonResponse({ error: "Documento inválido ou ausente." }, 400);
  }
  const document = stripClinicalIdentifiers(payload.document);

  const prompt = `Gere uma "Descrição do Ato Anestésico" técnica, formal e narrativa baseada EXCLUSIVAMENTE nos dados da ficha anexada.
Não invente sinais vitais, doses, vias, concentrações ou horários ausentes.
O texto deve ser fluido e cronológico: monitorização, acessos, técnica, vias aéreas, fluidos e evolução só com o que está documentado.

Se o documento não tiver dados suficientes, descreva a insuficiência de dados — não complete por costume.

Modelos base (escolha o mais apropriado e preencha só com dados reais; se nenhum servir, narre formalmente):
${JSON.stringify(payload.models || [])}

Documento:
${JSON.stringify(document)}`;

  let meta;
  let text: string;
  try {
    const result = await invokeGeminiGateway({
      feature: "narrative",
      promptVersion: NARRATIVE_PROMPT_VERSION,
      schemaVersion: NARRATIVE_SCHEMA_VERSION,
      errorCode: "AI_NARRATIVE_FAILED",
      systemInstruction:
        "Você redige o ato anestésico no Brasil com base só no documentado. JSON no schema pedido. Sem chain-of-thought.",
      input: prompt,
      responseSchema: NARRATIVE_JSON_SCHEMA as unknown as Record<string, unknown>,
    });
    meta = result.meta;
    text = result.text;
  } catch (error) {
    if (error instanceof GeminiFeatureError) throw error;
    throw new GeminiFeatureError(
      "AI_NARRATIVE_FAILED",
      error instanceof Error ? error.message : "Falha na narrativa de IA.",
      502,
    );
  }

  try {
    const parsed = JSON.parse(text || "") as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.description !== "string" || !parsed.description.trim()) {
      return jsonResponse({
        error: "AI_NARRATIVE_SCHEMA_INVALID",
        ai: { ...meta, success: false, error_code: "AI_NARRATIVE_SCHEMA_INVALID" },
      }, 502);
    }
    return jsonResponse({ ...parsed, ai: meta });
  } catch {
    return jsonResponse({
      error: "AI_NARRATIVE_SCHEMA_INVALID",
      ai: { ...meta, success: false, error_code: "AI_NARRATIVE_SCHEMA_INVALID" },
    }, 502);
  }
}, "O tempo limite para geração da descrição foi excedido.");
