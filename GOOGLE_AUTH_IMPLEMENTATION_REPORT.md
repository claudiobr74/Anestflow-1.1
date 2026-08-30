# Relatório de implementação — login Google (AnestFlow)

Google é uma forma adicional de autenticar o **mesmo** usuário Supabase. Identidade canônica: `auth.users.id` / `auth.uid()`. Não existe tabela `google_users`. Não há merge de contas no frontend.

## Código

| Item | Detalhe |
| ---- | ------- |
| Auditoria | `GOOGLE_AUTH_AUDIT.md` |
| Handler | `startGoogleOAuth()` em `src/lib/googleAuth.ts`; `handleGoogleSignIn()` em `src/components/LoginScreen.tsx` |
| Botão | `src/components/GoogleAuthButton.tsx` — `type="button"`, `aria-label="Continuar com Google"`, ícone SVG oficial, `disabled` durante o envio |
| Redirect | `getAuthRedirectTo()` = `window.location.origin` + `/` (localhost, preview e produção). Sem domínio Vercel hardcoded. Sem rota `/auth/callback` nova: o SDK já tem `detectSessionInUrl: true` |
| Sessão | `onAuthStateChange` / `getSession` / `fetchOwnProfile` / `isProfileComplete` inalterados na arquitetura |
| Complete Profile | Tela existente quando CRM/UF/hospital faltam; nome pode vir de `full_name` ou `name` do metadata só como pré-preenchimento |
| Step-up / lock | `WorkstationLockScreen`: senha se houver identidade `email`; Google com `prompt=login` se houver identidade `google`. `consumeOAuthReauthIfPresent()` no App renova o relógio **antes** do `useSessionGuard` |
| Erros | `mapAuthError` cobre cancelamento, provider desligado, redirect mismatch e OAuth genérico |
| Logout | Continua `supabase.auth.signOut()` + `clearClinicalBrowserCache`. Não apaga `profiles` nem identidade Google |
| Trigger | `private.handle_new_user` também lê `name`; não grava avatar |
| config.toml local | `[auth.external.google] enabled = true` com `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)` e `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)` |

Arquivos tocados (além dos relatórios): `LoginScreen.tsx`, `GoogleAuthButton.tsx`, `googleAuth.ts`, `authErrors.ts`, `WorkstationLockScreen.tsx`, `App.tsx`, `supabase/config.toml`, `supabase/migrations/20260830003000_google_oauth_profile_name.sql`, `src/tests/run_tests.ts`, `README.md`.

Não foram alterados: ficha, save atômico, revision, RLS clínica, SignedAnesthesiaRecordV1, PDF, Voice Scribe, Gemini, Edge Functions, header/layout geral.

## Ambiente

| Checagem | Resultado |
| -------- | --------- |
| Provider Google no projeto Anestflow (`plciototnjsdjzhudptc`) | Ativo: `GET /auth/v1/authorize?provider=google` → **302** para `accounts.google.com` |
| Client ID | Confere com o informado (`256506538709-v1asd63jtkjrcr8f2eil81tfajd7rk5i.apps.googleusercontent.com`) no `location` do authorize — **não** está no frontend |
| Scopes | `email profile` apenas (padrão do Supabase; o app não pede Calendar/Drive/Gmail) |
| `VITE_GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_SECRET` | Ausentes |
| Secret no git | Ausente (`config.toml` usa `env(...)`) |
| `provider_token` persistido pelo app | Removido do blob `*-auth-token` após sessão; access/refresh do Supabase permanecem |
| Identidades Google após cancelar o login | Continua **0** (`auth.identities` só `email`) |

Identity linking automático é o comportamento padrão do Supabase Auth (mesmo e-mail confirmado → mesmo `auth.users.id`). **Não** há união de contas no cliente. A conta de teste e-mail/senha deste ambiente **não** é Gmail; o E2E de linking precisa de um e-mail Google igual a um usuário já confirmado.

## Testes automatizados

`npx tsc --noEmit`, `npm run lint:lib`, `npx tsx src/tests/run_tests.ts`: **1002/1002**.

Cobertos: `provider = "google"`; `redirectTo` na origem; erro do Supabase no estado; e-mail/senha permanece; perfil incompleto → Complete Profile; perfil completo → entra; step-up Google usa `prompt=login`; tokens do provedor não ficam no storage.

Baseline Gemini intacta nos testes (ASR `gemini-3.5-transcribe`; parser/review/narrativa `gemini-3.6-flash` + versões v4/v2). Camada clínica não foi modificada nesta rodada.

## E2E

Conta Google de teste **não** estava disponível neste ambiente (sem PHI; sem senha Google). O fluxo foi exercido até o redirect do Google e o cancelamento (voltar). E-mail/senha e logout foram exercidos com a conta de teste já existente (`@anestflow.app`).

| Cenário | Resultado |
| -------------------------------- | --------- |
| Novo Google | NÃO EXECUTADO (sem conta Google de teste) |
| Google recorrente | NÃO EXECUTADO |
| Email/senha → Google mesmo email | NÃO EXECUTADO (conta de teste não é Gmail) |
| UID preservado | NÃO EXECUTADO ao vivo; linking automático documentado, sem merge no app |
| Cancelamento | PASS (voltar do Google → LoginScreen; 0 identidades Google; sem sessão) |
| Logout | PASS (Sair → LoginScreen; Google e e-mail/senha visíveis; cache limpo pelo fluxo existente) |
| Complete Profile | PASS no código/testes; NÃO EXECUTADO para usuário só-Google |
| Step-up Google | CÓDIGO PASS; LIVE NÃO EXECUTADO |
| Signing Google | LIVE NÃO EXECUTADO |
| RLS `auth.uid()` | Indistinguível no código (mesmo UID); LIVE só-Google NÃO EXECUTADO |

## Veredito

`GOOGLE_AUTH_LOGIN = PASS` — botão, authorize hospedado, redirect Google, cancelamento sem usuário fantasma, e-mail/senha intacto, logout, testes 100%.

`GOOGLE_AUTH_STEP_UP = NÃO EXECUTADO AO VIVO` — overlay de lock chama `startGoogleOAuth({ mode: "reauth" })` com `prompt=login` e o App consome o intent renovando o relógio. Sem usuário só-Google não foi possível assinar/encerrar de ponta a ponta.

`GOOGLE_AUTH_E2E = FAIL` — critério final exige step-up e assinatura com usuário Google-only, Complete Profile no primeiro login Google, e UID preservado no linking. Esses itens **não** foram comprovados com conta Google real. A autenticação Google **não** deve ser tratada como mecanismo principal até essa validação humana com contas de teste.

Para fechar o E2E no Dashboard (contas de teste, sem PHI):

1. Novo Gmail nunca usado no Anestflow → Continuar com Google → Complete Profile (CRM/UF/hospital sintéticos) → app.
2. Sair e entrar de novo com o mesmo Gmail → app direto.
3. Usuário e-mail/senha confirmado cujo e-mail **é** Gmail → anotar `UID_BEFORE` → Continuar com Google → `UID_AFTER` deve ser igual. Se o Supabase criar outro usuário: **parar**; não implementar merge no frontend.
4. Usuário só-Google: ociosidade 15+ min (ou ajustar o relógio de sessão) → Encerrar → reauth Google → Encerrar de novo → `sign_procedure`.
