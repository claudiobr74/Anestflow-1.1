# Relatório de migração organization_id

Sem PHI. Contagens apenas.

| Métrica | Valor |
|---------|-------|
| total procedures | 28 |
| matched (organization_id atribuído) | 0 |
| unmatched | 28 |
| ambiguous | 0 |

## Regra

`organization_id` só é preenchido quando o nome normalizado do hospital textual coincide com **exatamente uma** organização não arquivada, ou quando o criador tem **exatamente um** membership.

## Resultado

Não havia organizações cadastradas no momento da migração. Nenhum matching inequívoco. Nenhum chute.

Novos procedimentos passam a receber `organization_id` no INSERT (trigger) quando a organização estiver definida.
