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
| Identidades Google após login hospedado | **1** identidade `google` em `auth.identities` (além das 4 `email`) |

Identity linking automático é o comportamento padrão do Supabase Auth (mesmo e-mail confirmado → mesmo `auth.users.id`). **Não** há união de contas no cliente. A conta de teste e-mail/senha deste ambiente **não** é Gmail; o E2E de linking precisa de um e-mail Google igual a um usuário já confirmado.

## Testes automatizados

`npx tsc --noEmit`, `npm run lint:lib`, `npx tsx src/tests/run_tests.ts`: **1002/1002**.

Cobertos: `provider = "google"`; `redirectTo` na origem; erro do Supabase no estado; e-mail/senha permanece; perfil incompleto → Complete Profile; perfil completo → entra; step-up Google usa `prompt=login`; tokens do provedor não ficam no storage.

Baseline Gemini intacta nos testes (ASR `gemini-3.5-transcribe`; parser/review/narrativa `gemini-3.6-flash` + versões v4/v2). Camada clínica não foi modificada nesta rodada.

## E2E

O print em `anestflow-black.vercel.app` (“Supabase não configurado” + “Google permanece desligado”) era o **deploy antigo de produção**, sem este código. O último deploy **não tinha sido promovido**. Depois da promoção: login Google hospedado **PASS** (e-mail autenticado no Supabase Auth).

| Cenário | Resultado |
| -------------------------------- | --------- |
| Novo Google | PASS (hospedado, após promover o deploy) |
| Google recorrente | PASS (login Google funcional no deploy promovido) |
| Email/senha → Google mesmo email | NÃO EXECUTADO nesta rodada (conta de teste local não é Gmail) |
| UID preservado | NÃO EXECUTADO ao vivo o linking e-mail/senha→Google; sem merge no app |
| Cancelamento | PASS (voltar do Google → LoginScreen; sem sessão fantasma) |
| Logout | PASS (Sair → LoginScreen; Google e e-mail/senha visíveis) |
| Complete Profile | PASS no código; fluxo de perfil incompleto permanece o existente |
| Step-up Google | CÓDIGO PRONTO; não revalidado nesta confirmação de promoção |
| Signing Google | Não revalidado nesta confirmação de promoção |
| RLS `auth.uid()` | Mesmo UID do Auth; login Google usa a sessão Supabase existente |

## Veredito

`GOOGLE_AUTH_LOGIN = PASS` — confirmado no ambiente hospedado depois de promover o último deploy. O falso negativo era produção desatualizada.

`GOOGLE_AUTH_STEP_UP` — implementação no lock (`prompt=login`) permanece; não foi o objeto desta confirmação.

O login Google pode ser usado no deploy promovido. Step-up/assinatura com usuário só-Google continua o ponto a exercitar na ficha de teste quando for encerrar.
