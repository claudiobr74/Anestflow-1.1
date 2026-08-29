import { AI_MODEL_CONFIG } from "./aiModelConfig.ts";
import {
  ATTEMPT_TIMEOUT_MS,
  GeminiConfigError,
  GeminiError,
  GeminiFeatureError,
  GeminiTimeoutError,
  MAX_RETRIES,
  fetchWithTimeout,
  getGeminiApiKey,
  isTransientGeminiFailure,
  type GeminiInvocationMeta,
} from "./gemini.ts";

const INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

export type GeminiGatewayFeature = keyof typeof AI_MODEL_CONFIG;

export type GeminiGatewayRequest = {
  feature: GeminiGatewayFeature;
  promptVersion: string;
  schemaVersion: string;
  errorCode: string;
  systemInstruction?: string;
  input?: unknown;
  responseSchema?: Record<string, unknown>;
  audio?: { mimeType: string; data: string; vocabulary: string[] };
};

function okMeta(
  feature: string,
  model: string,
  promptVersion: string,
  schemaVersion: string,
  started: number,
  thinkingLevel?: string,
): GeminiInvocationMeta {
  const completed = new Date();
  return {
    feature,
    provider: "google-gemini",
    model,
    prompt_version: promptVersion,
    schema_version: schemaVersion,
    thinking_level: thinkingLevel,
    timestamp: completed.toISOString(),
    started_at: new Date(started).toISOString(),
    completed_at: completed.toISOString(),
    latency_ms: Date.now() - started,
    status: "ok",
    success: true,
  };
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!content) return "";
  if (Array.isArray(content)) return content.map((item) => textFromContent(item)).join("");
  if (typeof content === "object") {
    const rec = content as Record<string, unknown>;
    if (rec.type === "thought" || rec.type === "thinking") return "";
    if (typeof rec.text === "string") return rec.text;
    if (rec.content !== undefined) return textFromContent(rec.content);
  }
  return "";
}

export function extractGatewayText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const rec = payload as Record<string, unknown>;
  if (typeof rec.output_text === "string" && rec.output_text.trim()) return rec.output_text.trim();
  const fromOutputs = textFromContent(rec.outputs ?? rec.output).trim();
  if (fromOutputs) return fromOutputs;
  if (Array.isArray(rec.steps)) {
    const chunks: string[] = [];
    for (const step of rec.steps) {
      if (!step || typeof step !== "object") continue;
      const s = step as Record<string, unknown>;
      if (s.type === "thought" || s.type === "thinking") continue;
      const piece = textFromContent(s.content ?? s.output ?? s.text).trim();
      if (piece) chunks.push(piece);
    }
    if (chunks.length) return chunks.join("\n").trim();
  }
  const candidates = rec.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
  return (candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "").trim();
}

function stripJsonFence(text: string): string {
  const fence = text.trim().match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fence ? fence[1].trim() : text.trim();
}

function buildTranscriptionBody(model: string, audio: { mimeType: string; data: string; vocabulary: string[] }) {
  return {
    model,
    store: false,
    input: [{ type: "audio", mime_type: audio.mimeType, data: audio.data }],
    generation_config: {
      transcription_config: {
        language_hints: ["pt-BR"],
        custom_vocabulary: audio.vocabulary,
        mode: { type: "verbatim" },
      },
    },
  };
}

function buildClinicalBody(
  model: string,
  thinkingLevel: string,
  input: unknown,
  systemInstruction: string | undefined,
  responseSchema: Record<string, unknown> | undefined,
) {
  const body: Record<string, unknown> = {
    model,
    store: false,
    input,
    generation_config: {
      thinking_level: thinkingLevel,
      thinking_summaries: "none",
    },
  };
  if (systemInstruction) body.system_instruction = systemInstruction;
  if (responseSchema) {
    body.response_format = {
      type: "text",
      mime_type: "application/json",
      schema: responseSchema,
    };
  }
  return body;
}

function httpStatus(error: unknown): number | undefined {
  const rec = error as { status?: number };
  return typeof rec?.status === "number" ? rec.status : undefined;
}

async function postInteractions(apiKey: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetchWithTimeout(
    INTERACTIONS_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
        "User-Agent": "anestflow-gemini-gateway",
      },
      body: JSON.stringify(body),
    },
    ATTEMPT_TIMEOUT_MS,
  );

  const raw = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = raw ? JSON.parse(raw) as Record<string, unknown> : {};
  } catch {
    throw new GeminiError(`Resposta inválida do Gemini (HTTP ${response.status})`, 502);
  }

  if (!response.ok) {
    const err = payload.error as { message?: string; status?: string } | undefined;
    const message = err?.message || err?.status || `HTTP ${response.status}`;
    const wrapped = new Error(message) as Error & { status?: number };
    wrapped.status = response.status;
    throw wrapped;
  }

  if (payload.status === "failed" || payload.status === "cancelled") {
    throw new GeminiError("A interação Gemini falhou sem conteúdo utilizável.", 502);
  }

  return payload;
}

/**
 * Transporte legado no MESMO modelo se Interactions não existir (404).
 * Nunca troca o ID do modelo. Não se aplica à transcrição.
 */
async function postGenerateContent(
  apiKey: string,
  model: string,
  thinkingLevel: string,
  input: unknown,
  systemInstruction: string | undefined,
  responseSchema: Record<string, unknown> | undefined,
): Promise<Record<string, unknown>> {
  const textInput = typeof input === "string" ? input : JSON.stringify(input);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const generationConfig: Record<string, unknown> = {
    thinkingConfig: { thinkingLevel },
  };
  if (responseSchema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = responseSchema;
  }
  const requestBody: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: textInput }] }],
    generationConfig,
  };
  if (systemInstruction) {
    requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
        "User-Agent": "anestflow-gemini-gateway",
      },
      body: JSON.stringify(requestBody),
    },
    ATTEMPT_TIMEOUT_MS,
  );
  const raw = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = raw ? JSON.parse(raw) as Record<string, unknown> : {};
  } catch {
    throw new GeminiError(`Resposta inválida do Gemini (HTTP ${response.status})`, 502);
  }
  if (!response.ok) {
    const err = payload.error as { message?: string; status?: string } | undefined;
    const message = err?.message || err?.status || `HTTP ${response.status}`;
    const wrapped = new Error(message) as Error & { status?: number };
    wrapped.status = response.status;
    throw wrapped;
  }
  return payload;
}

/**
 * Único ponto server-side de chamada Gemini.
 * React nunca chama a API. Sem fallback de modelo. Sem store/PHI remoto.
 */
export async function invokeGeminiGateway(
  request: GeminiGatewayRequest,
): Promise<{ text: string; meta: GeminiInvocationMeta }> {
  const cfg = AI_MODEL_CONFIG[request.feature];
  const model = cfg.model;
  const thinkingLevel = "thinkingLevel" in cfg ? cfg.thinkingLevel : undefined;
  const started = Date.now();
  const apiKey = await getGeminiApiKey();

  const body = request.feature === "transcription"
    ? buildTranscriptionBody(model, request.audio ?? { mimeType: "audio/webm", data: "", vocabulary: [] })
    : buildClinicalBody(
      model,
      thinkingLevel ?? "minimal",
      request.input,
      request.systemInstruction,
      request.responseSchema,
    );

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      let payload: Record<string, unknown>;
      try {
        payload = await postInteractions(apiKey, body);
      } catch (error) {
        const status = httpStatus(error);
        if (request.feature !== "transcription" && status === 404) {
          payload = await postGenerateContent(
            apiKey,
            model,
            thinkingLevel ?? "minimal",
            request.input,
            request.systemInstruction,
            request.responseSchema,
          );
        } else {
          throw error;
        }
      }

      const text = stripJsonFence(extractGatewayText(payload));
      if (!text) {
        throw new GeminiFeatureError(
          request.errorCode,
          "O modelo de IA não retornou conteúdo utilizável.",
          502,
        );
      }

      return {
        text,
        meta: okMeta(request.feature, model, request.promptVersion, request.schemaVersion, started, thinkingLevel),
      };
    } catch (error) {
      lastError = error;
      if (error instanceof GeminiConfigError) throw error;
      if (error instanceof GeminiFeatureError && !isTransientGeminiFailure(error.message, error.status)) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      const status = httpStatus(error);
      const transient = error instanceof GeminiTimeoutError || isTransientGeminiFailure(message, status);
      if (!transient || attempt >= MAX_RETRIES) break;

      const delay = attempt * 1000 + Math.random() * 500;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  if (lastError instanceof GeminiTimeoutError) {
    throw new GeminiFeatureError(request.errorCode, lastError.message, 504);
  }
  if (lastError instanceof GeminiFeatureError) throw lastError;
  if (lastError instanceof GeminiError) {
    throw new GeminiFeatureError(request.errorCode, lastError.message, lastError.status);
  }
  const message = lastError instanceof Error ? lastError.message : "Falha ao obter resposta do modelo de IA.";
  const status = httpStatus(lastError) ?? 502;
  throw new GeminiFeatureError(request.errorCode, message, status >= 400 ? status : 502);
}

export function parseTranscriptText(text: string): string {
  const trimmed = stripJsonFence(text);
  if (!trimmed) return "";
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const candidate = parsed.transcript_original ?? parsed.transcript ?? parsed.text ?? parsed.output_text;
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}
