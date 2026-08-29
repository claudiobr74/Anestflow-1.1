<div align="center">
<h1>AnestFlow</h1>
<p>Registro anestésico digital (PWA) — migração de Firebase para Supabase em andamento.</p>
</div>

## Onda 0 (fundação)

O app ainda autentica e persiste no Firebase. A onda 0 só abre o trilho Supabase: CLI, Auth local, env e projeto hospedado. Schema/RLS é a onda 1; login no cliente é a onda 2.

| Item | Valor |
|---|---|
| Organização | Macedotech Org |
| Projeto hospedado | `plciototnjsdjzhudptc` ([dashboard](https://supabase.com/dashboard/project/plciototnjsdjzhudptc)) |
| Região atual | `us-west-2` |
| Região alvo (LGPD) | `sa-east-1` — **não criada**: limite de 2 projetos free (já existem `Anestflow` e `Virginiapsi`) |

Para ir a São Paulo depois: pausar ou subir de plano um dos projetos free, criar `anestflow-sa` em `sa-east-1` e apontar o `.env.local`.

### Auth (espelhar no Dashboard do projeto hospedado)

O `supabase/config.toml` já define isto para `supabase start`:

- Cadastro anônimo desligado
- Confirmação de e-mail **obrigatória**
- Senha mínima 12 caracteres, maiúsculas + minúsculas + dígitos
- Sessão: timebox 12h, inatividade 8h
- JWT 1 hora, rotação de refresh token
- Google OAuth preparado mas **desligado** até existirem Client ID/Secret (não colocar secret no Vite)
- Firebase **não** é provider third-party

No projeto cloud, abra **Authentication → Providers / Settings** e marque as mesmas opções. O CLI não aplica `config.toml` no projeto hospedado.

### Variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha só:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (chave `sb_publishable_…`; nunca `service_role`)

A chave publishable pode ir no cliente. `service_role` não entra no repositório nem no front.

### Stack local (opcional nesta onda)

```bash
npx supabase start
```

Requer Docker. A API local fica em `http://127.0.0.1:54321`. O app Vite/Express continua em `http://127.0.0.1:3000`.

## Rodar o app (ainda Firebase)

**Pré-requisito:** Node.js

1. `npm install`
2. `GEMINI_API_KEY` em `.env.local` (rotas de IA no Express)
3. `npm run dev`

Firebase permanece até a onda 2. Não adicione novos documentos Firestore.

## Segurança imediata (fora do código)

1. Tornar o repositório GitHub **privado**.
2. Rotacionar a API key do Firebase já commitada em `firebase-applet-config.json`.
3. Não copiar PHI de Firestore para o Supabase nesta onda (projeto remoto está vazio de tabelas).
