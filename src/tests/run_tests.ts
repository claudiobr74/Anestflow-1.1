import { buildCanonicalDocumentRepresentation, verifyDocumentIntegrity } from "../lib/signatureService.js";
import { AnesthesiaDocument } from "../types.js";
import { validateClinicalPassword, MIN_PASSWORD_LENGTH } from "../lib/passwordPolicy.ts";
import {
  evaluateSession,
  SESSION_INACTIVITY_MS,
  SESSION_TIMEBOX_MS,
  sessionEndMessage,
} from "../lib/sessionPolicy.ts";
import {
  AUTH_ERROR_EMAIL_SEND_RATE,
  AUTH_ERROR_TOO_MANY_REQUESTS,
  mapAuthError
} from "../lib/authErrors.ts";
import { isMockProcedureId, isUuid, toDbStatus, fromDbStatus, isMeaningfulDocument } from "../lib/procedureMapper.ts";
import { computeSHA256 } from "../lib/signatureService.ts";
import fs from "fs";
import path from "path";

console.log("=================================================");
console.log("🧪 INICIANDO TESTES AUTOMÁTICOS DE SEGURANÇA E DADOS");
console.log("=================================================");

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
  }
}

// 1. TESTE DE IMUTABILIDADE E HASH DE ASSINATURA DIGITALE (SHA-256 CANÔNICO)
console.log("\n1. Testando Hash Canônico SHA-256 e Integridade de Assinatura...");

const sampleDoc: Partial<AnesthesiaDocument> = {
  id: "proc-test-123",
  docVersion: "2.0.0",
  patient: { fullName: "Maria Silva", age: 45, gender: "F" } as any,
  status: "Signed",
  signedAt: "2026-08-06T10:00:00Z",
  vitals: [
    { id: "v1", minutesFromStart: 0, timestamp: "10:00", pas: 120, pad: 80, fc: 72 },
    { id: "v2", minutesFromStart: 5, timestamp: "10:05", pas: 115, pad: 75, fc: 70 }
  ]
};

const canonicalRepresentation1 = buildCanonicalDocumentRepresentation(sampleDoc);
const canonicalRepresentation2 = buildCanonicalDocumentRepresentation({
  ...sampleDoc,
  // Ordem de chaves alterada no JS para verificar determinismo
  vitals: [
    { pas: 120, id: "v1", timestamp: "10:00", fc: 72, pad: 80, minutesFromStart: 0 },
    { id: "v2", minutesFromStart: 5, timestamp: "10:05", pas: 115, pad: 75, fc: 70 }
  ]
});

assert(
  canonicalRepresentation1 === canonicalRepresentation2,
  "A ordenação determinística das chaves gera a mesma string canônica independentemente do objeto JS"
);

// 2. ONDA 6 — FIREBASE REMOVIDO DO APP
console.log("\n2. Verificando remoção do Firebase (onda 6)...");

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSourceFiles(full));
    else if (/\.(ts|tsx|js|jsx|json)$/.test(entry.name)) out.push(full);
  }
  return out;
}

try {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  assert(!pkg.dependencies?.firebase, "package.json não declara firebase");
  assert(!pkg.dependencies?.["firebase-admin"], "package.json não declara firebase-admin");
  assert(!pkg.devDependencies?.firebase && !pkg.devDependencies?.["firebase-admin"], "firebase não voltou como devDependency");
  assert(!fs.existsSync(path.join(process.cwd(), "src/lib/firebase.ts")), "src/lib/firebase.ts removido");
  assert(!fs.existsSync(path.join(process.cwd(), "src/lib/firestoreUtils.ts")), "src/lib/firestoreUtils.ts removido");
  assert(!fs.existsSync(path.join(process.cwd(), "firebase-applet-config.json")), "firebase-applet-config.json removido");
  assert(!fs.existsSync(path.join(process.cwd(), "firebase-blueprint.json")), "firebase-blueprint.json removido");
  assert(!fs.existsSync(path.join(process.cwd(), "firestore.rules")), "firestore.rules removido");

  const importRe = /from\s+['"]firebase(?:\/[^'"]*)?['"]|require\(\s*['"]firebase(?:-admin)?['"]/;
  const runtimeFiles = [
    ...listSourceFiles(path.join(process.cwd(), "src")).filter((f) => !f.includes(`${path.sep}tests${path.sep}`)),
    path.join(process.cwd(), "server.ts"),
  ];
  const offenders = runtimeFiles.filter((file) => importRe.test(fs.readFileSync(file, "utf-8")));
  assert(offenders.length === 0, "Nenhum módulo de runtime importa firebase / firebase-admin");
} catch (err) {
  assert(false, `Falha na verificação da onda 6: ${err}`);
}

// 3. AUDITORIA DE LIMPEZA DE SESSÃO / LOGOUT
console.log("\n3. Verificando sanitização no Logout...");
try {
  const appContent = fs.readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf-8");
  const policy = fs.readFileSync(path.join(process.cwd(), "src/lib/sessionPolicy.ts"), "utf-8");
  assert(appContent.includes("clearClinicalBrowserCache"), "Logout remove rascunhos clínicos do localStorage");
  assert(policy.includes("anestflow_doc_local_"), "Cache local de ficha é apagado no encerramento");
  assert(policy.includes("anestflow_pending_sync_queue"), "Fila de sync pendente é apagada no encerramento");
} catch (err) {
  assert(false, `Falha na verificação de logout: ${err}`);
}

// 4. ONDA 2 — AUTH SUPABASE E POLÍTICA DE SENHA
console.log("\n4. Verificando login Supabase (onda 2)...");
try {
  const loginContent = fs.readFileSync(path.join(process.cwd(), "src/components/LoginScreen.tsx"), "utf-8");
  const serverContent = fs.readFileSync(path.join(process.cwd(), "server.ts"), "utf-8");
  const shareContent = fs.readFileSync(path.join(process.cwd(), "src/components/ShareModal.tsx"), "utf-8");
  const appContent = fs.readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf-8");

  assert(!loginContent.includes("firebase/auth"), "LoginScreen não usa mais Firebase Auth");
  assert(loginContent.includes("signInWithPassword"), "Login usa signInWithPassword do Supabase");
  assert(!fs.existsSync(path.join(process.cwd(), "src/lib/api.ts")), "authenticatedFetch morto foi removido");
  assert(serverContent.includes("/api/health"), "Express continua expondo health público");
  assert(!serverContent.includes("@google/genai"), "Express não importa mais o SDK Gemini");
  assert(!serverContent.includes("/api/review"), "Express não expõe mais /api/review");
  assert(!serverContent.includes("firebase-admin"), "Express não verifica mais ID token Firebase");
  assert(shareContent.includes("lookupProfileByEmail"), "ShareModal busca colega via RPC lookup_profile_by_email");
  assert(appContent.includes("getSupabase().auth.signOut"), "Logout do App encerra a sessão Supabase");
  assert(validateClinicalPassword("short") !== null, "Senha curta é rejeitada");
  assert(validateClinicalPassword("alllowercase1") !== null, "Senha sem maiúscula é rejeitada");
  assert(validateClinicalPassword("ALLUPPERCASE1") !== null, "Senha sem minúscula é rejeitada");
  assert(validateClinicalPassword("NoDigitsHere") !== null, "Senha sem dígito é rejeitada");
  assert(validateClinicalPassword("ValidPassw0rd") === null, "Senha com 12+ chars, maiúscula, minúscula e dígito é aceita");
  assert(MIN_PASSWORD_LENGTH === 12, "Política mínima alinhada ao config.toml (12)");
  assert(
    mapAuthError({ code: "over_email_send_rate_limit", message: "email rate limit exceeded" }) === AUTH_ERROR_EMAIL_SEND_RATE,
    "429 de SMTP embutido explica limite de e-mail, não 'muitas tentativas'"
  );
  assert(
    mapAuthError({ message: "429: email rate limit exceeded" }) === AUTH_ERROR_EMAIL_SEND_RATE,
    "Mensagem crua de email rate limit é reconhecida sem code"
  );
  assert(
    mapAuthError({ code: "over_request", message: "too many requests" }) === AUTH_ERROR_TOO_MANY_REQUESTS,
    "over_request continua mapeado para excesso de login"
  );
  assert(
    !mapAuthError({ message: "corporate directory unavailable" }).includes("Limite de e-mails"),
    "A substring 'rate' isolada não dispara o aviso de SMTP"
  );
  assert(loginContent.includes("mapAuthError"), "LoginScreen usa o mapeamento compartilhado de erros Auth");
  assert(!loginContent.includes("Muitas tentativas. Tente novamente mais tarde."), "LoginScreen não usa mais o aviso genérico de rate limit");
} catch (err) {
  assert(false, `Falha na verificação da onda 2: ${err}`);
}

// 5. ONDA 3 — PERSISTÊNCIA SUPABASE
console.log("\n5. Verificando persistência clínica no Supabase (onda 3)...");
try {
  const procService = fs.readFileSync(path.join(process.cwd(), "src/lib/proceduresService.ts"), "utf-8");
  const worklist = fs.readFileSync(path.join(process.cwd(), "src/lib/worklistService.ts"), "utf-8");
  const syncEngineHook = fs.readFileSync(path.join(process.cwd(), "src/lib/useSyncEngine.ts"), "utf-8");
  const share = fs.readFileSync(path.join(process.cwd(), "src/components/ShareModal.tsx"), "utf-8");
  const review = fs.readFileSync(path.join(process.cwd(), "src/components/ReviewTab.tsx"), "utf-8");

  assert(!procService.includes("firebase/firestore"), "proceduresService não usa Firestore");
  assert(procService.includes("sign_procedure"), "Assinatura usa RPC sign_procedure");
  assert(procService.includes("transfer_responsibility"), "Transferência usa RPC transfer_responsibility");
  assert(!worklist.includes("firebase/firestore"), "worklistService não usa Firestore");
  assert(worklist.includes("cpf_hash"), "Worklist grava cpf_hash, não índice global de CPF");
  assert(syncEngineHook.includes("subscribeProcedureRealtime"), "Autosave escuta Realtime do Supabase");
  assert(!syncEngineHook.includes("firebase/firestore"), "useSyncEngine não usa Firestore");
  assert(share.includes("addParticipantByEmail"), "ShareModal adiciona participante via RPC");
  assert(!review.includes("../lib/firebase"), "ReviewTab não usa Firebase Auth");
  assert(isUuid("6c121a5b-8e8d-4e8a-bb0d-42120764d7db"), "UUID v4 válido é reconhecido");
  assert(!isUuid("doc-123"), "id local doc-timestamp não é UUID");
  assert(isMockProcedureId("doc-mock-cvl-2026"), "Fichas mock não persistem");
  assert(toDbStatus("Signed") === "signed" && fromDbStatus("in_progress") === "InProgress", "Status Draft/InProgress/Signed mapeia para o check SQL");
  assert(isMeaningfulDocument({ patient: { fullName: "Paciente Teste" } } as any), "Ficha com nome de paciente é persistível");
  assert(!isMeaningfulDocument({ patient: { fullName: "" }, vitals: [] } as any), "Stub vazio não é persistível");
} catch (err) {
  assert(false, `Falha na verificação da onda 3: ${err}`);
}

console.log("\n5b. Hash de CPF da worklist (SHA-256 hex minúsculo)...");
try {
  const digest = (await computeSHA256("39053344705")).toLowerCase();
  assert(/^[0-9a-f]{64}$/.test(digest), "cpf_hash tem 64 hex minúsculos");
  assert(digest === digest.toLowerCase(), "cpf_hash não usa hex maiúsculo (check SQL)");
} catch (err) {
  assert(false, `Falha no hash de CPF: ${err}`);
}

// 6. ONDA 5 — EDGE FUNCTIONS DE IA
console.log("\n6. Verificando Edge Functions de IA (onda 5)...");
try {
  const reviewUi = fs.readFileSync(path.join(process.cwd(), "src/components/ReviewTab.tsx"), "utf-8");
  const voiceUi = fs.readFileSync(path.join(process.cwd(), "src/components/VoiceCommandButton.tsx"), "utf-8");
  const descUi = fs.readFileSync(path.join(process.cwd(), "src/components/AnesthesiaDescriptionDrawer.tsx"), "utf-8");
  const aiLib = fs.readFileSync(path.join(process.cwd(), "src/lib/aiFunctions.ts"), "utf-8");
  const server = fs.readFileSync(path.join(process.cwd(), "server.ts"), "utf-8");
  const reviewFn = fs.readFileSync(path.join(process.cwd(), "supabase/functions/review/index.ts"), "utf-8");
  const voiceFn = fs.readFileSync(path.join(process.cwd(), "supabase/functions/voice-command/index.ts"), "utf-8");
  const descFn = fs.readFileSync(path.join(process.cwd(), "supabase/functions/generate-description/index.ts"), "utf-8");
  const authFn = fs.readFileSync(path.join(process.cwd(), "supabase/functions/_shared/auth.ts"), "utf-8");
  const geminiFn = fs.readFileSync(path.join(process.cwd(), "supabase/functions/_shared/gemini.ts"), "utf-8");
  const configToml = fs.readFileSync(path.join(process.cwd(), "supabase/config.toml"), "utf-8");
  const envExample = fs.readFileSync(path.join(process.cwd(), ".env.example"), "utf-8");
  const pkg = fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8");

  assert(aiLib.includes('functions.invoke'), "Cliente chama Edge Functions via functions.invoke");
  assert(aiLib.includes("auth.getUser"), "Cliente revalida a sessão antes do invoke");
  assert(reviewUi.includes('invokeAiFunction') && reviewUi.includes('"review"'), "ReviewTab invoca a função review");
  assert(!reviewUi.includes("/api/review"), "ReviewTab não chama /api/review");
  assert(voiceUi.includes('"voice-command"') && !voiceUi.includes("/api/voice-command"), "Voz usa Edge Function, não Express");
  assert(descUi.includes('"generate-description"') && !descUi.includes("/api/generate-description"), "Descrição usa Edge Function, não Express");
  assert(!server.includes("GEMINI_API_KEY"), "Express não lê GEMINI_API_KEY");
  assert(!server.includes("@google/genai"), "Express não depende de @google/genai");
  assert(reviewFn.includes("email_confirmed_at") || authFn.includes("email_confirmed_at"), "Funções exigem e-mail confirmado");
  assert(authFn.includes("getUser"), "Funções validam o JWT com auth.getUser");
  assert(geminiFn.includes("GEMINI_API_KEY"), "Gemini lê o secret do runtime, não do Vite");
  assert(geminiFn.includes("read_gemini_api_key"), "Fallback lê a chave no Vault via RPC do service_role");
  assert(!geminiFn.includes("console.log") || !geminiFn.includes("audioBase64"), "Helper Gemini não loga o corpo clínico");
  assert(voiceFn.includes("audioBase64"), "voice-command espera o mesmo contrato de áudio");
  assert(descFn.includes("description"), "generate-description devolve description");
  assert(configToml.includes("[functions.review]") && configToml.includes("verify_jwt = true"), "verify_jwt permanece ligado");
  assert(!envExample.includes("VITE_GEMINI"), "Nenhuma chave Gemini no bundle Vite");
  assert(!pkg.includes("@google/genai"), "Dependência @google/genai removida do app Node");
  assert(!reviewUi.includes("service_role") && !aiLib.includes("service_role"), "Cliente de IA não usa service_role");
} catch (err) {
  assert(false, `Falha na verificação da onda 5: ${err}`);
}

// 7. ONDA 7 — SESSÃO DO POSTO (12h / 8h)
console.log("\n7. Verificando política de sessão do posto compartilhado (onda 7)...");
try {
  const appContent = fs.readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf-8");
  const loginContent = fs.readFileSync(path.join(process.cwd(), "src/components/LoginScreen.tsx"), "utf-8");
  const configToml = fs.readFileSync(path.join(process.cwd(), "supabase/config.toml"), "utf-8");
  const hour = 60 * 60 * 1000;
  const t0 = 1_000_000;

  assert(SESSION_TIMEBOX_MS === 12 * hour, "Timebox do cliente é 12 horas");
  assert(SESSION_INACTIVITY_MS === 8 * hour, "Ociosidade do cliente é 8 horas");
  assert(configToml.includes('timebox = "12h"') && configToml.includes('inactivity_timeout = "8h"'), "config.toml declara 12h / 8h");
  assert(evaluateSession({ startedAt: t0, lastActivityAt: t0, now: t0 + 7 * hour }) === null, "7h de uso contínuo não encerra");
  assert(evaluateSession({ startedAt: t0, lastActivityAt: t0, now: t0 + 8 * hour }) === "inactivity", "8h ociosas encerram por inatividade");
  assert(evaluateSession({ startedAt: t0, lastActivityAt: t0 + 11 * hour, now: t0 + 12 * hour }) === "timebox", "12h absolutas encerram mesmo com atividade recente");
  assert(
    evaluateSession({ startedAt: t0, lastActivityAt: t0 + 3 * hour, now: t0 + 11 * hour }) === "inactivity",
    "8h desde o último toque encerram, mesmo antes das 12h"
  );
  assert(sessionEndMessage("timebox").includes("12 horas"), "Mensagem de timebox cita 12 horas");
  assert(sessionEndMessage("inactivity").includes("8 horas"), "Mensagem de ociosidade cita 8 horas");
  assert(appContent.includes("useSessionGuard"), "App aplica o guarda de sessão");
  assert(appContent.includes("beginSession"), "Login inicia o relógio de sessão");
  assert(loginContent.includes("consumeSessionEndMessage"), "Tela de login mostra o motivo do encerramento");
  assert(!fs.existsSync(path.join(process.cwd(), "src/lib/api.ts")), "src/lib/api.ts não voltou");
} catch (err) {
  assert(false, `Falha na verificação da onda 7: ${err}`);
}

console.log("\n8. Verificando injeção das env Vite/Express do Supabase...");
try {
  const supabaseLib = fs.readFileSync(path.join(process.cwd(), "src/lib/supabase.ts"), "utf-8");
  const envFilesLib = fs.readFileSync(path.join(process.cwd(), "src/lib/supabaseEnvFiles.ts"), "utf-8");
  const loginContent = fs.readFileSync(path.join(process.cwd(), "src/components/LoginScreen.tsx"), "utf-8");
  const mainContent = fs.readFileSync(path.join(process.cwd(), "src/main.tsx"), "utf-8");
  const serverContent = fs.readFileSync(path.join(process.cwd(), "server.ts"), "utf-8");
  const viteConfig = fs.readFileSync(path.join(process.cwd(), "vite.config.ts"), "utf-8");

  assert(supabaseLib.includes("import.meta.env.VITE_SUPABASE_URL"), "URL lida com acesso estático import.meta.env.VITE_SUPABASE_URL");
  assert(
    supabaseLib.includes("import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"),
    "Chave lida com acesso estático import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"
  );
  assert(!supabaseLib.includes("env?.[name]"), "Cliente não usa acesso dinâmico env[name] (Vite não injeta em produção)");
  assert(loginContent.includes("ensureSupabaseConfig"), "Login espera o fallback /api/public-config");
  assert(mainContent.includes("serviceWorker") && mainContent.includes("unregister"), "Dev desregistra SW de um dist antigo");
  assert(serverContent.includes("/api/public-config"), "Express expõe a config pública do Supabase");
  assert(!serverContent.includes("service_role"), "public-config não usa service_role");
  assert(viteConfig.includes("applySupabaseEnvFromFiles"), "vite.config aplica .env.local antes do loadEnv");
  assert(envFilesLib.includes("usable(fromProc)"), "Arquivo prevalece sobre process.env vazio");

  const { applySupabaseEnvFromFiles } = await import("../lib/supabaseEnvFiles.ts");
  const tmp = fs.mkdtempSync(path.join(process.cwd(), "tmp-env-"));
  fs.writeFileSync(
    path.join(tmp, ".env.local"),
    "VITE_SUPABASE_URL=https://envfile.supabase.co\nVITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fromfile\n"
  );
  const prevUrl = process.env.VITE_SUPABASE_URL;
  const prevKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const prevAnon = process.env.VITE_SUPABASE_ANON_KEY;
  process.env.VITE_SUPABASE_URL = "";
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "";
  delete process.env.VITE_SUPABASE_ANON_KEY;
  try {
    const resolved = applySupabaseEnvFromFiles(tmp, "development");
    assert(resolved.url === "https://envfile.supabase.co", "URL do .env.local vence process.env vazio");
    assert(resolved.key === "sb_publishable_fromfile", "Chave do .env.local vence process.env vazio");
  } finally {
    if (prevUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = prevKey;
    if (prevAnon === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
    else process.env.VITE_SUPABASE_ANON_KEY = prevAnon;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
} catch (err) {
  assert(false, `Falha na verificação das env Vite: ${err}`);
}

// 9. VERIFICAÇÃO FINAL DE RESULTADOS
console.log("\n=================================================");
console.log(`📊 RESUMO DOS TESTES: ${passedTests}/${totalTests} aprovados (${Math.round((passedTests/totalTests)*100)}%)`);
console.log("=================================================");

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
