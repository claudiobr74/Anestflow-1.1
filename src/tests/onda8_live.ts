/**
 * Live check da onda 8: health + login (o toggle HIBP é do Dashboard).
 * Não tenta cadastrar senha vazada — isso consome a cota de e-mail.
 */
import dotenv from "dotenv";
import { getSupabase } from "../lib/supabase.ts";
import { AUTH_ERROR_LEAKED_PASSWORD, mapAuthError } from "../lib/authErrors.ts";

dotenv.config({ path: ".env.local" });

const url = process.env.VITE_SUPABASE_URL || "";
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const email = process.env.ONDA8_TEST_EMAIL || process.env.ONDA3_TEST_EMAIL || "";
const password = process.env.ONDA8_TEST_PASSWORD || process.env.ONDA3_TEST_PASSWORD || "";
const appOrigin = process.env.ONDA8_APP_ORIGIN || "http://127.0.0.1:3000";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

if (!url || !key || key.includes("xxxxxxxx")) fail("VITE_SUPABASE_URL / PUBLISHABLE_KEY ausentes");
if (!email || !password) fail("ONDA8_TEST_EMAIL / ONDA8_TEST_PASSWORD (ou ONDA3_*) ausentes");

if (mapAuthError({ code: "weak_password", reasons: ["pwned"] }) !== AUTH_ERROR_LEAKED_PASSWORD) {
  fail("mapAuthError deveria traduzir reasons pwned");
}

console.log("1) GET /api/health público");
const health = await fetch(`${appOrigin.replace(/\/$/, "")}/api/health`);
if (health.status !== 200) fail(`health esperado 200, veio ${health.status}`);
const healthBody = await health.json() as { status?: string };
if (healthBody.status !== "ok") fail("health.status != ok");
console.log("   200 ok");

console.log("2) login Supabase (senha atual do usuário de teste)");
const supabase = getSupabase();
const { data: session, error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError || !session.user) fail(authError?.message || "login falhou");
console.log("   login ok", session.user.id);

await supabase.auth.signOut();
console.log("PASS onda 8 live");
