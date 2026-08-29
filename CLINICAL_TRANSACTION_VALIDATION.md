# Validação da transação clínica

Projeto hospedado: **Anestflow** `plciototnjsdjzhudptc`. Pacientes sintéticos. Sem PHI. Baseline Gemini **não** foi alterada.

Auditoria prévia: `ATOMICITY_AND_RLS_AUDIT.md`.

Suíte local: `npx tsc --noEmit`, `npm run lint:lib`, `npx tsx src/tests/run_tests.ts` → **949/949**.

---

## 1. Atomicity — PASS

`saveProcedure` chama `save_procedure_atomic`. Pai + vitais + bolus + fluidos + infusões + eventos na mesma transação. Uma `revision` por save clínico.

Evidência: `fase_atomic_live.ts` TESTE A — Sevo + FC + fluido + evento persistidos, insert revision 1, save completo 1 → 2. Ficha `3e4f6b70-7fc1-452e-9f5b-7a86e2a5cbc3`.

## 2. Revision conflict — PASS

Duas cópias na mesma revision: A salva, B com payload diferente recebe `stale_revision`. Conteúdo de B não sobrescreve A.

Evidência: TESTE C (`fase_atomic_live.ts`) e conflito multiaba (`fase_longcase_live.ts`).

## 3. Rollback — PASS

RPC com `events` inválido: erro `invalid_child_payload`, revision inalterada, nome do paciente inalterado, filhos intactos.

Evidência: TESTE B.

## 4. Child consistency — PASS

Reload após saves múltiplos devolve vitais, bolus, fluidos, eventos, gases, SRPA e transcrição juntos na mesma revision.

Evidência: TESTE A + reload mid do caso longo (31 vitais).

## 5. Hard delete bypass — PASS

`DELETE` autenticado em `procedure_events` não remove a linha (policy/grant).

Evidência: `DELETE bypass NEGADO` no live atômico; o mesmo após assinatura no caso longo.

## 6. Void audit — PASS

`void_clinical_item` grava `voided_at`, `voided_by = auth.uid()`, `void_reason = "Lançamento duplicado"`. Hidratação devolve `voidedAt`.

Evidência: `VOID PASS`.

## 7. Signing Readiness — PASS

Cliente e servidor exigem `startAnesthesia`, `endAnesthesia`, `end >= start`, identificação, responsável/CRM, e recusam `pending_transfer`. Defaults qualitativos não geram CRITICAL. Quantitativos ausentes não são inventados.

Evidência: suíte 24 + `evaluateSigningReadiness` no caso longo antes do selo + `assert_signing_readiness` no `sign_procedure`.

## 8. Signed immutability — PASS

Re-save, INSERT de vital e DELETE de evento após o selo recusados. Nome do paciente inalterado.

Evidência: `imutabilidade PASS` (`fase_longcase_live.ts`).

## 9. Realtime — PASS (código + conflito equivalente)

Short-circuit `incomingRevision < currentRevision`. Fila pendente (dirty) não chama `onRemoteUpdate`. Conflito de duas edições na mesma revision comprovado no live (equivalente ao cenário 1). Evento antigo não rebaixa estado porque o listener refaz `getProcedureById` e ignora revision menor.

## 10. Reload — PASS

`getProcedureById` no meio do caso longo recuperou 31 vitais, Fentanil 100 mcg, `transcript_original` e SRPA (Aldrete 2).

## 11. Long-case simulation — PASS

Anestesia sintética ~2h35 (timestamps 08:00–10:35Z): pré com alteração cardíaca proposital, início, checklist, acesso, 31 vitais, Sevo, RL, diurese, Fentanil confirmado + Propofol, Remifentanil, hipotensão + correção, transcrição original persistida, dois saves, reload, conflito multiaba, SRPA, handover, selo.

Ficha: `4be0f430-1e9c-4982-94ed-d46b6c269f98`.

Voice Scribe: lançamento com `transcriptOriginal = "fentanil cem microgramas"` e bolus confirmado na ficha. A invocação Gemini **não** foi repetida nesta fase (`VOICE_COMMAND_E2E = PASS` na baseline congelada).

## 12. PDF — PASS

`toSignedAnesthesiaRecordV1` + `pdfFinalSearchableText`: `procedureId`, hash SHA-256, transcrição original, snapshot com Fentanil e Sevoflurano. Não inventa `120/80`.

## 13. Integrity verification — PASS / tamper PASS

Estado selado: `snapshotOk=true`, `persistedOk=true`, `isProcedureIntegrityIntact=true`.

Tamper administrativo (UPDATE de um `procedure_vitals.payload` da ficha signed, fora do cliente): `snapshotOk=true`, `persistedOk=false`, `intact=false`. **INTEGRITY MISMATCH** detectado. Hash armazenado inalterado (`3700D76A5230…`).

## 14. AI regression

`VOICE_COMMAND_E2E = PASS`

`src/lib/aiModelConfig.ts` e Edge Functions de voz/review/narrativa **não** foram tocados nesta fase.

| Função | Baseline |
|---|---|
| ASR | `gemini-3.5-transcribe`, `language_codes=["pt-BR"]` |
| Parser | `gemini-3.6-flash`, thinking `minimal`, `voice-parser-v4` / `voice-command-schema-v4` |
| Supervisor | `gemini-3.6-flash`, thinking `medium`, `clinical-review-v4` / `clinical-review-schema-v2` |
| Narrativa | `gemini-3.6-flash`, thinking `low`, `anesthesia-narrative-v2` / `narrative-schema-v2` |

---

## Critérios de aceite (22)

Todos atendidos: save atômico, rollback, uma revision por save, conflito sem overwrite silencioso, Realtime antigo/dirty, hard delete bloqueado, void auditável, `auth.uid()` em ações sensíveis, signed imutável, readiness com início/fim, defaults qualitativos, sem quantitativo inventado, caso longo, reload, multiaba, SRPA/handover, PDF = snapshot, integridade PASS, tamper MISMATCH, Gemini inalterada, VOICE_COMMAND_E2E PASS, build/typecheck/testes verdes.
