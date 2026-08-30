/**
 * Google OAuth via Supabase Auth. Não é um segundo sistema de usuários.
 * UID canônico permanece auth.users.id. Não persiste provider_token à parte.
 */

import { getSupabase } from "./supabase";
import { touchSession } from "./sessionPolicy";
import type { AuthErrorLike } from "./authErrors";

export const OAUTH_REAUTH_KEY = "anestflow_oauth_reauth";

export type GoogleOAuthMode = "login" | "reauth";

export type OAuthUserLike = {
  email?: string | null;
  email_confirmed_at?: string | null;
  identities?: Array<{ provider: string }> | null;
  app_metadata?: {
    provider?: string;
    providers?: string[];
  } | null;
  user_metadata?: Record<string, unknown> | null;
};

export type GoogleOAuthClient = {
  auth: {
    signInWithOAuth: (params: {
      provider: "google";
      options?: {
        redirectTo?: string;
        queryParams?: Record<string, string>;
      };
    }) => Promise<{
      data: { provider: "google"; url: string | null };
      error: { message?: string; code?: string } | null;
    }>;
  };
};

export type OAuthReauthIntent = {
  reason: "idle" | "signature";
  at: number;
};

function listProviders(user: OAuthUserLike | null | undefined): string[] {
  if (!user) return [];
  const fromIdentities = (user.identities ?? []).map((item) => item.provider);
  const fromMeta = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers
    : [];
  const single = user.app_metadata?.provider ? [user.app_metadata.provider] : [];
  return [...fromIdentities, ...fromMeta, ...single];
}

export function userHasPasswordIdentity(user: OAuthUserLike | null | undefined): boolean {
  return listProviders(user).includes("email");
}

export function userHasGoogleIdentity(user: OAuthUserLike | null | undefined): boolean {
  return listProviders(user).includes("google");
}

/** Google já autentica o e-mail no provedor; não bloquear em “confirme o e-mail”. */
export function sessionUserCanEnterApp(user: OAuthUserLike | null | undefined): boolean {
  if (!user) return false;
  if (user.email_confirmed_at) return true;
  return userHasGoogleIdentity(user);
}

export function displayNameFromAuthUser(user: OAuthUserLike | null | undefined): string {
  const meta = user?.user_metadata;
  if (!meta) return "";
  const full = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  if (full) return full;
  const name = typeof meta.name === "string" ? meta.name.trim() : "";
  return name;
}

export function getAuthRedirectTo(origin?: string): string {
  const raw =
    origin ??
    (typeof window !== "undefined" && window.location?.origin ? window.location.origin : "");
  if (!raw) return "/";
  return `${raw.replace(/\/$/, "")}/`;
}

export async function startGoogleOAuth(options: {
  mode?: GoogleOAuthMode;
  origin?: string;
  supabase?: GoogleOAuthClient;
} = {}): Promise<{ error: { message?: string; code?: string } | null }> {
  const client = options.supabase ?? getSupabase();
  const redirectTo = getAuthRedirectTo(options.origin);
  const queryParams = options.mode === "reauth" ? { prompt: "login" } : undefined;
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      ...(queryParams ? { queryParams } : {})
    }
  });
  return { error };
}

function paramsFromFragment(raw: string): URLSearchParams {
  const trimmed = raw.startsWith("?") || raw.startsWith("#") ? raw.slice(1) : raw;
  const query = trimmed.includes("?") ? trimmed.slice(trimmed.indexOf("?") + 1) : trimmed;
  return new URLSearchParams(query);
}

export function parseOAuthCallbackError(search = "", hash = ""): AuthErrorLike | null {
  const fromSearch = paramsFromFragment(search);
  const fromHash = paramsFromFragment(hash);
  const error = fromSearch.get("error") || fromHash.get("error");
  const code = fromSearch.get("error_code") || fromHash.get("error_code") || error || "";
  const description =
    fromSearch.get("error_description") || fromHash.get("error_description") || "";
  if (!error && !description) return null;
  return {
    code: code || undefined,
    message: description.replace(/\+/g, " ") || error || undefined
  };
}

export function consumeOAuthCallbackError(): AuthErrorLike | null {
  if (typeof window === "undefined") return null;
  const parsed = parseOAuthCallbackError(window.location.search, window.location.hash);
  if (!parsed) return null;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    url.searchParams.delete("error_code");
    url.searchParams.delete("error_description");
    url.searchParams.delete("error_uri");
    const hashParams = paramsFromFragment(url.hash);
    if (hashParams.has("error") || hashParams.has("error_description")) {
      url.hash = "";
    }
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* ignore malformed URL */
  }
  return parsed;
}

export function markOAuthReauthIntent(reason: OAuthReauthIntent["reason"]): void {
  try {
    sessionStorage.setItem(
      OAUTH_REAUTH_KEY,
      JSON.stringify({ reason, at: Date.now() } satisfies OAuthReauthIntent)
    );
  } catch {
    /* quota / private mode */
  }
}

/**
 * Consome o intent de reauth Google e renova o relógio do posto.
 * Deve rodar no primeiro render do App, antes do useSessionGuard.
 */
export function consumeOAuthReauthIfPresent(now = Date.now()): OAuthReauthIntent | null {
  try {
    const raw = sessionStorage.getItem(OAUTH_REAUTH_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(OAUTH_REAUTH_KEY);
    const parsed = JSON.parse(raw) as OAuthReauthIntent;
    if (parsed?.reason !== "idle" && parsed?.reason !== "signature") return null;
    touchSession(now);
    return parsed;
  } catch {
    return null;
  }
}

function stripProviderTokensDeep(value: unknown): { value: unknown; changed: boolean } {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const nested = stripProviderTokensDeep(item);
      if (nested.changed) changed = true;
      return nested.value;
    });
    return { value: next, changed };
  }
  if (!value || typeof value !== "object") {
    return { value, changed: false };
  }
  const record = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  let changed = false;
  for (const [key, nested] of Object.entries(record)) {
    if (key === "provider_token" || key === "provider_refresh_token") {
      changed = true;
      continue;
    }
    const child = stripProviderTokensDeep(nested);
    if (child.changed) changed = true;
    next[key] = child.value;
  }
  return { value: next, changed };
}

/** Remove tokens do Google do blob de sessão do SDK. Não apaga access/refresh do Supabase. */
export function stripProviderOAuthTokensFromStorage(): void {
  if (typeof localStorage === "undefined") return;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.includes("auth-token")) continue;
      const raw = localStorage.getItem(key);
      if (!raw || (!raw.includes("provider_token") && !raw.includes("provider_refresh_token"))) {
        continue;
      }
      try {
        const parsed: unknown = JSON.parse(raw);
        const stripped = stripProviderTokensDeep(parsed);
        if (stripped.changed) {
          localStorage.setItem(key, JSON.stringify(stripped.value));
        }
      } catch {
        /* not JSON */
      }
    }
  } catch {
    /* ignore */
  }
}
