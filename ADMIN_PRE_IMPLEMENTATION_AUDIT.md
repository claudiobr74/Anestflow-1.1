# Auditoria pré-implementação — Admin / ERP Analytics

Fonte visual: Figma `nKjtTJtOuSQi0fYEuTTjgD`, página **15 Admin** (`62:2`). Não usar `0:1`.

Classificação: `IMPLEMENTED` | `PARTIAL` | `ABSENT` | `EQUIVALENT` | `NOT_APPLICABLE`.

Projeto canônico: Supabase **Anestflow** `plciototnjsdjzhudptc`.

---

## 6.1 Arquitetura atual

| Item | Status | Evidência |
| ---- | ------ | --------- |
| Framework | IMPLEMENTED | React 19 + Vite 6 + Express `tsx server.ts` porta 3000 (`package.json`, `server.ts`) |
| Next.js | NOT_APPLICABLE | Não é o stack |
| react-router | ABSENT | Teste em `src/tests/run_tests.ts` exige ausência de `react-router-dom`. Rotas Admin devem usar `pathname` + `history.pushState`, sem adicionar o pacote |
| Montagem | IMPLEMENTED | `src/main.tsx` → `ClinicalErrorBoundary` → `App` |
| Rotas `/admin` | ABSENT | `App.tsx` é SPA de abas clínicas (`activeTab`) |
| vercel rewrite SPA | IMPLEMENTED | `vercel.json` `/*` → `index.html` |
| Auth e-mail/senha | IMPLEMENTED | `LoginScreen.tsx` |
| Auth Google | IMPLEMENTED | `src/lib/googleAuth.ts`, `GoogleAuthButton.tsx` |
| Cliente Supabase | IMPLEMENTED | `src/lib/supabase.ts` — `getSupabase()` |
| Serviços | IMPLEMENTED | `profileService`, `proceduresService`, `aiFunctions`, `sessionPolicy` |
| State global (zustand/redux) | ABSENT | `useState` + hooks (`useClinicalDocument`, `useSyncEngine`) |
| Design tokens | PARTIAL | Inter, `--shadow-card`, radii em `src/index.css`; indigo via Tailwind; Figma Admin usa `#6c5ce7`, `#f8f9fa`, `#2d3436`, `#636e72`, `#e8ecf0` |
| Dark/light | IMPLEMENTED | `anesthesia_theme` + `src/lib/theme.ts` |
| Header clínico | IMPLEMENTED | `AppHeader.tsx` — identidade do **paciente**; não reutilizar como shell Admin |
| Tabs clínicas | EQUIVALENT | `AppNav.tsx` — padrão de nav horizontal, labels clínicos distintos |
| Modal | IMPLEMENTED | `SettingsModal`, `ProceduresManagerModal`, `AppModalHost`, etc. |
| Drawer | IMPLEMENTED | `AnesthesiaDescriptionDrawer.tsx` — overlay clínico; padrão overlay/largura reutilizável, conteúdo não |
| Badge | EQUIVALENT | Status clínico em `AppHeader` / `SyncStatusBadge` — semântica diferente do ERP |
| Tabela ERP / data grid | ABSENT | `ProceduresManagerModal` é grid de **cards** |
| Gráficos | EQUIVALENT | `ClinicalChart.tsx` + d3 = intraoperatório; não copiar para o Admin |
| Toast lib | ABSENT | Mensagens inline |
| Skeleton | ABSENT | `Loader2` / `animate-pulse` |
| Error boundary | IMPLEMENTED | `ClinicalErrorBoundary.tsx` |
| Ícones | IMPLEMENTED | `lucide-react` (Bell, Search, HeartPulse, RefreshCw coincidem com o Figma) |
| Logo | IMPLEMENTED | `AnestFlowLogo` (`/logo.png`). Figma Admin usa marca 28×28 `#6c5ce7` + “AnestFlow Admin” |
| Responsividade clínica | IMPLEMENTED | breakpoints `md` / `xl` no header e nav |
| Pasta `src/admin` | ABSENT | Greenfield |

**Shell Figma (autoridade visual):** header 68px + **tabs horizontais** 48px. Não há sidebar. O exemplo conceitual `AdminSidebar` do prompt **não** deve ser seguido.

---

## 6.2 Autorização existente

| Item | Status | Evidência |
| ---- | ------ | --------- |
| `profiles` | IMPLEMENTED | `id`, `full_name`, `crm`, `uf`, `hospital`, `email` — RLS: só a própria linha |
| Role de plataforma | ABSENT | Sem `platform_admins`, sem claim JWT de admin |
| Organizations / memberships | ABSENT | Instituição = texto livre `profiles.hospital` |
| Roles clínicos | EQUIVALENT | `procedure_participants.role` ∈ `creator \| responsible \| collaborator` — **não** substitui admin de plataforma |
| Edição da ficha | IMPLEMENTED | `assertCanEdit` + `private.is_procedure_responsible` |
| Sessão confirmada | IMPLEMENTED | `private.assert_signed_in_confirmed()` |
| RPCs admin | ABSENT | Nenhuma função `admin_*` |
| Edge Functions admin | ABSENT | Apenas `voice-command`, `review`, `generate-description` (JWT) |
| Listar todos os profiles | ABSENT | Policy `profiles_select_own` — Admin precisa de RPC SECURITY DEFINER |

**Decisão:** não reutilizar role de procedimento como Super Admin. Criar `public.platform_admins` auditável + `private.assert_platform_admin()`. Bootstrap apenas se a tabela estiver vazia (`admin_bootstrap_self`).

---

## 6.3 Estrutura de dados (live `plciototnjsdjzhudptc`)

| Tabela | Status Admin | Observação |
| ------ | ------------ | ---------- |
| `public.profiles` | PARTIAL | Usuários reais (4). Sem role/org FK |
| `public.procedures` | PARTIAL | 28 fichas (`draft` 17, `in_progress` 4, `signed` 7). PHI em jsonbs — Admin só metadata |
| `public.procedure_participants` | EQUIVALENT | Membership **da ficha**, não da instituição |
| `public.procedure_amendments` | EQUIVALENT | Contagem “com adendo” |
| `public.procedure_*` filhos | NOT_APPLICABLE | Vitais/meds — **não** expor no Admin |
| `public.worklist_entries` | NOT_APPLICABLE | Contém `cpf_hash` + patient jsonb — **fora** do Admin |
| `private.audit_events` | PARTIAL | 23 eventos (`save_atomic`, `sign`, transfers…). Sem IP, org, payload. Cliente **não** lê (RLS deny) |
| `organizations` | ABSENT | Criar |
| `organization_members` | ABSENT | Criar |
| billing / invoices / plans | ABSENT | Financeiro = empty state verdadeiro |
| AI usage / latency / cost | ABSENT | Métricas de custo/latência = 0 / “—”. Catálogo de modelos vem de `aiModelConfig.ts` (real) |
| incidents / issues | ABSENT | Criar `admin_issues` vazia |
| system settings | ABSENT | Criar singleton `admin_settings` |
| Gemini key | IMPLEMENTED | Vault / Edge — **nunca** no Admin UI |

Agregações reais já possíveis **sem** nova tabela: counts de `procedures`/`profiles`, hospitais via `patient->>'hospital'` (instituição, não identidade), ASA via `pre_evaluation->>'asa'`, técnicas via `technique` booleanos, durações via `timers`, auditoria via `private.audit_events`.

---

## Requisitos do prompt vs repositório

| Requisito | Classificação |
| --------- | ------------- |
| Visual Admin Figma | ABSENT (implementar) |
| Auth existente | IMPLEMENTED (reusar LoginScreen) |
| Router de produto | ABSENT (pathname, sem react-router) |
| RBAC plataforma | ABSENT |
| Multi-instituição | ABSENT (hospital texto) |
| Métricas dashboard | ABSENT (RPC nova sobre dados reais) |
| Procedimentos metadata-first | ABSENT (RPC nova; tabelas clínicas IMPLEMENTED) |
| IA clínica Gemini | IMPLEMENTED (não alterar). Admin = vitrine + zeros de telemetria |
| Financeiro | ABSENT → empty |
| Operação / uptime 99.98% | ABSENT telemetria → status derivado (DB up se RPC responde) + counts de audit reais; **sem** uptime inventado |
| Problemas | ABSENT → tabela vazia + drawer |
| Auditoria server-side | PARTIAL (existe; falta RPC admin sem PHI) |
| Configurações plataforma | ABSENT. `SettingsModal` = preferência **clínica** do usuário — não misturar |
| Voice Scribe fail-closed / verbatim | IMPLEMENTED — **não alterar** |
| Signed imutável | IMPLEMENTED — Admin não edita ficha |
| PHI no Admin | N/A até RPC — queries não podem `select patient` completo |

---

## Fora de escopo (não refatorar)

Ficha clínica, save atômico, RLS clínica, Gemini runtime, Voice Scribe, PDF, `SignedAnesthesiaRecordV1`, `AppHeader` clínico além de um link condicional para `/admin`.
