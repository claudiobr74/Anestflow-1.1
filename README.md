<div align="center">
<h1>AnestFlow</h1>
<p>Registro anestésico digital (PWA) — migração de Firebase para Supabase em andamento.</p>
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

Identidade versionada em `supabase/remote.json`. Schema clínico, RLS e RPCs da onda 1 já estão aplicados neste projeto. O login do cliente é a **onda 2** (Supabase Auth + `profiles`).

## Onda 0 (fundação)

Abriu o trilho: CLI, Auth local, env e vínculo com este projeto. Firebase Auth saiu na onda 2; persistência de fichas no Firestore ainda não foi migrada (onda 3+).

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
3. `GEMINI_API_KEY` em `.env.local` (rotas de IA no Express; opcional)
4. `npm run dev`

Login e perfil usam Supabase Auth + tabela `profiles`. Fichas intraoperatórias ainda podem sincronizar no Firestore legado até a onda de persistência; não adicione novos documentos Firestore nem copie PHI de produção.

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

Fora desta onda: migrar fichas/worklist do Firestore, Realtime (onda 3), Edge Functions de IA (onda 5).

## Segurança imediata (fora do código)

1. Tornar o repositório GitHub **privado**.
2. Rotacionar a API key Firebase já commitada em `firebase-applet-config.json`.
3. Confirmar e-mail ON e anônimo OFF no Dashboard do Anestflow.
