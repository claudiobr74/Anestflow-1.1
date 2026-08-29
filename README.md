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

Identidade versionada em `supabase/remote.json`. Tabelas ainda vazias — schema/RLS entram na onda 1.

## Onda 0 (fundação)

O app ainda autentica e persiste no Firebase. A onda 0 só abre o trilho: CLI, Auth local, env e vínculo com este projeto. Login no cliente é a onda 2.

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

## Rodar o app (ainda Firebase)

1. `npm install`
2. `GEMINI_API_KEY` em `.env.local` (rotas de IA no Express)
3. `npm run dev`

Firebase permanece até a onda 2. Não adicione novos documentos Firestore. Não copie PHI para este projeto até a RLS da onda 1.

## Segurança imediata (fora do código)

1. Tornar o repositório GitHub **privado**.
2. Rotacionar a API key Firebase já commitada em `firebase-applet-config.json`.
3. Confirmar e-mail ON e anônimo OFF no Dashboard do Anestflow.
