import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { generateJsonWithRetry } from "../_shared/gemini.ts";
import { serveAiFunction } from "../_shared/serve.ts";

const VOICE_SCHEMA = {
  type: "OBJECT",
  properties: {
    transcription: { type: "STRING", description: "Transcrição fiel do áudio." },
    identifiedActions: {
      type: "OBJECT",
      properties: {
        bolusDrugs: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              dose: { type: "STRING" },
              unit: { type: "STRING", description: "mg, mcg, g, ml, UI" },
              route: { type: "STRING", description: "EV, IM, SC, IN" },
            },
          },
        },
        continuousInfusions: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              rate: { type: "STRING" },
              rateUnit: { type: "STRING", description: "mcg/kg/min, mg/h, ml/h" },
            },
          },
        },
        inhalationAgents: {
          type: "ARRAY",
          items: { type: "OBJECT", properties: { name: { type: "STRING" } } },
        },
        events: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              category: {
                type: "STRING",
                description:
                  "Procedimento, Via Aérea, Bloqueio, Acesso, Marcador Temporal, Intercorrência, Outro",
              },
            },
          },
        },
        vitals: {
          type: "OBJECT",
          properties: {
            hr: { type: "NUMBER", description: "Frequência Cardíaca" },
            systolic: { type: "NUMBER", description: "Pressão Arterial Sistólica" },
            diastolic: { type: "NUMBER", description: "Pressão Arterial Diastólica" },
            spo2: { type: "NUMBER", description: "Saturação de O2 (%)" },
            etco2: { type: "NUMBER", description: "Capnografia (EtCO2)" },
            temp: { type: "NUMBER", description: "Temperatura" },
          },
        },
        patient: {
          type: "OBJECT",
          description: "Dados do paciente identificados no áudio.",
          properties: {
            fullName: {
              type: "STRING",
              description: "Nome completo do paciente ou identificação (ex: 'João Silva' ou 'Paciente A').",
            },
            age: { type: "STRING", description: "Idade em anos (ex: '45')." },
            weight: { type: "STRING", description: "Peso em kg (ex: '70')." },
            recordNumber: {
              type: "STRING",
              description: "Número do prontuário ou número do registro ou número do paciente (ex: 'GH-90210' ou '1234').",
            },
            admissionNumber: {
              type: "STRING",
              description: "Número de atendimento ou número de internação ou número de admissão (ex: '44093').",
            },
            bed: {
              type: "STRING",
              description: "Leito, quarto ou enfermaria do paciente (ex: 'UTI 2' ou 'Leito 15').",
            },
            dob: {
              type: "STRING",
              description: "Data de nascimento do paciente formatada estritamente como YYYY-MM-DD (ex: '1980-05-10').",
            },
          },
        },
        templates: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Nomes de templates ou protocolos a serem ativados (ex: 'cesariana', 'apendicectomia').",
        },
        timers: {
          type: "OBJECT",
          properties: {
            startAnesthesia: { type: "BOOLEAN", description: "True se foi solicitado início da anestesia." },
            startSurgery: { type: "BOOLEAN", description: "True se foi solicitado início da cirurgia." },
            startSurgeryMinutes: {
              type: "NUMBER",
              description: "Minutos a partir de agora para início da cirurgia (ex: 'em 10 minutos').",
            },
            endSurgery: { type: "BOOLEAN", description: "True se foi solicitado fim da cirurgia." },
            endAnesthesia: { type: "BOOLEAN", description: "True se foi solicitado fim da anestesia." },
          },
        },
      },
    },
  },
  required: ["transcription", "identifiedActions"],
};

const VOICE_PROMPT = `Você é um assistente de IA atuando como 'Escriba Anestésico' avançado, especializado no contexto médico brasileiro.
Seu objetivo é ouvir e interpretar com altíssima precisão o comando de voz do anestesiologista durante a cirurgia, extraindo as ações clínicas de forma estruturada.

ATENÇÃO REDOBRADA AOS JARGÕES E ATALHOS VERBAIS DO BRASIL:
- Fármacos: "propofol", "fenta" (fentanil), "remi" (remifentanil), "nora" ou "norinha" (noradrenalina), "sevo" (sevoflurano), "des" (desflurano), "keta" (cetamina), "cis" ou "nimbium" (cisatracúrio), "esmeron" ou "rocu" (rocurônio), "dex" ou "precedex" (dexmedetomidina), "adrena" (adrenalina), "atropo" (atropina).
- Doses e Taxas: "150 de propofol e 100 de fenta", "nora a zero zero cinco" (0.05 mcg/kg/min), "remi a zero um" (0.1 mcg/kg/min).
- Sinais Vitais: "pressão 12 por 8" (Sistólica 120, Diastólica 80), "frequência" ou "FC" (Frequência Cardíaca), "saturação" ou "sap" ou "sat" (SpO2), "capno" ou "etco2" (EtCO2). Ex: "pressão 115 por 70 com frequência de 65, saturação 99".
- Eventos: "intubado", "IOT", "máscara laríngea", "incisão", "bloqueio", "raqui", "peridural", "extubado".
- Paciente: Identificação do paciente como nome completo (fullName), idade (age), data de nascimento (dob, convertida para o formato AAAA-MM-DD, ex: "1980-05-10"), peso (weight), número do prontuário (recordNumber), número de atendimento (admissionNumber) ou leito (bed). Ex: "Paciente João Silva, 45 anos, data de nascimento 10 de maio de 1980, prontuário GH-90210, atendimento 44093, leito UTI 2".
- Tempos/Timers: "iniciar anestesia agora" (startAnesthesia: true), "cirurgia em 10 minutos" (startSurgeryMinutes: 10, e não true em startSurgery), "iniciar cirurgia agora" (startSurgery: true), "fim da anestesia" (endAnesthesia: true).
- Templates: Quando o usuário pedir para carregar/ativar um "protocolo" ou "template", retorne APENAS o nome base do protocolo (ex: se pedir "ativar protocolo de cesariana", retorne "cesariana"; se "carregar template de revascularização", retorne "revascularização").

INSTRUÇÕES:
1. Transcreva o áudio de forma ABSOLUTAMENTE FIEL E CORRETA para o português do Brasil no campo 'transcription'. Corrija fonemas mal compreendidos para o termo médico correto (ex: "tem ta" -> "fenta", "nora adrenalina" -> "noradrenalina").
2. Preencha as estruturas relevantes (campo 'identifiedActions'). Se algo não for falado, deixe vazio. Extraia o máximo de informações e cruze os jargões para as categorias corretas.`;

serveAiFunction("voice-command", async (_user, body) => {
  const payload = body as { audioBase64?: string; mimeType?: string } | null;
  if (!payload?.audioBase64) {
    return jsonResponse({ error: "Áudio não fornecido." }, 400);
  }

  const text = await generateJsonWithRetry(
    [
      { text: VOICE_PROMPT },
      {
        inlineData: {
          data: payload.audioBase64,
          mimeType: payload.mimeType || "audio/webm",
        },
      },
    ],
    "Retorne EXCLUSIVAMENTE um objeto JSON válido seguindo estritamente a estrutura solicitada. Nenhuma palavra a mais.",
    VOICE_SCHEMA,
  );

  try {
    return jsonResponse(JSON.parse(text || "{}"));
  } catch {
    return jsonResponse({});
  }
}, "O tempo limite para processamento do áudio foi excedido.");
