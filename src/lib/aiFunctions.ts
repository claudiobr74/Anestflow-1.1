import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

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

  const invokePromise = client.functions.invoke<T>(name, { body });
  const { data, error } = signal
    ? await Promise.race([invokePromise, waitForAbort(signal)])
    : await invokePromise;

  if (error) throw await mapFunctionsError(error);
  if (data == null) {
    throw new Error("Resposta vazia da função de IA.");
  }
  return data;
}
