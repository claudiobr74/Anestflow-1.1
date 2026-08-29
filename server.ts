/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

dotenv.config();

// Initialize Firebase Admin SDK using configured project ID
let firebaseProjectId = "anestflow-62d4b";
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const rawConfig = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(rawConfig);
    if (parsed && parsed.projectId) {
      firebaseProjectId = parsed.projectId;
    }
  }
} catch (e) {
  console.warn("[Firebase Admin] Usando ID do projeto padrão:", firebaseProjectId);
}

function getFirebaseAuth() {
  if (getApps().length === 0) {
    try {
      initializeApp({
        projectId: firebaseProjectId
      });
    } catch (err: any) {
      console.warn("[Firebase Admin] Aviso ao inicializar Firebase Admin:", err?.message || err);
    }
  }
  return getAuth();
}

const app = express();
const PORT = 3000;

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.removeHeader("X-Powered-By");
  next();
});

// Parse JSON payloads with strict limit (10MB for medical documents and audio base64)
app.use(express.json({ limit: "10mb" }));

// Express body-parser error handler for oversized payloads
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && (err.type === "entity.too.large" || err.status === 413)) {
    return res.status(413).json({ error: "Tamanho do conteúdo excede o limite permitido (10MB)." });
  }
  next(err);
});

// Audit logging middleware - NEVER log clinical patient data, names, CPFs or audio base64!
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    const start = Date.now();
    res.on("finish", () => {
      const userUid = (req as any).user?.uid || "anônimo";
      const duration = Date.now() - start;
      console.log(`[API LOG] ${req.method} ${req.path} | Status: ${res.statusCode} | UID: ${userUid} | ${duration}ms`);
    });
  }
  next();
});

// In-memory sliding window rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
function rateLimiter(maxRequests = 30, windowMs = 60 * 1000) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const uid = (req as any).user?.uid || req.ip || "unknown";
    const now = Date.now();
    const record = rateLimitMap.get(uid) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
    } else {
      record.count += 1;
    }

    rateLimitMap.set(uid, record);

    if (record.count > maxRequests) {
      return res.status(429).json({ 
        error: "Muitas requisições enviadas ao servidor.", 
        details: "Limite de taxa excedido. Por favor, aguarde alguns instantes antes de tentar novamente." 
      });
    }

    next();
  };
}

// Authentication middleware requiring Firebase ID Token in Authorization: Bearer <token>
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ 
      error: "Acesso não autorizado.", 
      details: "Token de autenticação Firebase ausente no cabeçalho Authorization." 
    });
  }

  const idToken = authHeader.substring(7).trim();
  if (!idToken) {
    return res.status(401).json({ 
      error: "Acesso não autorizado.", 
      details: "Token de autenticação Firebase malformado." 
    });
  }

  try {
    const decodedToken = await getFirebaseAuth().verifyIdToken(idToken);
    
    // Attach verified user information to request object
    (req as any).user = {
      uid: decodedToken.uid,
      email: decodedToken.email || "",
      emailVerified: decodedToken.email_verified || false
    };

    next();
  } catch (error: any) {
    console.error(`[Auth Middleware] Falha na verificação do token para ${req.path}:`, error.message || "Token inválido");
    return res.status(401).json({ 
      error: "Acesso não autorizado.", 
      details: "Sessão inválida, expirada ou token revogado." 
    });
  }
}

// Global protection middleware applied to all current and future /api/* routes except public /api/health
app.use("/api", (req, res, next) => {
  if (req.path === "/health" || req.path === "/health/") {
    return next();
  }
  return requireAuth(req, res, () => {
    return rateLimiter(30, 60 * 1000)(req, res, next);
  });
});

// Server-side initialization of Gemini API
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required but missing.");
    }
    aiClient = new GoogleGenAI({ 
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

/**
 * Executes a Gemini request with automatic retries on transient errors (such as 503 Service Unavailable)
 * and falls back to a secondary robust model if the primary model remains overloaded.
 */
async function generateContentWithRetryAndFallback(
  client: GoogleGenAI,
  params: any,
  maxRetries = 2
): Promise<any> {
  const modelsToTry = [params.model, "gemini-3.1-flash-lite", "gemini-flash-latest"].filter((m, i, arr) => m && arr.indexOf(m) === i);
  let lastError: any = null;

  for (const model of modelsToTry) {
    if (!model) continue;

    const currentParams = { ...params, model };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let timeoutTimer: NodeJS.Timeout | undefined;
      try {
        const timeoutPromise = new Promise((_, reject) => {
          timeoutTimer = setTimeout(() => {
            reject(new Error("Timeout de resposta da API do Gemini"));
          }, 20000); // 20 seconds per attempt safety timeout
        });

        const response = await Promise.race([
          client.models.generateContent(currentParams),
          timeoutPromise
        ]);

        if (timeoutTimer) clearTimeout(timeoutTimer);
        return response;
      } catch (error: any) {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        lastError = error;
        
        const errorMessage = typeof error.message === 'string' ? error.message : JSON.stringify(error);

        const isTransient = errorMessage.includes("503") || 
                            errorMessage.includes("504") || 
                            errorMessage.includes("529") || 
                            errorMessage.includes("Timeout");

        if (!isTransient) {
          break;
        }

        if (attempt < maxRetries) {
          const delay = attempt * 1000 + Math.random() * 500;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  throw lastError || new Error("Não foi possível obter resposta do modelo de IA devido à alta demanda.");
}

// API Routes

// Public Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Protected Gemini Clinical Record Review Endpoint
app.post("/api/review", async (req, res) => {
  try {
    const document = req.body;
    
    if (!document || !document.patient) {
      return res.status(400).json({ error: "Documento inválido ou ausente." });
    }

    const client = getAIClient();
    
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

    const response = await generateContentWithRetryAndFallback(client, {
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        systemInstruction: "Você é um assistente sênior especialista em auditoria de prontuários médicos anestésicos no Brasil. Suas respostas devem ser exclusivamente em formato JSON conforme a estrutura solicitada, em português, objetivas, visando a segurança do paciente e a qualidade legal da documentação anestésica sob a Resolução CFM 2.174/2017.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            alerts: {
              type: Type.ARRAY,
              description: "Lista de inconsistências ou pendências encontradas.",
              items: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    description: "Critico, Importante, ou Informativo"
                  },
                  title: {
                    type: Type.STRING
                  },
                  description: {
                    type: Type.STRING
                  },
                  module: {
                    type: Type.STRING,
                    description: "Patient, Vitals, PreEvaluation, Timing, Airway, Drugs"
                  }
                }
              }
            }
          }
        }
      }
    });

    const text = response.text || '{"alerts":[]}';
    res.setHeader("Content-Type", "application/json");
    res.send(text);

  } catch (error: any) {
    const isTimeout = error.message?.includes("Timeout");
    console.error(`[API Error /api/review] UID: ${(req as any).user?.uid} - Error:`, error.message || "Erro desconhecido");
    
    if (isTimeout) {
      return res.status(504).json({ error: "O tempo limite para revisão do documento foi excedido." });
    }
    res.status(500).json({ error: "Não foi possível realizar a revisão assistida por IA no momento." });
  }
});

// Protected Voice Command Parsing Endpoint
app.post("/api/voice-command", async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body;
    
    if (!audioBase64) {
      return res.status(400).json({ error: "Áudio não fornecido." });
    }

    const client = getAIClient();
    
    const prompt = `Você é um assistente de IA atuando como 'Escriba Anestésico' avançado, especializado no contexto médico brasileiro.
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

    const response = await generateContentWithRetryAndFallback(client, {
      model: "gemini-3.1-flash-lite",
      contents: [
        prompt,
        {
          inlineData: {
            data: audioBase64,
            mimeType: mimeType || "audio/webm",
          }
        }
      ],
      config: {
        systemInstruction: "Retorne EXCLUSIVAMENTE um objeto JSON válido seguindo estritamente a estrutura solicitada. Nenhuma palavra a mais.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcription: { type: Type.STRING, description: "Transcrição fiel do áudio." },
            identifiedActions: {
              type: Type.OBJECT,
              properties: {
                bolusDrugs: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      dose: { type: Type.STRING },
                      unit: { type: Type.STRING, description: "mg, mcg, g, ml, UI" },
                      route: { type: Type.STRING, description: "EV, IM, SC, IN" }
                    }
                  }
                },
                continuousInfusions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      rate: { type: Type.STRING },
                      rateUnit: { type: Type.STRING, description: "mcg/kg/min, mg/h, ml/h" }
                    }
                  }
                },
                inhalationAgents: {
                  type: Type.ARRAY,
                  items: { type: Type.OBJECT, properties: { name: { type: Type.STRING } } }
                },
                events: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      category: { type: Type.STRING, description: "Procedimento, Via Aérea, Bloqueio, Acesso, Marcador Temporal, Intercorrência, Outro" }
                    }
                  }
                },
                vitals: {
                  type: Type.OBJECT,
                  properties: {
                    hr: { type: Type.NUMBER, description: "Frequência Cardíaca" },
                    systolic: { type: Type.NUMBER, description: "Pressão Arterial Sistólica" },
                    diastolic: { type: Type.NUMBER, description: "Pressão Arterial Diastólica" },
                    spo2: { type: Type.NUMBER, description: "Saturação de O2 (%)" },
                    etco2: { type: Type.NUMBER, description: "Capnografia (EtCO2)" },
                    temp: { type: Type.NUMBER, description: "Temperatura" }
                  }
                },
                patient: {
                  type: Type.OBJECT,
                  description: "Dados do paciente identificados no áudio.",
                  properties: {
                    fullName: { type: Type.STRING, description: "Nome completo do paciente ou identificação (ex: 'João Silva' ou 'Paciente A')." },
                    age: { type: Type.STRING, description: "Idade em anos (ex: '45')." },
                    weight: { type: Type.STRING, description: "Peso em kg (ex: '70')." },
                    recordNumber: { type: Type.STRING, description: "Número do prontuário ou número do registro ou número do paciente (ex: 'GH-90210' ou '1234')." },
                    admissionNumber: { type: Type.STRING, description: "Número de atendimento ou número de internação ou número de admissão (ex: '44093')." },
                    bed: { type: Type.STRING, description: "Leito, quarto ou enfermaria do paciente (ex: 'UTI 2' ou 'Leito 15')." },
                    dob: { type: Type.STRING, description: "Data de nascimento do paciente formatada estritamente como YYYY-MM-DD (ex: '1980-05-10')." }
                  }
                },
                templates: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Nomes de templates ou protocolos a serem ativados (ex: 'cesariana', 'apendicectomia')."
                },
                timers: {
                  type: Type.OBJECT,
                  properties: {
                    startAnesthesia: { type: Type.BOOLEAN, description: "True se foi solicitado início da anestesia." },
                    startSurgery: { type: Type.BOOLEAN, description: "True se foi solicitado início da cirurgia." },
                    startSurgeryMinutes: { type: Type.NUMBER, description: "Minutos a partir de agora para início da cirurgia (ex: 'em 10 minutos')." },
                    endSurgery: { type: Type.BOOLEAN, description: "True se foi solicitado fim da cirurgia." },
                    endAnesthesia: { type: Type.BOOLEAN, description: "True se foi solicitado fim da anestesia." }
                  }
                }
              }
            }
          },
          required: ["transcription", "identifiedActions"]
        }
      }
    });

    const text = response.text || "{}";
    res.setHeader("Content-Type", "application/json");
    res.send(text);

  } catch (error: any) {
    const isTimeout = error.message?.includes("Timeout");
    console.error(`[API Error /api/voice-command] UID: ${(req as any).user?.uid} - Error:`, error.message || "Erro desconhecido");
    
    if (isTimeout) {
      return res.status(504).json({ error: "O tempo limite para processamento do áudio foi excedido." });
    }
    res.status(500).json({ error: "Falha ao processar comando de voz." });
  }
});

// Protected Generate Description Endpoint
app.post("/api/generate-description", async (req, res) => {
  try {
    const { document, models } = req.body;
    
    if (!document) {
      return res.status(400).json({ error: "Documento inválido ou ausente." });
    }

    const client = getAIClient();
    
    const prompt = `Gere uma "Descrição do Ato Anestésico" técnica, formal e narrativa baseada EXCLUSIVAMENTE nos dados da ficha anestésica anexada em formato JSON.
O texto deve ser fluido e legível, descrevendo cronologicamente: monitorização, acessos (venosos, arteriais), técnica anestésica (indução, manutenção, bloqueios), vias aéreas, fluidos administrados e evolução clínica (estabilidade, intercorrências) com base APENAS no que está documentado.

Caso o documento esteja vazio ou não tenha dados suficientes, elabore uma descrição muito genérica ou indique a falta de dados estruturados.

IMPORTANTE: Abaixo está uma lista de Modelos Base (Templates) de descrições pré-definidos pelo usuário.
Você deve escolher o modelo mais apropriado com base no procedimento e preencher os colchetes com os dados reais do documento. Se os modelos fornecidos não cobrirem o cenário, gere uma narrativa formal do zero utilizando as diretrizes CFM. Mantenha o formato e a estrutura textual do modelo selecionado, substituindo apenas os placeholders de forma inteligente e natural. Se não houver nenhum modelo útil, crie o seu.

Modelos Disponíveis:
${JSON.stringify(models || [], null, 2)}

Documento JSON da Anestesia (Preencha o modelo com esses dados):
${JSON.stringify(document, null, 2)}
`;

    const response = await generateContentWithRetryAndFallback(client, {
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        systemInstruction: "Você é um especialista em documentação de anestesiologia médica no Brasil. Seu objetivo é ajudar a redigir o ato anestésico com base em dados.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: "O texto narrativo final gerado." }
          }
        }
      }
    });

    const text = response.text || '{"description": ""}';
    res.setHeader("Content-Type", "application/json");
    res.send(text);

  } catch (error: any) {
    const isTimeout = error.message?.includes("Timeout");
    console.error(`[API Error /api/generate-description] UID: ${(req as any).user?.uid} - Error:`, error.message || "Erro desconhecido");
    
    if (isTimeout) {
      return res.status(504).json({ error: "O tempo limite para geração da descrição foi excedido." });
    }
    res.status(500).json({ error: "Não foi possível gerar a descrição assistida por IA no momento." });
  }
});

// Vite middleware configuration for development vs. production serving
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware mounted successfully.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving compiled static assets in production mode.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://localhost:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error("Failed to start server:", err);
});
