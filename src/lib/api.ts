import { getSupabase } from "./supabase";

/**
 * Wrapper over fetch that attaches the current Supabase access token
 * in the Authorization: Bearer header for remaining Express /api/* routes
 * (health is public). Gemini AI uses Edge Functions via `invokeAiFunction`.
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { data, error } = await getSupabase().auth.getSession();
  const session = data.session;
  if (error || !session?.access_token) {
    throw new Error("Usuário não autenticado. Faça login para utilizar os recursos autenticados do AnestFlow.");
  }

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${session.access_token}`);

  return fetch(url, {
    ...options,
    headers
  });
}
