import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function trimEnv(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function processFallback(name: string): string {
  if (typeof process === "undefined" || !process.env) return "";
  return trimEnv(process.env[name]);
}

/**
 * Vite only inlines `VITE_*` when the identifier is a static
 * `import.meta.env.VITE_...` access. Dynamic `env[name]` becomes undefined
 * in production builds (and in any bundle served by a leftover PWA SW).
 * The try/catch covers Node/tsx, where `import.meta.env` does not exist.
 */
function fromVite(read: () => unknown, processKey: string): string {
  try {
    const fromVite = trimEnv(read());
    if (fromVite) return fromVite;
  } catch {
    /* Node/tsx without the Vite env object */
  }
  return processFallback(processKey);
}

export function getSupabaseUrl(): string {
  return fromVite(() => import.meta.env.VITE_SUPABASE_URL, "VITE_SUPABASE_URL");
}

export function getSupabasePublishableKey(): string {
  return (
    fromVite(() => import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, "VITE_SUPABASE_PUBLISHABLE_KEY") ||
    fromVite(() => import.meta.env.VITE_SUPABASE_ANON_KEY, "VITE_SUPABASE_ANON_KEY")
  );
}

function isPlaceholderKey(key: string): boolean {
  return key.includes("xxxxxxxx");
}

export function getSupabaseConfigError(): string | null {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url && !key) {
    return "Supabase não configurado. Confira VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY em .env.local e reinicie o servidor (npm run dev).";
  }
  if (!url) {
    return "Supabase não configurado. Preencha VITE_SUPABASE_URL em .env.local e reinicie o servidor.";
  }
  if (!key) {
    return "Supabase não configurado. Preencha VITE_SUPABASE_PUBLISHABLE_KEY em .env.local e reinicie o servidor.";
  }
  if (isPlaceholderKey(key)) {
    return "Supabase não configurado. Substitua o placeholder da chave em .env.local pela chave sb_publishable_ do Dashboard e reinicie o servidor.";
  }
  return null;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfigError() === null;
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const configError = getSupabaseConfigError();
  if (configError) {
    throw new Error(configError);
  }
  client = createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  return client;
}
