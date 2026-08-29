import { CANONICAL_SUPABASE_PUBLISHABLE_KEY, CANONICAL_SUPABASE_URL } from "./supabaseProject";

export type PublicSupabaseConfig = {
  supabaseUrl: string | null;
  supabasePublishableKey: string | null;
};

/** Config pública (URL + chave publishable). Express e a função Vercel usam a mesma fonte. */
export function getPublicSupabaseConfig(
  env: Record<string, string | undefined> = process.env
): PublicSupabaseConfig {
  const url = (env.VITE_SUPABASE_URL || CANONICAL_SUPABASE_URL).trim();
  const key = (
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    CANONICAL_SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();
  return {
    supabaseUrl: url || null,
    supabasePublishableKey: key && !key.includes("xxxxxxxx") ? key : null
  };
}
