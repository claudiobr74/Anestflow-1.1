<div align="center">
<h1>AnestFlow</h1>
<p>Registro anestésico digital (PWA) — runtime no Supabase (Auth, Postgres, Realtime, Edge Functions).</p>
</div>

## Projeto Supabase (canônico)

O backend alvo é o projeto **Anestflow** na organização Macedotech:

| Item | Valor |
|---|---|
| Nome | Anestflow |
| Ref | `plciototnjsdjzhudptc` |
| URL | `https://plciototnjsdjzhudptc.supabase.co` |
| Região | `us-west-2` |
| Dashboard | [abrir projeto](https://supabase.com/dashboard/project/plciototnjsdjzhudptc) |

Identidade versionada em `supabase/remote.json`. Schema clínico, RLS e RPCs da onda 1 já estão aplicados neste projeto. Login é a **onda 2**. Persistência e Realtime das fichas é a **onda 3**. IA é a **onda 5**. O SDK Firebase saiu na **onda 6**.

## Onda 0 (fundação)

Abriu o trilho: CLI, Auth local, env e vínculo com este projeto. Firebase Auth saiu na onda 2; fichas e worklist saíram do Firestore na onda 3; o pacote Firebase saiu na onda 6.

### Auth (espelhar no Dashboard)

O `supabase/config.toml` já define isto para `npx supabase start`:

- Cadastro anônimo desligado
- Confirmação de e-mail **obrigatória**
- Senha mínima 12 caracteres, maiúsculas + minúsculas + dígitos
- Sessão: timebox 12h, inatividade 8h
- JWT 1 hora, rotação de refresh token
- Google OAuth preparado mas **desligado** até existirem Client ID/Secret (não colocar secret no Vite)
- Firebase **não** é provider third-party

No cloud: **Authentication → Providers / Settings** com as mesmas opções. O CLI não aplica `config.toml` no projeto hospedado.

### Variáveis de ambiente

```bash
cp .env.example .env.local
```

`VITE_SUPABASE_URL` já aponta para o Anestflow. Preencha só `VITE_SUPABASE_PUBLISHABLE_KEY` (chave `sb_publishable_…` no Dashboard). Nunca `service_role` no front.

### Stack local (opcional nesta onda)

```bash
npx supabase start
```

Requer Docker. API local em `http://127.0.0.1:54321`. App em `http://127.0.0.1:3000`.

## Rodar o app

1. `npm install`
2. `cp .env.example .env.local` e preencha `VITE_SUPABASE_PUBLISHABLE_KEY`
3. IA (opcional): `npx supabase secrets set GEMINI_API_KEY=... --project-ref plciototnjsdjzhudptc`
4. `npm run dev`

Login e perfil usam Supabase Auth + tabela `profiles`. Fichas, eventos clínicos e worklist gravam no Postgres do Anestflow (onda 3). Assistentes de IA chamam Edge Functions (onda 5). O SDK Firebase não faz mais parte do app (onda 6). Não copie PHI de produção.

## Onda 1 (schema, RLS, RPCs)

Aplicada no Anestflow. Migrations em `supabase/migrations/`:

| Arquivo | Conteúdo |
|---|---|
| `20260829022538_onda_1_clinical_schema.sql` | `profiles`, fichas, filhas, worklist, `private.audit_events`, triggers |
| `20260829022539_onda_1_rls_policies.sql` | Helpers RLS, policies, grants, view `procedure_summaries` (`security_invoker`) |
| `20260829022540_onda_1_rpcs_realtime.sql` | Assinar, transferir, claim, participante, adendo; publicação Realtime |
| `20260829023500_onda_1_advisor_fixes.sql` | Policies de auditoria, índices de FK, wrappers `SECURITY INVOKER` |

Regras importantes:

- `anon` não lê nem grava nada clínico.
- SELECT da ficha exige participação **e** e-mail confirmado.
- UPDATE da ficha só o responsável, e não se `status = signed`.
- `created_by` é imutável (trigger). Ficha signed não atualiza nem apaga.
- Worklist só do criador; `cpf_hash` é SHA-256 hex, sem índice global de CPF.
- `transfer_responsibility` exige `p_incoming_user_id <> auth.uid()`.
- Hash de assinatura/adendo é SHA-256 **no servidor** (`extensions.digest`).
- RPCs públicas são wrappers invoker; a implementação DEFINER fica em `private`.

Advisors de segurança no projeto: **0 lints** depois da onda 1.

## Onda 2 (login no cliente)

- Cliente `src/lib/supabase.ts` com chave publishable (`sb_publishable_…` ou anon legado)
- Tela de login/cadastro via `signInWithPassword` / `signUp`
- Perfil clínico em `public.profiles` (CRM, UF, hospital)
- Confirmação de e-mail obrigatória; senha mínima 12 caracteres com maiúsculas, minúsculas e dígito
- Google OAuth continua **desligado** até Client ID/Secret no Dashboard
- Rotas `/api/*` validam o access token do Supabase (`auth.getUser`)
- Busca de colega em `ShareModal` usa `lookup_profile_by_email`

### Limite de e-mail no cadastro (`over_email_send_rate_limit`)

O Auth hospedado usa o SMTP embutido do Supabase, limitado a **2 e-mails por hora** no projeto inteiro (cadastro, reenvio e recuperação). Esse teto só aumenta com SMTP próprio (Resend, SendGrid, etc.) em Authentication → SMTP. Documentação: [Rate limits](https://supabase.com/docs/guides/auth/rate-limits).

O que fazer quando a tela avisar o limite:

1. **Não** clique de novo em Cadastrar nem em Reenviar — cada clique consome a cota.
2. Espere cerca de **1 hora**.
3. Se o usuário já aparecer em Authentication → Users, confirme o e-mail no Dashboard e use **Entrar** (não Cadastrar). O 429 no signup muitas vezes **não cria** a conta.
4. Se você já tem um usuário confirmado neste projeto, entre com esse e-mail.

Não desligue a confirmação de e-mail para contornar o limite.

## Onda 3 (fichas, worklist, Realtime)

O cliente grava no schema da onda 1:

- `saveProcedure` → `public.procedures` + tabelas filhas (`procedure_vitals`, `medications`, `fluids`, `infusions`, `events`)
- Assinatura → RPC `sign_procedure` (hash SHA-256 no servidor). O cliente **não** faz UPDATE para `signed`.
- Troca / assunção → `transfer_responsibility` / `claim_responsibility`
- Adendo → `add_procedure_amendment`
- Participantes → `add_participant_by_email`, `list_procedure_participant_profiles`, `remove_procedure_collaborator`
- Worklist → `worklist_entries` com `cpf_hash` SHA-256 hex minúsculo (sem índice global de CPF)
- Autosave + `postgres_changes` (Realtime) na ficha aberta

IDs locais `doc-{timestamp}` viram UUID no primeiro save. Fichas `doc-mock*` não vão para a nuvem.

## Onda 5 (IA nas Edge Functions)

As três rotas Gemini saíram do Express. O cliente chama `getSupabase().functions.invoke` (JWT da sessão + chave publishable). A `GEMINI_API_KEY` fica só nos **secrets do projeto** — nunca `VITE_GEMINI_*`.

| Função | Contrato (igual ao Express) |
|---|---|
| `review` | body = ficha completa → `{ alerts: [...] }` |
| `voice-command` | `{ audioBase64, mimeType }` → `{ transcription, identifiedActions }` |
| `generate-description` | `{ document, models }` → `{ description }` |

`verify_jwt` permanece **ligado**. O handler ainda chama `auth.getUser` e recusa e-mail não confirmado. Express só serve o SPA e `GET /api/health`.

Limite de body nas Edge Functions é ~5,5MB (o Express permitia 10MB). Áudio muito longo pode retornar 413.

```bash
npx supabase secrets set GEMINI_API_KEY=... --project-ref plciototnjsdjzhudptc
```

Sem o secret de Edge Function, as funções tentam o fallback no Vault (`private.read_gemini_api_key`, só `service_role`). Não coloque a chave no Vite nem em migration.

## Onda 6 (Firebase fora do app)

O cliente não importa mais `firebase` / `firebase-admin`. Removidos `src/lib/firebase.ts`, `src/lib/firestoreUtils.ts`, `firebase-applet-config.json`, `firebase-blueprint.json` e `firestore.rules`.

PDF da ficha e TCLE continuam **download local** (`jspdf` + `html-to-image`). Assinatura digital é hash SHA-256 no Postgres. Áudio de voz vai só para a Edge Function, sem arquivo persistido. Por isso esta onda **não** abre bucket de Storage — não havia upload para migrar.

## Segurança imediata (fora do código)

1. Tornar o repositório GitHub **privado**.
2. Rotacionar no Google Cloud a API key Firebase que já esteve em `firebase-applet-config.json` (o arquivo saiu da árvore; o histórico do git ainda tem o valor).
3. Confirmar e-mail ON e anônimo OFF no Dashboard do Anestflow.
