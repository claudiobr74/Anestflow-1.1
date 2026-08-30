# Admin Hardening — Auditoria pré-implementação

Fonte: branch `cursor/admin-figma-erp-235e` + schema remoto `plciototnjsdjzhudptc`.
Data: 2026-08-30. Sem PHI.

## Achados

| # | Item | Status | Evidência |
|---|------|--------|-----------|
| 1 | `admin_bootstrap_self` | CONFIRMED | `private.admin_bootstrap_self` insere em `platform_admins` se a tabela estiver vazia. `AdminApp` chama no gate de `/admin`. |
| 2 | `platform_admins` | ALREADY_FIXED | Tabela com FORCE RLS deny-all. 1 linha já provisionada no projeto. |
| 3 | `assert_platform_admin` | ALREADY_FIXED | Toda RPC `admin_*` chama `private.assert_platform_admin()`. |
| 4 | `organization_members` | PARTIAL | Schema e role `admin` existem. Nenhuma RPC usa membership para autorização. |
| 5 | Relação procedure ↔ hospital | CONFIRMED | Admin agrega por `patient->>'hospital'`. `procedures.organization_id` **não existe**. 0 organizações cadastradas. |
| 6 | Integridade no Admin | CONFIRMED | `has_hash AND status=signed` → “Íntegro”. Não chama `verify_procedure_integrity` (snapshotOk/persistedOk). |
| 7 | Geração de `admin_issues` | CONFIRMED | Tabela vazia (0 rows). Sem produtor. Só `admin_update_issue` de status. |
| 8 | Métricas hardcoded | PARTIAL | Operação marca Database/Auth/Atomic/Realtime/Signing como `operational` sem probe. `rollbacks`, `stale_revisions`, falhas = `0`. IA devolve `voice_events=0` e `cost_brl=0`. Frontend `formatInt(null)` já mostra “—”. |
| 9 | Feature flags | CONFIRMED | `admin_settings.feature_flags` e `require_2fa` salvam no banco e **não** alteram runtime clínico. |
| 10 | Mutations de usuários | CONFIRMED | Só list/get. Sem ativar/inativar, membership ou clinic admin. |
| 11 | Mutations de organizações | PARTIAL | `admin_create_organization` existe. Sem update/archive. Campos legais/billing incompletos. |
| 12 | Audit log administrativo | PARTIAL | `private.admin_log(actor, action)` sem `target_type`/`target_id`/metadata. |
| 13 | Paginação | CONFIRMED | Users/orgs/procedures/issues/audit carregam até 200 e filtram no browser (`paginate`). |
| 14 | RPCs existentes | ALREADY_FIXED | Gate + overview + listagens + create org + settings + issues update. Faltam mutações e paginação server-side. |

## Fora de escopo (não alterar)

Core clínico (atomic save, revision, signing, Voice, Gemini baseline), layout Figma, gateway de pagamento.

## Decisões desta rodada

1. Neutralizar `admin_bootstrap_self` (nunca inserir). Provisionar Super Admin só via SQL/service_role.
2. Reutilizar `private.verify_procedure_integrity` (mesmo algoritmo A+B) no Admin.
3. `organization_id` em procedures; matching legado só se inequívoco.
4. `organization_members.role = admin` = CLINIC_ADMIN.
5. Sem hard delete de usuário/org.
6. Telemetria ausente → `null` / “—” / “Não monitorado”.
