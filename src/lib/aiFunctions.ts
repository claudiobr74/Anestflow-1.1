import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import { isAiReviewErrorCode, isVoiceAiErrorCode } from "./aiErrorCodes";

export type AiFunctionName = "review" | "voice-command" | "generate-description";

function abortError(): Error {
  const err = new Error("The operation was aborted.");
  err.name = "AbortError";
  return err;
}

function waitForAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const abort = () => reject(abortError());
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}

async function mapFunctionsError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    let payload: { error?: string; details?: string } | null = null;
    try {
      payload = await error.context.json();
    } catch {
      payload = null;
    }
    const code = payload?.error;
    if (typeof code === "string" && (isAiReviewErrorCode(code) || isVoiceAiErrorCode(code) || code.startsWith("AI_") || code.startsWith("VOICE_"))) {
      return new Error(code);
    }
    const message = payload?.details || payload?.error || error.message || "Falha ao comunicar com o assistente de IA.";
    return new Error(message);
  }
  if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
    return new Error(error.message || "Falha ao comunicar com o assistente de IA.");
  }
  if (error instanceof Error) return error;
  return new Error("Falha ao comunicar com o assistente de IA.");
}

/**
 * Invokes a JWT-protected Supabase Edge Function.
 * The Gemini key stays in project secrets — never in Vite.
 */
export async function invokeAiFunction<T>(
  name: AiFunctionName,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) throw abortError();

  const client = getSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("Usuário não autenticado. Faça login para utilizar os recursos de IA do AnestFlow.");
  }
  if (!userData.user.email_confirmed_at) {
    throw new Error("E-mail ainda não confirmado.");
  }

  const started = Date.now();
  const invokePromise = client.functions.invoke<T>(name, {
    body: body as Record<string, unknown>
  });
  const { data, error } = signal
    ? await Promise.race([invokePromise, waitForAbort(signal)])
    : await invokePromise;

  const latencyMs = Date.now() - started;
  if (error) {
    const mapped = await mapFunctionsError(error);
    void recordAiUsageSafe({
      feature: mapAiFeature(name, body),
      status: "provider_error",
      error_code: mapped.message,
      latency_ms: latencyMs,
      procedure_id: procedureIdFromBody(body),
    });
    throw mapped;
  }
  if (data == null) {
    void recordAiUsageSafe({
      feature: mapAiFeature(name, body),
      status: "provider_error",
      error_code: "empty_response",
      latency_ms: latencyMs,
      procedure_id: procedureIdFromBody(body),
    });
    throw new Error("Resposta vazia da função de IA.");
  }
  void recordAiUsageSafe({
    feature: mapAiFeature(name, body),
    status: "success",
    latency_ms: latencyMs,
    procedure_id: procedureIdFromBody(body),
    ...aiMetaFromResult(data),
  });
  return data;
}

function mapAiFeature(name: AiFunctionName, body: unknown): "voice_asr" | "voice_parser" | "clinical_review" | "narrative" {
  if (name === "review") return "clinical_review";
  if (name === "generate-description") return "narrative";
  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (rec.feature === "transcription") return "voice_asr";
  return "voice_parser";
}

function procedureIdFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const rec = body as Record<string, unknown>;
  const id = rec.procedureId ?? rec.procedure_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function aiMetaFromResult(data: unknown): {
  model: string | null;
  provider: string | null;
  prompt_version: string | null;
  schema_version: string | null;
} {
  if (!data || typeof data !== "object") {
    return { model: null, provider: null, prompt_version: null, schema_version: null };
  }
  const rec = data as Record<string, unknown>;
  const ai = rec.ai && typeof rec.ai === "object" ? (rec.ai as Record<string, unknown>) : null;
  const pick = (value: unknown): string | null => (typeof value === "string" && value.length > 0 ? value : null);
  return {
    model: pick(ai?.model ?? rec.model),
    provider: pick(ai?.provider),
    prompt_version: pick(ai?.prompt_version),
    schema_version: pick(ai?.schema_version),
  };
}

function recordAiUsageSafe(payload: {
  feature: string;
  status: string;
  latency_ms: number;
  error_code?: string;
  procedure_id?: string | null;
  model?: string | null;
  provider?: string | null;
  prompt_version?: string | null;
  schema_version?: string | null;
}): void {
  void (async () => {
    try {
      await getSupabase().rpc("record_ai_usage", {
        p_payload: {
          feature: payload.feature,
          status: payload.status,
          latency_ms: payload.latency_ms,
          error_code: payload.error_code || null,
          procedure_id: payload.procedure_id || null,
          model: payload.model || null,
          provider: payload.provider || null,
          prompt_version: payload.prompt_version || null,
          schema_version: payload.schema_version || null,
        },
      });
    } catch {
      /* telemetria não pode quebrar a IA clínica */
    }
  })();
}
