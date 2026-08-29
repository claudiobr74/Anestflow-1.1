import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CANONICAL_SUPABASE_URL, CANONICAL_SUPABASE_PUBLISHABLE_KEY } from "./supabaseProject";

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
 * in production builds. The try/catch covers Node/tsx, where import.meta.env
 * does not exist.
 */
function fromVite(read: () => unknown, processKey: string): string {
  try {
    const fromViteValue = trimEnv(read());
    if (fromViteValue) return fromViteValue;
  } catch {
    /* Node/tsx without the Vite env object */
  }
  return processFallback(processKey);
}

type RuntimeConfig = { url: string; key: string };

let runtimeOverride: RuntimeConfig | null = null;
let ensurePromise: Promise<string | null> | null = null;

export function applyRuntimeSupabaseConfig(config: RuntimeConfig): void {
  const url = trimEnv(config.url);
  const key = trimEnv(config.key);
  if (!url || !key || key.includes("xxxxxxxx")) return;
  runtimeOverride = { url, key };
  client = null;
}

export function getSupabaseUrl(): string {
  if (runtimeOverride?.url) return runtimeOverride.url;
  return fromVite(() => import.meta.env.VITE_SUPABASE_URL, "VITE_SUPABASE_URL") || CANONICAL_SUPABASE_URL;
}

export function getSupabasePublishableKey(): string {
  if (runtimeOverride?.key) return runtimeOverride.key;
  return (
    fromVite(() => import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, "VITE_SUPABASE_PUBLISHABLE_KEY") ||
    fromVite(() => import.meta.env.VITE_SUPABASE_ANON_KEY, "VITE_SUPABASE_ANON_KEY") ||
    CANONICAL_SUPABASE_PUBLISHABLE_KEY
  );
}

function configHint(): string {
  try {
    if (import.meta.env.PROD) {
      return " No projeto Vercel, defina VITE_SUPABASE_PUBLISHABLE_KEY em Settings → Environment Variables e faça um novo deploy.";
    }
  } catch {
    /* Node/tsx */
  }
  return " Preencha VITE_SUPABASE_PUBLISHABLE_KEY em .env.local e reinicie o servidor (npm run dev).";
}

export function getSupabaseConfigError(): string | null {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url && !key) {
    return "Supabase não configurado. Faltam URL e chave publishable." + configHint();
  }
  if (!url) {
    return "Supabase não configurado. Falta VITE_SUPABASE_URL." + configHint();
  }
  if (!key) {
    return "Supabase não configurado. Falta VITE_SUPABASE_PUBLISHABLE_KEY." + configHint();
  }
  if (key.includes("xxxxxxxx")) {
    return "Supabase não configurado. A chave ainda é o placeholder sb_publishable_xxxxxxxx." + configHint();
  }
  return null;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfigError() === null;
}

/**
 * If Vite did not inline the keys (empty import.meta.env), ask Express for the
 * same values it loaded from .env.local. No-op when already configured or when
 * the host has no /api/public-config (static deploy without env).
 */
export async function ensureSupabaseConfig(): Promise<string | null> {
  if (getSupabaseConfigError() === null) return null;
  if (!ensurePromise) {
    ensurePromise = (async () => {
      try {
        const res = await fetch("/api/public-config", { credentials: "same-origin" });
        if (res.ok) {
          const data = (await res.json()) as {
            supabaseUrl?: string;
            supabasePublishableKey?: string;
          };
          applyRuntimeSupabaseConfig({
            url: data.supabaseUrl ?? "",
            key: data.supabasePublishableKey ?? ""
          });
        }
      } catch {
        /* static host or offline */
      }
      return getSupabaseConfigError();
    })();
  }
  return ensurePromise;
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
