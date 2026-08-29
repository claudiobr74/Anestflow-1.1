export class GeminiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
  }
}

export class GeminiTimeoutError extends GeminiError {
  constructor() {
    super("Timeout de resposta da API do Gemini", 504);
    this.name = "GeminiTimeoutError";
  }
}

export class GeminiConfigError extends GeminiError {
  constructor() {
    super(
      "GEMINI_API_KEY não configurada no projeto Supabase. Defina o secret no Dashboard ou via CLI (supabase secrets set).",
      500,
    );
    this.name = "GeminiConfigError";
  }
}

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

const PRIMARY_MODELS = ["gemini-3.1-flash-lite", "gemini-flash-latest"];
const ATTEMPT_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;

function isTransient(message: string): boolean {
  return (
    message.includes("503") ||
    message.includes("504") ||
    message.includes("529") ||
    message.includes("Timeout") ||
    message.includes("UNAVAILABLE") ||
    message.includes("DEADLINE")
  );
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new GeminiTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function extractText(payload: Record<string, unknown>): string {
  const candidates = payload.candidates as Array<{
    content?: { parts?: Array<{ text?: string }> };
  }> | undefined;
  const text = candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return text.trim();
}

async function generateOnce(
  apiKey: string,
  model: string,
  parts: GeminiPart[],
  systemInstruction: string,
  responseSchema: Record<string, unknown>,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
        "User-Agent": "aistudio-build",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
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
    const err = payload.error as { message?: string; code?: number; status?: string } | undefined;
    const message = err?.message || err?.status || `HTTP ${response.status}`;
    const wrapped = new Error(message);
    (wrapped as Error & { status?: number }).status = response.status;
    throw wrapped;
  }

  const text = extractText(payload);
  if (!text) {
    throw new GeminiError("O modelo de IA não retornou conteúdo utilizável.", 502);
  }
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fence ? fence[1].trim() : text;
}

/**
 * Calls Gemini with the same retry/fallback chain as the former Express routes.
 * Never log `parts` — they may contain PHI or audio.
 */
export async function generateJsonWithRetry(
  parts: GeminiPart[],
  systemInstruction: string,
  responseSchema: Record<string, unknown>,
): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!apiKey) throw new GeminiConfigError();

  const models = PRIMARY_MODELS.filter((m, i, arr) => m && arr.indexOf(m) === i);
  let lastError: unknown = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await generateOnce(apiKey, model, parts, systemInstruction, responseSchema);
      } catch (error) {
        lastError = error;
        if (error instanceof GeminiConfigError) throw error;

        const message = error instanceof Error ? error.message : String(error);
        const transient = error instanceof GeminiTimeoutError || isTransient(message);
        if (!transient) break;

        if (attempt < MAX_RETRIES) {
          const delay = attempt * 1000 + Math.random() * 500;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  if (lastError instanceof GeminiError) throw lastError;
  const message = lastError instanceof Error ? lastError.message : "";
  if (message.includes("Timeout")) throw new GeminiTimeoutError();
  throw lastError instanceof Error
    ? new GeminiError("Não foi possível obter resposta do modelo de IA devido à alta demanda.", 500)
    : new GeminiError("Não foi possível obter resposta do modelo de IA devido à alta demanda.", 500);
}
