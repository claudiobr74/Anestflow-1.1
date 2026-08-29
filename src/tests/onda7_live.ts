/**
 * Live check da onda 7: health público + login Supabase.
 * A política 12h/8h é exercida nos testes estáticos e na UI (relógio adiantado).
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { getSupabase } from "../lib/supabase.ts";
import { evaluateSession, SESSION_INACTIVITY_MS, SESSION_TIMEBOX_MS } from "../lib/sessionPolicy.ts";

dotenv.config({ path: ".env.local" });

const url = process.env.VITE_SUPABASE_URL || "";
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const email = process.env.ONDA7_TEST_EMAIL || process.env.ONDA3_TEST_EMAIL || "";
const password = process.env.ONDA7_TEST_PASSWORD || process.env.ONDA3_TEST_PASSWORD || "";
const appOrigin = process.env.ONDA7_APP_ORIGIN || "http://127.0.0.1:3000";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

if (!url || !key || key.includes("xxxxxxxx")) fail("VITE_SUPABASE_URL / PUBLISHABLE_KEY ausentes");
if (!email || !password) fail("ONDA7_TEST_EMAIL / ONDA7_TEST_PASSWORD (ou ONDA3_*) ausentes");

if (fs.existsSync(path.join(process.cwd(), "src/lib/api.ts"))) fail("src/lib/api.ts deveria ter sido removido");

const hour = 60 * 60 * 1000;
if (SESSION_TIMEBOX_MS !== 12 * hour || SESSION_INACTIVITY_MS !== 8 * hour) {
  fail("constantes de sessão divergem de 12h/8h");
}
const t0 = 5_000_000;
if (evaluateSession({ startedAt: t0, lastActivityAt: t0, now: t0 + 8 * hour }) !== "inactivity") {
  fail("evaluateSession deveria marcar inatividade em 8h");
}

console.log("1) GET /api/health público");
const health = await fetch(`${appOrigin.replace(/\/$/, "")}/api/health`);
if (health.status !== 200) fail(`health esperado 200, veio ${health.status}`);
const healthBody = await health.json() as { status?: string };
if (healthBody.status !== "ok") fail("health.status != ok");
console.log("   200 ok");

console.log("2) login Supabase");
const supabase = getSupabase();
const { data: session, error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError || !session.user) fail(authError?.message || "login falhou");
console.log("   login ok", session.user.id);

await supabase.auth.signOut();
console.log("PASS onda 7 live");
