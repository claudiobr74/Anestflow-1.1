import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { generateJsonWithRetry } from "../_shared/gemini.ts";
import { serveAiFunction } from "../_shared/serve.ts";

const REVIEW_SCHEMA = {
  type: "OBJECT",
  properties: {
    alerts: {
      type: "ARRAY",
      description: "Lista de inconsistências ou pendências encontradas.",
      items: {
        type: "OBJECT",
        properties: {
          type: {
            type: "STRING",
            description: "Critico, Importante, ou Informativo",
          },
          title: { type: "STRING" },
          description: { type: "STRING" },
          module: {
            type: "STRING",
            description: "Patient, Vitals, PreEvaluation, Timing, Airway, Drugs",
          },
        },
      },
    },
  },
};

serveAiFunction("review", async (_user, body) => {
  const document = body as { patient?: unknown } | null;
  if (!document || !document.patient) {
    return jsonResponse({ error: "Documento inválido ou ausente." }, 400);
  }

  const prompt = `Analise a ficha anestésica digital anexada a seguir em formato JSON. Seu objetivo é encontrar:
1. Inconsistências cronológicas (ex: cirurgia iniciando antes da anestesia, fim de cirurgia após fim de anestesia, etc).
2. Lapsos documentais de campos clínicos importantes (ex: paciente hipertenso na avaliação pré-anestésica, mas sem registro de pressão arterial registrada no intraoperatório, peso zero, alergia severa listada mas sem destaque correspondente, técnica regional com cateter mas sem descrição do cateter ou bloqueio neuromuscular sem TOF registrado).
3. Riscos potenciais baseados na documentação de jejum ou alergias.

Documento JSON:
${JSON.stringify(document, null, 2)}

Importante: 
- Forneça a resposta em formato JSON estruturado com uma lista de alertas.
- Cada alerta deve ter: 'type' (Critico, Importante, Informativo), 'title' (título resumido), 'description' (descrição em português clara e objetiva para o médico anestesiologista) e 'module' (módulo correspondente, ex: 'Patient', 'Vitals', 'PreEvaluation', 'Timing', 'Airway', 'Drugs').
- Não invente diagnósticos, não prescreva condutas. Apenas aponte dados que possam faltar ou inconsistências lógicas no preenchimento.`;

  const text = await generateJsonWithRetry(
    [{ text: prompt }],
    "Você é um assistente sênior especialista em auditoria de prontuários médicos anestésicos no Brasil. Suas respostas devem ser exclusivamente em formato JSON conforme a estrutura solicitada, em português, objetivas, visando a segurança do paciente e a qualidade legal da documentação anestésica sob a Resolução CFM 2.174/2017.",
    REVIEW_SCHEMA,
  );

  try {
    return jsonResponse(JSON.parse(text || '{"alerts":[]}'));
  } catch {
    return jsonResponse({ alerts: [] });
  }
}, "O tempo limite para revisão do documento foi excedido.");
