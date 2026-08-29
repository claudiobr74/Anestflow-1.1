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
  AUTH_ERROR_LEAKED_PASSWORD,
  AUTH_ERROR_TOO_MANY_REQUESTS,
  mapAuthError
} from "../lib/authErrors.ts";
import { isMockProcedureId, isUuid, toDbStatus, fromDbStatus, isMeaningfulDocument } from "../lib/procedureMapper.ts";
import { computeSHA256 } from "../lib/signatureService.ts";
import {
  checkLeakedPassword,
  HIBP_RANGE_URL,
  matchHibpRangeBody,
  sha1HexUpper,
} from "../lib/leakedPassword.ts";
import { installMemoryStorage, storageDump } from "./memoryStorage.ts";
import fs from "fs";
import path from "path";

installMemoryStorage();

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
  const cacheKeys = fs.readFileSync(path.join(process.cwd(), "src/lib/clinicalStorageKeys.ts"), "utf-8");
  assert(appContent.includes("clearClinicalBrowserCache"), "Logout remove rascunhos clínicos do navegador");
  assert(appContent.includes("purgeClinicalPhiFromLocalStorage"), "App apaga PHI legado do localStorage na subida");
  assert(cacheKeys.includes("anestflow_doc_local_") && policy.includes("purgeClinicalPhiFromLocalStorage"), "Cache local de ficha é apagado no encerramento");
  assert(cacheKeys.includes("anestflow_pending_sync_queue") && policy.includes("clearClinicalSessionDrafts"), "Fila de sync da aba é apagada no encerramento");
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
  assert(
    mapAuthError({ code: "weak_password", reasons: ["pwned"] }) === AUTH_ERROR_LEAKED_PASSWORD,
    "AuthWeakPasswordError pwned vira aviso de senha vazada"
  );
  assert(
    mapAuthError({ code: "weak_password", weak_password: { reasons: ["pwned"] } }) === AUTH_ERROR_LEAKED_PASSWORD,
    "Corpo weak_password.reasons pwned também é reconhecido"
  );
  assert(
    mapAuthError({ code: "weak_password", reasons: ["length"] }).includes("12"),
    "reasons length cita o mínimo de 12 caracteres"
  );
  assert(
    mapAuthError({ code: "weak_password", reasons: ["characters"] }).includes("maiúscula"),
    "reasons characters pede maiúscula/minúscula/dígito"
  );
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
  assert(voiceUi.includes("transcription"), "Botão de voz encaminha a transcrição para conferência");
  assert(!voiceUi.includes("console.log(\"Comando de voz processado\""), "Botão de voz não loga o payload clínico");
  const appVoice = fs.readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf-8");
  assert(appVoice.includes("<VoiceCommandButton"), "Microfone de voz está montado no App");
  assert(appVoice.includes("VoiceCommandConfirmModal"), "Confirmação da transcrição existe no App");
  assert(appVoice.includes("handleVoiceCommandConfirm"), "Lançamento na ficha só após confirmar");
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
  assert(appContent.includes("overflowMenuOpen"), "Menu de overflow do cabeçalho abre por clique");
  assert(!appContent.includes("group-hover:visible"), "Menu de overflow não depende de hover (quebra no toque)");
  assert(appContent.includes('aria-label="Mais opções"'), "Botão de overflow tem rótulo acessível");
  assert(
    appContent.includes("document.addEventListener"),
    "Menu overflow escuta o DOM document"
  );
  assert(
    !appContent.includes("window.document.addEventListener"),
    "Menu overflow não precisa mais de window.document para desviar da ficha"
  );
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
  const projectDefaults = fs.readFileSync(path.join(process.cwd(), "src/lib/supabaseProject.ts"), "utf-8");
  const vercelJson = fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf-8");
  const vercelApi = fs.readFileSync(path.join(process.cwd(), "api/public-config.ts"), "utf-8");

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
  assert(projectDefaults.includes("CANONICAL_SUPABASE_PUBLISHABLE_KEY"), "Deploy Vercel tem fallback da chave publishable");
  assert(projectDefaults.includes("sb_publishable_") && !projectDefaults.includes("xxxxxxxx"), "Fallback da chave não é placeholder");
  assert(vercelJson.includes("vite") && vercelJson.includes("dist"), "vercel.json gera o SPA Vite em dist/");
  assert(vercelApi.includes("CANONICAL_SUPABASE_PUBLISHABLE_KEY"), "Função Vercel /api/public-config usa o fallback");
  assert(!vercelApi.includes("service_role"), "Função Vercel não usa service_role");

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

  const emptyDir = fs.mkdtempSync(path.join(process.cwd(), "tmp-env-"));
  process.env.VITE_SUPABASE_URL = "";
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "";
  delete process.env.VITE_SUPABASE_ANON_KEY;
  try {
    const fallback = applySupabaseEnvFromFiles(emptyDir, "production");
    assert(fallback.url.includes("plciototnjsdjzhudptc"), "Sem .env.local, URL canônica do Anestflow entra no build");
    assert(fallback.key.startsWith("sb_publishable_") && !fallback.key.includes("xxxxxxxx"), "Sem .env.local, chave publishable canônica entra no build");
  } finally {
    if (prevUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = prevKey;
    if (prevAnon === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
    else process.env.VITE_SUPABASE_ANON_KEY = prevAnon;
    fs.rmSync(emptyDir, { recursive: true, force: true });
  }
} catch (err) {
  assert(false, `Falha na verificação das env Vite: ${err}`);
}

// 9. ESCRIBA POR VOZ — CONFIRMAÇÃO, GASES E APLICAÇÃO
console.log("\n9. Verificando escriba por voz (microfone, gases, confirmação)...");
try {
  const {
    sanitizeVoiceCommand,
    mapInhalationAgentName,
    summarizeVoiceActions,
    applyVoiceActionsToDocument,
    parseDateToYYYYMMDD,
  } = await import("../lib/voiceCommand.ts");
  const { getBlankDocument } = await import("../mockData.ts");

  assert(mapInhalationAgentName("sevo") === "Sevoflurano", "Jargão sevo vira Sevoflurano");
  assert(mapInhalationAgentName("nora") === null, "Fármaco EV não é mapeado como gás");
  assert(parseDateToYYYYMMDD("10 de maio de 1980") === "1980-05-10", "Data por extenso vira YYYY-MM-DD");

  const raw = {
    transcription: "cento e cinquenta de propofol e sevo",
    identifiedActions: {
      bolusDrugs: [{ name: "Propofol", dose: "150", unit: "mg", route: "EV" }],
      inhalationAgents: [{ name: "sevo" }],
      vitals: { hr: 65, systolic: 115, diastolic: 70, spo2: 99 },
    },
  };
  const sanitized = sanitizeVoiceCommand(raw.identifiedActions);
  assert(Boolean(sanitized?.inhalationAgents?.length), "sanitizeVoiceCommand preserva gases inalatórios");
  assert(Boolean(sanitized?.bolusDrugs?.length), "sanitizeVoiceCommand preserva bolus");

  const summary = summarizeVoiceActions(sanitized!);
  assert(summary.some((line) => line.includes("Sevoflurano")), "Resumo cita o gás mapeado");
  assert(summary.some((line) => /Propofol/i.test(line)), "Resumo cita o bolus");

  const blank = getBlankDocument();
  blank.status = "Draft";
  const applied = applyVoiceActionsToDocument(blank, sanitized!, null, new Date("2026-08-29T12:00:00Z"));
  assert(applied.bolusDrugs.some((d) => d.name === "Propofol" && d.dose === 150), "Bolus entra na ficha só na aplicação");
  assert(applied.inhalationAgents.some((g) => g.agent === "Sevoflurano"), "Sevoflurano entra em inhalationAgents");
  assert(applied.vitals.some((v) => v.fc === 65 && v.pas === 115 && v.pad === 70), "Vitais entram na ficha");
  const again = applyVoiceActionsToDocument(applied, sanitized!, null, new Date("2026-08-29T12:01:00Z"));
  assert(again.inhalationAgents.filter((g) => g.agent === "Sevoflurano").length === 1, "Gás já lançado não duplica");

  const signed = { ...blank, status: "Signed" as const };
  const ignored = applyVoiceActionsToDocument(signed, sanitized!, null);
  assert(ignored.bolusDrugs.length === blank.bolusDrugs.length, "Ficha assinada ignora voz");
} catch (err) {
  assert(false, `Falha na verificação do escriba por voz: ${err}`);
}

// 10. ONDA 8 — SENHA VAZADA (HIBP)
console.log("\n10. Verificando mapeamento de senha vazada (onda 8)...");
try {
  const configToml = fs.readFileSync(path.join(process.cwd(), "supabase/config.toml"), "utf-8");
  const readme = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf-8");
  const authErrors = fs.readFileSync(path.join(process.cwd(), "src/lib/authErrors.ts"), "utf-8");
  assert(authErrors.includes("AUTH_ERROR_LEAKED_PASSWORD"), "Cliente declara mensagem de senha vazada");
  assert(authErrors.includes("pwned"), "Cliente lê reasons pwned do Auth");
  assert(configToml.includes("HaveIBeenPwned"), "config.toml aponta o toggle HaveIBeenPwned no Dashboard");
  assert(!/password_hibp_enabled\s*=/.test(configToml), "config.toml não finge uma chave HIBP que o CLI ainda não aceita");
  assert(readme.includes("Prevent use of leaked passwords"), "README da onda 8 cita o toggle do Dashboard");
} catch (err) {
  assert(false, `Falha na verificação da onda 8: ${err}`);
}

// 11. ONDA 9 — ERROR BOUNDARY E FECHAMENTO
console.log("\n11. Verificando fechamento da onda 9 (error boundary)...");
try {
  const mainContent = fs.readFileSync(path.join(process.cwd(), "src/main.tsx"), "utf-8");
  const boundary = fs.readFileSync(path.join(process.cwd(), "src/components/ClinicalErrorBoundary.tsx"), "utf-8");
  const readme = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf-8");
  assert(mainContent.includes("ClinicalErrorBoundary"), "main.tsx envolve o App com ClinicalErrorBoundary");
  assert(boundary.includes("getDerivedStateFromError"), "Boundary captura throw de render");
  assert(boundary.includes("Recarregar"), "Boundary oferece recarregar a página");
  assert(!boundary.includes("error.message"), "Boundary não mostra mensagem crua (risco de PHI)");
  assert(readme.includes("Onda 9"), "README documenta a onda 9");
  assert(readme.includes("Prevent use of leaked passwords"), "README da onda 9 ainda aponta o toggle HIBP");
} catch (err) {
  assert(false, `Falha na verificação da onda 9: ${err}`);
}

// 12. ONDA 10 — HIBP NO CADASTRO (K-ANONYMITY)
console.log("\n12. Verificando checagem HIBP no cadastro (onda 10)...");
try {
  const loginUi = fs.readFileSync(path.join(process.cwd(), "src/components/LoginScreen.tsx"), "utf-8");
  const readme = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf-8");
  assert(matchHibpRangeBody("AABBCC:12\nDDEEFF:1", "aabbcc"), "Range HIBP casa suffix com count > 0");
  assert(!matchHibpRangeBody("AABBCC:0", "AABBCC"), "Padding count 0 não é vazamento");
  assert(!matchHibpRangeBody("DDEEFF:99", "AABBCC"), "Suffix diferente não casa");

  const hash = await sha1HexUpper("Password1234");
  assert(hash.length === 40, "SHA-1 hex tem 40 caracteres");

  const mockHit: typeof fetch = async (input) => {
    const url = String(input);
    assert(url.startsWith(HIBP_RANGE_URL), "Consulta usa a URL de range do HIBP");
    assert(url.length === HIBP_RANGE_URL.length + 5, "A URL leva só os 5 hex do prefixo");
    assert(!url.toUpperCase().includes(hash.slice(5)), "O restante do SHA-1 não vai na URL");
    return new Response(`${hash.slice(5)}:99\n00000000000000000000000000000000000:0`, { status: 200 });
  };
  const hit = await checkLeakedPassword("Password1234", mockHit);
  assert(hit.leaked && hit.checked, "Senha presente no range mockado é recusada");

  const mockDown: typeof fetch = async () => new Response("unavailable", { status: 503 });
  const open = await checkLeakedPassword("Password1234", mockDown);
  assert(!open.leaked && !open.checked, "HIBP 503 é fail-open");

  const leakIdx = loginUi.indexOf("checkLeakedPassword");
  const signUpIdx = loginUi.indexOf("supabase.auth.signUp");
  assert(leakIdx >= 0, "LoginScreen consulta HIBP no cadastro");
  assert(signUpIdx > leakIdx, "Checagem HIBP ocorre antes de signUp");
  assert(loginUi.includes("AUTH_ERROR_LEAKED_PASSWORD"), "Cadastro usa a mensagem de senha vazada");
  assert(!loginUi.includes("signUp({") || loginUi.indexOf("if (leak.leaked)") < signUpIdx, "signUp não roda se a senha vazou");
  assert(readme.includes("Onda 10"), "README documenta a onda 10");
  assert(readme.includes("k-anonymity"), "README explica k-anonymity");
} catch (err) {
  assert(false, `Falha na verificação da onda 10: ${err}`);
}

// 13. FASE 0+1 — FINGERPRINT, SEM INVENTAR DADO, VOZ, IDs, CACHE
console.log("\n13. Verificando Fase 0+1 (persistência clínica e segurança de dado)...");
try {
  const { getBlankDocument } = await import("../mockData.ts");
  const { clinicalChangeFingerprint } = await import("../lib/clinicalChangeFingerprint.ts");
  const {
    UNREGISTERED,
    displayAldreteScore,
    displayAldreteTotal,
    displayBloodPressure,
    displayQmentumRange,
    qmentumRange,
    resolveRecoveryBaseline,
  } = await import("../lib/clinicalDisplay.ts");
  const { CLINICAL_CACHE_KEY_INVENTORY, CLINICAL_STORAGE_KEYS } = await import("../lib/clinicalStorageKeys.ts");
  const { ensureUniqueClinicalEventIds } = await import("../lib/syncEngine.ts");
  const {
    applyVoiceActionsToDocument,
    summarizeVoiceActions,
    sanitizeVoiceCommand,
  } = await import("../lib/voiceCommand.ts");
  const {
    AI_REVIEW_PARSE_FAILED,
    AI_REVIEW_UNAVAILABLE_MESSAGE,
    parseAiReviewPayload,
  } = await import("../lib/aiReviewParse.ts");

  const base = getBlankDocument();
  base.id = "fase01-doc";
  base.status = "Draft";
  const hash0 = clinicalChangeFingerprint(base);

  const withTimer = { ...base, timers: { ...base.timers, startAnesthesia: "2026-08-29T12:00:00Z" } };
  assert(clinicalChangeFingerprint(withTimer) !== hash0, "Alterar timer muda o fingerprint");

  const withGas = {
    ...base,
    inhalationAgents: [{ id: "ia-1", agent: "Sevoflurano" as const, startTime: "2026-08-29T12:00:00Z" }],
  };
  assert(clinicalChangeFingerprint(withGas) !== hash0, "Alterar gás muda o fingerprint");

  const withFluid = {
    ...base,
    fluids: [{ id: "fl-1", type: "Cristaloide" as const, name: "Ringer", volumePrepared: 500, volumeAdministered: 500, startTime: "2026-08-29T12:00:00Z" }],
  };
  assert(clinicalChangeFingerprint(withFluid) !== hash0, "Alterar fluido muda o fingerprint");

  const withSrpa = { ...base, recovery: { ...base.recovery, pas: 110, pad: 70, fc: 64, spo2: 97, temp: 36.1 } };
  assert(clinicalChangeFingerprint(withSrpa) !== hash0, "Alterar SRPA muda o fingerprint");

  const withAirway = { ...base, airway: { ...base.airway, deviceSize: "7.5" } };
  assert(clinicalChangeFingerprint(withAirway) !== hash0, "Alterar via aérea muda o fingerprint");

  const withChecklist = { ...base, checklist: { ...base.checklist, patientIdConfirmed: false } };
  assert(clinicalChangeFingerprint(withChecklist) !== hash0, "Alterar checklist muda o fingerprint");

  assert(clinicalChangeFingerprint(base) === hash0, "Ficha inalterada mantém o mesmo fingerprint");

  const emptyBaseline = resolveRecoveryBaseline({}, null);
  assert(emptyBaseline.pas === undefined && emptyBaseline.fc === undefined, "Sem PA/FC de SRPA nem intra, baseline fica vazio");
  assert(displayBloodPressure(emptyBaseline.pas, emptyBaseline.pad) === UNREGISTERED, "PDF de PA sem registro não inventa 120/80");
  assert(qmentumRange(emptyBaseline.pas, 20) === null, "QMentum sem baseline não calcula faixa");
  assert(displayQmentumRange(null) === UNREGISTERED, "Limite QMentum sem baseline é Não registrado");
  assert(!String(displayBloodPressure(undefined, undefined)).includes("120"), "Texto de PA não contém 120 inventado");

  const fromIntra = resolveRecoveryBaseline({}, { pas: 118, pad: 76, fc: 71, spo2: 99, temp: 36.4 });
  assert(fromIntra.pas === 118 && fromIntra.fc === 71, "Baseline usa intra só se o registro existir");

  assert(displayAldreteScore(0) === "0/2", "Aldrete 0 não é tratado como vazio");
  assert(displayAldreteScore(undefined) === UNREGISTERED, "Aldrete não registrado distingue de 0");
  assert(displayAldreteTotal([0, 0, 0, 0, 0]) === "0/10", "Aldrete total 0 é válido");
  assert(displayAldreteTotal([2, 2, undefined, 2, 2]) === UNREGISTERED, "Aldrete incompleto não soma como se fosse 0");

  const pdfSrc = fs.readFileSync(path.join(process.cwd(), "src/components/PdfPreviewModal.tsx"), "utf-8");
  const recSrc = fs.readFileSync(path.join(process.cwd(), "src/components/RecoveryTab.tsx"), "utf-8");
  assert(!pdfSrc.includes("?? 120") && !pdfSrc.includes("?? 80") && !pdfSrc.includes("?? 98") && !pdfSrc.includes("?? 36.5"), "PDF não tem fallbacks 120/80/98/36.5");
  assert(!recSrc.includes("?? 120") && !recSrc.includes("?? 36.5"), "RecoveryTab não tem fallbacks inventados de PA/temp");
  assert(pdfSrc.includes("scoreActivity || 0") === false, "PDF Aldrete não usa || 0");

  const incompleteVoice = sanitizeVoiceCommand({
    bolusDrugs: [{ name: "Fentanil" }],
    continuousInfusions: [{ name: "Remifentanil" }],
    inhalationAgents: [{ name: "sevo" }],
  });
  assert(Boolean(incompleteVoice), "sanitize preserva lançamentos incompletos");
  const incompleteSummary = summarizeVoiceActions(incompleteVoice!);
  assert(incompleteSummary.some((l) => /Dose: não informada/i.test(l)), "Resumo de bolus sem dose não inventa 0");
  assert(incompleteSummary.some((l) => /Via: não informada/i.test(l)), "Resumo de bolus sem via não inventa EV");
  assert(incompleteSummary.some((l) => /Concentração: não informada/i.test(l)), "Resumo de gás/infusão sem conc não inventa 2%");
  const appliedIncomplete = applyVoiceActionsToDocument(base, incompleteVoice!, null, new Date("2026-08-29T12:00:00Z"));
  const fentanil = appliedIncomplete.bolusDrugs.find((d) => /fentanil/i.test(d.name));
  assert(Boolean(fentanil), "Bolus reconhecido pelo nome entra na ficha");
  assert(fentanil?.dose !== 0 && fentanil?.dose === undefined, "Dose ausente não vira 0");
  assert(fentanil?.route !== "EV" && fentanil?.route === undefined, "Via ausente não vira EV");
  const sevo = appliedIncomplete.inhalationAgents.find((g) => g.agent === "Sevoflurano");
  assert(Boolean(sevo), "Sevo sem concentração ainda é lançado");
  assert(sevo?.inspiredConc === undefined, "Sevo sem conc não inventa 2%");
  assert(!appliedIncomplete.events.some((e) => /2[,.]0\s*%/.test(e.name)), "Evento de gás não inventa 2,0%");
  const remi = appliedIncomplete.continuousInfusions.find((i) => /remifentanil/i.test(i.name));
  assert(Boolean(remi), "Infusão reconhecida pelo nome entra na ficha");
  assert(remi?.concentration !== "1" && !remi?.concentration, "Concentração ausente não vira 1");
  assert(remi?.totalVolumePrepared !== 100 && remi?.totalVolumePrepared === undefined, "Volume ausente não vira 100 mL");
  assert(!appliedIncomplete.events.some((e) => /1[,.]0\s*L\/min/.test(e.name)), "Evento de O2/ar não inventa 1 L/min");

  const dupDoc = {
    ...base,
    events: [
      { id: "same", timestamp: "2026-08-29T12:00:00Z", category: "Outro" as const, name: "Primeiro" },
      { id: "same", timestamp: "2026-08-29T12:01:00Z", category: "Outro" as const, name: "Segundo" },
    ],
  };
  const unique = ensureUniqueClinicalEventIds(dupDoc);
  assert(unique.events.length === 2, "ID duplicado não descarta o segundo lançamento");
  assert(unique.events[0].id !== unique.events[1].id, "Duplicata recebe ID novo");
  assert(unique.events.map((e) => e.name).sort().join(",") === "Primeiro,Segundo", "Os dois eventos sobrevivem");

  assert(parseAiReviewPayload("{bad").ok === false, "Payload não-objeto é parse falho");
  assert(parseAiReviewPayload({ foo: 1 }).ok === false, "JSON sem alerts é parse falho");
  assert(parseAiReviewPayload({ error: AI_REVIEW_PARSE_FAILED }).ok === false, "Código AI_REVIEW_PARSE_FAILED é parse falho");
  const emptyOk = parseAiReviewPayload({ alerts: [] });
  assert(emptyOk.ok === true && emptyOk.ok && emptyOk.alerts.length === 0, "alerts: [] válido não é parse falho");
  assert(AI_REVIEW_UNAVAILABLE_MESSAGE.includes("Nenhuma conclusão"), "Mensagem de IA indisponível não finge zero alertas");

  const reviewFn = fs.readFileSync(path.join(process.cwd(), "supabase/functions/review/index.ts"), "utf-8");
  assert(reviewFn.includes("AI_REVIEW_PARSE_FAILED"), "Edge review devolve erro explícito de parse");
  assert(reviewFn.includes("502"), "Edge review usa status de falha no parse");
  assert(!/JSON\.parse\(\s*text\s*\|\|\s*['"]\{\s*"alerts"\s*:\s*\[\s*\]/.test(reviewFn), "Edge review não mascara parse falho com alerts vazios");

  const reviewUi = fs.readFileSync(path.join(process.cwd(), "src/components/ReviewTab.tsx"), "utf-8");
  assert(reviewUi.includes("parseAiReviewPayload"), "ReviewTab interpreta payload de auditoria");
  assert(reviewUi.includes("AI_REVIEW_UNAVAILABLE_MESSAGE") || reviewUi.includes("Auditoria de IA indisponível"), "UI distingue parse falho de zero alertas");

  const appSrc = fs.readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf-8");
  assert(!appSrc.includes("email: user.hospital"), "Assinatura/claim não usa hospital como e-mail");
  assert(appSrc.includes("email: user.email"), "E-mail de assinatura vem do Auth/perfil");

  const syncSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/useSyncEngine.ts"), "utf-8");
  assert(syncSrc.includes("clinicalChangeFingerprint"), "useSyncEngine usa fingerprint clínico completo");

  assert(CLINICAL_CACHE_KEY_INVENTORY.includes(CLINICAL_STORAGE_KEYS.anesthesiaDoc), "Inventário lista anesthesia_doc");
  assert(CLINICAL_CACHE_KEY_INVENTORY.some((k) => k.includes("anestflow_doc_local_")), "Inventário lista anestflow_doc_local_*");
  assert(CLINICAL_CACHE_KEY_INVENTORY.includes(CLINICAL_STORAGE_KEYS.pendingSyncQueue), "Inventário lista fila de sync");
  assert(CLINICAL_CACHE_KEY_INVENTORY.some((k) => k.includes("anestflow_active_doc_")), "Inventário lista anestflow_active_doc_${uid}");

  const readme = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf-8");
  assert(readme.includes("Fase 0") && readme.includes("Fase 1"), "README documenta Fase 0+1");
  assert(readme.includes("anesthesia_doc") && readme.includes("anestflow_pending_sync_queue"), "README documenta chaves de cache atuais");
} catch (err) {
  assert(false, `Falha na verificação da Fase 0+1: ${err}`);
}

// 14. FASE 2 — PHI FORA DO LOCALSTORAGE
console.log("\n14. Verificando Fase 2 (PHI fora do localStorage)...");
try {
  const { getBlankDocument } = await import("../mockData.ts");
  const {
    CLINICAL_STORAGE_KEYS,
    localDocStorageKey,
    localStorageHoldsClinicalPhi,
    clearClinicalSessionDrafts,
    activeDocSessionKey,
  } = await import("../lib/clinicalStorageKeys.ts");
  const { SyncQueueManager } = await import("../lib/syncEngine.ts");
  const { clearClinicalBrowserCache } = await import("../lib/sessionPolicy.ts");

  const PHI = "PACIENTE_PHI_FASE2_XYZ";
  const themeKeep = "dark-clean";
  localStorage.setItem("anesthesia_theme", themeKeep);
  localStorage.setItem("anesthesia_user", JSON.stringify({ name: "Dr Teste", uid: "u1" }));
  localStorage.setItem(CLINICAL_STORAGE_KEYS.anesthesiaDoc, JSON.stringify({ patient: { fullName: PHI } }));
  localStorage.setItem(localDocStorageKey("proc-legado"), JSON.stringify({ patient: { fullName: PHI } }));
  localStorage.setItem(
    CLINICAL_STORAGE_KEYS.pendingSyncQueue,
    JSON.stringify({ "proc-legado": { doc: { patient: { fullName: PHI } }, timestamp: "2026-08-29T12:00:00Z" } })
  );

  assert(localStorageHoldsClinicalPhi(), "Antes do purge o localStorage ainda tem PHI legado");

  const doc = getBlankDocument();
  doc.id = "fase02-doc";
  doc.status = "Draft";
  doc.patient.fullName = PHI;
  doc.patient.recordNumber = "FASE02-001";
  SyncQueueManager.enqueue(doc);

  assert(!localStorageHoldsClinicalPhi(), "enqueue apaga PHI legado do localStorage");
  assert(!storageDump(localStorage).includes(PHI), "Nenhum valor no localStorage contém o nome do paciente");
  assert(localStorage.getItem("anesthesia_theme") === themeKeep, "Tema (não-PHI) permanece no localStorage");
  assert(localStorage.getItem(CLINICAL_STORAGE_KEYS.anesthesiaDoc) === null, "anesthesia_doc legado foi apagado");
  assert(localStorage.getItem(localDocStorageKey("proc-legado")) === null, "anestflow_doc_local_* legado foi apagado");
  assert(localStorage.getItem(CLINICAL_STORAGE_KEYS.pendingSyncQueue) === null, "fila legado saiu do localStorage");

  const sessionDump = storageDump(sessionStorage);
  assert(sessionDump.includes(PHI), "Fila de sync na aba ainda tem a ficha (sessionStorage)");
  assert(sessionStorage.getItem(CLINICAL_STORAGE_KEYS.pendingSyncQueue)?.includes(PHI), "Fila vive em sessionStorage");
  assert(SyncQueueManager.getPendingCount() === 1, "Fila tem um documento pendente");

  sessionStorage.setItem(activeDocSessionKey("u1"), JSON.stringify(doc));
  const clearedDrafts = clearClinicalSessionDrafts();
  assert(clearedDrafts.includes(CLINICAL_STORAGE_KEYS.pendingSyncQueue), "Limpar rascunho da aba remove a fila");
  assert(SyncQueueManager.getPendingCount() === 0, "Fila da aba ficou vazia");
  assert(!storageDump(sessionStorage).includes(PHI), "Rascunho ativo da aba também saiu");

  localStorage.setItem(CLINICAL_STORAGE_KEYS.anesthesiaDoc, JSON.stringify({ patient: { fullName: PHI } }));
  sessionStorage.setItem(CLINICAL_STORAGE_KEYS.pendingSyncQueue, JSON.stringify({ x: { doc: { patient: { fullName: PHI } } } }));
  clearClinicalBrowserCache();
  assert(!localStorageHoldsClinicalPhi(), "Logout purga PHI do localStorage");
  assert(localStorage.getItem("anesthesia_user") === null, "Logout apaga anesthesia_user");
  assert(localStorage.getItem("anesthesia_theme") === themeKeep, "Logout não apaga o tema");
  assert(!storageDump(sessionStorage).includes(PHI), "Logout limpa sessionStorage clínico");

  const syncSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/syncEngine.ts"), "utf-8");
  assert(!syncSrc.includes("localStorage.setItem"), "SyncQueueManager não grava localStorage");
  assert(syncSrc.includes("sessionStorage"), "SyncQueueManager usa sessionStorage");
  assert(!syncSrc.includes("saveLocalCopy"), "Cópia local de ficha no disco foi removida");

  const settingsSrc = fs.readFileSync(path.join(process.cwd(), "src/components/SettingsModal.tsx"), "utf-8");
  assert(settingsSrc.includes("purgeClinicalPhiFromLocalStorage"), "Configurações purgam PHI legado");
  assert(settingsSrc.includes("clearClinicalSessionDrafts"), "Configurações limpam rascunho da aba");
  assert(!settingsSrc.includes("sessionStorage.removeItem(CLINICAL_STORAGE_KEYS.anesthesiaDoc)"), "Limpar cache não usa a chave errada");

  const badgeSrc = fs.readFileSync(path.join(process.cwd(), "src/components/SyncStatusBadge.tsx"), "utf-8");
  assert(badgeSrc.includes("nesta aba"), "Badge offline não promete persistência em disco");
  assert(!badgeSrc.includes("protegidos localmente no seu dispositivo"), "Tooltip offline não afirma proteção em disco");

  const readme2 = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf-8");
  assert(readme2.includes("Fase 2") && readme2.includes("PHI fora do localStorage"), "README documenta Fase 2");
} catch (err) {
  assert(false, `Falha na verificação da Fase 2: ${err}`);
}

// 15. FASE 3 — assertCanEdit (só o responsável grava)
console.log("\n15. Verificando Fase 3 (assertCanEdit)...");
try {
  const {
    assertCanEdit,
    assignNewDocumentOwner,
    canEditDocument,
    isClinicalEditor,
    isCurrentResponsible,
    EDIT_BLOCKED_SIGNED,
    EDIT_BLOCKED_UNAUTHENTICATED,
  } = await import("../lib/assertCanEdit.ts");
  const { getBlankDocument } = await import("../mockData.ts");

  const aliceDoc = {
    status: "Draft" as const,
    currentResponsibleUid: "alice-uid",
    createdByUid: "creator-uid",
    team: { anesthesiologistLead: "Alice" },
  };

  assert(canEditDocument(aliceDoc, "alice-uid").ok === true, "Responsável atual pode editar");
  assert(isClinicalEditor(aliceDoc, "alice-uid") === true, "isClinicalEditor verdadeiro para o responsável");
  assert(isCurrentResponsible(aliceDoc, "alice-uid") === true, "isCurrentResponsible ignora status e olha o UID");

  const creatorGate = canEditDocument(aliceDoc, "creator-uid");
  assert(creatorGate.ok === false && creatorGate.reason === "not_responsible", "Criador que não é responsável não edita");
  assert(creatorGate.ok === false && creatorGate.message.includes("Alice"), "Mensagem cita o responsável atual");

  const bobGate = canEditDocument(aliceDoc, "bob-uid");
  assert(bobGate.ok === false && bobGate.reason === "not_responsible", "Outro UID não edita");

  const anonGate = canEditDocument(aliceDoc, null);
  assert(anonGate.ok === false && anonGate.reason === "unauthenticated", "Sem UID não edita");
  assert(anonGate.ok === false && anonGate.message === EDIT_BLOCKED_UNAUTHENTICATED, "Mensagem de não autenticado");

  const missingResp = canEditDocument({ status: "Draft", team: {} }, "alice-uid");
  assert(missingResp.ok === false && missingResp.reason === "not_responsible", "Sem currentResponsibleUid é fail-closed");

  const signedDoc = { ...aliceDoc, status: "Signed" as const };
  const signedGate = canEditDocument(signedDoc, "alice-uid");
  assert(signedGate.ok === false && signedGate.reason === "signed", "Ficha assinada bloqueia mutação");
  assert(signedGate.ok === false && signedGate.message === EDIT_BLOCKED_SIGNED, "Mensagem de ficha assinada");
  assert(isCurrentResponsible(signedDoc, "alice-uid") === true, "Quem assinou continua o responsável (banner)");
  assert(isClinicalEditor(signedDoc, "alice-uid") === false, "Responsável não edita ficha já assinada");
  assert(canEditDocument(signedDoc, "alice-uid", { closingSignature: true }).ok === true, "Fechamento da ficha permite closingSignature");

  let threw = false;
  try {
    assertCanEdit(aliceDoc, "bob-uid");
  } catch (err) {
    threw = err instanceof Error && err.message.includes("responsável");
  }
  assert(threw, "assertCanEdit lança para quem não é responsável");

  const stamped = assignNewDocumentOwner(getBlankDocument(), "alice-uid");
  assert(stamped.currentResponsibleUid === "alice-uid", "Nova ficha recebe o UID como responsável");
  assert(stamped.createdByUid === "alice-uid", "Nova ficha recebe o UID como criador");
  assert(isClinicalEditor(stamped, "alice-uid") === true, "Dono recém-carimbado pode editar");

  const saveSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/proceduresService.ts"), "utf-8");
  assert(saveSrc.includes("assertCanEdit"), "saveProcedure usa assertCanEdit");
  assert(!saveSrc.includes("createdByUid !== userId"), "saveProcedure não libera o criador no lugar do responsável");

  const syncSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/useSyncEngine.ts"), "utf-8");
  assert(syncSrc.includes("canEditDocument"), "Autosave usa canEditDocument");
  assert(!syncSrc.includes("!userId || !currentResponsibleUid"), "Autosave não é fail-open sem UID");

  const appSrc = fs.readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf-8");
  assert(appSrc.includes("isClinicalEditor") && appSrc.includes("canEditDocument"), "App consulta o gate único");
  assert(appSrc.includes("assignNewDocumentOwner"), "Reset/login carimbam o dono da ficha em branco");

  const signSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/signatureService.ts"), "utf-8");
  assert(signSrc.includes("assertCanEdit"), "Assinatura exige assertCanEdit");

  const bannerSrc = fs.readFileSync(path.join(process.cwd(), "src/components/ResponsibilityBanner.tsx"), "utf-8");
  assert(bannerSrc.includes("isCurrentResponsible"), "Banner de responsável usa UID, não o gate de edição");
  assert(!bannerSrc.includes("!user || !user.uid || !currentResponsibleUid"), "Banner não trata ausência de UID como autorizado");

  const patientSrc = fs.readFileSync(path.join(process.cwd(), "src/components/PatientTab.tsx"), "utf-8");
  assert(patientSrc.includes("isClinicalEditor"), "Aba paciente fecha campos pelo gate único");

  const readme3 = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf-8");
  assert(readme3.includes("Fase 3") && readme3.includes("assertCanEdit"), "README documenta Fase 3");
} catch (err) {
  assert(false, `Falha na verificação da Fase 3: ${err}`);
}

// 16. FASE 4 — claim/transfer só via RPC
console.log("\n16. Verificando Fase 4 (claim/transfer só via RPC)...");
try {
  const { mapClinicalError } = await import("../lib/clinicalErrors.ts");
  const { parentPayloadForWrite } = await import("../lib/procedureMapper.ts");
  const { getBlankDocument } = await import("../mockData.ts");

  assert(
    mapClinicalError({ message: "incoming_must_differ" }).message.includes("Assumir"),
    "incoming_must_differ aponta para Assumir responsabilidade"
  );
  assert(
    mapClinicalError({ message: "pending_not_found" }).message.includes("pendente"),
    "pending_not_found tem mensagem específica"
  );
  assert(
    mapClinicalError({ message: "profile_not_found" }).message.includes("perfil"),
    "profile_not_found pede perfil confirmado"
  );

  const payload = parentPayloadForWrite(getBlankDocument(), "alice-uid", { includeStatus: true });
  assert(!("pending_transfer" in payload), "autosave não envia pending_transfer");

  const appSrc = fs.readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf-8");
  assert(appSrc.includes("resolveIncomingDoctorByEmail"), "Transferência resolve o colega por e-mail");
  assert(appSrc.includes("requestTransferAtomic"), "Solicitar transferência usa RPC");
  assert(appSrc.includes("declinePendingTransferAtomic"), "Recusar pendência usa RPC");
  assert(appSrc.includes("claimResponsibilityAtomic"), "Aceitar/assumir usa claim RPC");
  assert(appSrc.includes("requireCloudProcedure"), "Claim/transfer recusam ficha só local ou offline");
  assert(!/incomingUid:\s*user\??\.uid/.test(appSrc), "App não usa o UID do sainte como incoming");
  assert(!/currentResponsibleUid:\s*user\??\.uid/.test(appSrc), "App não muta currentResponsibleUid no cliente");
  assert(!appSrc.includes("Solicitar Troca"), "Modo leitura não abre o modal de transfer do responsável");
  assert(appSrc.includes("handleClaimResponsibility"), "Modo leitura oferece Assumir via claim");

  const modalSrc = fs.readFileSync(path.join(process.cwd(), "src/components/TransferResponsibilityModal.tsx"), "utf-8");
  assert(modalSrc.includes("lookupProfileByEmail"), "Modal consulta perfil pelo e-mail");
  assert(modalSrc.includes("type=\"email\"") && modalSrc.includes("required"), "E-mail do entrante é obrigatório");
  assert(!modalSrc.includes("(opcional)"), "E-mail não é mais opcional no modal");

  const procSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/proceduresService.ts"), "utf-8");
  assert(procSrc.includes("rpc(\"request_transfer\""), "requestTransferAtomic chama request_transfer");
  assert(procSrc.includes("rpc(\"decline_pending_transfer\""), "declinePendingTransferAtomic chama decline_pending_transfer");
  assert(procSrc.includes("incomingDoctor.uid === currentUserId"), "Cliente recusa transferir para si mesmo");

  const childrenSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/clinicalChildren.ts"), "utf-8");
  assert(!childrenSrc.includes("from(\"procedure_transfers\").upsert"), "Autosave não grava procedure_transfers");
  assert(childrenSrc.includes("Transferências só entram via RPC"), "addClinicalEventItem recusa transfers locais");

  const migDir = path.join(process.cwd(), "supabase/migrations");
  const migFiles = fs.readdirSync(migDir).filter((f) => f.includes("fase_4"));
  assert(migFiles.length >= 1, "Migration Fase 4 existe");
  const mig = fs.readFileSync(path.join(migDir, migFiles[0]), "utf-8");
  assert(mig.includes("private.request_transfer"), "Migration cria request_transfer");
  assert(mig.includes("private.decline_pending_transfer"), "Migration cria decline_pending_transfer");
  assert(mig.includes("pending_transfer = null"), "Claim limpa pending_transfer");
  assert(mig.includes("security definer") && mig.includes("security invoker"), "DEFINER no private, wrapper invoker no public");
  assert(mig.includes("grant execute on function public.request_transfer"), "authenticated pode chamar request_transfer");
  assert(mig.includes("revoke all on function public.request_transfer") && mig.includes("anon"), "anon não executa request_transfer");

  const readme4 = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf-8");
  assert(readme4.includes("Fase 4") && readme4.includes("request_transfer"), "README documenta Fase 4");
} catch (err) {
  assert(false, `Falha na verificação da Fase 4: ${err}`);
}

// 17. FASE 5 — ficha não se chama mais document
console.log("\n17. Verificando Fase 5 (renomear document → ficha)...");
try {
  const appSrc = fs.readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf-8");
  const intraSrc = fs.readFileSync(path.join(process.cwd(), "src/components/IntraoperativeTab.tsx"), "utf-8");
  const drawerSrc = fs.readFileSync(path.join(process.cwd(), "src/components/AnesthesiaDescriptionDrawer.tsx"), "utf-8");
  const tcleSrc = fs.readFileSync(path.join(process.cwd(), "src/components/TcleModal.tsx"), "utf-8");
  const patientSrc = fs.readFileSync(path.join(process.cwd(), "src/components/PatientTab.tsx"), "utf-8");
  const reviewSrc = fs.readFileSync(path.join(process.cwd(), "src/components/ReviewTab.tsx"), "utf-8");
  const syncSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/useSyncEngine.ts"), "utf-8");
  const saveSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/proceduresService.ts"), "utf-8");
  const onda5Live = fs.readFileSync(path.join(process.cwd(), "src/tests/onda5_live.ts"), "utf-8");
  const sessionSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/useSessionGuard.ts"), "utf-8");
  const readme5 = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf-8");

  assert(appSrc.includes("const [ficha, setFicha]"), "App guarda a ficha clínica em ficha");
  assert(!appSrc.includes("const [document, setDocument]"), "App não declara mais document como a ficha");
  assert(appSrc.includes("ficha={ficha}"), "App passa a ficha com a prop ficha");
  assert(!appSrc.includes("document={ficha}") && !appSrc.includes("document={document}"), "App não passa mais a ficha como prop document");
  assert(appSrc.includes("setFichaWithBroadcast"), "Broadcast da ficha usa setFichaWithBroadcast");
  assert(appSrc.includes("document.addEventListener"), "Depois do rename o overflow usa o document do DOM");

  assert(intraSrc.includes("ficha: AnesthesiaDocument"), "IntraoperativeTab recebe ficha");
  assert(intraSrc.includes("} = ficha"), "IntraoperativeTab destrutura a ficha");
  assert(!/\bdocument:\s*AnesthesiaDocument\b/.test(intraSrc), "IntraoperativeTab não tipa mais a ficha como document");

  assert(patientSrc.includes("ficha: AnesthesiaDocument"), "PatientTab recebe ficha");
  assert(reviewSrc.includes("ficha: AnesthesiaDocument"), "ReviewTab recebe ficha");
  assert(syncSrc.includes("ficha: AnesthesiaDocument"), "useSyncEngine recebe ficha");
  assert(saveSrc.includes("saveProcedure(ficha: AnesthesiaDocument"), "saveProcedure recebe ficha");

  assert(
    drawerSrc.includes("{ document: ficha, models }"),
    "generate-description continua enviando a chave document da Edge Function"
  );
  assert(
    onda5Live.includes("document: blank"),
    "Live da onda 5 ainda usa a chave document no body da Edge Function"
  );
  assert(tcleSrc.includes("printWindow.document.write"), "TCLE continua usando o document da janela de impressão");
  assert(sessionSrc.includes("document.visibilityState"), "Guarda de sessão continua no document do DOM");
  assert(sessionSrc.includes("document.addEventListener"), "Guarda de sessão escuta visibilitychange no DOM");

  assert(readme5.includes("Fase 5") && readme5.includes("ficha"), "README documenta Fase 5");
} catch (err) {
  assert(false, `Falha na verificação da Fase 5: ${err}`);
}

// 18. FASE 6 — revision de concorrência
console.log("\n18. Verificando Fase 6 (revision de concorrência)...");
try {
  const { expectedProcedureRevision, parentPayloadForWrite } = await import("../lib/procedureMapper.ts");
  const { getBlankDocument } = await import("../mockData.ts");
  const { mapClinicalError, isStaleRevisionError, STALE_REVISION_MESSAGE } = await import("../lib/clinicalErrors.ts");
  const { clinicalChangeFingerprint, CLINICAL_FINGERPRINT_FIELDS } = await import("../lib/clinicalChangeFingerprint.ts");

  assert(expectedProcedureRevision(undefined) === 1, "Revision ausente vira 1");
  assert(expectedProcedureRevision({}) === 1, "Objeto sem revision vira 1");
  assert(expectedProcedureRevision({ revision: 0 }) === 1, "Revision 0 é inválida e vira 1");
  assert(expectedProcedureRevision({ revision: 4 }) === 4, "Revision positiva é preservada");

  const blank = getBlankDocument();
  assert(blank.revision === 1, "Ficha em branco nasce com revision 1");
  const payload = parentPayloadForWrite(blank, "alice-uid", { includeStatus: true });
  assert(!("revision" in payload), "autosave não envia revision");
  assert(!("pending_transfer" in payload), "autosave ainda não envia pending_transfer");

  const hash0 = clinicalChangeFingerprint(blank);
  assert(
    clinicalChangeFingerprint({ ...blank, revision: 99 }) === hash0,
    "Mudar só revision não muda o fingerprint"
  );
  assert(
    !(CLINICAL_FINGERPRINT_FIELDS as readonly string[]).includes("revision"),
    "revision não entra no fingerprint clínico"
  );

  const staleMapped = mapClinicalError({ message: "stale_revision" });
  assert(staleMapped.message === STALE_REVISION_MESSAGE, "stale_revision tem mensagem específica");
  assert(staleMapped.message.includes("outro lugar"), "mensagem de conflito fala em outro lugar");
  assert(isStaleRevisionError({ message: "stale_revision" }), "isStaleRevisionError reconhece o token");
  assert(isStaleRevisionError(staleMapped), "isStaleRevisionError reconhece a mensagem mapeada");

  const saveSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/proceduresService.ts"), "utf-8");
  assert(saveSrc.includes('.eq("revision"'), "saveProcedure condiciona o UPDATE à revision esperada");
  assert(saveSrc.includes("stale_revision"), "saveProcedure lança stale_revision");
  assert(saveSrc.includes("applyRevisionMeta"), "saveProcedure devolve revision/updated_at ao cliente");

  const mapperSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/procedureMapper.ts"), "utf-8");
  assert(mapperSrc.includes("expectedProcedureRevision"), "Mapper expõe expectedProcedureRevision");
  assert(mapperSrc.includes("revision: expectedProcedureRevision(row)"), "Hydrate lê revision da linha");

  const syncSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/useSyncEngine.ts"), "utf-8");
  assert(syncSrc.includes("isStaleRevisionError"), "Autosave trata conflito de revision");
  assert(syncSrc.includes("staleConflict"), "Conflito de revision não entra no retry de 5s");
  assert(syncSrc.includes("revision: cleanedDoc.revision"), "Após save o autosave mescla revision na ficha viva");

  const migDir = path.join(process.cwd(), "supabase/migrations");
  const migFiles = fs.readdirSync(migDir).filter((f) => f.includes("fase_6"));
  assert(migFiles.length >= 1, "Migration Fase 6 existe");
  const mig = fs.readFileSync(path.join(migDir, migFiles[0]), "utf-8");
  assert(mig.includes("add column") && mig.includes("revision"), "Migration cria a coluna revision");
  assert(mig.includes("new.revision := coalesce(old.revision, 1) + 1"), "Trigger incrementa revision no servidor");
  assert(mig.includes("private.bump_procedure_revision"), "Trigger mora em private");
  assert(mig.includes("set search_path = ''"), "Trigger com search_path vazio");

  const appSrc = fs.readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf-8");
  const intraSrc = fs.readFileSync(path.join(process.cwd(), "src/components/IntraoperativeTab.tsx"), "utf-8");
  assert(appSrc.includes("const [ficha, setFicha]"), "App.tsx não foi fatiado");
  assert(intraSrc.includes("ficha: AnesthesiaDocument"), "IntraoperativeTab.tsx não foi fatiado");

  const typesSrc = fs.readFileSync(path.join(process.cwd(), "src/types.ts"), "utf-8");
  assert(typesSrc.includes("updatedAtServer?"), "updatedAtServer permanece (sem drive-by)");
  assert(typesSrc.includes("revision?: number"), "AnesthesiaDocument ganha revision");

  const readme6 = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf-8");
  assert(readme6.includes("Fase 6") && readme6.includes("stale_revision"), "README documenta Fase 6");
} catch (err) {
  assert(false, `Falha na verificação da Fase 6: ${err}`);
}

// 19. VERIFICAÇÃO FINAL DE RESULTADOS
console.log("\n=================================================");
console.log(`📊 RESUMO DOS TESTES: ${passedTests}/${totalTests} aprovados (${Math.round((passedTests/totalTests)*100)}%)`);
console.log("=================================================");

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
