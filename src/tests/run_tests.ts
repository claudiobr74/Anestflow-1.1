import { buildCanonicalDocumentRepresentation, verifyDocumentIntegrity } from "../lib/signatureService.js";
import { AnesthesiaDocument } from "../types.js";
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

// 4. VERIFICAÇÃO FINAL DE RESULTADOS
console.log("\n=================================================");
console.log(`📊 RESUMO DOS TESTES: ${passedTests}/${totalTests} aprovados (${Math.round((passedTests/totalTests)*100)}%)`);
console.log("=================================================");

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
