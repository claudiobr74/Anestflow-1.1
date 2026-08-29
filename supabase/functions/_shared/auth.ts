import { createClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse } from "./cors.ts";

export type AuthedUser = { id: string; email: string };

export async function requireConfirmedUser(
  req: Request,
): Promise<{ user: AuthedUser } | { response: Response }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return {
      response: jsonResponse({
        error: "Acesso não autorizado.",
        details: "Token de autenticação Supabase ausente no cabeçalho Authorization.",
      }, 401),
    };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return {
      response: jsonResponse({
        error: "Acesso não autorizado.",
        details: "Token de autenticação Supabase malformado.",
      }, 401),
    };
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!url || !anon) {
    console.error("[auth] SUPABASE_URL / SUPABASE_ANON_KEY ausentes no runtime");
    return {
      response: jsonResponse({
        error: "Serviço de autenticação indisponível.",
      }, 500),
    };
  }

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return {
      response: jsonResponse({
        error: "Acesso não autorizado.",
        details: "Sessão inválida, expirada ou token revogado.",
      }, 401),
    };
  }

  if (!data.user.email_confirmed_at) {
    return {
      response: jsonResponse({
        error: "Acesso não autorizado.",
        details: "E-mail ainda não confirmado.",
      }, 401),
    };
  }

  return { user: { id: data.user.id, email: data.user.email ?? "" } };
}
