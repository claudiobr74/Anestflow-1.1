# Mapa de dados — Admin

Regra: **real data > mock**. Sem registro → `0` ou empty state. Sem telemetria → “—” / copy honesta, nunca 99.98% inventado.

| Tela Figma | Precisa | Fonte real hoje | Lacuna | Estratégia |
| ---------- | ------- | --------------- | ------ | ---------- |
| Visão Geral | users, orgs, procs, taxas, séries, hospitais, técnicas, ASA, heatmap, durações | `profiles`, `procedures` (status, timers, technique, pre_evaluation.asa, patient.hospital, created_at), `procedure_amendments` | sem “sala”; sem cancelado; sem org table | RPC agrega o que existe; “proc. por sala” = —; cancelados = 0 (status inexistente) |
| Organizações | lista, tipo, plano, status, users, proc/mês | **ausente** | tabela nova | `organizations` + members; vazio até cadastro; hospital de `profiles` **não** vira org fake |
| Detalhe org | cadastro, métricas, membros, atividade | após tabela | billing/IA calls | métricas de members + procedures filtrados por hospital name match **somente** se org.name = hospital; senão 0. Valor R$ só se `monthly_cents` preenchido |
| Usuários | nome, email, CRM, UF, org, status, last access | `profiles` + `auth.users` (last_sign_in, email_confirmed) via DEFINER | memberships | status derivado: convite pendente / perfil incompleto / ativo. Org = membership ou `profiles.hospital` (texto) |
| Detalhe usuário | identidade, provider, orgs, atividade | profiles + `auth.identities` + audit | sem mobile/iOS | sem senha/token; atividade = audit do actor sem PHI |
| Procedimentos | id, org, responsável, data, status, duração, IA flags, integridade | procedures + profiles | sem cancelado; IA flags não persistidos por chamada | hospital = `patient->>'hospital'`; responsável = profile; duração = timers; integridade = signed+hash → Íntegro, senão Não verificado; **sem** verify em massa; IA Voice/Review = presença de `voice_transcripts` / não inventar Review; **nunca** patient name/CPF |
| IA | modelos, prompts, schema, calls, latência, custo, erros | `aiModelConfig.ts` + Edge Functions ativas | sem tabela de usage/custo | cards de modelo **reais** (3.5-transcribe, 3.6-flash, voice-parser-v4, clinical-review-v4, anesthesia-narrative-v2). KPIs 0. Erros vazios. Sem GPT-4o do Figma |
| Financeiro | MRR, contratos | ausente | billing | RPC zeros + tabela vazia + nota “faturamento não integrado” |
| Operação | health, saves, falhas, logs | audit_events counts; RPC liveness | sem uptime, PDF latency, IP | Database/Auth = Operacional se RPC ok; Atomic Saves = count `save_atomic`; Sign = count `sign`; falhas Voice/PDF = 0 se não houver tabela; logs = audit mapeado (ação + horário + ator), **sem** inventar backup 32.4 GB |
| Problemas | incidentes | ausente | — | `admin_issues` vazia; drawer só com linha real |
| Auditoria | timestamp, tipo, descrição, usuário, org, IP | `private.audit_events` | sem IP, org, LOGIN | mapear `action` → tipo/descrição PT; usuário via profile; IP = —; **sem** descrição com nome de paciente |
| Configurações | plataforma, segurança, flags, prompts | sessionPolicy 12h; passwordPolicy; Google; prompts no código | Figma “1h” e GPT-4o | persistir `admin_settings` (flags globais). Sessão clínica **não** muda silenciosamente para 1h sem governança — campo informativo alinhado a `sessionPolicy` real. Prompts: catálogo **real**, read-only (“edição desabilitada por segurança” do Figma) |

## Colunas proibidas nas RPCs Admin

Não selecionar: `patient` jsonb completo, `cpf`, `fullName`/`full_name` de paciente, `narratives`, `voice_transcripts` texto, `procedure_vitals`, `procedure_medications`, `signed_canonical`, doses, diagnósticos.

Permitido: `procedures.id`, `status`, `revision`, `created_at`, `updated_at`, `signed_at`, `content_hash is not null`, `responsible_id` → nome/CRM/UF de **profissional**, `patient->>'hospital'`, `pre_evaluation->>'asa'`, flags booleanos de `technique`, chaves de `timers`.
