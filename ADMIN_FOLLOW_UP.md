# Follow-up — Admin AnestFlow

Itens encontrados durante a implementação que **não** foram corrigidos automaticamente (fora do escopo desta onda ou dependem de domínio ainda inexistente).

## Não bloqueantes

1. **Admin por organização.** Só existe Super Admin de plataforma. Memberships (`organization_members`) estão no schema, mas nenhum papel `coordenador` chama as RPCs. Isolamento A ≠ B para “admin de hospital” fica para uma onda futura, com RPCs filtradas por membership — não inferir no frontend.
2. **Hospital em texto livre.** `procedures.patient->>'hospital'` não cria `organizations`. Cadastro de instituição é explícito. Métricas “proc./mês” por org só batem quando o nome coincide.
3. **Billing.** Sem subscriptions/invoices. Financeiro permanece R$ 0 e empty state até existir fonte real.
4. **Usage de IA.** Sem tabela de latência/custo/erros por chamada. A tela de IA mostra o catálogo Gemini real e KPIs zerados. Não fabricar telemetria.
5. **Convite de usuário.** Figma tem “+ Novo Usuário”. O produto cadastra pela ficha clínica. O botão explica a ausência; não há invite RPC.
6. **Feature flags** em `admin_settings` não desligam Voice Scribe / supervisor / PDF no runtime clínico. Ligar isso exige mudança cuidadosa do core — fora desta onda.
7. **Edição cadastral de organização / planos.** Botões do Figma existem desabilitados até haver RPC de update.
8. **IP na auditoria.** `audit_events` pode não persistir IP; a coluna mostra “—”.
9. **Filtro de organização na visão geral.** Controle visual “Todas as organizações” existe; a RPC ainda é global. Com 0 orgs, filtrar seria teatro.
10. **Uptime 99,98%** do Figma de Operação não é calculado. Status “Sem telemetria” quando não há probe.

## Bloqueantes potenciais (não introduzidos)

- Não se alterou persistência clínica, assinatura, `SignedAnesthesiaRecordV1`, Voice Scribe, PDF, CAS/revision.
- Hard delete clínico não foi adicionado.

## Bootstrap

O primeiro usuário **confirmado** que visita `/admin` com a tabela `platform_admins` vazia torna-se Super Admin. Depois disso, novos usuários recebem 403 até um grant explícito (hoje só via SQL/RPC futura). Documentar o grant operacional antes de produção ampla.
