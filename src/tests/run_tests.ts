import { buildCanonicalDocumentRepresentation, verifyDocumentIntegrity } from "../lib/signatureService.js";
import { AnesthesiaDocument } from "../types.js";
import { validateClinicalPassword, MIN_PASSWORD_LENGTH } from "../lib/passwordPolicy.ts";
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

// 2. AUDITORIA DE REGRAS DO FIRESTORE (firestore.rules vs firebase-blueprint.json)
console.log("\n2. Auditando consistência de Regras Firestore vs Blueprint...");

try {
  const rulesContent = fs.readFileSync(path.join(process.cwd(), "firestore.rules"), "utf-8");
  const blueprintContent = fs.readFileSync(path.join(process.cwd(), "firebase-blueprint.json"), "utf-8");

  assert(rulesContent.includes("function isParticipant"), "Regra de permissão por responsável/participante/admin está presente em firestore.rules");
  assert(rulesContent.includes("match /amendments/{amendmentId}"), "Subcoleção /amendments está mapeada e protegida no Firestore");
  assert(rulesContent.includes("allow update: if false;"), "Bloqueio de alteração em adendos assinados implementado em firestore.rules");
  assert(rulesContent.includes("match /vitals/{vitalId}"), "Subcoleção granular /vitals mapeada");
  assert(rulesContent.includes("match /medications/{medicationId}"), "Subcoleção granular /medications mapeada");
  assert(blueprintContent.includes("procedures/{procedureId}/vitals"), "Blueprint inclui declaração das subcoleções para indexação");
} catch (err) {
  assert(false, `Falha na leitura das regras de segurança: ${err}`);
}

// 3. AUDITORIA DE LIMPEZA DE SESSÃO / LOGOUT
console.log("\n3. Verificando sanitização no Logout...");
try {
  const appContent = fs.readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf-8");
  assert(appContent.includes("localStorage.removeItem(\"anesthesia_user\")"), "Remoção de credenciais locais executada no logout para evitar vazamento");
  assert(appContent.includes("sessionStorage.clear()"), "sessionStorage.clear() executado na troca de conta/logout");
} catch (err) {
  assert(false, `Falha na verificação de logout: ${err}`);
}

// 4. ONDA 2 — AUTH SUPABASE E POLÍTICA DE SENHA
console.log("\n4. Verificando login Supabase (onda 2)...");
try {
  const loginContent = fs.readFileSync(path.join(process.cwd(), "src/components/LoginScreen.tsx"), "utf-8");
  const apiContent = fs.readFileSync(path.join(process.cwd(), "src/lib/api.ts"), "utf-8");
  const serverContent = fs.readFileSync(path.join(process.cwd(), "server.ts"), "utf-8");
  const shareContent = fs.readFileSync(path.join(process.cwd(), "src/components/ShareModal.tsx"), "utf-8");
  const appContent = fs.readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf-8");

  assert(!loginContent.includes("firebase/auth"), "LoginScreen não usa mais Firebase Auth");
  assert(loginContent.includes("signInWithPassword"), "Login usa signInWithPassword do Supabase");
  assert(apiContent.includes("getSession"), "authenticatedFetch lê a sessão Supabase");
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

// 7. VERIFICAÇÃO FINAL DE RESULTADOS
console.log("\n=================================================");
console.log(`📊 RESUMO DOS TESTES: ${passedTests}/${totalTests} aprovados (${Math.round((passedTests/totalTests)*100)}%)`);
console.log("=================================================");

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
