# Auditoria de atomicidade, RLS e concorrência

Mapa do código **real** na árvore atual (`cursor/clinical-transaction-235e`, baseline Gemini congelada). Nenhuma correção nesta etapa — só o diagnóstico.

Fontes: `src/lib/proceduresService.ts`, `src/lib/clinicalChildren.ts`, `src/lib/procedureMapper.ts`, `src/lib/useSyncEngine.ts`, `src/lib/procedureRealtime.ts`, `src/lib/signingReadinessEngine.ts`, `src/lib/assertCanEdit.ts`, `src/components/ReviewTab.tsx`, `src/App.tsx`, `supabase/migrations/20260829022538_onda_1_clinical_schema.sql`, `20260829022539_onda_1_rls_policies.sql`, `20260829160155_fase_6_procedure_revision.sql`, `20260829183000_fase_4b_signed_record_v1.sql`.

---

## A. SAVE

### 1. Onde `saveProcedure()` começa?

`src/lib/proceduresService.ts`, função `saveProcedure(ficha, userId)`.

Ordem real:

1. recusa sem `userId`, ficha vazia (`isMeaningfulDocument`) ou id mock;
2. `ensureUniqueClinicalEventIds`;
3. `withInProgressIfAnesthesiaStarted` (Draft → InProgress se há `startAnesthesia`);
4. resolve id de rascunho existente (`findExistingDraftId`);
5. normaliza `createdByUid` / `currentResponsibleUid`;
6. `assertCanEdit` no React (não é o banco);
7. `write()` com timeout.

### 2. Onde ocorre o CAS de `revision`?

No **cliente**, depois de um `SELECT` da linha:

- compara `expectedProcedureRevision(cleanedDoc)` com `existing.revision`;
- se diferir, lança `stale_revision`;
- `UPDATE procedures … WHERE id = $id AND revision = $expected`.

Zero linhas no `UPDATE` vira de novo `stale_revision` (ou imutável / não responsável).

**Não** há `SELECT … FOR UPDATE`. O CAS é otimista na linha pai.

O valor novo **não** vem do browser: trigger `private.bump_procedure_revision` (`BEFORE UPDATE` em `procedures`) faz `new.revision := old.revision + 1`.

Não existe RPC `save_procedure_atomic` (nem equivalente transacional que cubra pai + filhos).

### 3. Quando a `revision` é incrementada?

Em **todo** `UPDATE` da linha `procedures` (autosave clínico, handover/claim/assume, `sign_procedure`, etc.).

Os filhos (`procedure_vitals`, `procedure_medications`, …) **não** incrementam `procedures.revision`.

Um `saveProcedure` de ficha já persistida = **um** `UPDATE` no pai = **um** incremento, **depois** upserts paralelos nos filhos. Não é o cenário “41→42 pai, 42→43 vital, 43→44 droga” — os filhos não batem o token. O problema é outro: o token já avança **antes** dos filhos gravarem.

### 4. O update da linha `procedures` acontece antes das tabelas filhas?

**Sim.** `applyRevisionMeta` aplica a revision nova no objeto local e só então `await persistClinicalChildren(...)`.

Insert de ficha nova: `insertProcedureParent` (revision nasce 1) e depois os filhos.

### 5. Cada child table é persistida em chamada separada?

**Sim.** `persistClinicalChildren` dispara `Promise.all` de cinco `upsert` no cliente:

| Ordem lógica | Tabela | Campo da ficha |
|---|---|---|
| paralelo | `procedure_vitals` | `vitals` |
| paralelo | `procedure_medications` | `bolusDrugs` |
| paralelo | `procedure_fluids` | `fluids` |
| paralelo | `procedure_infusions` | `continuousInfusions` |
| paralelo | `procedure_events` | `events` |

Cada uma é `from(table).upsert(rows, { onConflict: "id" })` — round-trip HTTP próprio, **fora** de transação Postgres comum.

### 6. Existe transação PostgreSQL única?

**Não** para o save clínico. Cada `from().update` / `from().upsert` é um statement autocommit via PostgREST.

RPCs que **já** são transacionais (não substituem o save): `sign_procedure`, `transfer_responsibility`, `request_transfer`, `claim_responsibility`, `assume_responsibility`, `add_procedure_amendment`, participantes.

### 7. Existe janela em que `revision` já mudou mas children ainda não?

**Sim. Gap comprovado.**

1. `UPDATE procedures` commita (revision N→N+1, pai novo).
2. Outro cliente / Realtime pode ler essa revision.
3. `Promise.all` dos filhos ainda não terminou (ou falhou em parte).
4. Estado observável: pai 52 + vitais da 51 + drogas parciais da 52.

Se um upsert filho falha depois do pai, o cliente fica com revision já aplicada na memória e filhos incompletos. Retry do mesmo cliente com a revision nova pode completar os filhos; outro cliente com a revision velha toma `stale_revision`. A ficha **não** é uma unidade clínica transacional.

### 8. Como conflitos são retornados ao cliente?

Token estável: `stale_revision` (`Error` no cliente ou mensagem PostgREST).

`mapClinicalError` / `isStaleRevisionError` em `src/lib/clinicalErrors.ts` mapeiam para `STALE_REVISION_MESSAGE` (“atualizada em outro lugar”).

`useSyncEngine`: conflito **não** entra no retry de 5s; faz `dequeue` e **recarrega a nuvem por cima do estado local** (`onRemoteUpdate(remote)`). Servidor ganha; não há merge clínico (alinhado ao produto), mas **há perda silenciosa das edições locais da aba que perdeu o CAS**.

### 9. O retry atual pode duplicar algum evento?

- Retry **do mesmo payload com os mesmos UUIDs**: `upsert onConflict id` **não** duplica linha. IDs client-generated (`ensureUniqueClinicalEventIds` + `crypto.randomUUID`) já existem.
- Retry **após falha parcial**: não duplica; tenta completar. Pode deixar a revision à frente dos filhos até o retry.
- Retry **cego da fila de 5s**: **não** se aplica a `stale_revision`. Aplica-se a erro de rede genérico — reenvia o documento inteiro. Com IDs estáveis, upsert continua idempotente.
- `Promise.all` **não** apaga órfãos: item removido só no React permanece no banco. Reload “ressuscita” o lançamento. Não é duplicata; é cancelamento local não auditável.

`deleteClinicalEventItem` no cliente **já recusa** hard delete (lança erro). O banco, porém, ainda **permite** `DELETE` (ver C).

---

## B. TABELAS FILHAS / ENTIDADES

Persistência real (não a lista desejada da spec).

| Entidade | Destino | Insert | Update | Delete | Upsert | RPC | Cliente direto |
|---|---|---|---|---|---|---|---|
| Ficha pai (patient, team, pré, técnica, via aérea, checklist, timers, monitores, equipamentos, recovery, handover, narrativas, voice_transcripts, status) | `procedures` colunas jsonb / texto | Sim (ficha nova) | Sim (`UPDATE` CAS) | Sim, **só rascunho do criador** | Não | Não no save | Sim |
| `vascularAccesses` | `procedures.vascular_accesses` jsonb | via pai | via pai | omitir do array = apaga no JSON | — | Não | Sim |
| `incidents` | `procedures.incidents` jsonb | via pai | via pai | omitir do array | — | Não | Sim |
| `outputs` | `procedures.outputs` jsonb | via pai | via pai | omitir do array | — | Não | Sim |
| `inhalationAgents` | `procedures.inhalation_agents` jsonb | via pai | via pai | omitir do array | — | Não | Sim |
| Vitais | `procedure_vitals` | upsert | upsert | **policy DELETE sim** | Sim | Não | Sim |
| Bolus | `procedure_medications` | upsert | upsert | **policy DELETE sim** | Sim | Não | Sim |
| Fluidos | `procedure_fluids` | upsert | upsert | **policy DELETE sim** | Sim | Não | Sim |
| Infusões | `procedure_infusions` | upsert | upsert | **policy DELETE sim** | Sim | Não | Sim |
| Eventos clínicos | `procedure_events` | upsert | upsert | **policy DELETE sim** | Sim | Não | Sim |
| Transferências de responsabilidade | `procedure_transfers` | Não pelo save | Não | Sem policy DELETE | Não | RPCs de handover | INSERT policy existe; app recusa `addClinicalEventItem("transfers")` |
| Participantes | `procedure_participants` | trigger / RPC | RPC | RPC | — | Sim | SELECT só |
| Adendos | `procedure_amendments` | RPC `add_procedure_amendment` | Não | Não | — | Sim | INSERT policy só com ficha **já signed** |
| Worklist | `worklist_entries` | Sim | Sim | Sim (próprio criador) | — | Não | Sim |

`persistClinicalChildren` **não** envia `transfers`. `addClinicalEventItem` / `persistClinicalEventsSubcollections` existem no módulo; o App **não** os usa no fluxo vivo (só testes de fonte).

Não há colunas `voided_at` / `voided_by` / `void_reason` em lugar nenhum.

---

## C. RLS

Helpers: `private.is_email_confirmed`, `private.is_procedure_participant`, `private.is_procedure_responsible`, `private.is_procedure_open`. `FORCE ROW LEVEL SECURITY` nas tabelas clínicas.

### `procedures`

| Ação | Policy | Quem |
|---|---|---|
| SELECT | participante + e-mail confirmado | participante |
| INSERT | criador = responsável = `auth.uid()` | autenticado |
| UPDATE | responsável + status ≠ signed; WITH CHECK recusa `signed` e exige `responsible_id = auth.uid()` | responsável |
| DELETE | criador + `status = 'draft'` | criador do rascunho |

Trigger `private.protect_procedure_immutability`: `created_by` imutável; `signed` não atualiza/apaga.

### Filhos clínicos (`vitals`, `medications`, `fluids`, `infusions`, `events`)

| Ação | Regra |
|---|---|
| SELECT | participante + e-mail confirmado |
| INSERT | responsável + ficha aberta + `created_by = auth.uid()` |
| UPDATE | responsável + ficha aberta |
| **DELETE** | **responsável + ficha aberta** |

`GRANT … DELETE` está dado a `authenticated` nessas cinco tabelas.

### Outras

| Tabela | DELETE autenticado? |
|---|---|
| `procedure_transfers` | **Não** (sem policy DELETE; grant sem delete) |
| `procedure_amendments` | **Não** |
| `procedure_participants` | **Não** (writes via RPC/trigger) |
| `profiles` | **Não** |
| `worklist_entries` | **Sim** (próprio criador) |

### Gap: hard delete clínico pelo cliente Supabase

Um usuário autenticado **responsável**, com ficha **não signed**, consegue:

```sql
delete from procedure_events where id = …;
delete from procedure_medications where id = …;
-- idem vitals, fluids, infusions
```

via `supabase.from("procedure_events").delete()`. A UI não faz isso (`deleteClinicalEventItem` recusa), mas **RLS não impede**. Isso quebra auditabilidade e o critério “bypass da UI não destrói registro clínico”.

`assertCanEdit` no React **não** é autoridade. O banco é.

Não há void server-side; `voided_by` do cliente não existe.

---

## D. SIGNING READINESS

Dois motores, **não** compartilham código.

### Cliente — `evaluateSigningReadiness` (`src/lib/signingReadinessEngine.ts`)

`canClose` = zero alertas `CRITICAL`.

| Regra | Nível | No cliente hoje |
|---|---|---|
| Paciente identificado (`fullName` ≥ 5) | CRITICAL | Sim |
| Responsável (`currentResponsibleUid`) | CRITICAL | Sim |
| Anestesiologista + CRM (`team.anesthesiologistLead` / `crmLead`) | CRITICAL | Sim |
| Identidade profissional no **perfil** (CRM/UF do signatário) | — | Não; só no `sign_procedure` (`profile_required`) |
| `startAnesthesia` | CRITICAL | Sim |
| `endAnesthesia` existente | — | **Não** |
| `endAnesthesia >= startAnesthesia` | — | **Não** |
| Cirurgia ≥ início de anestesia | CRITICAL | Sim |
| Fim de cirurgia ≥ início de cirurgia | CRITICAL | Sim |
| Procedimento não encerrado | — | UI bloqueia signed; servidor `already_signed` |
| Timeline crítica além de cirurgia/anestesia | parcial | Só esses dois pares |
| Destino | INFO (admissão SRPA / `dischargeDestination` ausentes, se há início) | Default qualitativo `handover.destination = "SRPA"` no blank **não** gera alerta |
| Recovery/handover quando o workflow exige | INFO | Não é bloqueio |
| Transferência pendente | — | **Não bloqueia** |
| Conflito de revision | — | Não; close faz `saveProcedure` antes |
| Estado = versão mais recente no servidor | — | Cliente envia a ficha React; servidor sela o que está no **banco** |
| Técnica | IMPORTANT | Sim |
| Peso / prontuário / vitais / infusões abertas | IMPORTANT | Sim |
| Sem bolus | INFO | Sim |
| Capnografia | — | Explicitamente **não** é critério |
| Defaults qualitativos (sistemas negativos, Mallampati I, checklist) | — | Não alertam (correto) |
| Inventar quantitativo | — | Engine não preenche ausência (correto) |

Confirmação na Review (`ReviewTab`): texto sobre selo SHA-256 / `SignedAnesthesiaRecordV1`. **Não** contém ainda a frase de revisão dos defaults.

Encerramento: step-up (`needsSignatureStepUp`) → `saveProcedure` → RPC `sign_procedure(uuid)`. Canonical e hash **não** saem do browser.

### Servidor — `private.assert_signing_readiness`

Exige: `startAnesthesia` parseável, cronologia cirurgia vs anestesia, nome ≥ 5, `responsible_id`, lead + CRM.

**Não** exige: `endAnesthesia`, `end >= start`, destino, recovery, ausência de `pending_transfer`, revision esperada pelo cliente.

`sign_procedure`: `FOR UPDATE`, `auth.uid()` = responsável, recusa signed, monta `SignedAnesthesiaRecordV1`, SHA-256, `status=signed`, zera `pending_transfer` **mesmo se havia convite pendente**.

Override com motivo / `auth.uid()` / audit: **não existe**.

Autoridade final já é o servidor para o selo; as regras CRITICAL de **término** e **pendência de transferência** ainda não estão nessa autoridade.

---

## E. REALTIME

### Tabelas inscritas (`subscribeProcedureRealtime`)

Canal `procedure:{uuid}`:

- `procedures` filtrado por `id`
- `procedure_vitals`
- `procedure_medications`
- `procedure_fluids`
- `procedure_infusions`
- `procedure_events`
- `procedure_transfers`
- `procedure_amendments`
- `procedure_participants`

Não inscritos: worklist, profiles. Entidades só-json no pai (`incidents`, gases, outputs, recovery, …) disparam via mudança em `procedures`.

Debounce 250 ms; o payload do change **não** é aplicado. Sempre `getProcedureById` (pai + filhos).

### Como a revision é transportada

Não via o evento Realtime. Vem no `SELECT` da linha `procedures.revision` na hidratação.

### Evento antigo

Não há `if (incomingRevision < currentRevision) ignore` no cliente.

Na prática um evento velho **não rebaixa** o estado: o refetch lê o banco atual. Gap residual: o refetch **sempre** chama `onRemoteUpdate`, que no `App` é `setFicha(remoteDoc)` — pode pisar estado local mesmo quando o remoto não é mais novo em conteúdo, e não compara revision.

### Dirty local vs evento remoto

Único guarda: `isLocalSavingRef` (durante `saveProcedure` da fila).

Não há marca de conflito se a aba tem fila pendente / fingerprint local diferente.

`lastDocStateHashRef` é atualizado **na edição local** (para o autosave), então **não** serve como “último salvo”.

**Cenário 3 (dirty + Realtime mais novo): gap comprovado** — `setFicha(remote)` substitui a ficha viva, inclusive Fentanil/evento ainda não enviados, sem diálogo.

**Cenário 2 (limpo + Realtime):** funciona: refetch aplica a revision nova; B pode salvar.

**Cenário 1 (duas abas sujas):** o CAS do pai impede B de sobrescrever o pai de A; o stale handler **descarta a fila de B e carrega A**. Fentanil de A permanece (bom). Evento de B some da UI (perda local, não overwrite na nuvem).

**Cenário 4:** refetch do atual ≈ ignore do payload antigo; não há rebaixo de revision. Falta só o short-circuit explícito `remote.revision < local.revision`.

---

## Síntese — gaps a corrigir (próximas fases)

| # | Gap | Fase |
|---|---|---|
| 1 | Pai + filhos sem transação; janela revision-à-frente-dos-filhos | 1 — `save_procedure_atomic` |
| 2 | Browser não deve “completar” save em 6 round-trips | 1 |
| 3 | Stale handler sobrescreve dirty local | 1 / 4 |
| 4 | `DELETE` RLS nas cinco tabelas clínicas de evento | 2 |
| 5 | Sem void (`voided_at` / `voided_by=auth.uid()` / `void_reason`) | 2 |
| 6 | `endAnesthesia` e `end >= start` não são CRITICAL no servidor | 3 |
| 7 | `pending_transfer` não bloqueia selo | 3 |
| 8 | Confirmação de revisão dos defaults incompleta | 3 (copy da Review, sem redesenho) |
| 9 | Realtime aplica remoto com state dirty | 4 |
| 10 | Sem short-circuit `incomingRevision < currentRevision` | 4 |

### O que **não** é gap

- Gemini / prompts / schemas / Voice Scribe (fora de escopo).
- Trigger de revision no servidor (browser não manda o número).
- Token `stale_revision` já distinto de erro genérico.
- Upsert por id (base de idempotência).
- `deleteClinicalEventItem` recusando hard delete na UI.
- Selo `SignedAnesthesiaRecordV1` + hash no servidor.
- Defaults qualitativos (Mallampati, sistemas, checklist, `handover.destination = SRPA`) — produto, não alerta.
- Ausência quantitativa permanece ausência.
- Destino: o blank já traz `handover.destination`; não gerar CRITICAL só porque o default é SRPA.
- Filhos não incrementam revision (já é 1 bump por UPDATE do pai).
- Realtime não aplica payload cru (sempre refetch).

### RPC nova vs existente

Não há mecanismo equivalente corretamente transacional para o save clínico. Encerramento/handover já são RPC. **Justifica** `save_procedure_atomic` (e `void_clinical_item`). Não reescrever o banco nem event sourcing.
