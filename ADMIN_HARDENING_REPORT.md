# Admin Hardening — Relatório final

Data: 2026-08-30  
Branch: `cursor/admin-hardening-0e5d`  
Base: `cursor/admin-figma-erp-235e`  
Projeto: `plciototnjsdjzhudptc`  
Escopo: FUNCTIONAL HARDENING. Layout Figma e core clínico não redesenhados.

---

## 1. Executive Summary

O Admin deixou de ser uma camada majoritariamente consultiva. O gate de `/admin` não promove ninguém. Integridade usa a verificação A+B do core (`snapshotOk` + `persistedOk`). Tenancy administrativa usa `procedures.organization_id`. CLINIC_ADMIN é `organization_members.role = admin` e é isolado nas RPCs. Gestão de usuários, memberships e organizações é mutável via RPC auditada. Issues têm produtor real e deduplicação. Operação e IA não inventam zero. Settings sem enforcement estão read-only. Financeiro V1 usa contratos. Paginação server-side cobre users, organizations, procedures, issues e audit.

## 2. P0 Findings

| Item | Status | Ação |
|------|--------|------|
| `admin_bootstrap_self` auto-promove | CONFIRMED → FIXED | Função só retorna `is_platform_admin()`. Sem INSERT. |
| Integridade = hash presente | CONFIRMED → FIXED | `verify_procedure_integrity_core` (mesmo algoritmo A+B). |
| Issues sem produtor | CONFIRMED → FIXED | `admin_integrity_status` + falhas de `record_ai_usage`. |
| procedure ↔ hospital textual | CONFIRMED → FIXED | FK `organization_id`; hospital textual permanece histórico. |

## 3. Bootstrap Security

`private.admin_bootstrap_self()` autenticada no remoto:

```
return private.is_platform_admin();
```

Não há INSERT em `platform_admins`. Provisionamento explícito: `private.provision_platform_admin` restrito a `postgres` / `supabase_admin` / `service_role`. `AdminApp` chama `adminWhoami()`, nunca `adminBootstrapSelf`.

Fluxo: login → `admin_whoami` → SUPER_ADMIN/CLINIC_ADMIN entra; USER recebe 403. Tabela vazia + usuário comum = DENIED, sem linha nova.

## 4. Integrity Verification

Status: `intact` | `snapshot_mismatch` | `persisted_mismatch` | `both_mismatch` | `not_verified` | `legacy`.

Íntegro somente se `snapshotOk = true` AND `persistedOk = true`. Qualquer mismatch → “Inconsistência detectada”. Sem assinatura → “Não verificado”.

Listagem usa `verify_core` (não incrementa issue). Verificação explícita: `admin_verify_procedure` → `admin_integrity_status`.

Teste SQL de tamper (trigger de imutabilidade desligado só durante o UPDATE controlado, depois religado):

- `snapshot_ok = false`
- status `snapshot_mismatch` / `both_mismatch`
- issue `INTEGRITY_MISMATCH` critical criada
- hash restaurado; trigger `procedures_protect_immutability` voltou a `O` (enabled)
- procedimento signed voltou a `intact` / `legacy`

## 5. Multi-Tenancy

`procedures.organization_id` (FK `organizations.id`). Matching legado só se inequívoco. Relatório: 28 procedimentos, 0 matched, 28 unmatched, 0 ambiguous (0 orgs no momento da migração). Novos inserts: `resolve_my_organization_id` + trigger `procedures_assign_organization_id`. Agregações Admin usam `organization_id`, não `patient.hospital` como chave.

## 6. Clinic Admin

`organization_members.role = admin` = CLINIC_ADMIN. `assert_admin_reader` / `admin_visible_org_ids` / `admin_can_access_org` no PostgreSQL. Super Admin vê tudo. Clinic Admin: só orgs próprias; sem financeiro global e sem settings. UI esconde essas abas. Cross-org DENIED na RPC (`not_platform_admin`). Live autenticado (USER B como CLINIC_ADMIN de ORG_A): `admin_get_organization(ORG_A)` PASS; `admin_get_organization(ORG_B)` DENIED (`not_platform_admin`).

## 7. User Management

RPCs: `admin_set_user_status`, `admin_add_membership`, `admin_remove_membership`, `admin_set_membership_role`. Sem hard delete. `profiles.account_status` = `active|inactive|suspended`. Conta inativa falha em `assert_signed_in_confirmed` (`account_inactive`) — bloqueia save/sign/IA. Super Admin não pode ser inativado. Drawer de usuário executa as ações sem redesign.

Auditoria: `USER_ACTIVATED`, `USER_DEACTIVATED`, `MEMBER_ADDED`, `MEMBER_REMOVED`, `MEMBER_ROLE_CHANGED`, `CLINIC_ADMIN_GRANTED`, `CLINIC_ADMIN_REVOKED`.

## 8. Organization Management

CREATE / READ / UPDATE / ARCHIVE. Campos reais: name, legal_name, type, cnpj, city, state, status, plan, monthly_cents, billing_cycle, starts_at, renews_at, notes. Arquivar não apaga procedimentos.

## 9. Issues Pipeline

Produtores reais: `INTEGRITY_MISMATCH` (verificação A+B) e falhas de IA (`VOICE_TRANSCRIPTION_FAILED`, `VOICE_PARSE_FAILED`, `AI_REVIEW_FAILED`). Tipos sem telemetria (PDF, AUTH, ATOMIC_SAVE, SIGNING) **não** geram issue sintético.

Dedup por `dedup_key`. Update incrementa `occurrences` e `last_seen_at`. TEST G (SQL): 3 eventos → 1 issue, `occurrences = 3`.

Status: `open|investigating|resolved|ignored` com `resolved_at` / `resolved_by`.

## 10. Operations Telemetry

Database/Auth = `operational` (probe da própria RPC autenticada). Atomic/Voice/Signing = `operational` só com evento real no período; senão `unknown` → UI “Não monitorado”. Contadores sem fonte = `null` → “—”. Nunca “0 operacional” inventado.

## 11. AI Usage

Tabela `ai_usage` sem transcript, resposta clínica, paciente, prompt ou áudio. Features: `voice_asr`, `voice_parser`, `clinical_review`, `narrative`. Custo em `admin_ai_cost_rates` (centralizado). `invokeAiFunction` registra `record_ai_usage` (latência + status + model/provider/prompt_version/schema_version quando a função devolve) sem alterar modelos/prompts Gemini. Chamadas reais desta rodada aparecem em `admin_ai_overview` (voice/review/narrative). Tokens, `audio_seconds` e custo ficam `null` quando o fluxo existente não os envia.

## 12. Settings Enforcement

`require_2fa`, `feature_flags`, `maintenance_mode` = `NOT_IMPLEMENTED`. RPC recusa mutação (`setting_not_enforced`). UI: toggles disabled + “Ainda não aplicado ao runtime”. `require_2fa` sempre retorna `false`. Campos de plataforma (nome, URL, suporte) continuam editáveis como metadados.

## 13. Dashboard Metric Corrections

- Usuários: `users_registered` / `users_active` (last_sign_in no período). Label: “Usuários cadastrados” se não houver ativo medido.
- “Taxa de assinatura” = signed / total no período (não “sucesso operacional”).
- `cancelled = null` → “—”.
- `in_progress` é snapshot atual.
- Cards de período usam `admin_range_start`.

## 14. Audit Improvements

`private.admin_audit(actor, action, target_type, target_id, organization_id, metadata)`. Exemplo: `ORGANIZATION_CREATED` com `target_type=organization`. Metadata sanitizada (status, role, keys). Sem PHI.

## 15. Server-side Pagination

RPCs `*_page` retornam `items` + `total_count`. Frontend de users, organizations, procedures, issues e audit consome essas RPCs. Filtros secundários da página atual ainda podem restringir o lote recebido.

## 16. Financial V1

Plano, valor, ciclo, renovação e status por organização. MRR derivado de contratos `active` não-trial (`monthly` ou `annual/12`). Sem Stripe/Pix/boleto/NF.

## 17. RLS

Tabelas admin: ENABLE + FORCE RLS + deny-all para `authenticated`/`anon`. Acesso só via RPC `security definer` com `assert_admin_reader` / `assert_super_admin`. Clinic Admin isolado por `organization_id`.

## 18. PHI

RPCs de procedimentos devolvem metadata (id, status, hospital institucional, responsável). Não retornam `patient_name`, CPF, diagnóstico, medicações, vitais, notas clínicas nem `signed_canonical`.

## 19. Tests

Estados usados: `PASS` | `FAIL` | `NOT_RUN` | `SKIPPED`. Nenhum `NOT_RUN`/`SKIPPED` foi promovido a `PASS`.

Contas sintéticas (não produção): `live.hard.a@anestflow.app` (USER A, Super Admin de teste) e `live.hard.b@anestflow.app` (USER B). Variáveis efetivas em `ADMIN_LIVE_E2E_ENV.md`. Secrets não commitados.

| Teste | Resultado |
|-------|-----------|
| A Bootstrap não promove | PASS (`platform_admins` não cresceu; `admin_bootstrap_self` só consulta) |
| B Super Admin dashboard + ORG_A/ORG_B | PASS |
| SUPER_ADMIN_GLOBAL_ACCESS | PASS |
| C CLINIC_ADMIN_OWN_ORG | PASS |
| C CLINIC_ADMIN_CROSS_ORG | DENIED (`not_platform_admin` no PostgreSQL/RPC) |
| D USER_ADMIN_RPC | DENIED (`admin_whoami` = USER; dashboard/orgs recusados) |
| D USER_ADMIN_ROUTE | PASS (SPA: gate `adminWhoami` → USER; mesmas RPCs DENIED; sem auto-promoção) |
| E Membership add/role/remove + audit | PASS (`target_type`, `target_id`, `actor_id` = USER A) |
| F Integridade inicial A+B | PASS (`snapshot_ok=true`, `persisted_ok=true`, `intact`) |
| F Tamper controlado | PASS (`snapshot_ok=false`, `persisted_ok=false`, `both_mismatch`) |
| F Admin mismatch | PASS (`admin_verify_procedure` autenticado; label UI “Inconsistência detectada”) |
| F INTEGRITY_MISMATCH critical | PASS (issue `ad110e09-cbcd-4783-a55c-171f6870da17`) |
| F Restore + trigger | PASS (hash/revision restaurados; `procedures_protect_immutability` = `O`) |
| G Dedup 3 ocorrências | PASS (1 issue, `occurrences=3`) |
| H Settings não enforced | PASS |
| I PHI nas RPCs de procedures | PASS |
| J Paginação | PASS |

`npx tsx src/tests/admin_live_e2e.ts` — **PASS** (nenhum SKIPPED). Reexecução após os fixes: `TEST F verify (pre-tamper) intact`.

### Defeitos reais encontrados no live (corrigidos)

1. `admin_dashboard_overview` — `jsonb_agg(count(*))` no heatmap (`aggregate function calls cannot be nested`). Migration `20260830140600`.
2. `resolve_procedure_organization_id` — `min(uuid)` quebrava todo `save_atomic` (`function min(uuid) does not exist`). Migration `20260830140700`.
3. `invokeAiFunction` — `review` enviava `document.id` como `procedure_id` e o insert em `ai_usage` falhava por FK. Hook deixa de usar `rec.id`.

### Regressão estática

- `npx tsc --noEmit` — PASS
- `npm run lint:lib` — PASS
- `npx tsx src/tests/run_tests.ts` — **1081/1081** PASS
- `npm run build` — PASS (`dist/index.html` title = AnestFlow)

## 20. Clinical Live Regression

Suítes já existentes, paciente sintético, sem duplicar testes:

| Suite | Resultado |
|-------|-----------|
| `fase_atomic_live.ts` (atomic save, rollback, stale, idempotência, DELETE negado, void) | PASS |
| `fase06_live.ts` (revision / stale) | PASS |
| `fase04b_live.ts` (signing, selo A+B, imutabilidade, adendo) | PASS |
| `checkpoint_live.ts` (persistência, signing, A+B) | PASS |
| `fase_longcase_live.ts` (long case, reload, multi-aba, signing, imutabilidade, integrity, PDF) | PASS |
| `onda3_live.ts` (save, hydrate, sign, imutabilidade) | PASS |
| `fase04_handover_live.ts` (A→B) | PASS |

Procedimento sintético do long case usado no tamper: `0337b28d-73c1-4309-9f06-5d788aa28c92`. Após restore: `integrity_status=intact`. Trigger de imutabilidade permanece ligado.

## 21. Voice Live

`npx tsx src/tests/voice_scribe_e2e_live.ts` com WAVs sintéticos (`edge-tts pt-BR-AntonioNeural` → ffmpeg 16 kHz).

Baseline preservada em todos os casos t1–t5:

- ASR: `gemini-3.5-transcribe`
- Parser: `gemini-3.6-flash`
- Prompt: `voice-parser-v4`
- Schema: `voice-command-schema-v4`

`VOICE_COMMAND_E2E = PASS`. Artifact: `/opt/cursor/artifacts/voice_scribe_e2e/results.json`.

## 22. AI telemetry real

Não houve insert manual em `ai_usage`. Chamadas reais:

- Voice ASR+Parser: Voice E2E (fetch) + `invokeAiFunction('voice-command')` com WAV t1
- Supervisor: `invokeAiFunction('review')`
- Narrativa: `onda5_live` `generate-description`

Colunas de `ai_usage` (sem PHI): `feature`, `provider`, `model`, `prompt_version`, `schema_version`, `latency_ms`, `status`, `input_tokens`, `output_tokens`, `audio_seconds`, `estimated_cost`. Não existem colunas de transcript, nome de paciente, resposta clínica, prompt ou áudio.

Exemplo pós-fix (Supervisor): `feature=clinical_review`, `provider=google-gemini`, `model=gemini-3.6-flash`, `prompt_version=clinical-review-v4`, `schema_version=clinical-review-schema-v2`, `latency_ms=7911`, `status=success`. Tokens/áudio/custo = `null` (fluxo existente não envia).

O hook atual mapeia `voice-command` → `voice_parser` (não cria linha separada `voice_asr`). O ASR foi exercitado de verdade e validado no Voice E2E.

`admin_ai_overview` autenticado: `voice_events=3`, `review_events=1`, `narrative_events=1`, `total_ai_events=5`, nota “sem conteúdo clínico”.

---

## Status final

```
ADMIN_BOOTSTRAP_SECURITY          = PASS
ADMIN_INTEGRITY                   = PASS
ADMIN_MULTI_TENANCY               = PASS
ADMIN_CLINIC_ADMIN                = PASS
ADMIN_USER_MANAGEMENT             = PASS
ADMIN_ORGANIZATION_MANAGEMENT     = PASS
ADMIN_ISSUES                      = PASS
ADMIN_OPERATIONS                  = PASS
ADMIN_AI_TELEMETRY                = PASS
ADMIN_SETTINGS                    = PASS
ADMIN_AUDIT                       = PASS
ADMIN_PAGINATION                  = PASS
ADMIN_FINANCIAL_V1                = PASS
ADMIN_RLS                         = PASS
ADMIN_PHI_REVIEW                  = PASS
ADMIN_LIVE_E2E                    = PASS
CORE_CLINICAL_STATIC_REGRESSION   = PASS
CORE_CLINICAL_LIVE_REGRESSION     = PASS
VOICE_COMMAND_E2E                 = PASS
BUILD                             = PASS
```

Critério de release (live):

```
Clinic Admin A → A              = PASS
Clinic Admin A → B              = DENIED
Normal User → Admin             = DENIED
Super Admin global              = PASS
Integrity live                  = PASS
Tamper detection                = PASS
Issue creation                  = PASS
Issue dedup                     = PASS
AI real telemetry               = PASS
Admin Live E2E                  = PASS
Clinical Live Regression        = PASS
Voice E2E                       = PASS
TypeScript                      = PASS
Lint                            = PASS
Tests                           = PASS
Build                           = PASS
```

---

## ANESTFLOW_ADMIN_HARDENED

```
ANESTFLOW_ADMIN_HARDENED = PASS
```
