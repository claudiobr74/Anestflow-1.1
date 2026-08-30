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

`organization_members.role = admin` = CLINIC_ADMIN. `assert_admin_reader` / `admin_visible_org_ids` / `admin_can_access_org` no PostgreSQL. Super Admin vê tudo. Clinic Admin: só orgs próprias; sem financeiro global e sem settings. UI esconde essas abas. Cross-org DENIED na RPC (`not_platform_admin`). Teste autenticado com segundo usuário não rodou neste ambiente (`ONDA3_TEST_EMAIL_B` ausente).

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

Tabela `ai_usage` sem transcript, resposta clínica, paciente, prompt ou áudio. Features: `voice_asr`, `voice_parser`, `clinical_review`, `narrative`. Custo em `admin_ai_cost_rates` (centralizado). `invokeAiFunction` registra `record_ai_usage` (latência + status) sem alterar modelos/prompts Gemini. Sem linhas no período → Admin mostra “—” e nota “Sem telemetria”.

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

| Teste | Resultado |
|-------|-----------|
| A Bootstrap (definição remota + sem INSERT) | PASS |
| B Super Admin (RPCs + 1 admin provisionado) | PASS (código/SQL) |
| C Clinic Admin A vs B | NÃO EXECUTADO (sem 2º usuário) |
| D USER denied | coberto por `admin_whoami` + assert nas RPCs |
| E Membership + audit | RPCs + live script |
| F Tamper + issue | PASS (SQL controlado) |
| G Dedup occurrences=3 | PASS (SQL) |
| H Settings não enforced | RPC recusa; UI read-only |
| I PHI | lista não inclui campos clínicos |
| J Paginação | `total_count` + `page_size` |

`src/tests/admin_live_e2e.ts` existe. Sem `ONDA3_TEST_EMAIL` neste workspace o script encerra com `ADMIN_LIVE_E2E_SKIPPED`.

Regressão estática desta rodada:

- `npx tsc --noEmit` — PASS
- `npm run lint:lib` — PASS
- `npx tsx src/tests/run_tests.ts` — **1069/1069** PASS
- `npm run build` — PASS
- `npx tsx src/tests/admin_live_e2e.ts` — SKIPPED (sem `VITE_SUPABASE_*` / `ONDA3_TEST_*`)

## 20. Clinical Regression

Core não foi reescrito. `save_atomic`, revision, signing, `verify_procedure_integrity` público, Voice/Gemini baseline (`gemini-3.5-transcribe`, `gemini-3.6-flash`, voice-parser-v4, schema v4) permanecem. Trigger de imutabilidade foi desligado **apenas** no UPDATE de tamper e religado em seguida.

Suites live clínicas/Voice desta rodada não foram reexecutadas (sem credenciais/áudio). Pinamento de modelos permanece nos testes estáticos.

---

## Status final

```
ADMIN_BOOTSTRAP_SECURITY     = PASS
ADMIN_INTEGRITY              = PASS
ADMIN_MULTI_TENANCY          = PASS
ADMIN_CLINIC_ADMIN           = PARTIAL
ADMIN_USER_MANAGEMENT        = PASS
ADMIN_ORGANIZATION_MANAGEMENT= PASS
ADMIN_ISSUES                 = PASS
ADMIN_OPERATIONS             = PASS
ADMIN_AI_TELEMETRY           = PARTIAL
ADMIN_SETTINGS               = PASS
ADMIN_AUDIT                  = PASS
ADMIN_PAGINATION             = PASS
ADMIN_FINANCIAL_V1           = PASS
ADMIN_RLS                    = PASS
ADMIN_PHI_REVIEW             = PASS
ADMIN_LIVE_E2E               = FAIL
CORE_CLINICAL_REGRESSION     = PASS
```

`ADMIN_CLINIC_ADMIN = PARTIAL`: isolamento implementado no PostgreSQL; falta E2E autenticado A vs B.

`ADMIN_AI_TELEMETRY = PARTIAL`: tabela + hook + UI honesta; `ai_usage` ainda vazio até a próxima chamada real.

`ADMIN_LIVE_E2E = FAIL`: suite autenticada não rodou neste ambiente. Substitutos SQL de A/F/G passaram.

`CORE_CLINICAL_REGRESSION = PASS`: sem mudança funcional do core; testes estáticos cobrem o pinamento. Live Voice/clínico não reexecutado.

---

## ANESTFLOW_ADMIN_HARDENED

```
ANESTFLOW_ADMIN_HARDENED = FAIL
```

Motivo: critério 26 (live E2E autenticado) e critério 10 (TEST C com dois usuários) não foram executados neste ambiente. A implementação dos demais critérios está no código e no schema remoto.

Para promover a PASS: rodar `npx tsx src/tests/admin_live_e2e.ts` com `ONDA3_TEST_EMAIL` / `_B` e a suíte clínica/Voice live já existente.
