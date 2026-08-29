/**
 * Live check da onda 9: health + login + error boundary no bundle de entrada.
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { getSupabase } from "../lib/supabase.ts";

dotenv.config({ path: ".env.local" });

const url = process.env.VITE_SUPABASE_URL || "";
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const email = process.env.ONDA9_TEST_EMAIL || process.env.ONDA3_TEST_EMAIL || "";
const password = process.env.ONDA9_TEST_PASSWORD || process.env.ONDA3_TEST_PASSWORD || "";
const appOrigin = process.env.ONDA9_APP_ORIGIN || "http://127.0.0.1:3000";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

if (!url || !key || key.includes("xxxxxxxx")) fail("VITE_SUPABASE_URL / PUBLISHABLE_KEY ausentes");
if (!email || !password) fail("ONDA9_TEST_EMAIL / ONDA9_TEST_PASSWORD (ou ONDA3_*) ausentes");

const mainPath = path.join(process.cwd(), "src/main.tsx");
const main = fs.readFileSync(mainPath, "utf-8");
if (!main.includes("ClinicalErrorBoundary")) fail("main.tsx sem ClinicalErrorBoundary");

console.log("1) GET /api/health público");
const health = await fetch(`${appOrigin.replace(/\/$/, "")}/api/health`);
if (health.status !== 200) fail(`health esperado 200, veio ${health.status}`);
console.log("   200 ok");

console.log("2) login Supabase");
const supabase = getSupabase();
const { data: session, error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError || !session.user) fail(authError?.message || "login falhou");
console.log("   login ok", session.user.id);

await supabase.auth.signOut();
console.log("PASS onda 9 live");
