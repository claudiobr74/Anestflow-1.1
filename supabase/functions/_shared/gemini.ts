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

export class GeminiFeatureError extends GeminiError {
  errorCode: string;
  constructor(errorCode: string, message: string, status = 502) {
    super(message, status);
    this.name = "GeminiFeatureError";
    this.errorCode = errorCode;
  }
}

export type GeminiInvocationMeta = {
  feature: string;
  provider: "google-gemini";
  model: string;
  prompt_version: string;
  schema_version: string;
  thinking_level?: string;
  timestamp: string;
  started_at: string;
  completed_at: string;
  latency_ms: number;
  status: "ok" | "error";
  success: boolean;
  error_code?: string;
};

export const ATTEMPT_TIMEOUT_MS = 20_000;
export const MAX_RETRIES = 2;

export function isTransientGeminiFailure(message: string, status?: number): boolean {
  if (status === 429 || status === 503 || status === 504 || status === 529) return true;
  return (
    message.includes("503") ||
    message.includes("504") ||
    message.includes("429") ||
    message.includes("529") ||
    message.includes("Timeout") ||
    message.includes("UNAVAILABLE") ||
    message.includes("DEADLINE") ||
    message.includes("RESOURCE_EXHAUSTED")
  );
}

export async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
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

export async function getGeminiApiKey(): Promise<string> {
  const fromEnv = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (fromEnv) return fromEnv;

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !service) throw new GeminiConfigError();

  const response = await fetch(`${url}/rest/v1/rpc/read_gemini_api_key`, {
    method: "POST",
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!response.ok) {
    console.error(`[gemini] vault rpc failed status=${response.status}`);
    throw new GeminiConfigError();
  }

  const payload = await response.json();
  const key = typeof payload === "string" ? payload.trim() : "";
  if (!key) {
    console.error("[gemini] vault rpc returned empty key");
    throw new GeminiConfigError();
  }
  return key;
}
