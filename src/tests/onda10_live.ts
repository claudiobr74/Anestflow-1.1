/**
 * Live da onda 10: health + HIBP k-anonymity com senha já vazada.
 * Não chama signUp — não gasta a cota de e-mail.
 */
import dotenv from "dotenv";
import { AUTH_ERROR_LEAKED_PASSWORD } from "../lib/authErrors.ts";
import { checkLeakedPassword, sha1HexUpper } from "../lib/leakedPassword.ts";

dotenv.config({ path: ".env.local" });

const appOrigin = process.env.ONDA10_APP_ORIGIN || "http://127.0.0.1:3000";
const knownPwned = "Password1234";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

console.log("1) GET /api/health público");
const health = await fetch(`${appOrigin.replace(/\/$/, "")}/api/health`);
if (health.status !== 200) fail(`health esperado 200, veio ${health.status}`);
const healthBody = await health.json() as { status?: string };
if (healthBody.status !== "ok") fail("health.status != ok");
console.log("   200 ok");

console.log("2) SHA-1 + range HIBP (k-anonymity)");
const hash = await sha1HexUpper(knownPwned);
const prefix = hash.slice(0, 5);
const suffix = hash.slice(5);
const range = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
  headers: { "Add-Padding": "true" },
});
if (!range.ok) fail(`HIBP range HTTP ${range.status}`);
const body = await range.text();
if (body.toUpperCase().includes(hash)) fail("resposta do HIBP não deveria ecoar o SHA-1 completo");
if (!body.toUpperCase().includes(suffix)) fail("range HIBP não trouxe o suffix da amostra vazada");
console.log("   range ok prefix", prefix);

console.log("3) checkLeakedPassword recusa a amostra vazada");
const result = await checkLeakedPassword(knownPwned);
if (!result.checked) fail("HIBP deveria ter respondido");
if (!result.leaked) fail("amostra conhecida como vazada não foi detectada");
if (!AUTH_ERROR_LEAKED_PASSWORD.includes("HaveIBeenPwned")) fail("mensagem de senha vazada ausente");
console.log("   leaked ok");

console.log("PASS onda 10 live");
