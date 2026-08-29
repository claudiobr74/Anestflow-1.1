import { jsonResponse, optionsResponse } from "./cors.ts";
import { requireConfirmedUser, type AuthedUser } from "./auth.ts";
import { allowRequest } from "./rateLimit.ts";
import { GeminiConfigError, GeminiError, GeminiTimeoutError } from "./gemini.ts";

/** Hosted Edge Functions typically cap bodies around 6MB; stay under that. */
const MAX_BODY_BYTES = 5_500_000;

export type AiHandler = (user: AuthedUser, body: unknown) => Promise<Response>;

export function serveAiFunction(name: string, handler: AiHandler, timeoutMessage: string) {
  Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return optionsResponse();
    if (req.method !== "POST") {
      return jsonResponse({ error: "Método não permitido." }, 405);
    }

    const started = Date.now();
    const authed = await requireConfirmedUser(req);
    if ("response" in authed) return authed.response;
    const { user } = authed;

    if (!allowRequest(user.id)) {
      console.log(`[${name}] uid=${user.id} status=429`);
      return jsonResponse({
        error: "Muitas requisições enviadas ao servidor.",
        details: "Limite de taxa excedido. Por favor, aguarde alguns instantes antes de tentar novamente.",
      }, 429);
    }

    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (contentLength > MAX_BODY_BYTES) {
      console.log(`[${name}] uid=${user.id} status=413`);
      return jsonResponse({
        error: "Tamanho do conteúdo excede o limite permitido das Edge Functions (~5,5MB).",
      }, 413);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "JSON inválido." }, 400);
    }

    try {
      const response = await handler(user, body);
      console.log(`[${name}] uid=${user.id} status=${response.status} ${Date.now() - started}ms`);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      console.error(`[${name}] uid=${user.id} error=${message}`);

      if (error instanceof GeminiTimeoutError) {
        return jsonResponse({ error: timeoutMessage }, 504);
      }
      if (error instanceof GeminiConfigError || error instanceof GeminiError) {
        return jsonResponse({ error: error.message }, error.status);
      }
      return jsonResponse({ error: "Falha ao processar a solicitação de IA." }, 500);
    }
  });
}
