/**
 * Live check da onda 6: Firebase fora do runtime, Auth continua no Supabase.
 * Não copia PHI de produção.
 *
 * Uso: env de .env.local + ONDA6_TEST_EMAIL/PASSWORD (fallback ONDA3_*).
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { getSupabase } from "../lib/supabase.ts";

dotenv.config({ path: ".env.local" });

const url = process.env.VITE_SUPABASE_URL || "";
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const email = process.env.ONDA6_TEST_EMAIL || process.env.ONDA3_TEST_EMAIL || "";
const password = process.env.ONDA6_TEST_PASSWORD || process.env.ONDA3_TEST_PASSWORD || "";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

if (!url || !key || key.includes("xxxxxxxx")) fail("VITE_SUPABASE_URL / PUBLISHABLE_KEY ausentes");
if (!email || !password) fail("ONDA6_TEST_EMAIL / ONDA6_TEST_PASSWORD (ou ONDA3_*) ausentes");

console.log("1) artefatos Firebase ausentes no working tree");
for (const rel of [
  "src/lib/firebase.ts",
  "src/lib/firestoreUtils.ts",
  "firebase-applet-config.json",
  "firebase-blueprint.json",
  "firestore.rules",
]) {
  if (fs.existsSync(path.join(process.cwd(), rel))) fail(`${rel} ainda existe`);
}
console.log("   ok");

console.log("2) login Supabase (sem Firebase Auth)");
const supabase = getSupabase();
const { data: session, error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError || !session.user) fail(authError?.message || "login falhou");
if (!session.user.email_confirmed_at) fail("usuário de teste sem e-mail confirmado");
console.log("   login ok", session.user.id);

const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("full_name")
  .eq("id", session.user.id)
  .maybeSingle();
if (profileError) fail(profileError.message);
if (!profile) fail("perfil da onda 2/3 ausente após remover Firebase");
console.log("   perfil ok");

await supabase.auth.signOut();
console.log("PASS onda 6 live");
