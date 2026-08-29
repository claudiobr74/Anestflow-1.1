import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { generateJsonWithRetry } from "../_shared/gemini.ts";
import { serveAiFunction } from "../_shared/serve.ts";

const DESCRIPTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    description: { type: "STRING", description: "O texto narrativo final gerado." },
  },
};

serveAiFunction("generate-description", async (_user, body) => {
  const payload = body as { document?: unknown; models?: unknown } | null;
  if (!payload?.document) {
    return jsonResponse({ error: "Documento inválido ou ausente." }, 400);
  }

  const prompt = `Gere uma "Descrição do Ato Anestésico" técnica, formal e narrativa baseada EXCLUSIVAMENTE nos dados da ficha anestésica anexada em formato JSON.
O texto deve ser fluido e legível, descrevendo cronologicamente: monitorização, acessos (venosos, arteriais), técnica anestésica (indução, manutenção, bloqueios), vias aéreas, fluidos administrados e evolução clínica (estabilidade, intercorrências) com base APENAS no que está documentado.

Caso o documento esteja vazio ou não tenha dados suficientes, elabore uma descrição muito genérica ou indique a falta de dados estruturados.

IMPORTANTE: Abaixo está uma lista de Modelos Base (Templates) de descrições pré-definidos pelo usuário.
Você deve escolher o modelo mais apropriado com base no procedimento e preencher os colchetes com os dados reais do documento. Se os modelos fornecidos não cobrirem o cenário, gere uma narrativa formal do zero utilizando as diretrizes CFM. Mantenha o formato e a estrutura textual do modelo selecionado, substituindo apenas os placeholders de forma inteligente e natural. Se não houver nenhum modelo útil, crie o seu.

Modelos Disponíveis:
${JSON.stringify(payload.models || [], null, 2)}

Documento JSON da Anestesia (Preencha o modelo com esses dados):
${JSON.stringify(payload.document, null, 2)}
`;

  const text = await generateJsonWithRetry(
    [{ text: prompt }],
    "Você é um especialista em documentação de anestesiologia médica no Brasil. Seu objetivo é ajudar a redigir o ato anestésico com base em dados.",
    DESCRIPTION_SCHEMA,
  );

  try {
    return jsonResponse(JSON.parse(text || '{"description": ""}'));
  } catch {
    return jsonResponse({ description: "" });
  }
}, "O tempo limite para geração da descrição foi excedido.");
