import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
import { CANONICAL_SUPABASE_URL, CANONICAL_SUPABASE_PUBLISHABLE_KEY } from "./supabaseProject";

export { CANONICAL_SUPABASE_URL, CANONICAL_SUPABASE_PUBLISHABLE_KEY };

const KEYS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_ANON_KEY"
] as const;

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  return dotenv.parse(fs.readFileSync(filePath));
}

function usable(value: string | undefined): boolean {
  const trimmed = (value ?? "").trim();
  return Boolean(trimmed) && !trimmed.includes("xxxxxxxx");
}

/**
 * Vite's loadEnv copies process.env over file values, including empty strings.
 * An empty VITE_SUPABASE_* in the shell therefore hides a filled .env.local.
 * Fill those keys from env files when process.env is empty/placeholder, then
 * Vite's config.env (and the browser import.meta.env object) see the real values.
 */
export function applySupabaseEnvFromFiles(
  cwd = process.cwd(),
  mode = process.env.NODE_ENV === "production" ? "production" : "development"
): { url: string; key: string } {
  const merged: Record<string, string> = {};
  for (const file of [
    path.join(cwd, ".env"),
    path.join(cwd, ".env.local"),
    path.join(cwd, `.env.${mode}`),
    path.join(cwd, `.env.${mode}.local`)
  ]) {
    Object.assign(merged, parseEnvFile(file));
  }

  for (const key of KEYS) {
    const fromProc = (process.env[key] ?? "").trim();
    const fromFile = (merged[key] ?? "").trim();
    const chosen = usable(fromProc) ? fromProc : fromFile || fromProc;
    if (chosen) process.env[key] = chosen;
  }

  if (!usable(process.env.VITE_SUPABASE_URL) && !(process.env.VITE_SUPABASE_URL || "").trim()) {
    process.env.VITE_SUPABASE_URL = CANONICAL_SUPABASE_URL;
  }
  if (!usable(process.env.VITE_SUPABASE_PUBLISHABLE_KEY) && !usable(process.env.VITE_SUPABASE_ANON_KEY)) {
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = CANONICAL_SUPABASE_PUBLISHABLE_KEY;
  }

  const url = (process.env.VITE_SUPABASE_URL || "").trim();
  const key = (
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  return { url, key };
}

export function describeSupabaseEnvPresence(url: string, key: string): string {
  const urlState = url ? "ok" : "ausente";
  let keyState = "ausente";
  if (key) keyState = key.includes("xxxxxxxx") ? "placeholder" : "ok";
  return `[env] Supabase URL ${urlState}; publishable key ${keyState}`;
}
