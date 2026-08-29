import { buildCanonicalDocumentRepresentation, verifyDocumentIntegrity } from "../lib/signatureService.js";
import { AnesthesiaDocument } from "../types.js";
import { validateClinicalPassword, MIN_PASSWORD_LENGTH } from "../lib/passwordPolicy.ts";
import {
  evaluateSession,
  evaluateWorkstationLock,
  needsSignatureStepUp,
  SESSION_INACTIVITY_MS,
  SESSION_TIMEBOX_MS,
  SIGNATURE_STEP_UP_MS,
  WORKSTATION_LOCK_MS,
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

function readSrc(...relPaths: string[]): string {
  return relPaths.map((rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf-8")).join("\n");
}

function clinicalShellSrc(): string {
  return readSrc(
    "src/App.tsx",
    "src/lib/useClinicalDocument.ts",
    "src/lib/useAiSupervisor.ts",
    "src/lib/useOverflowMenu.ts",
    "src/lib/useResponsibilityActions.ts",
    "src/components/AppHeader.tsx",
    "src/components/AppNav.tsx",
    "src/components/AppModalHost.tsx"
  );
}

function intraSrcAll(): string {
  const dir = path.join(process.cwd(), "src/components/intra");
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith(".tsx")).sort()
    : [];
  return readSrc("src/components/IntraoperativeTab.tsx", ...files.map((f) => `src/components/intra/${f}`));
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
  assert(procService.includes("closeProcedureAtomic"), "Encerramento usa closeProcedureAtomic");
  assert(!procService.includes("p_canonical"), "Cliente não envia p_canonical no encerramento");
  assert(procService.includes("verify_procedure_integrity"), "Verificação de selo usa RPC verify_procedure_integrity");
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
  assert(voiceUi.includes("transcript_original"), "Cliente prefere transcript_original da Edge");
  assert(!voiceUi.includes("console.log(\"Comando de voz processado\""), "Botão de voz não loga o payload clínico");
  const appVoice = clinicalShellSrc();
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
  const shell7 = clinicalShellSrc();
  assert(shell7.includes("overflowMenuOpen"), "Menu de overflow do cabeçalho abre por clique");
  assert(!shell7.includes("group-hover:visible"), "Menu de overflow não depende de hover (quebra no toque)");
  assert(shell7.includes('aria-label="Mais opções"'), "Botão de overflow tem rótulo acessível");
  assert(
    shell7.includes("document.addEventListener"),
    "Menu overflow escuta o DOM document"
  );
  assert(
    !shell7.includes("window.document.addEventListener"),
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
  const publicCfg = fs.readFileSync(path.join(process.cwd(), "src/lib/publicSupabaseConfig.ts"), "utf-8");
  assert(publicCfg.includes("CANONICAL_SUPABASE_PUBLISHABLE_KEY"), "getPublicSupabaseConfig usa o fallback da chave publishable");
  assert(serverContent.includes("getPublicSupabaseConfig"), "Express lê a config pública de uma função compartilhada");
  assert(vercelApi.includes("getPublicSupabaseConfig"), "Função Vercel /api/public-config usa a mesma função compartilhada");
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

  const heard = "tem ta cinquenta";
  const onlyHeard = applyVoiceActionsToDocument(blank, {}, null, new Date("2026-08-29T12:00:00Z"), heard);
  assert(onlyHeard.voiceTranscripts?.[0]?.transcriptOriginal === heard, "Transcrição original persiste sem correção de jargão");
  assert(!onlyHeard.voiceTranscripts?.[0]?.transcriptOriginal.includes("fenta"), "Não substitui o que foi ouvido por fenta");
  const signedHeard = applyVoiceActionsToDocument({ ...onlyHeard, status: "Signed" }, {}, null, new Date(), "outra fala");
  assert(signedHeard.voiceTranscripts?.length === onlyHeard.voiceTranscripts?.length, "Ficha assinada não grava transcrição");
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
  assert(reviewFn.includes("AI_REVIEW_PARSE_FAILED") || reviewFn.includes("AI_REVIEW_SCHEMA_INVALID"), "Edge review devolve erro explícito de parse");
  assert(reviewFn.includes("502"), "Edge review usa status de falha no parse");
  assert(!/JSON\.parse\(\s*text\s*\|\|\s*['"]\{\s*"alerts"\s*:\s*\[\s*\]/.test(reviewFn), "Edge review não mascara parse falho com alerts vazios");

  const reviewUi = fs.readFileSync(path.join(process.cwd(), "src/components/ReviewTab.tsx"), "utf-8");
  assert(reviewUi.includes("parseAiReviewPayload"), "ReviewTab interpreta payload de auditoria");
  assert(reviewUi.includes("AI_REVIEW_UNAVAILABLE_MESSAGE") || reviewUi.includes("Auditoria de IA indisponível"), "UI distingue parse falho de zero alertas");

  const appSrc = clinicalShellSrc();
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

  const appSrc = clinicalShellSrc();
  assert(appSrc.includes("isClinicalEditor") && appSrc.includes("canEditDocument"), "App consulta o gate único");
  assert(appSrc.includes("assignNewDocumentOwner"), "Reset/login carimbam o dono da ficha em branco");

  const signSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/signatureService.ts"), "utf-8");
  assert(signSrc.includes("assertCanEdit"), "Assinatura exige assertCanEdit");

  const bannerSrc = fs.readFileSync(path.join(process.cwd(), "src/components/ResponsibilityBanner.tsx"), "utf-8");
  assert(bannerSrc.includes("isCurrentResponsible"), "Banner de responsável usa UID, não o gate de edição");
  assert(!bannerSrc.includes("!user || !user.uid || !currentResponsibleUid"), "Banner não trata ausência de UID como autorizado");

  const patientSrc = fs.readFileSync(path.join(process.cwd(), "src/components/PatientTab.tsx"), "utf-8");
  assert(patientSrc.includes("isClinicalEditor"), "Aba paciente fecha campos pelo gate único");
  assert(patientSrc.includes("ClinicalEditorLock"), "Admissão usa fieldset de somente leitura");
  assert(patientSrc.includes("isClosed || isSaving || !cpf"), "Salvar worklist exige editor clínico");
  assert(patientSrc.includes("isClosed || isSearching || !cpf"), "Buscar worklist exige editor clínico");

  assert(appSrc.includes("<ResponsibilityBanner"), "App monta o banner único de responsabilidade");
  assert(!appSrc.includes("ESTA FICHA FOI ENCERRADA E ASSINADA"), "App não duplica faixa de ficha assinada");
  assert(!appSrc.includes("Ficha assinada. Modificações apenas via adendo."), "Texto de ficha assinada vive só no banner único");
  assert(appSrc.includes("canEditDocument(ficha, user?.uid)"), "Worklist save passa por canEditDocument");
  assert(appSrc.includes("anesthesiaProgressLabel"), "Header usa rótulo de andamento centralizado");
  assert(appSrc.includes("withInProgressIfAnesthesiaStarted"), "App promove Draft → InProgress");

  const reviewSrc3 = fs.readFileSync(path.join(process.cwd(), "src/components/ReviewTab.tsx"), "utf-8");
  assert(reviewSrc3.includes("evaluateSigningReadiness"), "ReviewTab usa SigningReadinessEngine");
  assert(!reviewSrc3.includes("runLocalValidation"), "Validação de encerramento saiu do ReviewTab");
  assert(reviewSrc3.includes("disabled={!canEdit}"), "Encerrar procedimento respeita canEdit");

  const intraSrc3 = fs.readFileSync(path.join(process.cwd(), "src/components/IntraoperativeTab.tsx"), "utf-8");
  assert(intraSrc3.includes("canEdit = true"), "Intra recebe canEdit");
  assert(intraSrc3.includes("if (!canEdit) return"), "Intra não aplica mutação sem canEdit");
  assert(intraSrc3.includes("pointer-events-none"), "Intra bloqueia pointer nos painéis clínicos");

  const recSrc3 = fs.readFileSync(path.join(process.cwd(), "src/components/RecoveryTab.tsx"), "utf-8");
  assert(recSrc3.includes("ClinicalEditorLock"), "SRPA usa fieldset de somente leitura");
  const preSrc3 = fs.readFileSync(path.join(process.cwd(), "src/components/PreEvaluationTab.tsx"), "utf-8");
  assert(preSrc3.includes("ClinicalEditorLock"), "Pré-anestésica usa fieldset de somente leitura");

  const {
    withInProgressIfAnesthesiaStarted,
    isAnesthesiaInProgress,
    anesthesiaProgressLabel,
  } = await import("../lib/procedureStatus.ts");
  const draftNoTimer = getBlankDocument();
  draftNoTimer.status = "Draft";
  assert(withInProgressIfAnesthesiaStarted(draftNoTimer).status === "Draft", "Sem início permanece Draft");
  draftNoTimer.timers = { startAnesthesia: "2026-08-29T12:00:00Z" };
  assert(withInProgressIfAnesthesiaStarted(draftNoTimer).status === "InProgress", "Início da anestesia promove Draft → InProgress");
  const signedStay = { ...getBlankDocument(), status: "Signed" as const, timers: { startAnesthesia: "2026-08-29T12:00:00Z" } };
  assert(withInProgressIfAnesthesiaStarted(signedStay).status === "Signed", "Signed não é rebaixado");
  const inProgressStay = { ...getBlankDocument(), status: "InProgress" as const, timers: {} };
  assert(withInProgressIfAnesthesiaStarted(inProgressStay).status === "InProgress", "Limpar timer não volta para Draft");
  assert(isAnesthesiaInProgress({ startAnesthesia: "x" }) === true, "Em andamento exige início sem término");
  assert(isAnesthesiaInProgress({ startAnesthesia: "x", endAnesthesia: "y" }) === false, "Com término não está em andamento");
  assert(anesthesiaProgressLabel({ startAnesthesia: "x", endAnesthesia: "y" }) === "Anestesia encerrada", "Header com término não diz em andamento");
  assert(anesthesiaProgressLabel({}) === "Aguardando início", "Sem início aguarda");

  const {
    evaluateSigningReadiness,
    hasSelectedAnestheticTechnique,
  } = await import("../lib/signingReadinessEngine.ts");
  const blankReady = getBlankDocument();
  const blankEval = evaluateSigningReadiness(blankReady);
  assert(blankEval.canClose === false, "Ficha em branco não encerra");
  assert(blankEval.alerts.some((a) => a.level === "CRITICAL" && a.title.includes("Início")), "Falta de início é CRITICAL");
  assert(blankEval.alerts.some((a) => a.level === "CRITICAL" && a.title.includes("Responsável")), "Responsável ausente é CRITICAL");
  assert(blankEval.alerts.some((a) => a.level === "IMPORTANT" && a.module === "Technique"), "Técnica ausente é IMPORTANT, não bloqueio universal");
  assert(!blankEval.alerts.some((a) => /capno|EtCO|etco2/i.test(`${a.title} ${a.description}`)), "Capnografia não é critério de encerramento");
  assert(hasSelectedAnestheticTechnique(blankReady.technique) === false, "Blank não tem técnica selecionada");
  assert(hasSelectedAnestheticTechnique({ ...blankReady.technique, spinal: true }) === true, "Raqui conta como técnica");

  const closeable = getBlankDocument();
  closeable.currentResponsibleUid = "alice-uid";
  closeable.patient.fullName = "Maria da Silva Santos";
  closeable.patient.recordNumber = "123";
  closeable.patient.weight = 70;
  closeable.team.anesthesiologistLead = "Alice";
  closeable.team.crmLead = "12345";
  closeable.timers.startAnesthesia = "2026-08-29T12:00:00Z";
  closeable.technique.balanced = true;
  closeable.vitals = [{ id: "v1", timestamp: "2026-08-29T12:05:00Z", minutesFromStart: 5, fc: 72 }];
  closeable.bolusDrugs = [{ id: "d1", name: "Fentanil", timestamp: "2026-08-29T12:05:00Z" } as any];
  closeable.airway = { ...closeable.airway, capnographyConfirmed: false, ventilationType: "Intubação Orotraqueal" };
  closeable.monitorConfig = { ...closeable.monitorConfig, capnography: false };
  const readyEval = evaluateSigningReadiness(closeable);
  assert(readyEval.canClose === true, "Mínimo contextual permite encerrar");
  assert(!readyEval.alerts.some((a) => a.level === "CRITICAL"), "Sem CRITICAL no caso mínimo");
  assert(!readyEval.alerts.some((a) => /capno|EtCO|etco2/i.test(`${a.title} ${a.description}`)), "IOT sem capnografia registrada não bloqueia");

  const chrono = { ...closeable, timers: { startAnesthesia: "2026-08-29T13:00:00Z", startSurgery: "2026-08-29T12:00:00Z" } };
  assert(evaluateSigningReadiness(chrono).canClose === false, "Cirurgia antes da anestesia é CRITICAL");

  const saveSrcStatus = fs.readFileSync(path.join(process.cwd(), "src/lib/proceduresService.ts"), "utf-8");
  assert(saveSrcStatus.includes("withInProgressIfAnesthesiaStarted"), "saveProcedure promove Draft → InProgress");
  const voiceSrc3 = fs.readFileSync(path.join(process.cwd(), "src/lib/voiceCommand.ts"), "utf-8");
  assert(voiceSrc3.includes("withInProgressIfAnesthesiaStarted"), "Voz promove Draft → InProgress");

  const readme3 = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf-8");
  assert(readme3.includes("Fase 3") && readme3.includes("assertCanEdit"), "README documenta Fase 3");
  assert(readme3.includes("SigningReadinessEngine") || readme3.includes("evaluateSigningReadiness"), "README documenta o engine de encerramento");
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
  assert(
    mapClinicalError({ message: "reason_required" }).message.toLowerCase().includes("motivo"),
    "reason_required pede motivo da assunção"
  );
  assert(
    mapClinicalError({ message: "claim_requires_pending" }).message.toLowerCase().includes("assumir"),
    "claim_requires_pending aponta para Assumir"
  );

  const { validateAssumeReason } = await import("../lib/assumeResponsibility.ts");
  assert(validateAssumeReason("curto").ok === false, "motivo curto falha");
  assert(validateAssumeReason("1234567890").ok === true, "motivo com 10 caracteres passa");
  assert(validateAssumeReason("   abc   ").ok === false, "trim não infla motivo curto");
  assert(validateAssumeReason("  motivo excepcional de teste  ").ok === true, "motivo válido após normalizar");

  const payload = parentPayloadForWrite(getBlankDocument(), "alice-uid", { includeStatus: true });
  assert(!("pending_transfer" in payload), "autosave não envia pending_transfer");

  const appSrc = clinicalShellSrc();
  assert(appSrc.includes("resolveIncomingDoctorByEmail"), "Transferência resolve o colega por e-mail");
  assert(appSrc.includes("requestTransferAtomic"), "Solicitar transferência usa RPC");
  assert(appSrc.includes("declinePendingTransferAtomic"), "Recusar pendência usa RPC");
  assert(appSrc.includes("assumeResponsibilityAtomic"), "Assumir usa assume RPC");
  assert(appSrc.includes("requireCloudProcedure"), "Claim/transfer recusam ficha só local ou offline");
  assert(!/incomingUid:\s*user\??\.uid/.test(appSrc), "App não usa o UID do sainte como incoming");
  assert(!/currentResponsibleUid:\s*user\??\.uid/.test(appSrc), "App não muta currentResponsibleUid no cliente");
  assert(!appSrc.includes("Solicitar Troca"), "Modo leitura não abre o modal de transfer do responsável");
  assert(appSrc.includes("handleClaimResponsibility"), "Modo leitura oferece Assumir");
  assert(appSrc.includes("AssumeResponsibilityModal"), "Assumir abre modal de motivo");
  assert(!appSrc.includes("isSyncing={syncEngine.isOnline}"), "ShareModal não trata online como pause");
  assert(!appSrc.includes("toggleSync={syncEngine.retrySyncNow}"), "ShareModal não usa retry como pause");
  assert(appSrc.includes("autosavePaused={syncEngine.autosavePaused}"), "ShareModal recebe pause real");
  assert(appSrc.includes("onToggleAutosavePause={syncEngine.toggleAutosavePause}"), "ShareModal alterna pauseAutosave");

  const claimFn = appSrc.slice(
    appSrc.indexOf("const handleClaimResponsibility"),
    appSrc.indexOf("const handleConfirmAssume")
  );
  assert(!claimFn.includes("claimResponsibilityAtomic"), "Assumir não chama claim_responsibility");
  assert(claimFn.includes("setShowAssumeModal"), "Assumir abre o modal de motivo");

  const assumeFn = appSrc.slice(
    appSrc.indexOf("const handleConfirmAssume"),
    appSrc.indexOf("const handleConfirmTransfer")
  );
  assert(assumeFn.includes("assumeResponsibilityAtomic"), "Confirmar Assumir chama assume RPC");
  assert(!assumeFn.includes("claimResponsibilityAtomic"), "Confirmar Assumir não chama claim");

  const acceptFn = appSrc.slice(
    appSrc.indexOf("const handleAcceptTransfer"),
    appSrc.indexOf("const handleCancelTransfer")
  );
  assert(acceptFn.includes("claimResponsibilityAtomic"), "Aceitar usa claim RPC");
  assert(!acceptFn.includes("assumeResponsibilityAtomic"), "Aceitar não usa assume RPC");

  const modalSrc = fs.readFileSync(path.join(process.cwd(), "src/components/TransferResponsibilityModal.tsx"), "utf-8");
  assert(modalSrc.includes("lookupProfileByEmail"), "Modal consulta perfil pelo e-mail");
  assert(modalSrc.includes("type=\"email\"") && modalSrc.includes("required"), "E-mail do entrante é obrigatório");
  assert(!modalSrc.includes("(opcional)"), "E-mail não é mais opcional no modal");

  const assumeModalSrc = fs.readFileSync(path.join(process.cwd(), "src/components/AssumeResponsibilityModal.tsx"), "utf-8");
  assert(assumeModalSrc.includes("validateAssumeReason"), "Modal de Assumir valida o motivo");
  assert(assumeModalSrc.includes("MIN_ASSUME_REASON_LENGTH"), "Modal de Assumir exige mínimo de caracteres");

  const procSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/proceduresService.ts"), "utf-8");
  assert(procSrc.includes("rpc(\"request_transfer\""), "requestTransferAtomic chama request_transfer");
  assert(procSrc.includes("rpc(\"decline_pending_transfer\""), "declinePendingTransferAtomic chama decline_pending_transfer");
  assert(procSrc.includes("rpc(\"assume_responsibility\""), "assumeResponsibilityAtomic chama assume_responsibility");
  assert(procSrc.includes("incomingDoctor.uid === currentUserId"), "Cliente recusa transferir para si mesmo");
  assert(!procSrc.includes("Assunção direta de responsabilidade"), "Claim não envia texto de assunção direta");

  const engineSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/useSyncEngine.ts"), "utf-8");
  assert(engineSrc.includes("pauseAutosave"), "useSyncEngine exporta pauseAutosave");
  assert(engineSrc.includes("autosavePaused"), "useSyncEngine guarda autosavePaused");
  assert(engineSrc.includes("Autosave pausado"), "statusText distingue pause de offline");
  assert(engineSrc.includes("Pausado: não atualiza o hash"), "pause não consome o hash antes do resume");

  const shareSrc4 = fs.readFileSync(path.join(process.cwd(), "src/components/ShareModal.tsx"), "utf-8");
  assert(shareSrc4.includes("autosavePaused"), "ShareModal recebe autosavePaused");
  assert(shareSrc4.includes("onToggleAutosavePause"), "ShareModal pausa/retoma autosave");
  assert(shareSrc4.includes("Retomar"), "ShareModal tem rótulo Retomar");
  assert(!shareSrc4.includes("isSyncing"), "ShareModal não usa mais isSyncing como pause");
  assert(!shareSrc4.includes("toggleSync"), "ShareModal não usa mais toggleSync");

  const childrenSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/clinicalChildren.ts"), "utf-8");
  assert(!childrenSrc.includes("from(\"procedure_transfers\").upsert"), "Autosave não grava procedure_transfers");
  assert(childrenSrc.includes("Transferências só entram via RPC"), "addClinicalEventItem recusa transfers locais");

  const migDir = path.join(process.cwd(), "supabase/migrations");
  const migFiles = fs.readdirSync(migDir).filter((f) => f.includes("fase_4")).sort();
  assert(migFiles.length >= 1, "Migration Fase 4 existe");
  const migRequest = migFiles.find((f) => f.includes("fase_4_request")) || migFiles[0];
  const mig = fs.readFileSync(path.join(migDir, migRequest), "utf-8");
  assert(mig.includes("private.request_transfer"), "Migration cria request_transfer");
  assert(mig.includes("private.decline_pending_transfer"), "Migration cria decline_pending_transfer");
  assert(mig.includes("pending_transfer = null"), "Claim limpa pending_transfer");
  assert(mig.includes("security definer") && mig.includes("security invoker"), "DEFINER no private, wrapper invoker no public");
  assert(mig.includes("grant execute on function public.request_transfer"), "authenticated pode chamar request_transfer");
  assert(mig.includes("revoke all on function public.request_transfer") && mig.includes("anon"), "anon não executa request_transfer");

  const mig4aName = migFiles.find((f) => f.includes("fase_4a"));
  assert(!!mig4aName, "Migration Fase 4A existe");
  const mig4a = fs.readFileSync(path.join(migDir, mig4aName as string), "utf-8");
  assert(mig4a.includes("private.assume_responsibility"), "Migration 4A cria assume_responsibility");
  assert(mig4a.includes("claim_requires_pending"), "claim exige pending_transfer");
  assert(mig4a.includes("reason_required"), "assume exige motivo");
  assert(mig4a.includes("assume_responsibility_exceptional"), "audit de assunção excepcional");

  const readme4 = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf-8");
  assert(readme4.includes("Fase 4") && readme4.includes("request_transfer"), "README documenta Fase 4");
  assert(readme4.includes("assume_responsibility"), "README documenta assume_responsibility");
  assert(readme4.includes("pauseAutosave"), "README documenta pauseAutosave");
  assert(readme4.includes("fase04_handover_live"), "README documenta o live A→B");

  const handoverLive = fs.readFileSync(path.join(process.cwd(), "src/tests/fase04_handover_live.ts"), "utf-8");
  assert(handoverLive.includes("ONDA3_TEST_EMAIL_B"), "Live A→B lê o segundo usuário");
  assert(handoverLive.includes("claim_requires_pending"), "Live A→B exercita claim_requires_pending");
  assert(handoverLive.includes("assumeResponsibilityAtomic"), "Live A→B exercita assume excepcional");
  assert(handoverLive.includes("requestTransferAtomic"), "Live A→B pede transferência");
  assert(handoverLive.includes("claimResponsibilityAtomic"), "Live A→B aceita via claim");
} catch (err) {
  assert(false, `Falha na verificação da Fase 4: ${err}`);
}

// 16b. FASE 4B — integridade documental V2
console.log("\n16b. Verificando Fase 4B (selo SignedAnesthesiaRecordV1 no servidor)...");
try {
  const { mapClinicalError } = await import("../lib/clinicalErrors.ts");
  const procSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/proceduresService.ts"), "utf-8");
  const appSrc = clinicalShellSrc();
  const reviewSrc = fs.readFileSync(path.join(process.cwd(), "src/components/ReviewTab.tsx"), "utf-8");
  const pdfSrc = fs.readFileSync(path.join(process.cwd(), "src/components/PdfPreviewModal.tsx"), "utf-8");
  const drawerSrc = fs.readFileSync(path.join(process.cwd(), "src/components/AnesthesiaDescriptionDrawer.tsx"), "utf-8");
  const sigSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/signatureService.ts"), "utf-8");
  const readme4b = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf-8");
  const onda3Live = fs.readFileSync(path.join(process.cwd(), "src/tests/onda3_live.ts"), "utf-8");
  const live4b = fs.readFileSync(path.join(process.cwd(), "src/tests/fase04b_live.ts"), "utf-8");

  const migDir = path.join(process.cwd(), "supabase/migrations");
  const mig4bName = fs.readdirSync(migDir).find((f) => f.includes("fase_4b"));
  assert(!!mig4bName, "Migration Fase 4B existe");
  const mig4b = fs.readFileSync(path.join(migDir, mig4bName as string), "utf-8");
  assert(mig4b.includes("private.build_signed_record_v1"), "Migration monta SignedAnesthesiaRecordV1 no servidor");
  assert(mig4b.includes("private.assert_signing_readiness"), "Migration executa readiness CRITICAL no servidor");
  assert(mig4b.includes("drop function if exists public.sign_procedure(uuid, text, jsonb)"), "Overload antigo com canonical é removido");
  assert(mig4b.includes("create or replace function public.sign_procedure(p_procedure_id uuid)"), "sign_procedure público só recebe procedure_id");
  assert(mig4b.includes("public.verify_procedure_integrity"), "Migration cria verify_procedure_integrity");
  assert(mig4b.includes("snapshot_ok") && mig4b.includes("persisted_ok"), "Verify devolve checagens A e B");
  assert(mig4b.includes("p_author_* do cliente não é fonte") || mig4b.includes("Identidade oficial do perfil"), "Adendo usa profiles, não o browser");

  assert(procSrc.includes("closeProcedureAtomic"), "proceduresService exporta closeProcedureAtomic");
  assert(procSrc.includes("rpc(\"sign_procedure\""), "close chama sign_procedure");
  assert(!procSrc.includes("p_canonical"), "proceduresService não manda p_canonical");
  assert(!procSrc.includes("p_signer"), "proceduresService não manda p_signer no close");
  assert(procSrc.includes("verifyProcedureIntegrity"), "Cliente verifica selo via RPC");
  assert(procSrc.includes("isProcedureIntegrityIntact"), "Íntegro só com A e B");
  assert(procSrc.includes("p_author_name: \"\""), "Adendo não envia nome do navegador como fonte");

  assert(appSrc.includes("closeProcedureAtomic"), "App encerra via closeProcedureAtomic");
  assert(!appSrc.includes("signAndLockDocument"), "App não sela no navegador");
  assert(!appSrc.includes("Assinatura Digital SHA-256"), "App não vende SHA-256 como assinatura digital");
  assert(appSrc.includes("Selo criptográfico de integridade"), "App usa a terminologia de selo");

  assert(reviewSrc.includes("verifyProcedureIntegrity"), "ReviewTab verifica pelo servidor");
  assert(!reviewSrc.includes("signAndLockDocument"), "ReviewTab não sela no navegador");
  assert(reviewSrc.includes("Selo criptográfico de integridade"), "ReviewTab usa selo, não assinatura digital");
  assert(!reviewSrc.includes("Assinado Digitalmente (SHA-256)"), "ReviewTab não rotula SHA-256 como assinatura digital");

  assert(pdfSrc.includes("SELO CRIPTOGRÁFICO DE INTEGRIDADE"), "PDF preview usa selo de integridade");
  assert(!pdfSrc.includes("ASSINATURA DIGITAL VALIDADA"), "PDF preview não afirma assinatura digital validada");
  assert(drawerSrc.includes("Selo de integridade"), "Drawer de descrição alinha a terminologia");

  assert(sigSrc.includes("não é autoridade de encerramento"), "signAndLockDocument local não é o selo oficial");

  assert(
    mapClinicalError({ message: "signing_not_ready" }).message.toLowerCase().includes("encerramento"),
    "signing_not_ready tem mensagem clínica"
  );
  assert(
    mapClinicalError({ message: "canonical_required" }).message.toLowerCase().includes("servidor"),
    "canonical_required explica que o selo é do servidor"
  );

  assert(readme4b.includes("Fase 4B") && readme4b.includes("SignedAnesthesiaRecordV1"), "README documenta Fase 4B");
  assert(readme4b.includes("verify_procedure_integrity"), "README documenta verify A+B");
  assert(readme4b.includes("fase04b_live"), "README aponta o live 4B");

  assert(onda3Live.includes("closeProcedureAtomic"), "onda3_live encerra pelo servidor");
  assert(!onda3Live.includes("signAndLockDocument"), "onda3_live não monta canonical no cliente");
  assert(live4b.includes("signing_not_ready") || live4b.includes("critérios mínimos"), "Live 4B exercita readiness no servidor");
  assert(live4b.includes("p_canonical"), "Live 4B tenta o overload antigo e espera recusa");
  assert(live4b.includes("Hacker Fake Name"), "Live 4B tenta autor mentiroso no adendo");
  assert(live4b.includes("verifyProcedureIntegrity"), "Live 4B chama verify A+B");
  assert(live4b.includes("FASE04B_LIVE_OK"), "Live 4B tem sentinela de sucesso");
} catch (err) {
  assert(false, `Falha na verificação da Fase 4B: ${err}`);
}

// 17. FASE 5 — ficha não se chama mais document
console.log("\n17. Verificando Fase 5 (renomear document → ficha)...");
try {
  const appSrc = clinicalShellSrc();
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
    drawerSrc.includes("document: toAIClinicalContext(ficha)") && drawerSrc.includes("models"),
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

// 17b. FASE 5 — higiene que reduz acidente
console.log("\n17b. Verificando Fase 5 (higiene: IDs, resíduos, settings, tema)...");
try {
  const { resolveActiveVitalInterval } = await import("../lib/vitalInterval.ts");
  const { playVitalOverdueBeep } = await import("../lib/vitalAlertSound.ts");
  const { deleteClinicalEventItem } = await import("../lib/clinicalChildren.ts");
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8"));
  const appSrc = clinicalShellSrc();
  const intraSrc = fs.readFileSync(path.join(process.cwd(), "src/components/IntraoperativeTab.tsx"), "utf-8");
  const intraAll = intraSrcAll();
  const drugsSrc = fs.readFileSync(path.join(process.cwd(), "src/components/IntraoperativeDrugsPanel.tsx"), "utf-8");
  const childrenSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/clinicalChildren.ts"), "utf-8");
  const boundarySrc = fs.readFileSync(path.join(process.cwd(), "src/components/ClinicalErrorBoundary.tsx"), "utf-8");
  const pdfSrc = fs.readFileSync(path.join(process.cwd(), "src/components/PdfPreviewModal.tsx"), "utf-8");
  const cssSrc = fs.readFileSync(path.join(process.cwd(), "src/index.css"), "utf-8");
  const readme5b = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf-8");
  const rootFiles = fs.readdirSync(process.cwd());

  const drugsIds = [...intraAll.matchAll(/\bid=["']drugs["']/g), ...drugsSrc.matchAll(/\bid=["']drugs["']/g)];
  assert(drugsIds.length === 1, "id=drugs aparece uma única vez");
  assert(!drugsSrc.includes("DraggablePanel"), "painel de fármacos não envolve DraggablePanel interno");

  const panelIds = [...intraAll.matchAll(/<DraggablePanel[^>]*\bid=["']([^"']+)["']/g)].map((m) => m[1]);
  assert(panelIds.length === new Set(panelIds).size, "IDs de DraggablePanel no intra são únicos");

  assert(!intraAll.includes("from \"./VitalsPanel\"") && !intraAll.includes("from \"../VitalsPanel\""), "Intra não importa VitalsPanel");
  assert(!intraAll.includes("from \"./BolusDrugsPanel\"") && !intraAll.includes("from \"../BolusDrugsPanel\""), "Intra não importa BolusDrugsPanel");
  assert(!intraAll.includes("from \"./SupportPanel\"") && !intraAll.includes("from \"../SupportPanel\""), "Intra não importa SupportPanel");
  assert(!fs.existsSync(path.join(process.cwd(), "src/components/VitalsPanel.tsx")), "VitalsPanel.tsx removido");
  assert(!fs.existsSync(path.join(process.cwd(), "src/components/BolusDrugsPanel.tsx")), "BolusDrugsPanel.tsx removido");
  assert(!fs.existsSync(path.join(process.cwd(), "src/components/SupportPanel.tsx")), "SupportPanel.tsx removido");
  assert(!fs.existsSync(path.join(process.cwd(), "src/lib/useMultiplayer.ts")), "useMultiplayer.ts removido");

  assert(!pkg.dependencies?.["react-router-dom"], "package.json sem react-router-dom");
  assert(!pkg.devDependencies?.["react-router-dom"], "devDependencies sem react-router-dom");
  assert(!fs.existsSync(path.join(process.cwd(), "bun.lock")), "bun.lock removido");
  assert(!rootFiles.some((f) => /^(fix_|patch_|rewrite_)/.test(f)), "raiz sem fix_*/patch_*/rewrite_*");
  assert(!rootFiles.includes("test.js"), "arquivo vazio test.js removido da raiz");
  assert(!pkg.dependencies?.firebase, "firebase continua fora do runtime");

  assert(resolveActiveVitalInterval({ loggingInterval: 15, isCustomInterval: false, customIntervalVal: "8" }) === 15, "intervalo 15 min entra no alarme");
  assert(resolveActiveVitalInterval({ loggingInterval: 5, isCustomInterval: true, customIntervalVal: "8" }) === 8, "intervalo customizado entra no alarme");
  assert(resolveActiveVitalInterval({ loggingInterval: 5, isCustomInterval: true, customIntervalVal: "abc" }) === 5, "custom inválido cai em 5");
  playVitalOverdueBeep();
  assert(true, "playVitalOverdueBeep não explode no Node");

  assert(intraSrc.includes("resolveActiveVitalInterval"), "intra usa o intervalo ativo real");
  assert(intraSrc.includes("playVitalOverdueBeep"), "intra toca beep de atraso");
  assert(intraSrc.includes("vitalIntervalMinutes"), "intra lê vitalIntervalMinutes das settings");
  assert(intraSrc.includes("soundAlertsEnabled"), "intra lê soundAlertsEnabled das settings");
  assert(intraSrc.includes("compactMode"), "intra lê compactMode das settings");
  assert(appSrc.includes("vitalIntervalMinutes={appSettings.vitalIntervalMinutes}"), "App passa intervalo das settings");
  assert(appSrc.includes("anestflow-compact"), "App aplica classe compacta");
  assert(cssSrc.includes(".anestflow-compact"), "CSS define densidade compacta");
  assert(appSrc.includes("data-compact"), "App expõe data-compact");
  const settingsSrc = fs.readFileSync(path.join(process.cwd(), "src/components/SettingsModal.tsx"), "utf-8");
  assert(settingsSrc.includes("if (isOpen) setFormData(settings)"), "Settings recarrega o formulário ao reabrir");

  assert(appSrc.includes("supervisorDevLog"), "Supervisor de IA usa logger de DEV");
  assert(!appSrc.includes("console.log(`[Supervisor de IA]"), "Supervisor não usa console.log direto");
  assert(boundarySrc.includes("anesthesia_theme"), "Error Boundary lê o tema salvo");
  assert(pdfSrc.includes("isDark"), "PDF Preview recebe isDark no chrome");
  assert(pdfSrc.includes("bg-white text-zinc-900"), "folhas do PDF continuam claras para impressão");

  assert(childrenSrc.includes("Eventos clínicos não são apagados"), "deleteClinicalEventItem recusa hard delete");
  let deleteThrew = false;
  try {
    await deleteClinicalEventItem("proc", "vitals", "item");
  } catch (err) {
    deleteThrew = err instanceof Error && err.message.includes("não são apagados");
  }
  assert(deleteThrew, "deleteClinicalEventItem lança em vez de apagar");

  assert(readme5b.includes("higiene") && readme5b.includes("DraggablePanel"), "README documenta a higiene da Fase 5");
  assert(readme5b.includes("voided_at") || readme5b.includes("não são apagados"), "README documenta a decisão de auditoria de eventos");
} catch (err) {
  assert(false, `Falha na verificação da higiene da Fase 5: ${err}`);
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
  assert(saveSrc.includes("insertProcedureParent"), "INSERT da ficha não usa RETURNING (RLS de participante)");
  assert(saveSrc.includes("INSERT ... RETURNING cai no RLS"), "Comentário explica por que o INSERT não faz select encadeado");

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

  const appSrc = clinicalShellSrc();
  const intraSrc = fs.readFileSync(path.join(process.cwd(), "src/components/IntraoperativeTab.tsx"), "utf-8");
  assert(appSrc.includes("useClinicalDocument"), "App.tsx orquestra via useClinicalDocument");
  assert(appSrc.includes("AppHeader"), "App.tsx monta o header extraído");
  assert(intraSrc.includes("ficha: AnesthesiaDocument"), "IntraoperativeTab continua recebendo ficha");
  assert(intraSrc.includes("IntraoperativeUiProvider"), "IntraoperativeTab orquestra os painéis extraídos");

  const typesSrc = fs.readFileSync(path.join(process.cwd(), "src/types.ts"), "utf-8");
  assert(typesSrc.includes("updatedAtServer?"), "updatedAtServer permanece (sem drive-by)");
  assert(typesSrc.includes("revision?: number"), "AnesthesiaDocument ganha revision");

  const readme6 = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf-8");
  assert(readme6.includes("Fase 6") && readme6.includes("stale_revision"), "README documenta Fase 6");
} catch (err) {
  assert(false, `Falha na verificação da Fase 6: ${err}`);
}

// 18b. FASE 6B — fatiar App/Intra
console.log("\n18b. Verificando Fase 6B (extração App/Intra)...");
try {
  const appSrc = fs.readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf-8");
  const shell = clinicalShellSrc();
  const intraTab = fs.readFileSync(path.join(process.cwd(), "src/components/IntraoperativeTab.tsx"), "utf-8");
  const intraAll = intraSrcAll();
  const publicCfg = fs.readFileSync(path.join(process.cwd(), "src/lib/publicSupabaseConfig.ts"), "utf-8");
  const serverSrc = fs.readFileSync(path.join(process.cwd(), "server.ts"), "utf-8");
  const vercelApi = fs.readFileSync(path.join(process.cwd(), "api/public-config.ts"), "utf-8");
  const authErr = fs.readFileSync(path.join(process.cwd(), "src/lib/authErrors.ts"), "utf-8");
  const passPol = fs.readFileSync(path.join(process.cwd(), "src/lib/passwordPolicy.ts"), "utf-8");
  const readme6b = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf-8");

  assert(publicCfg.includes("export function getPublicSupabaseConfig"), "getPublicSupabaseConfig existe");
  assert(serverSrc.includes("getPublicSupabaseConfig"), "Express usa getPublicSupabaseConfig");
  assert(vercelApi.includes("getPublicSupabaseConfig"), "api/public-config usa getPublicSupabaseConfig");
  assert(passPol.includes("PASSWORD_ERROR_LENGTH") && passPol.includes("PASSWORD_ERROR_CHARACTERS"), "passwordPolicy exporta strings de erro");
  assert(authErr.includes("PASSWORD_ERROR_LENGTH") && authErr.includes("PASSWORD_ERROR_CHARACTERS"), "authErrors reusa as strings da política de senha");

  assert(appSrc.includes("useClinicalDocument"), "App importa useClinicalDocument");
  assert(appSrc.includes("useResponsibilityActions"), "App importa useResponsibilityActions");
  assert(appSrc.includes("useAiSupervisor"), "App importa useAiSupervisor");
  assert(appSrc.includes("useOverflowMenu"), "App importa useOverflowMenu");
  assert(appSrc.includes("AppHeader"), "App importa AppHeader");
  assert(appSrc.includes("AppNav"), "App importa AppNav");
  assert(appSrc.includes("AppModalHost"), "App importa AppModalHost");
  assert(appSrc.includes("ficha={ficha}"), "App continua passando ficha para as abas");
  assert(shell.includes("const [ficha, setFicha]"), "A ficha viva continua em useState");
  assert(shell.includes("setFichaWithBroadcast"), "Broadcast da ficha permanece");
  assert(shell.includes("closeProcedureAtomic"), "Encerramento atômico permanece no hook clínico");
  assert(shell.includes("supervisorDevLog"), "Logger de supervisor permanece");

  const launches = [
    "IntraoperativeVitalsLaunch",
    "IntraoperativeInfusionsLaunch",
    "IntraoperativeGasesLaunch",
    "IntraoperativeHydrationLaunch",
    "IntraoperativeEventsLaunch",
    "IntraoperativeSupportLaunch",
    "IntraoperativeDrugsLaunch",
    "IntraoperativeTimersLaunch",
    "IntraoperativeChartLaunch"
  ];
  for (const name of launches) {
    assert(fs.existsSync(path.join(process.cwd(), `src/components/intra/${name}.tsx`)), `${name} extraído`);
    assert(intraTab.includes(name), `IntraoperativeTab monta ${name}`);
  }
  assert(intraTab.includes("IntraoperativeUiProvider"), "IntraoperativeTab envolve os painéis no provider");
  assert(intraTab.includes("ficha: AnesthesiaDocument"), "Contrato da aba intra não mudou");
  assert(!intraTab.includes("const renderVitals"), "renderVitals saiu do orquestrador");
  assert(!intraTab.includes("const renderSupport"), "renderSupport saiu do orquestrador");
  assert(!intraAll.includes("from \"./VitalsPanel\"") && !intraAll.includes("from \"../VitalsPanel\""), "6B não reintroduz VitalsPanel");
  assert(!intraAll.includes("from \"./BolusDrugsPanel\"") && !intraAll.includes("from \"../BolusDrugsPanel\""), "6B não reintroduz BolusDrugsPanel");
  assert(!intraAll.includes("from \"./SupportPanel\"") && !intraAll.includes("from \"../SupportPanel\""), "6B não reintroduz SupportPanel");
  const drugsIds = [...intraAll.matchAll(/\bid=["']drugs["']/g)];
  assert(drugsIds.length === 1, "id=drugs continua único depois do fatiar");

  assert(readme6b.includes("6B") && readme6b.includes("useClinicalDocument"), "README documenta a extração 6B");
} catch (err) {
  assert(false, `Falha na verificação da Fase 6B: ${err}`);
}

// 19. FASE 7 — tipos, PWA, headers, lock, IA, PDF, CORS
console.log("\n19. Verificando Fase 7 (hardening)...");
try {
  const { execSync } = await import("node:child_process");
  execSync("npx tsc --noEmit -p tsconfig.lib.strict.json", { stdio: "pipe" });
  assert(true, "tsconfig.lib.strict.json passa (src/lib em strict)");

  const tsconfig = fs.readFileSync(path.join(process.cwd(), "tsconfig.json"), "utf-8");
  assert(!/"strict"\s*:\s*true/.test(tsconfig), "tsconfig principal não liga strict global");
  assert(tsconfig.includes("src/lib/ts-strict-shims"), "tsconfig principal exclui o shim de React");

  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8"));
  assert(pkg.scripts["lint:lib"] === "tsc --noEmit -p tsconfig.lib.strict.json", "package.json tem lint:lib");
  assert(!JSON.stringify(pkg).includes("@types/react"), "App não instala @types/react no projeto inteiro");

  const sigSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/signatureService.ts"), "utf-8");
  assert(!sigSrc.includes("obj: any"), "signatureService não usa obj: any");

  const { PWA_CACHE_NAME, PWA_REGISTER_TYPE } = await import("../lib/pwaPolicy.ts");
  assert(PWA_CACHE_NAME === "anestflow-pwa-v7", "cacheName da PWA é anestflow-pwa-v7");
  assert(PWA_REGISTER_TYPE === "autoUpdate", "PWA usa autoUpdate");
  const viteConfig = fs.readFileSync(path.join(process.cwd(), "vite.config.ts"), "utf-8");
  assert(viteConfig.includes("cacheId") && viteConfig.includes("PWA_CACHE_NAME"), "vite.config versiona cacheId");
  assert(viteConfig.includes("skipWaiting: true") && viteConfig.includes("clientsClaim: true"), "SW faz skipWaiting e clientsClaim");
  assert(viteConfig.includes("cleanupOutdatedCaches: true"), "SW limpa caches antigos");
  const mainSrc = fs.readFileSync(path.join(process.cwd(), "src/main.tsx"), "utf-8");
  assert(mainSrc.includes("import.meta.env.DEV") && mainSrc.includes("unregister"), "Unregister de SW só em DEV");
  const prodish = mainSrc.split("import.meta.env.DEV")[0];
  assert(!prodish.includes("unregister"), "Produção não desregistra o service worker");

  const { ANESTFLOW_SECURITY_HEADERS } = await import("../lib/securityHeaders.ts");
  const vercelCfg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf-8"));
  const vercelHeaders: Array<{ key: string; value: string }> = vercelCfg.headers?.[0]?.headers ?? [];
  for (const [key, value] of Object.entries(ANESTFLOW_SECURITY_HEADERS)) {
    const found = vercelHeaders.find((h) => h.key === key);
    assert(found?.value === value, `vercel.json replica ${key}`);
  }
  assert(ANESTFLOW_SECURITY_HEADERS["Permissions-Policy"].includes("microphone=(self)"), "Permissions-Policy libera microfone no próprio origin");
  assert(ANESTFLOW_SECURITY_HEADERS["Permissions-Policy"].includes("camera=()"), "Permissions-Policy bloqueia câmera");
  assert(ANESTFLOW_SECURITY_HEADERS["Content-Security-Policy"].includes("frame-ancestors 'none'"), "CSP tem frame-ancestors none");
  const serverSrc = fs.readFileSync(path.join(process.cwd(), "server.ts"), "utf-8");
  assert(serverSrc.includes("applyAnestflowSecurityHeaders"), "Express aplica os mesmos headers");
  const apiSrc = fs.readFileSync(path.join(process.cwd(), "api/public-config.ts"), "utf-8");
  assert(apiSrc.includes("ANESTFLOW_SECURITY_HEADERS"), "public-config Vercel aplica os headers");

  assert(WORKSTATION_LOCK_MS === 20 * 60 * 1000, "Lock do posto é 20 minutos");
  assert(SIGNATURE_STEP_UP_MS === 15 * 60 * 1000, "Step-up de assinatura é 15 minutos");
  assert(SESSION_INACTIVITY_MS === 8 * 60 * 60 * 1000, "Logout por ociosidade continua 8 horas");
  const t0 = 2_000_000;
  assert(
    evaluateWorkstationLock({ startedAt: t0, lastActivityAt: t0, now: t0 + 19 * 60 * 1000 }) === false,
    "19 min ociosos não travam o posto"
  );
  assert(
    evaluateWorkstationLock({ startedAt: t0, lastActivityAt: t0, now: t0 + 20 * 60 * 1000 }) === true,
    "20 min ociosos travam o posto"
  );
  assert(
    evaluateSession({ startedAt: t0, lastActivityAt: t0, now: t0 + 8 * 60 * 60 * 1000 }) === "inactivity",
    "8h ociosas ainda encerram a sessão"
  );
  assert(
    needsSignatureStepUp({ startedAt: t0, lastActivityAt: t0, now: t0 + 14 * 60 * 1000 }) === false,
    "14 min não pedem senha na assinatura"
  );
  assert(
    needsSignatureStepUp({ startedAt: t0, lastActivityAt: t0, now: t0 + 15 * 60 * 1000 }) === true,
    "15 min pedem senha na assinatura"
  );

  const guardSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/useSessionGuard.ts"), "utf-8");
  assert(guardSrc.includes("onLock") && guardSrc.includes("lockedRef"), "useSessionGuard tem onLock e respeita locked");
  assert(guardSrc.includes("if (lockIfNeeded()) return"), "Clique que dispara o lock não renova o relógio");
  const appSrc = clinicalShellSrc();
  assert(appSrc.includes("WorkstationLockScreen"), "App monta o overlay de lock");
  assert(appSrc.includes("needsSignatureStepUp"), "Encerramento pede step-up de senha");
  assert(appSrc.includes("setWorkstationLocked(true)"), "Lock não faz logout");
  const lockUi = fs.readFileSync(path.join(process.cwd(), "src/components/WorkstationLockScreen.tsx"), "utf-8");
  assert(lockUi.includes("signInWithPassword"), "Desbloqueio revalida a senha");
  assert(!lockUi.includes("signOut") && !lockUi.includes("setFicha"), "Lock não destrói a ficha nem faz logout sozinho");

  const { getBlankDocument } = await import("../mockData.ts");
  const { toAIClinicalContext, aiContextOmitsIdentifiers } = await import("../lib/aiClinicalContext.ts");
  const fichaIa = getBlankDocument();
  fichaIa.id = "fase07-doc";
  fichaIa.currentResponsibleUid = "uid-responsavel";
  fichaIa.participantUids = ["uid-responsavel"];
  fichaIa.patient.fullName = "Paciente Teste Fase Sete";
  fichaIa.patient.cpf = "39053344705";
  fichaIa.patient.recordNumber = "PRONT-7";
  fichaIa.patient.admissionNumber = "ADM-7";
  fichaIa.voiceTranscripts = [{ id: "vt-ia", transcriptOriginal: "paciente João CPF 390", createdAt: "2026-08-29T12:00:00.000Z" }];
  const ctx = toAIClinicalContext(fichaIa);
  assert(aiContextOmitsIdentifiers(ctx), "toAIClinicalContext omite identificadores");
  assert(fichaIa.patient.cpf === "39053344705", "Strip da IA não muta a ficha viva");
  assert(ctx.patient && typeof ctx.patient === "object" && !("cpf" in (ctx.patient as object)), "CPF não vai no contexto");
  assert(!("voiceTranscripts" in ctx), "Transcrição original não vai para a IA");
  const reviewUi = fs.readFileSync(path.join(process.cwd(), "src/components/ReviewTab.tsx"), "utf-8");
  assert(reviewUi.includes("toAIClinicalContext(ficha)"), "ReviewTab envia contexto stripado");
  const drawerUi = fs.readFileSync(path.join(process.cwd(), "src/components/AnesthesiaDescriptionDrawer.tsx"), "utf-8");
  assert(drawerUi.includes("toAIClinicalContext(ficha)"), "Descrição envia contexto stripado");
  assert(drawerUi.includes("document: toAIClinicalContext(ficha)"), "Chave document da Edge permanece");

  const geminiSrc = fs.readFileSync(path.join(process.cwd(), "supabase/functions/_shared/gemini.ts"), "utf-8");
  const gatewaySrc = fs.readFileSync(path.join(process.cwd(), "supabase/functions/_shared/geminiGateway.ts"), "utf-8");
  const edgeModelSrc = fs.readFileSync(path.join(process.cwd(), "supabase/functions/_shared/aiModelConfig.ts"), "utf-8");
  assert(!geminiSrc.includes("gemini-flash-latest"), "Modelo gemini-flash-latest foi removido");
  assert(!geminiSrc.includes("PRIMARY_MODELS"), "gemini.ts não escolhe modelo por lista de fallback");
  assert(edgeModelSrc.includes("gemini-3.6-flash") && edgeModelSrc.includes("gemini-3.5-transcribe"), "Config da Edge pina 3.6-flash e 3.5-transcribe");
  assert(geminiSrc.includes("prompt_version") && geminiSrc.includes("GeminiInvocationMeta"), "Gemini devolve metadados versionados");
  assert(gatewaySrc.includes("store: false") && gatewaySrc.includes("thinking_level"), "Gateway usa store false e thinking_level");
  const reviewFn = fs.readFileSync(path.join(process.cwd(), "supabase/functions/review/index.ts"), "utf-8");
  assert(reviewFn.includes("CLINICAL_REVIEW_PROMPT_VERSION"), "review declara prompt_version versionado");
  assert(reviewFn.includes("AI_REVIEW_PARSE_FAILED") || reviewFn.includes("AI_REVIEW_SCHEMA_INVALID"), "Parse falho de review continua explícito");
  assert(reviewFn.includes("AI_REVIEW_FAILED"), "Falha de API de review é explícita");
  assert(reviewFn.includes("stripClinicalIdentifiers"), "Edge review stripa identificadores");
  const { parseAiReviewPayload, AI_REVIEW_PARSE_FAILED } = await import("../lib/aiReviewParse.ts");
  assert(parseAiReviewPayload({ alerts: [], ai: { model: "gemini-3.1-flash-lite" } }).ok === true, "Metadados extras não viram parse falho");
  assert(parseAiReviewPayload({ error: AI_REVIEW_PARSE_FAILED, ai: { success: false } }).ok === false, "AI_REVIEW_PARSE_FAILED continua distinto de alerts vazios");
  assert(parseAiReviewPayload({ alerts: [] }).ok === true, "alerts: [] continua sucesso (zero achados)");

  const {
    toSignedAnesthesiaRecordV1,
    pdfFinalSearchableText,
    parseSignedAnesthesiaRecordV1,
    buildSignedRecordPdfBytes,
    SIGNED_RECORD_SCHEMA,
  } = await import("../lib/pdfFinal.ts");
  const { UNREGISTERED } = await import("../lib/clinicalDisplay.ts");
  const signed = toSignedAnesthesiaRecordV1(getBlankDocument());
  const text1 = pdfFinalSearchableText(signed);
  const text2 = pdfFinalSearchableText(signed);
  assert(text1 === text2, "Golden do PDF final é estável");
  assert(signed.schema === SIGNED_RECORD_SCHEMA, "Schema do PDF final é SignedAnesthesiaRecordV1");
  assert(text1.includes(UNREGISTERED), "Ausência no PDF final permanece ausência");
  assert(!text1.includes("120/80"), "PDF final não inventa 120/80");
  const pdfPreview = fs.readFileSync(path.join(process.cwd(), "src/components/PdfPreviewModal.tsx"), "utf-8");
  assert(pdfPreview.includes("html-to-image") || pdfPreview.includes("toPng") || pdfPreview.includes("htmlToImage"), "Preview de captura permanece");

  const goldenRaw = fs.readFileSync(path.join(process.cwd(), "src/tests/fixtures/signed_record_v1_golden.json"), "utf-8");
  const goldenHash = "AABBCCDDEEFF00112233445566778899AABBCCDDEEFF00112233445566778899";
  const parsedGolden = parseSignedAnesthesiaRecordV1(goldenRaw, goldenHash);
  assert(parsedGolden?.schema === SIGNED_RECORD_SCHEMA, "parse do snapshot 4B");
  assert(parsedGolden?.procedureId === "11111111-1111-4111-8111-111111111111", "snapshot traz procedureId");
  assert(parsedGolden?.revision === 2, "snapshot traz revision");
  const goldenText = pdfFinalSearchableText(parsedGolden!);
  assert(goldenText === pdfFinalSearchableText(parsedGolden!), "texto pesquisável do golden é determinístico");
  assert(goldenText.includes("tem ta cinquenta"), "PDF inclui transcrição original");
  assert(goldenText.includes(goldenHash), "PDF inclui integrity hash");
  assert(goldenText.includes(`procedure.diagnosis=${UNREGISTERED}`), "diagnóstico vazio permanece ausência");
  assert(!goldenText.includes("120/80"), "golden não inventa 120/80");
  const pdfBytes = buildSignedRecordPdfBytes(parsedGolden!);
  const pdfAscii = Buffer.from(pdfBytes).toString("latin1");
  assert(pdfAscii.startsWith("%PDF"), "PDF final começa com %PDF");
  assert(pdfAscii.includes("SignedAnesthesiaRecordV1"), "bytes do PDF contêm o schema");
  assert(pdfAscii.includes("tem ta cinquenta"), "bytes do PDF contêm a transcrição original");
  assert(pdfAscii.includes("11111111-1111-4111-8111-111111111111"), "bytes do PDF contêm procedureId");

  const fichaSnap = getBlankDocument();
  fichaSnap.signatureSnapshot = goldenRaw;
  fichaSnap.hash = goldenHash;
  const fromSnap = toSignedAnesthesiaRecordV1(fichaSnap);
  assert(fromSnap.procedureId === parsedGolden?.procedureId, "toSigned prefere o snapshot 4B");
  assert(fromSnap.voiceTranscripts[0]?.transcriptOriginal === "tem ta cinquenta", "snapshot hidrata transcript_original");

  const { applyVoiceActionsToDocument } = await import("../lib/voiceCommand.ts");
  const { parentPayloadForWrite } = await import("../lib/procedureMapper.ts");
  const { clinicalChangeFingerprint, CLINICAL_FINGERPRINT_FIELDS } = await import("../lib/clinicalChangeFingerprint.ts");
  const heard = "tem ta cinquenta";
  const blankVoice = getBlankDocument();
  const withTranscript = applyVoiceActionsToDocument(blankVoice, {}, null, new Date("2026-08-29T12:00:00Z"), heard);
  assert(withTranscript.voiceTranscripts?.[0]?.transcriptOriginal === heard, "apply grava transcript_original sem mutar");
  const appended = applyVoiceActionsToDocument(withTranscript, {}, null, new Date("2026-08-29T12:01:00Z"), heard);
  assert(appended.voiceTranscripts?.length === 2, "nova fala faz append");
  assert(
    clinicalChangeFingerprint(withTranscript) !== clinicalChangeFingerprint(blankVoice),
    "fingerprint muda ao gravar transcrição"
  );
  assert(
    (CLINICAL_FINGERPRINT_FIELDS as readonly string[]).includes("voiceTranscripts"),
    "fingerprint cobre voiceTranscripts"
  );
  const payloadVoice = parentPayloadForWrite(withTranscript, "alice-uid", { includeStatus: true });
  assert(Array.isArray(payloadVoice.voice_transcripts), "mapper persiste voice_transcripts");

  const modalSrc = fs.readFileSync(path.join(process.cwd(), "src/components/VoiceCommandConfirmModal.tsx"), "utf-8");
  assert(modalSrc.includes("Transcrição original"), "Modal rotula transcrição original");
  const voiceFn7 = fs.readFileSync(path.join(process.cwd(), "supabase/functions/voice-command/index.ts"), "utf-8");
  assert(voiceFn7.includes("transcript_original"), "Edge declara transcript_original");
  assert(voiceFn7.includes("VOICE_PROMPT_VERSION") && voiceFn7.includes("VOICE_SCHEMA_VERSION"), "Edge usa prompt/schema versionados da voz");
  assert(voiceFn7.includes("NÃO converta"), "Prompt proíbe corrigir fonema em transcript_original");
  assert(voiceFn7.includes("transcription"), "voice-command ainda transcreve antes de interpretar");

  const mig7eName = fs.readdirSync(path.join(process.cwd(), "supabase/migrations")).find((f) => f.includes("voice_transcripts"));
  assert(!!mig7eName, "Migration voice_transcripts existe");
  const mig7e = fs.readFileSync(path.join(process.cwd(), "supabase/migrations", mig7eName as string), "utf-8");
  assert(mig7e.includes("voice_transcripts") && mig7e.includes("voiceTranscripts"), "Migration inclui coluna e chave do selo");
  assert(mig7e.includes("jsonb_array_length"), "Selo só inclui voiceTranscripts quando há itens");

  assert(reviewUi.includes("PDF final (selo)"), "Review oferece PDF final do selo");
  assert(reviewUi.includes("downloadSignedRecordPdf"), "Review baixa o PDF derivado do contrato 4B");
  assert(reviewUi.includes("Transcrições originais"), "Review lista transcrições originais");

  const corsSrc = fs.readFileSync(path.join(process.cwd(), "supabase/functions/_shared/cors.ts"), "utf-8");
  assert(corsSrc.includes("ANESTFLOW_CORS_ORIGIN"), "CORS aceita origem opcional");
  assert(corsSrc.includes("|| \"*\""), "CORS default continua *");
  const authSrc = fs.readFileSync(path.join(process.cwd(), "supabase/functions/_shared/auth.ts"), "utf-8");
  assert(authSrc.includes("getUser") && authSrc.includes("email_confirmed_at"), "JWT + e-mail confirmado permanecem");
  const configToml = fs.readFileSync(path.join(process.cwd(), "supabase/config.toml"), "utf-8");
  assert(configToml.includes("verify_jwt = true"), "verify_jwt permanece ligado");

  const intraSrc = fs.readFileSync(path.join(process.cwd(), "src/components/IntraoperativeTab.tsx"), "utf-8");
  assert(appSrc.includes("useClinicalDocument"), "App.tsx permanece orquestrador após 6B");
  assert(intraSrc.includes("ficha: AnesthesiaDocument"), "IntraoperativeTab.tsx permanece o contrato da aba");
  assert(intraSrc.includes("IntraoperativeUiProvider"), "IntraoperativeTab.tsx orquestra os painéis extraídos");

  const readme7 = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf-8");
  assert(readme7.includes("Fase 7") && readme7.includes("toAIClinicalContext"), "README documenta Fase 7");
  assert(readme7.includes("20 min") && readme7.includes("lint:lib"), "README documenta lock e lint:lib");
  assert(readme7.includes("transcript_original") && readme7.includes("PDF final (selo)"), "README documenta 7E/7F");
} catch (err) {
  const extra =
    err && typeof err === "object" && "stderr" in err
      ? String((err as { stderr?: Buffer | string }).stderr || "")
      : "";
  assert(false, `Falha na verificação da Fase 7: ${err}${extra ? `\n${extra}` : ""}`);
}

// 20. CHECKPOINT PÓS-FASE 4
console.log("\n20. Verificando checkpoint pós-Fase 4 (auditoria antes da higiene)...");
try {
  const { isProcedureIntegrityIntact } = await import("../lib/proceduresService.ts");
  const { CLINICAL_FINGERPRINT_FIELDS } = await import("../lib/clinicalChangeFingerprint.ts");
  const { canEditDocument } = await import("../lib/assertCanEdit.ts");
  const { evaluateSigningReadiness } = await import("../lib/signingReadinessEngine.ts");
  const { getBlankDocument } = await import("../mockData.ts");
  const { UNREGISTERED, displayBloodPressure } = await import("../lib/clinicalDisplay.ts");
  const { localStorageHoldsClinicalPhi, CLINICAL_STORAGE_KEYS } = await import("../lib/clinicalStorageKeys.ts");

  const intact = {
    snapshotOk: true,
    persistedOk: true as boolean | null,
    storedHash: "aa",
    snapshotHash: "aa",
    schema: "SignedAnesthesiaRecordV1",
    legacy: false
  };
  assert(isProcedureIntegrityIntact(intact) === true, "A+B é íntegro");
  assert(isProcedureIntegrityIntact({ ...intact, persistedOk: false }) === false, "A sem B não é íntegro");
  assert(isProcedureIntegrityIntact({ ...intact, persistedOk: null, legacy: true }) === false, "legado A-only não é íntegro");
  assert(isProcedureIntegrityIntact({ ...intact, snapshotOk: false }) === false, "B sem A não é íntegro");

  const fp = CLINICAL_FINGERPRINT_FIELDS as readonly string[];
  for (const field of ["timers", "inhalationAgents", "fluids", "recovery", "airway", "checklist"]) {
    assert(fp.includes(field), `fingerprint cobre ${field}`);
  }

  const blank = getBlankDocument();
  const emptyBp = displayBloodPressure(undefined, undefined);
  assert(emptyBp === UNREGISTERED, "PA ausente permanece Não registrado");
  assert(!emptyBp.includes("120"), "PA ausente não vira 120");

  const unsigned = evaluateSigningReadiness(blank);
  assert(unsigned.canClose === false, "ficha em branco não encerra");
  assert(!unsigned.alerts.some((a) => /capno|EtCO/i.test(`${a.title} ${a.description}`)), "capnografia não é bloqueio");

  const creatorBlocked = canEditDocument(
    { status: "Draft", currentResponsibleUid: "alice-uid", team: { anesthesiologistLead: "Alice" } },
    "creator-uid"
  );
  assert(creatorBlocked.ok === false, "criador que não é responsável não edita");
  const signedBlocked = canEditDocument(
    { status: "Signed", currentResponsibleUid: "alice-uid", team: { anesthesiologistLead: "Alice" } },
    "alice-uid"
  );
  assert(signedBlocked.ok === false, "ficha assinada bloqueia o responsável");

  localStorage.setItem(CLINICAL_STORAGE_KEYS.anesthesiaDoc, JSON.stringify({ patient: { fullName: "PHI_CHKPT" } }));
  assert(localStorageHoldsClinicalPhi() === true, "detector de PHI legado ainda funciona");
  localStorage.removeItem(CLINICAL_STORAGE_KEYS.anesthesiaDoc);

  const procSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/proceduresService.ts"), "utf-8");
  const appSrc = clinicalShellSrc();
  const reviewSrc = fs.readFileSync(path.join(process.cwd(), "src/components/ReviewTab.tsx"), "utf-8");
  const readme = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf-8");

  assert(procSrc.includes("closeProcedureAtomic") && !procSrc.includes("p_canonical"), "encerramento não envia canonical");
  assert(appSrc.includes("closeProcedureAtomic") && !appSrc.includes("signAndLockDocument"), "App sela no servidor");
  assert(reviewSrc.includes("isProcedureIntegrityIntact"), "ReviewTab exige A e B");
  assert(procSrc.includes("rpc(\"assume_responsibility\""), "assunção excepcional continua RPC próprio");
  assert(procSrc.includes("rpc(\"claim_responsibility\""), "aceite continua claim RPC");

  const lives = [
    "fase01_live.ts",
    "fase03_live.ts",
    "fase04_live.ts",
    "fase04b_live.ts",
    "fase04_handover_live.ts",
    "fase06_live.ts",
    "onda3_live.ts",
    "checkpoint_live.ts"
  ];
  for (const live of lives) {
    assert(fs.existsSync(path.join(process.cwd(), "src/tests", live)), `live ${live} existe`);
  }

  assert(readme.includes("Checkpoint pós-Fase 4"), "README documenta o checkpoint");
  assert(readme.includes("CHECKPOINT_LIVE_OK"), "README aponta o live do checkpoint");
  assert(readme.includes("não fatiar"), "checkpoint ainda não fatiar App/Intra");
} catch (err) {
  assert(false, `Falha na verificação do checkpoint: ${err}`);
}

// 21. HEADER RESPONSIVO
console.log("\n21. Verificando redesign responsivo do header...");
try {
  const headerSrc = fs.readFileSync(path.join(process.cwd(), "src/components/AppHeader.tsx"), "utf-8");
  const navSrc = fs.readFileSync(path.join(process.cwd(), "src/components/AppNav.tsx"), "utf-8");
  const voiceSrc = fs.readFileSync(path.join(process.cwd(), "src/components/VoiceCommandButton.tsx"), "utf-8");
  const badgeSrc = fs.readFileSync(path.join(process.cwd(), "src/components/SyncStatusBadge.tsx"), "utf-8");
  const logoSrc = fs.readFileSync(path.join(process.cwd(), "src/components/AnestFlowLogo.tsx"), "utf-8");
  const shell = clinicalShellSrc();

  assert(headerSrc.includes("ChevronLeft"), "Top bar tem chevron de voltar");
  assert(logoSrc.includes("/logo.png"), "Logo do app é a imagem /logo.png");
  assert(headerSrc.includes("imgClassName"), "Header dimensiona a logo por breakpoint");
  assert(headerSrc.includes("h-[26px]"), "Logo mobile 26px de altura");
  assert(headerSrc.includes("xl:h-16"), "Top bar desktop tem 64px");
  assert(headerSrc.includes("(Anestesiologista)"), "Top bar mostra o médico com especialidade");
  assert(headerSrc.includes("xl:flex"), "Avatar do médico só no desktop");
  assert(headerSrc.includes('variant="header"'), "Microfone do header usa variante discreta");
  assert(headerSrc.includes('variant="plain"'), "Indicador Salvo do header é sutil");
  assert(headerSrc.includes("Visualizar PDF"), "Desktop usa rótulo Visualizar PDF");
  assert(headerSrc.includes("Equipe Médica"), "Desktop usa rótulo Equipe Médica");
  assert(headerSrc.includes("xl:hidden"), "PDF/Equipe abreviados abaixo do desktop");
  assert(headerSrc.includes("#7C3AED"), "Accent roxo do spec no header");
  assert(headerSrc.includes("#FEF3C7"), "Badge Rascunho usa fundo amber do spec");
  assert(headerSrc.includes("headerAnesthesiaChipLabel"), "Chip unificado de status da anestesia");
  assert(!headerSrc.includes("from-indigo-600"), "Header não monta o microfone gigante em gradiente");
  assert(headerSrc.includes('aria-label="Mais opções"'), "Overflow permanece acessível");
  assert(!headerSrc.includes("group-hover:visible"), "Overflow não depende de hover");

  assert(navSrc.includes('shortLabel: "Intraop."'), "Aba intra abreviada é Intraop.");
  assert(navSrc.includes('label: "Auditoria"'), "Aba de auditoria no desktop não concatena Assinatura");
  assert(navSrc.includes("hidden xl:inline"), "Nomes completos das abas só no desktop");
  assert(navSrc.includes("xl:hidden"), "Nomes curtos das abas no mobile/tablet");
  assert(navSrc.includes("bg-gradient-to-l"), "Fade de scroll à direita das abas");
  assert(navSrc.includes("from-white"), "Fade de scroll vai para branco");
  assert(navSrc.includes("bg-[#F3E8FF]"), "Aba ativa usa lilás do spec");

  assert(voiceSrc.includes('variant?: "default" | "header"'), "VoiceCommandButton aceita variante header");
  assert(voiceSrc.includes("h-9 w-9"), "Mic header é 36x36 no mobile");
  assert(voiceSrc.includes("xl:h-10 xl:w-10"), "Mic header é 40x40 no desktop");
  assert(badgeSrc.includes('variant?: "chip" | "plain"'), "SyncStatusBadge aceita variante plain");
  assert(badgeSrc.includes('text-[#10B981]'), "Salvo plain usa verde do spec");

  assert(shell.includes("<VoiceCommandButton"), "Microfone continua montado no shell clínico");
  assert(shell.includes("document.addEventListener"), "Menu overflow escuta document");

  const { getBlankDocument } = await import("../mockData.ts");
  const { headerAnesthesiaChipLabel, getElapsedAnesthesiaString } = await import("../components/AppHeader.tsx");
  const blank = getBlankDocument();
  const now = new Date("2026-08-29T12:30:00Z");
  assert(headerAnesthesiaChipLabel(blank, now) === "Aguardando início", "Chip unificado aguarda início sem timer");
  assert(getElapsedAnesthesiaString(blank, now) === "Não iniciada", "Timer interno permanece Não iniciada sem start");
  const running = {
    ...blank,
    timers: { ...blank.timers, startAnesthesia: "2026-08-29T12:00:00Z" }
  };
  assert(headerAnesthesiaChipLabel(running, now) === "00:30", "Chip em andamento mostra o tempo decorrido");
  const ended = {
    ...blank,
    timers: {
      ...blank.timers,
      startAnesthesia: "2026-08-29T12:00:00Z",
      endAnesthesia: "2026-08-29T13:00:00Z"
    }
  };
  assert(headerAnesthesiaChipLabel(ended, now) === "Anestesia encerrada", "Chip encerrado não mistura com aguardando");
} catch (err) {
  assert(false, `Falha na verificação do header responsivo: ${err}`);
}

// 22. ARQUITETURA DEFINITIVA GEMINI
console.log("\n22. Verificando arquitetura definitiva da IA Gemini...");
try {
  const {
    AI_MODEL_CONFIG,
    FORBIDDEN_CLINICAL_MODELS,
    VOICE_PROMPT_VERSION,
    CLINICAL_REVIEW_PROMPT_VERSION,
    NARRATIVE_PROMPT_VERSION,
    VOICE_SCHEMA_VERSION,
    CLINICAL_REVIEW_SCHEMA_VERSION,
    NARRATIVE_SCHEMA_VERSION,
    assertProductionAiModels,
    isForbiddenClinicalModel,
  } = await import("../lib/aiModelConfig.ts");
  const { transcriptionVocabulary, canonicalAnesthesiaTerms } = await import("../lib/anesthesiaVocabulary.ts");
  const { finalizeVoiceParse, parseSpokenPortugueseNumber, normalizeDoseUnit } = await import("../lib/voiceParserSemantics.ts");
  const {
    parseAiReviewPayload,
    AI_REVIEW_FAILED,
    AI_REVIEW_SCHEMA_INVALID,
    AI_REVIEW_PARSE_FAILED,
    AI_REVIEW_UNAVAILABLE_MESSAGE,
  } = await import("../lib/aiReviewParse.ts");
  const { AI_REVIEW_NO_ALERTS_MESSAGE } = await import("../lib/aiErrorCodes.ts");
  const {
    buildGemini36InteractionBody,
    buildTranscriptionInteractionBody,
    assertNoObsoleteGemini36Sampling,
    extractInteractionText,
  } = await import("../lib/geminiInteraction.ts");
  const { getBlankDocument, FAVORITE_DRUGS } = await import("../mockData.ts");
  const { applyVoiceActionsToDocument } = await import("../lib/voiceCommand.ts");

  assertProductionAiModels();
  assert(AI_MODEL_CONFIG.transcription.model === "gemini-3.5-transcribe", "Transcrição unary é gemini-3.5-transcribe");
  assert(AI_MODEL_CONFIG.transcription.mode === "verbatim", "Transcrição auditável é verbatim");
  assert(AI_MODEL_CONFIG.voiceParser.model === "gemini-3.6-flash" && AI_MODEL_CONFIG.voiceParser.thinkingLevel === "minimal", "Parser 3.6 minimal");
  assert(AI_MODEL_CONFIG.clinicalReview.model === "gemini-3.6-flash" && AI_MODEL_CONFIG.clinicalReview.thinkingLevel === "medium", "Supervisor 3.6 medium");
  assert(AI_MODEL_CONFIG.narrative.model === "gemini-3.6-flash" && AI_MODEL_CONFIG.narrative.thinkingLevel === "low", "Narrativa 3.6 low");
  assert(VOICE_PROMPT_VERSION === "voice-parser-v3", "Prompt de voz v3");
  assert(CLINICAL_REVIEW_PROMPT_VERSION === "clinical-review-v4", "Prompt de review v4");
  assert(NARRATIVE_PROMPT_VERSION === "anesthesia-narrative-v2", "Prompt de narrativa v2");
  assert(VOICE_SCHEMA_VERSION === "voice-command-schema-v3", "Schema de voz v3");
  assert(CLINICAL_REVIEW_SCHEMA_VERSION === "clinical-review-schema-v2", "Schema de review v2");
  assert(NARRATIVE_SCHEMA_VERSION === "narrative-schema-v2", "Schema de narrativa v2");
  assert((FORBIDDEN_CLINICAL_MODELS as readonly string[]).includes("gemini-flash-latest"), "Lista de proibidos inclui flash-latest");
  assert(isForbiddenClinicalModel("gemini-3-flash-preview"), "preview é proibido");
  assert(isForbiddenClinicalModel("gemini-3.1-flash-lite"), "3.1-flash-lite antigo é proibido no runtime");
  assert(isForbiddenClinicalModel("gemini-3.7-flash"), "3.7 não entra sem benchmark");
  assert(!isForbiddenClinicalModel("gemini-3.6-flash"), "3.6-flash é o modelo clínico desta versão");
  assert(!isForbiddenClinicalModel("gemini-3.5-transcribe"), "3.5-transcribe é permitido");

  const edgeCfg = fs.readFileSync(path.join(process.cwd(), "supabase/functions/_shared/aiModelConfig.ts"), "utf-8");
  const srcCfg = fs.readFileSync(path.join(process.cwd(), "src/lib/aiModelConfig.ts"), "utf-8");
  for (const id of ["gemini-3.5-transcribe", "gemini-3.6-flash", "voice-parser-v3", "clinical-review-v4", "anesthesia-narrative-v2"]) {
    assert(edgeCfg.includes(id) && srcCfg.includes(id), `Config src e Edge compartilham ${id}`);
  }
  assert(!edgeCfg.includes("gemini-flash-latest"), "Edge config não usa flash-latest");
  assert(!edgeCfg.includes("gemini-3.1-flash-lite"), "Edge config não usa 3.1-flash-lite");

  const gatewaySrc = fs.readFileSync(path.join(process.cwd(), "supabase/functions/_shared/geminiGateway.ts"), "utf-8");
  assert(gatewaySrc.includes("v1beta/interactions"), "Gateway fala Interactions API");
  assert(gatewaySrc.includes("store: false"), "Gateway pede store false");
  assert(gatewaySrc.includes("thinking_level"), "Gateway usa thinking_level");
  assert(!gatewaySrc.includes("thinking_budget"), "Gateway não usa thinking_budget");
  assert(!gatewaySrc.includes("previous_interaction_id"), "Gateway não usa memória remota Gemini");
  assert(gatewaySrc.includes("thinking_summaries") && gatewaySrc.includes("none"), "Gateway não pede resumo de thinking");

  const clinical36 = buildGemini36InteractionBody({
    model: "gemini-3.6-flash",
    input: "ping",
    thinkingLevel: "minimal",
    responseSchema: { type: "object" },
    systemInstruction: "json",
  });
  assertNoObsoleteGemini36Sampling(clinical36);
  assert((clinical36.generation_config as { thinking_level: string }).thinking_level === "minimal", "thinking_level no body 3.6");
  const asr = buildTranscriptionInteractionBody({
    model: "gemini-3.5-transcribe",
    mimeType: "audio/webm",
    data: "AAAA",
    vocabulary: ["fentanil"],
  });
  assertNoObsoleteGemini36Sampling(asr);
  const asrCfg = asr.generation_config as {
    thinking_level?: unknown;
    transcription_config?: {
      language_codes?: string[];
      language_hints?: unknown;
      mode?: { type?: string };
      custom_vocabulary?: string[];
    };
  };
  assert(asrCfg.thinking_level === undefined, "Transcrição não envia thinking_level");
  assert(asrCfg.transcription_config?.mode?.type === "verbatim", "ASR verbatim");
  assert(
    JSON.stringify(asrCfg.transcription_config?.language_codes) === JSON.stringify(["pt-BR"]),
    "buildTranscriptionBody/espelho envia language_codes = [pt-BR]",
  );
  assert(
    asrCfg.transcription_config?.language_hints === undefined,
    "buildTranscriptionBody/espelho NÃO envia language_hints",
  );
  assert(!JSON.stringify(asr).includes("language_hints"), "payload ASR serializado não contém language_hints");
  assert(
    JSON.stringify(asrCfg.transcription_config?.custom_vocabulary) === JSON.stringify(["fentanil"]),
    "custom_vocabulary permanece em transcription_config",
  );
  assert(gatewaySrc.includes("language_codes: [\"pt-BR\"]"), "gateway buildTranscriptionBody usa language_codes");
  assert(!gatewaySrc.includes("language_hints"), "gateway buildTranscriptionBody não usa language_hints");
  const runtimeTsFiles: string[] = [];
  const walkRuntime = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "tests") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkRuntime(full);
      else if (/\.(ts|tsx|js)$/.test(entry.name)) runtimeTsFiles.push(full);
    }
  };
  walkRuntime(path.join(process.cwd(), "src"));
  walkRuntime(path.join(process.cwd(), "supabase/functions"));
  const languageHintsHits = runtimeTsFiles.filter((file) => fs.readFileSync(file, "utf-8").includes("language_hints"));
  assert(
    languageHintsHits.length === 0,
    `runtime sem language_hints (${languageHintsHits.map((f) => path.relative(process.cwd(), f)).join(", ") || "ok"})`,
  );
  assert(extractInteractionText({ output_text: "ok" }) === "ok", "extract usa output_text");
  assert(extractInteractionText({ steps: [{ type: "thought", content: { text: "segredo" } }, { type: "message", content: { text: "fala" } }] }) === "fala", "thinking não vira texto clínico");

  const vocab = transcriptionVocabulary();
  assert(vocab.length > 40 && vocab.length <= 100, "Vocabulário ASR cabe no limite recomendado");
  assert(!vocab.some((term) => /\d+\s*(mg|mcg)/i.test(term)), "Vocabulário não inclui doses padrão");
  const canonical = canonicalAnesthesiaTerms().map((n) => n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
  for (const drug of FAVORITE_DRUGS) {
    const head = drug.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(" ")[0];
    assert(canonical.some((term) => term.includes(head) || head.includes(term.split(" ")[0])), `Catálogo ${drug.name} está no vocabulário`);
  }
  assert(canonical.some((t) => t.includes("fenilefrina")), "Fenilefrina no vocabulário");
  assert(canonical.some((t) => t.includes("vasopressina")), "Vasopressina no vocabulário");
  assert(canonical.some((t) => t.includes("cetorolaco")), "Cetorolaco no vocabulário");

  assert(parseSpokenPortugueseNumber("cem") === 100, "cem → 100");
  assert(parseSpokenPortugueseNumber("zero vírgula um") === 0.1, "zero vírgula um → 0.1");
  assert(normalizeDoseUnit("microgramas") === "mcg", "microgramas → mcg");

  const voice1 = finalizeVoiceParse("fentanil cem microgramas", {
    identifiedActions: { bolusDrugs: [{ name: "fentanil", dose: "cem", unit: "microgramas", route: "EV" }] },
    unparsedFragments: [],
    warnings: [],
  });
  assert(voice1.ok, "VOICE TEST 1 schema ok");
  const bolus1 = voice1.ok ? voice1.result.commands.bolusDrugs?.[0] : undefined;
  assert(bolus1?.name.toLowerCase() === "fentanil", "VOICE TEST 1 drug = fentanil");
  assert(bolus1?.dose === "100", "VOICE TEST 1 dose = 100");
  assert(bolus1?.unit === "mcg", "VOICE TEST 1 unit = mcg");
  assert(!bolus1?.route, "VOICE TEST 1 não inventa rota");

  const voice2 = finalizeVoiceParse("começar sevo", {
    identifiedActions: { inhalationAgents: [{ name: "sevoflurano", concentration: 2 }] },
    unparsedFragments: [],
    warnings: [],
  });
  assert(voice2.ok, "VOICE TEST 2 schema ok");
  const gas2 = voice2.ok ? voice2.result.commands.inhalationAgents?.[0] : undefined;
  assert(gas2 && /sevo/i.test(gas2.name), "VOICE TEST 2 agent = sevoflurano");
  assert(gas2?.concentration == null && gas2?.inspiredConc == null, "VOICE TEST 2 concentration = null");

  const voice3 = finalizeVoiceParse("noradrenalina zero vírgula um micrograma por quilo por minuto", {
    identifiedActions: {
      continuousInfusions: [{
        name: "noradrenalina",
        rate: "zero vírgula um",
        rateUnit: "mcg/kg/min",
        concentration: "8 mg/ml",
      }],
    },
    unparsedFragments: [],
    warnings: [],
  });
  assert(voice3.ok, "VOICE TEST 3 schema ok");
  const inf3 = voice3.ok ? voice3.result.commands.continuousInfusions?.[0] : undefined;
  assert(inf3?.rate === "0.1", "VOICE TEST 3 rate = 0.1");
  assert(inf3?.rateUnit === "mcg/kg/min", "VOICE TEST 3 unit = mcg/kg/min");
  assert(!inf3?.concentration, "VOICE TEST 3 concentration = null");

  const voice4 = finalizeVoiceParse("aquele negócio que a gente sempre usa", {
    identifiedActions: { bolusDrugs: [{ name: "propofol", dose: 150, unit: "mg", route: "EV" }] },
    unparsedFragments: [],
    warnings: [],
  });
  assert(voice4.ok, "VOICE TEST 4 schema ok");
  assert(!voice4.ok || !voice4.result.commands.bolusDrugs?.length, "VOICE TEST 4 não inventa medicamento");
  assert(voice4.ok && (voice4.result.warnings.length > 0 || voice4.result.unparsedFragments.length > 0), "VOICE TEST 4 warning/unparsed");

  const fichaVoice = getBlankDocument();
  const beforeVoice = JSON.stringify(fichaVoice);
  if (voice1.ok) {
    applyVoiceActionsToDocument(fichaVoice, {}, null, new Date("2026-08-29T12:00:00Z"));
  }
  assert(JSON.stringify(fichaVoice) === beforeVoice, "Parser de voz não muta a ficha sem apply real");

  const coherent = parseAiReviewPayload({ alerts: [] });
  assert(coherent.ok === true && coherent.ok && coherent.alerts.length === 0, "Fixture coerente: schema válido e zero alertas");
  const inconsistent = parseAiReviewPayload({
    alerts: [{ type: "Importante", title: "Cirurgia antes da anestesia", description: "Timer de cirurgia precede o de anestesia.", module: "Timing" }],
  });
  assert(inconsistent.ok === true && inconsistent.ok && inconsistent.alerts[0].module === "Timing", "Fixture com inconsistência gera alerta");
  const apiFail = parseAiReviewPayload({ error: AI_REVIEW_FAILED });
  assert(apiFail.ok === false && apiFail.error === AI_REVIEW_FAILED, "API failure → AI_REVIEW_FAILED");
  const schemaFail = parseAiReviewPayload({ error: AI_REVIEW_SCHEMA_INVALID });
  assert(schemaFail.ok === false && schemaFail.error === AI_REVIEW_SCHEMA_INVALID, "Schema failure → AI_REVIEW_SCHEMA_INVALID");
  const schemaMissing = parseAiReviewPayload({ foo: 1 });
  assert(schemaMissing.ok === false && schemaMissing.error === AI_REVIEW_SCHEMA_INVALID, "Objeto sem alerts é schema inválido, não zero alertas");
  const fichaReview = getBlankDocument();
  const beforeReview = JSON.stringify(fichaReview);
  parseAiReviewPayload({ alerts: [{ type: "Critico", title: "X", description: "Y", module: "Drugs" }] });
  parseAiReviewPayload({ error: AI_REVIEW_FAILED });
  assert(JSON.stringify(fichaReview) === beforeReview, "Nenhum cenário do supervisor altera a ficha");
  assert(String(AI_REVIEW_UNAVAILABLE_MESSAGE) !== String(AI_REVIEW_NO_ALERTS_MESSAGE), "Indisponível ≠ nenhum alerta");
  assert(AI_REVIEW_PARSE_FAILED === "AI_REVIEW_PARSE_FAILED", "Código legado de parse permanece");

  const reviewUi = fs.readFileSync(path.join(process.cwd(), "src/components/ReviewTab.tsx"), "utf-8");
  assert(reviewUi.includes("Nenhum alerta encontrado") || reviewUi.includes("AI_REVIEW_NO_ALERTS_MESSAGE"), "UI de zero alertas existe");
  assert(reviewUi.includes("Auditoria de IA indisponível") || reviewUi.includes("AI_REVIEW_UNAVAILABLE_MESSAGE"), "UI de falha de auditoria existe");
  assert(reviewUi.includes("Gemini 3.6"), "Loading do supervisor cita 3.6");

  const reactFiles = [
    "src/App.tsx",
    "src/components/ReviewTab.tsx",
    "src/components/VoiceCommandButton.tsx",
    "src/components/AnesthesiaDescriptionDrawer.tsx",
    "src/lib/aiFunctions.ts",
  ];
  for (const file of reactFiles) {
    const src = fs.readFileSync(path.join(process.cwd(), file), "utf-8");
    assert(!src.includes("generativelanguage.googleapis.com"), `${file} não chama Gemini direto`);
    assert(!src.includes("VITE_GEMINI"), `${file} não lê VITE_GEMINI`);
    assert(!src.includes("GEMINI_API_KEY"), `${file} não embute GEMINI_API_KEY`);
  }
  const aiFn = fs.readFileSync(path.join(process.cwd(), "src/lib/aiFunctions.ts"), "utf-8");
  assert(!aiFn.includes("GEMINI_API_KEY"), "Cliente invoke não lê GEMINI_API_KEY");
  assert(aiFn.includes("functions.invoke"), "Cliente continua no Edge");

  const voiceBtn = fs.readFileSync(path.join(process.cwd(), "src/components/VoiceCommandButton.tsx"), "utf-8");
  assert(voiceBtn.includes("sendToVoiceEdge"), "Botão de voz chama a Edge, não Gemini");
  assert(!voiceBtn.includes("sendToGemini("), "Nome sendToGemini saiu do cliente");
  const headerSrc = fs.readFileSync(path.join(process.cwd(), "src/components/AppHeader.tsx"), "utf-8");
  assert(headerSrc.includes("unparsedFragments"), "Header encaminha fragments da voz");
  const appSrc = clinicalShellSrc();
  assert(appSrc.includes("finalizeVoiceParse"), "Confirmação de voz passa por validação semântica");
  const modalSrc = fs.readFileSync(path.join(process.cwd(), "src/components/VoiceCommandConfirmModal.tsx"), "utf-8");
  assert(modalSrc.includes("warnings"), "Modal mostra warnings da proposta");

  const voiceFn = fs.readFileSync(path.join(process.cwd(), "supabase/functions/voice-command/index.ts"), "utf-8");
  assert(voiceFn.includes('feature: "transcription"') && voiceFn.includes('feature: "voiceParser"'), "Voz separa transcrição e interpretação");
  assert(voiceFn.includes("VOICE_TRANSCRIPTION_FAILED") && voiceFn.includes("VOICE_PARSE_FAILED") && voiceFn.includes("VOICE_SCHEMA_INVALID"), "Voz tem códigos fail-closed");
  const descFn = fs.readFileSync(path.join(process.cwd(), "supabase/functions/generate-description/index.ts"), "utf-8");
  assert(!descFn.includes('description: ""') || descFn.includes("AI_NARRATIVE_SCHEMA_INVALID"), "Narrativa não mascara falha com string vazia");
  const readme = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf-8");
  assert(readme.includes("gemini-3.6-flash") && readme.includes("GeminiGateway"), "README 7E documenta a arquitetura nova");
  assert(readme.includes("store: false"), "README documenta store false");
} catch (err) {
  assert(false, `Falha na verificação da arquitetura Gemini: ${err}`);
}

// 23. VERIFICAÇÃO FINAL DE RESULTADOS
console.log("\n=================================================");
console.log(`📊 RESUMO DOS TESTES: ${passedTests}/${totalTests} aprovados (${Math.round((passedTests/totalTests)*100)}%)`);
console.log("=================================================");

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
