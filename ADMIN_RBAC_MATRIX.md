# Matriz RBAC — Admin

## Papéis encontrados (não reinventar o que existe)

| Papel | Escopo | Onde | Serve para /admin? |
| ----- | ------ | ---- | ------------------ |
| `auth.users` + e-mail confirmado | sessão | `private.assert_signed_in_confirmed` | pré-requisito |
| `profiles` (médico) | próprio perfil | RLS own | não |
| `creator` / `responsible` / `collaborator` | **uma ficha** | `procedure_participants` | não — isolamento clínico |
| Super Admin Figma | plataforma | **ABSENT** | criar `platform_admins` |

Não usar `user_metadata` JWT para autorização (editável pelo usuário).

## Papel novo (mínimo)

| Papel | Persistência | Quem concede |
| ----- | ------------ | ------------ |
| Platform admin | `public.platform_admins(user_id PK → auth.users)` | Bootstrap: **primeiro** usuário confirmado que chama `admin_bootstrap_self` **somente se a tabela estiver vazia**. Depois: insert auditável por outro admin (fora desta onda se não houver UI de grant) |

Toda RPC `admin_*` começa com `private.assert_platform_admin()`.

Tabelas novas: RLS force + revoke authenticated + deny policies. Leitura/escrita **só** via RPC DEFINER em `private`, wrapper `public` invoker (padrão Fase 4).

## Isolamento multi-instituição

| Ator | Org A | Org B | Procedimento clínico |
| ---- | ----- | ----- | -------------------- |
| Médico comum (não platform admin) | sem RPC admin | sem RPC admin | RLS participante vigente |
| Platform admin | vê orgs/membros via RPC | vê orgs/membros via RPC | **metadata** de todas as fichas; **não** PHI; **não** edita signed |
| Membership futuro (não-admin) | apenas a própria org | DENIED | inalterado |

Testes negativos (suíte + SQL):

1. Usuário comum → `admin_dashboard_overview` → `not_platform_admin`
2. Sem sessão → `not_authenticated`
3. Platform admin → overview ALLOWED
4. Médico org A (quando membership existir) não lista org B — nesta onda só platform admin chama as RPCs; membership table existe para o modelo, sem grant amplo
5. Admin UI `/admin` sem papel → 403 (não só esconder menu)
6. `select` direto em `platform_admins` / `organizations` pelo cliente autenticado comum → 0 linhas

## Superfície de autorização

```
UI (link no overflow só se is_platform_admin)
+ pathname /admin/* (AdminApp gate)
+ RPC assert_platform_admin
+ RLS deny nas tabelas
```

A UI sozinha **não** é segurança.

## Auditoria de ações admin

`admin_update_issue`, `admin_update_settings`, `admin_create_organization`, bootstrap: insert em `private.audit_events` (`action` prefixo `admin_`, `actor_id` = uid, `procedure_id` null). Sem payload clínico.
