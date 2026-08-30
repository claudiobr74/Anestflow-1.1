# Mapa Figma → Admin AnestFlow

File: `Anestflow` · Key: `nKjtTJtOuSQi0fYEuTTjgD` · Página: **15 Admin** (`62:2`).

`get_design_context` executado nos 13 nodes abaixo (com screenshot). Números do Figma (142, 864, R$ 87.500, Hospital Santa Maria…) são **DESIGN DATA**.

Shell compartilhado: `admin-header-shell` (marca + sino + avatar) + `nav-tabs-row` (10 tabs, underline 3px `#6c5ce7`). Componente: `AdminShell`.

| Figma Frame | Node | Route | React Component | Data Source | Status |
| ----------- | ---- | ----- | --------------- | ----------- | ------ |
| admin-visao-geral | `59:549` 1440×1576 | `/admin` | `AdminOverviewPage` | `admin_dashboard_overview` | mapped |
| admin-organizacoes | `59:1010` 1440×1024 | `/admin/organizations` | `AdminOrganizationsPage` | `admin_list_organizations` | mapped |
| admin-organizacao-detalhe | `59:1256` 1440×1055 | `/admin/organizations/:id` | `AdminOrganizationDetailPage` | `admin_get_organization` | mapped |
| admin-usuarios | `59:1587` 1440×1067 | `/admin/users` | `AdminUsersPage` | `admin_list_users` | mapped |
| admin-usuario-detalhe | `59:1872` 1440×1024 | overlay em `/admin/users` (drawer 480px) | `AdminUserDrawer` | `admin_get_user` | mapped — **drawer**, não página |
| admin-procedimentos | `59:2095` 1440×1024 | `/admin/procedures` | `AdminProceduresPage` | `admin_list_procedures_meta` | mapped |
| admin-inteligencia-artificial | `59:2400` 1440×1498 | `/admin/ai` | `AdminAiPage` | `admin_ai_overview` + `aiModelConfig.ts` | mapped |
| admin-financeiro | `59:2760` 1440×1259 | `/admin/financial` | `AdminFinancialPage` | `admin_financial_overview` | mapped |
| admin-operacao | `59:3053` 1440×1323 | `/admin/operations` | `AdminOperationsPage` | `admin_operations_overview` | mapped |
| admin-problemas | `59:3329` 1440×1045 | `/admin/issues` | `AdminIssuesPage` | `admin_list_issues` | mapped |
| admin-problema-drawer | `59:3603` 1440×1024 | overlay 520px em `/admin/issues` | `AdminIssueDrawer` | `admin_get_issue` / `admin_update_issue` | mapped — **drawer** |
| admin-auditoria | `59:3927` 1440×1024 | `/admin/audit` | `AdminAuditPage` | `admin_list_audit_events` | mapped |
| admin-configuracoes | `59:4158` 1440×1123 | `/admin/settings` | `AdminSettingsPage` | `admin_get_settings` + catálogo IA real | mapped |

Gate: `private.assert_platform_admin()` em toda RPC. UI 403 se não for admin. Sem PHI (nome/CPF/prontuário/vitais/narrativa) nas respostas.

**Ver Ficha** no Figma de procedimentos: botão preservado visualmente; **não** abre prontuário. Tooltip: acesso clínico permanece na ficha, via RLS de participante.
