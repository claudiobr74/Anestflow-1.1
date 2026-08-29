import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function viteEnv(name: string): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  if (env?.[name]) return (env[name] ?? "").trim();
  if (typeof process !== "undefined" && process.env[name]) {
    return (process.env[name] ?? "").trim();
  }
  return "";
}

export function getSupabaseUrl(): string {
  return viteEnv("VITE_SUPABASE_URL");
}

export function getSupabasePublishableKey(): string {
  return viteEnv("VITE_SUPABASE_PUBLISHABLE_KEY") || viteEnv("VITE_SUPABASE_ANON_KEY");
}

export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  return Boolean(url && key && !key.includes("xxxxxxxx"));
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url || !key || key.includes("xxxxxxxx")) {
    throw new Error(
      "Supabase não configurado. Copie .env.example para .env.local e preencha VITE_SUPABASE_PUBLISHABLE_KEY."
    );
  }
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  return client;
}
