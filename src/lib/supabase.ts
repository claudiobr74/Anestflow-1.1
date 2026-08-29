import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CANONICAL_SUPABASE_URL } from "./supabaseProject";

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
    fromVite(() => import.meta.env.VITE_SUPABASE_ANON_KEY, "VITE_SUPABASE_ANON_KEY")
  );
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
  if (key.includes("xxxxxxxx")) {
    return "Supabase não configurado. Substitua o placeholder da chave em .env.local pela chave sb_publishable_ do Dashboard e reinicie o servidor.";
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
