# Auditoria do Auth atual — Google OAuth (AnestFlow)

Google é outra forma de autenticar o **mesmo** usuário Supabase. Identidade canônica: `auth.users.id` (`auth.uid()`). Não existe e não será criada tabela `google_users`.

## Inventário

| Item | Status atual | Arquivo |
| ---- | ------------ | ------- |
| LoginScreen | Email/senha + cadastro + Complete Profile na mesma tela. Aviso de Google “desligado”. | `src/components/LoginScreen.tsx` |
| signInWithPassword | Login existente | `src/components/LoginScreen.tsx` (`handleEmailAuth`) |
| signUp | Cadastro com política de senha + HIBP | `src/components/LoginScreen.tsx` |
| signOut | App e Complete Profile | `src/App.tsx` (`handleLogout`); `LoginScreen.tsx` (`handleLogout`) |
| onAuthStateChange | Login aplica sessão → perfil; App trata `SIGNED_OUT` e limpa cache | `LoginScreen.tsx`; `src/App.tsx` |
| getSession | No mount do LoginScreen | `LoginScreen.tsx` |
| fetchOwnProfile / isProfileComplete / saveOwnProfile | Completo = nome + CRM + UF + hospital | `src/lib/profileService.ts` |
| Complete Profile | Mesma LoginScreen quando `needsProfile` | `LoginScreen.tsx` |
| handle_new_user | Trigger `auth.users` INSERT → `profiles` (id, email, `full_name` de metadata) | `supabase/migrations/20260829022538_onda_1_clinical_schema.sql` |
| tabela profiles | `id` = `auth.users.id` | migration onda 1 |
| Guards de autenticação | Timebox 12h, ociosidade 8h, lock 20 min | `src/lib/useSessionGuard.ts`; `src/lib/sessionPolicy.ts` |
| mapAuthError | Email/senha, rate limit, HIBP; **sem** OAuth | `src/lib/authErrors.ts` |
| ensureSupabaseConfig / getSupabase | Cliente único; `detectSessionInUrl: true`; sem rota `/auth/callback` | `src/lib/supabase.ts` |
| Step-up de assinatura | 15 min ociosos → overlay de lock | `src/lib/useClinicalDocument.ts`; `src/App.tsx` |
| Workstation lock | **Só senha** (`signInWithPassword`) | `src/components/WorkstationLockScreen.tsx` |
| Cache clínico no logout | `signOut` + `clearClinicalBrowserCache` + limpa user/ficha | `src/App.tsx`; `sessionPolicy.ts` |
| Recuperação de senha na UI | Não há fluxo “Esqueci a senha” na LoginScreen | — |

## Lacunas para Google (esta rodada)

1. Botão `Continuar com Google` + `signInWithOAuth({ provider: "google" })`.
2. `redirectTo` = origem atual (`window.location.origin` + `/`). Sem Client ID/Secret no Vite.
3. Mensagens OAuth em `mapAuthError` (cancelamento, provider, redirect).
4. Trigger: também aceitar `name` do Google em `full_name` (CRM/UF/hospital continuam vazios).
5. **Crítico:** lock/step-up só com senha. Usuário só-Google precisa reautenticar via Google (`prompt=login`), sem bypass e sem senha inventada.
6. Após redirect de reauth, renovar o relógio de sessão **antes** do `useSessionGuard` relockar.

## O que não muda

Ficha, save atômico, revision, RLS clínica, SignedAnesthesiaRecordV1, PDF, Voice Scribe, Gemini, Edge Functions, header/layout além do necessário para o botão de login.
