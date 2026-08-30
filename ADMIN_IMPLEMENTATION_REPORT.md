# Relatório de implementação — Admin / ERP Analytics

File Figma: `nKjtTJtOuSQi0fYEuTTjgD` · Página **15 Admin** (`62:2`).

## 1. Executive Summary

O módulo Admin foi implementado como produto real sobre o AnestFlow existente: PWA React + Vite, rotas por `pathname` (sem `react-router-dom`), Supabase do projeto **Anestflow** (`plciototnjsdjzhudptc`), RPCs `security definer` com `assert_platform_admin`, e tabelas novas com RLS **FORCE** + deny-all para `anon`/`authenticated`.

Números do Figma (142 usuários, 864 procedimentos, R$ 87.500, Hospital Santa Maria, GPT-4o) **não** entram no runtime. O banco live, no momento da validação, tinha 4 profiles, 28 procedimentos, 23 eventos de auditoria, 0 organizações, 0 issues e 0 platform admins. Telas vazias e `0` / `—` são o estado verdadeiro.

## 2. Figma Nodes Implemented

| Node | Frame | Implementação |
| ---- | ----- | ------------- |
| `59:549` | admin-visao-geral | `AdminOverviewPage` |
| `59:1010` | admin-organizacoes | `AdminOrganizationsPage` |
| `59:1256` | admin-organizacao-detalhe | `AdminOrganizationDetailPage` |
| `59:1587` | admin-usuarios | `AdminUsersPage` |
| `59:1872` | admin-usuario-detalhe | `AdminUserDrawer` 480px |
| `59:2095` | admin-procedimentos | `AdminProceduresPage` metadata-first |
| `59:2400` | admin-inteligencia-artificial | `AdminAiPage` |
| `59:2760` | admin-financeiro | `AdminFinancialPage` |
| `59:3053` | admin-operacao | `AdminOperationsPage` |
| `59:3329` | admin-problemas | `AdminIssuesPage` |
| `59:3603` | admin-problema-drawer | `AdminIssueDrawer` 520px + overlay |
| `59:3927` | admin-auditoria | `AdminAuditPage` |
| `59:4158` | admin-configuracoes | `AdminSettingsPage` |

`get_screenshot` reconsultado nos 13 nodes na validação visual. Shell: header + tabs horizontais (não sidebar), marca 28×28 `#6c5ce7` + HeartPulse branco.

## 3. Routes

| Path | UI |
| ---- | -- |
| `/admin` | visão geral |
| `/admin/organizations` | lista |
| `/admin/organizations/:id` | detalhe |
| `/admin/users` + `?id=` | lista + drawer |
| `/admin/procedures` | metadata |
| `/admin/ai` | IA |
| `/admin/financial` | financeiro |
| `/admin/operations` | operação |
| `/admin/issues` + `?id=` | problemas + drawer |
| `/admin/audit` | auditoria |
| `/admin/settings` | configurações |

Gate em `AdminApp`: sessão → `admin_bootstrap_self` → `is_platform_admin` → 403 ou shell. Header clínico mostra **Admin** só se `is_platform_admin` for true.

## 4. Components Reused

- `LoginScreen` no gate
- tokens de `src/index.css` (`rounded-xl`, `shadow-card`, Inter)
- `lucide-react`
- tema `anesthesia_theme`
- `sessionPolicy` / `passwordPolicy` (sessão 12h, política forte)
- `aiModelConfig` (modelos, prompts, schemas)
- `ClinicalErrorBoundary` no `Root`

Não foi criado um segundo design system.

## 5. Components Created

`src/admin/` — `AdminApp`, `AdminShell`, `ui` (card, badge, table, pagination, filters), `charts` (sparkline/line/bar/donut/heatmap), drawers, pages, `api`, `routes`, `format`, `types`, `aiCatalog`.

## 6. Database Changes

Migration `supabase/migrations/20260830013809_admin_erp.sql` (aplicada no remoto Anestflow):

- `platform_admins`
- `organizations` (type/plan/status, `monthly_cents` default 0)
- `organization_members`
- `admin_issues`
- `admin_settings` singleton `default`

Sem colunas de PHI. Sem tabelas de billing/invoices (inexistentes no domínio).

## 7. RPCs / Views Created

Públicas (invoker → private definer): `admin_bootstrap_self`, `is_platform_admin`, `admin_dashboard_overview`, `admin_list_organizations`, `admin_get_organization`, `admin_create_organization`, `admin_list_users`, `admin_get_user`, `admin_list_procedures_meta`, `admin_ai_overview`, `admin_operations_overview`, `admin_financial_overview`, `admin_list_issues`, `admin_get_issue`, `admin_update_issue`, `admin_list_audit_events`, `admin_get_settings`, `admin_update_settings`.

Agregações no SQL (counts, séries por dia, ASA, técnicas, heatmap). Sem `SELECT *` para o browser contar.

## 8. RLS / RBAC

- FORCE RLS + policies `using (false)` para authenticated e anon em todas as tabelas novas.
- Acesso só via RPC com `private.assert_platform_admin()`.
- Bootstrap: primeiro usuário confirmado que chama `admin_bootstrap_self` **somente se a tabela estiver vazia**.
- Evidência: `select public.is_platform_admin()` sem JWT → `false`. `select public.admin_dashboard_overview('30d')` sem JWT → `42501 not_authenticated`.
- Papel de **admin de organização** não existia e não foi inventado. Super Admin de plataforma vê o conjunto via RPC.

## 9. AI Integration

Catálogo lido de `src/lib/aiModelConfig.ts`:

- ASR `gemini-3.5-transcribe` verbatim
- parser `gemini-3.6-flash` thinking `minimal` / `voice-parser-v4`
- supervisor thinking `medium` / `clinical-review-v4`
- narrativa thinking `low` / `anesthesia-narrative-v2`

Prompts no Admin são **somente leitura**. Sem `GEMINI_API_KEY` no bundle. Sem `gemini-flash-latest`. KPIs de custo/latência permanecem `0`/`—` porque não há tabela de usage.

## 10. Financial Integration

`admin_financial_overview` devolve MRR/ARR/ticket/custo/margem a partir de `organizations.monthly_cents` (default 0) e nota explícita de faturamento não integrado. Sem invoices fictícias.

## 11. Operational / Issues

Operação agrega `private.audit_events` (saves, signs, falhas nomeadas) e não inventa uptime 99,98%. Subsistemas sem telemetria mostram “Sem telemetria”. Issues: tabela real vazia + drawer 520px.

## 12. Audit

Lista `private.audit_events` (timestamp, ator, ação, tipo, descrição sem PHI). IP pode ser nulo. Não há log só de frontend apresentado como auditoria.

## 13. Security

- UI 403 + RPC + RLS.
- Segredos permanecem server-side.
- Feature flags em `admin_settings` são persistidas e auditáveis; **não** religam o runtime clínico nesta onda.
- Edição de prompts clínicos bloqueada.

## 14. PHI Review

`admin_list_procedures_meta` retorna id, status, revision, timestamps, hash flag, responsável (profile), `patient->>'hospital'`, duração de timers, flags de voice/incident. Definição SQL verificada: `leaks_name=false`, `leaks_cpf=false`, `leaks_canonical=false`. Botão **Ver Ficha** não abre prontuário.

## 15. Tests

`npx tsx src/tests/run_tests.ts` → **1058/1058**. `npx tsc --noEmit` e `npm run lint:lib` → pass.

Novos asserts: rotas Admin, ausência de react-router, ausência de GEMINI_API_KEY / GPT-4o / hospitais de design, RPC metadata-first, drawers 480/520, FORCE RLS, sessão 12h, modelos Gemini.

## 16. Visual Parity

Shell, tabs, tokens `#6c5ce7` / `#f8f9fa` / `#e8ecf0` / `#2d3436` / `#636e72`, cards `rounded-xl`, tabelas, badges, drawers e heatmap seguem os 13 frames.

Divergências conscientes (não copiar DESIGN DATA):

- KPIs reais (4 usuários, 28 procedimentos) em vez de 142 / 864.
- Sem sparkline de tendência percentual inventada (`+8.4%`).
- Usuários: status do modelo (`ativo` / `convite_pendente` / `perfil_incompleto`) em vez de “Inativo/Suspenso” do Figma.
- Filtro “Todas as organizações” na visão geral ainda não tem `p_org_id` na RPC (0 organizações cadastradas).
- Grão Diário/Semanal/Mensal reamostra a série **real** no cliente.

## 17. Known Limitations

Ver `ADMIN_FOLLOW_UP.md`. Principais: billing, usage de IA, admin por organização, convites, flags não ligadas ao runtime clínico, bootstrap do primeiro admin.

## 18. Follow-up Recommendations

Ver `ADMIN_FOLLOW_UP.md`.

---

```text
ADMIN_IMPLEMENTATION = PARTIAL
FIGMA_PARITY = PARTIAL
RBAC = PASS
RLS_ISOLATION = PASS
PHI_REVIEW = PASS
AI_ADMIN_INTEGRATION = PARTIAL
CORE_CLINICAL_REGRESSION = PASS
TEST_SUITE = PASS
```

Justificativa de PARTIAL: o Admin é real (RPCs, RLS, UI fiel, sem mock), mas billing/telemetria de IA/org-admin ainda não existem no domínio; a paridade visual não reproduz os números de design.
