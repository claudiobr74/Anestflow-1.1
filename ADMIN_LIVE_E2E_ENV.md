# Variáveis efetivamente lidas por `src/tests/admin_live_e2e.ts`

Não commitar secrets. Copiar para `.env.local` (já no `.gitignore`).

## Obrigatórias

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
ONDA3_TEST_EMAIL=
ONDA3_TEST_PASSWORD=
```

`VITE_SUPABASE_ANON_KEY` é aceita como fallback da publishable key (mesmo nome do teste).

## Segundo usuário (TEST C / TEST D)

```text
ONDA3_TEST_EMAIL_B=
ONDA3_TEST_PASSWORD_B=
```

Sem o par B, o TEST C (Clinic Admin A vs B) e o TEST D no segundo usuário não podem ser executados.

## Mapeamento desta rodada

| Papel no prompt | Variável | Conta sintética |
|-----------------|----------|-----------------|
| USER A (Super Admin de teste, não produção) | `ONDA3_TEST_EMAIL` / `ONDA3_TEST_PASSWORD` | `live.hard.a@anestflow.app` |
| USER B (USER depois CLINIC_ADMIN da ORG_A) | `ONDA3_TEST_EMAIL_B` / `ONDA3_TEST_PASSWORD_B` | `live.hard.b@anestflow.app` |

Não usar `claudiobr74@gmail.com` nem `claudiomacedo74@yahoo.com.br` nestes testes (contas reais; Super Admin de produção).

## Suítes clínicas / Voice / IA (mesmos nomes)

Os lives existentes leem o mesmo `.env.local`:

- `ONDA3_TEST_EMAIL` / `ONDA3_TEST_PASSWORD` — `onda3_live`, `fase_atomic_live`, `fase04b_live`, `fase06_live`, `fase_longcase_live`, `checkpoint_live`, …
- `ONDA5_TEST_EMAIL` / `ONDA5_TEST_PASSWORD` — opcional; fallback para `ONDA3_*` em `onda5_live.ts` e `voice_scribe_e2e_live.ts`
- `VOICE_E2E_AUDIO_DIR` — opcional; default `/tmp/voice-e2e` em `voice_scribe_e2e_live.ts`

## Não existem nestes testes

Não inventar `SUPER_ADMIN_EMAIL`, `SERVICE_ROLE`, `ORG_A_ID`, etc. Organizações sintéticas são criadas pelo próprio `admin_live_e2e.ts` via RPC.
