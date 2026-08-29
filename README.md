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

Identidade versionada em `supabase/remote.json`. Schema clínico, RLS e RPCs da onda 1 já estão aplicados neste projeto. Login é a **onda 2**. Persistência e Realtime das fichas é a **onda 3**. IA é a **onda 5**. O SDK Firebase saiu na **onda 6**. Sessão 12h/8h no cliente é a **onda 7**. Senha vazada (HaveIBeenPwned) no cliente é a **onda 8**. Onda **9** fecha o que ainda dava para fazer no código e lista o que só o Dashboard/ops resolve. Onda **10** recusa senha vazada no cadastro (HaveIBeenPwned k-anonymity) sem esperar o toggle do Dashboard.

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
4. `npm run dev` (reinicie o servidor depois de editar `.env.local` — o Vite lê as chaves na subida)

O aviso “Supabase não configurado” no login significa que o **JavaScript do browser** está sem URL/chave. O `.env.local` não vai sozinho para o cliente: o Vite só injeta `VITE_*` no `import.meta.env` na subida do servidor (e no `vite build`). `process.env` vazio no shell também esconde um `.env.local` preenchido. O Express (local) e `api/public-config.ts` (Vercel) publicam as mesmas chaves em `/api/public-config` (só a publishable).

Na **Vercel** o `.env.local` não entra no git. O app usa a URL e a chave **publishable** canônicas do Anestflow (`src/lib/supabaseProject.ts`) quando o ambiente de build não tem `VITE_*`. Ainda assim, o ideal é definir `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` em Settings → Environment Variables (Production, Preview e Development) para poder rotacionar sem commit. Nunca coloque `service_role` no Vite nem na Vercel como `VITE_*`.

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
- Rotas `/api/*` autenticadas saíram; resta só `GET /api/health` público
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
- Encerramento → RPC `sign_procedure(p_procedure_id)` (o servidor monta `SignedAnesthesiaRecordV1`, calcula o SHA-256 e grava o signatário a partir de `profiles`). O cliente **não** envia canonical nem faz UPDATE para `signed`.
- Troca / assunção → `transfer_responsibility` / `request_transfer` / `claim_responsibility` (aceite) / `assume_responsibility` (assunção excepcional) / `decline_pending_transfer`
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

O microfone fica no cabeçalho da ficha. Depois da Edge Function, o médico **confere a transcrição** e só então lança bolus, bombas, gases, vitais, eventos, timers e identificação. Ficha assinada não aceita voz. Áudio não é persistido.

`verify_jwt` permanece **ligado**. O handler ainda chama `auth.getUser` e recusa e-mail não confirmado. Express só serve o SPA e `GET /api/health`.

Limite de body nas Edge Functions é ~5,5MB (o Express permitia 10MB). Áudio muito longo pode retornar 413.

```bash
npx supabase secrets set GEMINI_API_KEY=... --project-ref plciototnjsdjzhudptc
```

Sem o secret de Edge Function, as funções tentam o fallback no Vault (`private.read_gemini_api_key`, só `service_role`). Não coloque a chave no Vite nem em migration.

## Onda 6 (Firebase fora do app)

O cliente não importa mais `firebase` / `firebase-admin`. Removidos `src/lib/firebase.ts`, `src/lib/firestoreUtils.ts`, `firebase-applet-config.json`, `firebase-blueprint.json` e `firestore.rules`.

PDF da ficha e TCLE continuam **download local** (`jspdf` + `html-to-image`). Assinatura digital é hash SHA-256 no Postgres. Áudio de voz vai só para a Edge Function, sem arquivo persistido. Por isso esta onda **não** abre bucket de Storage — não havia upload para migrar.

## Onda 7 (sessão do posto compartilhado)

O SPA espelha `[auth.sessions]` do `config.toml`: **12 horas** de timebox e **8 horas** sem atividade. Ao estourar o limite, o app faz `signOut`, limpa o cache clínico e mostra o motivo na tela de login. Isso cobre o posto hospitalar mesmo se o refresh token do Auth ainda for válido.

O wrapper morto `authenticatedFetch` (`src/lib/api.ts`) saiu — não restava rota Express autenticada. `GET /api/health` continua público.

No Dashboard, vale conferir Authentication → Settings com os mesmos 12h / 8h (o CLI não aplica `config.toml` no projeto hospedado).

## Onda 8 (senha vazada)

O advisor de Auth do Anestflow aponta **Leaked Password Protection Disabled**. O CLI ainda **não** versiona `password_hibp_enabled` no `config.toml`.

No cliente, `mapAuthError` reconhece `AuthWeakPasswordError` com `reasons: ["pwned"]` (e o corpo `weak_password.reasons`) e mostra aviso em português. Sem o toggle no Dashboard, o Auth hospedado **não rejeita** senhas do HaveIBeenPwned — só a mensagem do app fica pronta.

Ligar no projeto (plano Pro ou superior):

1. [Authentication → Providers → Email](https://supabase.com/dashboard/project/plciototnjsdjzhudptc/auth/providers?provider=Email)
2. **Prevent use of leaked passwords** → ON
3. Salvar

SMTP próprio e Google OAuth continuam fora desta onda (precisam de secret no Dashboard). Storage não entra: áudio de voz não é persistido.

## Onda 9 (fechamento)

Inventário do que as ondas 0–8 **não** cobriram, e o que ainda entra no código.

### Feito nesta onda

- `ClinicalErrorBoundary` em volta do app: um throw no React deixa de virar tela branca sem explicação; a ficha na nuvem não é apagada; o recarregar volta ao posto.
- Onda 4 **nunca existiu** no plano (salto 3 → 5). Storage de arquivo foi recusado de propósito na onda 6 (PDF/TCLE locais; áudio de voz não persiste).

### Só no Dashboard / ops (o git não liga sozinho)

| Item | Onde |
|---|---|
| Prevent use of leaked passwords (HaveIBeenPwned) no Auth hospedado | Auth → Providers → Email (Pro+). O cadastro no app já consulta HIBP na onda 10. |
| Sessão 12h / ociosidade 8h iguais ao `config.toml` | Auth → Settings (CLI não aplica no cloud) |
| Confirmar e-mail ON, cadastro anônimo OFF | Auth → Providers / Settings |
| SMTP próprio (sair do teto de 2 e-mails/hora) | Auth → SMTP |
| Google OAuth | Auth → Providers → Google, com Client ID/Secret |
| `GEMINI_API_KEY` | `npx supabase secrets set` / Edge Function secrets |
| `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` | Vercel → Environment Variables |
| Repositório GitHub **privado** | Settings do repo |
| Rotacionar a API key Firebase que já esteve no git | Google Cloud |
| Merge da pilha de PRs no `main` | revisão humana |

Não desligue a confirmação de e-mail para contornar o limite de SMTP.

## Onda 10 (senha vazada no cadastro)

O advisor `auth_leaked_password_protection` continua WARN no Anestflow até o toggle **Prevent use of leaked passwords** no Dashboard (Pro+). Sem `SUPABASE_ACCESS_TOKEN` esta onda **não** liga o Auth hospedado.

Enquanto isso, o cadastro no cliente consulta a API [Pwned Passwords](https://haveibeenpwned.com/API/v3#PwnedPasswords) **antes** de `signUp`:

- Só os 5 primeiros hex do SHA-1 saem do dispositivo (k-anonymity; header `Add-Padding`)
- Senha conhecida em vazamento → aviso em português, **sem** criar conta e **sem** gastar a cota de e-mail
- Se o HaveIBeenPwned estiver fora do ar, o cadastro segue (fail-open); tamanho/complexidade continuam obrigatórios
- Login de quem já tem conta **não** é bloqueado por esta checagem

O toggle no Dashboard continua recomendado: aí o GoTrue também recusa senha vazada no servidor.

## Fase 0+1 (persistência clínica e dado não inventado)

Testes do comportamento correto (Fase 0) e correções (Fase 1) na mesma linha:

- O autosave usa `clinicalChangeFingerprint` cobrindo o que `saveProcedure` persiste (timers, gases, fluidos, SRPA, via aérea, checklist, etc.). Debounce de 1,2s permanece.
- PDF/SRPA não preenchem PA 120/80, FC 80, SpO₂ 98% nem 36,5 °C. Aldrete **0** não é “não registrado”.
- Escriba por voz não inventa 2%, EV, dose 0, 100 mL nem 1 L/min; a confirmação mostra “não informada”.
- Parse falho da auditoria de IA devolve `AI_REVIEW_PARSE_FAILED` — não uma lista vazia de alertas.
- ID clínico duplicado **regenera** o segundo item; não descarta o lançamento.
- E-mail de assinatura/claim vem do Auth (`user.email`), não do hospital.

## Fase 2 (PHI fora do localStorage)

A ficha clínica (paciente, vitais, fármacos, SRPA, fila offline) **não** é mais gravada em `localStorage`. Posto compartilhado: fechar a aba some com o rascunho.

| Chave | Onde | Uso |
|---|---|---|
| `anestflow_pending_sync_queue` | `sessionStorage` | Fila de sync da aba |
| `anestflow_active_doc_<uid>` | `sessionStorage` | Rascunho ativo da aba |
| `anesthesia_doc` | `localStorage` | Legado — só apagada na subida/logout |
| `anestflow_doc_local_<procedureId>` | `localStorage` | Legado — só apagada na subida/logout |

`tema`, presets de bomba, templates e o relógio de sessão continuam no `localStorage` (não são PHI do paciente). O botão **Limpar Cache** nas configurações chama o mesmo purge. Offline: as alterações ficam nesta aba até sincronizar; fechar a aba antes do flush perde a fila.

## Fase 3 (`assertCanEdit`)

Edição clínica é **fail-closed**: só o `currentResponsibleUid` grava. O criador que não é o responsável atual **não** salva. Sem UID ou sem responsável na ficha → não edita.

- `canEditDocument` / `assertCanEdit` no cliente (App, voz, autosave, worklist) e em `saveProcedure`.
- UI de colaborador é somente leitura de verdade: `ClinicalEditorLock` (fieldset) em admissão, pré e SRPA; intra bloqueia pointer nos timers, gráfico e painéis (as abas de visualização continuam clicáveis). Voice Scribe não aplica.
- Banner único: `ResponsibilityBanner` (responsável / modo leitura + assumir / ficha assinada). Não há faixas duplicadas de “ficha assinada” no `App`.
- Ao registrar o início da anestesia, `Draft` vira `InProgress`. O header só diz “Anestesia em andamento” se existe `startAnesthesia` **e** não existe `endAnesthesia`.
- Encerramento usa `evaluateSigningReadiness` (`SigningReadinessEngine`) fora do `ReviewTab`: CRITICAL / IMPORTANT / INFO. Capnografia **não** é bloqueio universal. Técnica ausente é IMPORTANT. Sem responsável autenticado é CRITICAL.

Ficha assinada bloqueia mutação. O encerramento **não** grava `status: Signed` pelo cliente: `closeProcedureAtomic` chama `sign_procedure(uuid)` depois de um flush clínico. `closingSignature` permanece só como escape se alguém ainda passar uma ficha já marcada Signed para `saveProcedure`. Claim e transferência **não** passam por `assertCanEdit` no sentido de mutação local: o cliente chama as RPCs da Fase 4. Adendo retificatório em ficha já assinada continua no caminho próprio (`add_procedure_amendment`).

## Fase 4 (claim/transfer só via RPC)

Troca e assunção de responsabilidade **não** mutam `currentResponsibleUid` no React. Sem UUID da ficha na nuvem ou sem conexão, o cliente recusa — não há fallback local.

| Ação | RPC | Quem chama |
|---|---|---|
| Transferir já | `transfer_responsibility` | Responsável atual; `p_incoming_user_id` é o UID do colega (lookup por e-mail) |
| Solicitar aceite | `request_transfer` | Responsável atual; inclui o colega como participante e grava `pending_transfer` |
| Aceitar | `claim_responsibility` | Só o UID em `pending_transfer.incomingUid`. Sem pendência → `claim_requires_pending` |
| Recusar | `decline_pending_transfer` | Responsável atual **ou** o UID em `pending_transfer.incomingUid` |
| Assumir | `assume_responsibility` | Participante da ficha; motivo obrigatório (≥ 10 caracteres). Auditoria `assume_responsibility_exceptional` |

Aceitar (transferência normal) e Assumir (exceção) **não** compartilham o mesmo RPC. O botão Assumir abre o modal de motivo e chama `assume_responsibility`. `claim_responsibility` ficou só para o aceite da pendência.

O e-mail do entrante é **obrigatório**. O cliente resolve o perfil com `lookup_profile_by_email` e nunca envia o UID de quem transfere como incoming (`incoming_must_differ` no servidor). Autosave **não** grava `pending_transfer` nem `procedure_transfers` — essas colunas só mudam nas RPCs (e na assinatura, que zera a pendência).

O botão Sincronização do `ShareModal` pausa de verdade o **autosave de saída** (`pauseAutosave` / `resumeAutosave`). Offline continua offline; pausado não se disfarça de offline. Realtime de entrada segue ativo. `retrySyncNow` no badge continua sendo flush explícito.

O live `fase04_live.ts` (um usuário) cobre no-op, self-transfer, perfil ausente e `reason_required`. Com `ONDA3_TEST_EMAIL_B` + `ONDA3_TEST_PASSWORD_B`, `fase04_handover_live.ts` exercita participante sem pendência (`claim_requires_pending`), `request_transfer` A→B, aceite via `claim_responsibility` e `assume_responsibility` excepcional.

## Fase 4B (integridade documental V2)

O navegador **não** é autoridade do JSON selado. Encerrar a ficha chama `sign_procedure(p_procedure_id)` — sem `p_canonical`, sem hash e sem nome/CRM/UF do signatário vindos do cliente.

No mesmo COMMIT o Postgres:

1. Confere `auth.uid()`, responsável e critérios CRITICAL do `SigningReadinessEngine` (início da anestesia, ordem cirurgia/anestesia, nome ≥ 5, `responsible_id`, chefe + CRM).
2. Trava a linha (`SELECT … FOR UPDATE`), lê a ficha e as tabelas filhas.
3. Monta `SignedAnesthesiaRecordV1` (paciente, procedimento, equipe, pré, técnica, via aérea, monitor/equipamento, acessos, vitais, bolus, infusões, inalatórios, fluidos, débitos, eventos, incidentes, timers, transferências, checklist, recuperação, handover, narrativas e metadados).
4. Preenche o signatário a partir de `profiles`.
5. Canonical = `jsonb::text` determinístico; SHA-256 desse texto; grava `signed_canonical`, `content_hash`, `signed_by`, `signed_at` e `status = signed`.

Verificação (`verify_procedure_integrity`):

- **A:** `hash(snapshot) == stored_hash`
- **B:** `canonical(dados atuais do servidor) == signed_snapshot`

A UI só trata a ficha como íntegra quando **A e B** passam. Fichas seladas no contrato antigo (canonical do cliente) podem passar A e são marcadas `legacy` — não se afirma integridade persistida só com A.

Na interface isso é **selo criptográfico de integridade** / **Integridade SHA-256**. SHA-256 isolado **não** é apresentado como assinatura digital do médico.

Adendos: autor oficial = `auth.uid()` → `profiles`. `p_author_name` / `p_author_crm` / `p_author_uf` do navegador são ignorados. O canonical do adendo vincula procedimento, snapshot (`content_hash`), autor, timestamp, conteúdo e motivo.

O PDF final da Fase 7 (`pdfFinal.ts`) deriva do contrato `SignedAnesthesiaRecordV1` (snapshot 4B + hash sidecar). O preview de captura (`html-to-image` / `PdfPreviewModal`) permanece. Live: `fase04b_live.ts` (e `onda3_live.ts` atualizado para o close atômico).

## Checkpoint pós-Fase 4

Auditoria técnica obrigatória **antes** da higiene da Fase 5 e do fatiar App/Intra (6B). Este checkpoint **não fatiar** componentes.

Nesse ponto precisam estar comprovadamente estáveis: persistência, segurança clínica básica, cache, permissões, responsabilidade, encerramento e integridade documental.

| Critério do posto | Evidência |
|---|---|
| Alterar só Sevo e timer, recarregar | `fase01_live.ts`, `checkpoint_live.ts` |
| SRPA permanece (Aldrete 0 ≠ vazio) | `fase01_live.ts`, `checkpoint_live.ts` |
| PDF sem vital não inventa 120/80 | suíte Fase 0+1 / `clinicalDisplay` |
| Voz sem concentração não inventa 2% | suíte escriba + Sevo no live sem `inspiredConc` |
| Logout sem ficha no localStorage | suíte Fase 2 |
| Colaborador em modo leitura + ação de responsabilidade | suíte Fase 3 (`ClinicalEditorLock`) + Fase 4 |
| A transfere, B aceita, `responsible_id` = B | `fase04_handover_live.ts` (pede `ONDA3_TEST_EMAIL_B`) |
| Ficha assinada imutável | `onda3_live.ts`, `fase04b_live.ts`, `checkpoint_live.ts` |
| Hash gerado no servidor | `sign_procedure(uuid)`, live 4B / checkpoint |
| Adulteração pós-fecho detectável | `verify_procedure_integrity` A+B |
| Segundo save com revision velha rejeitado | `fase06_live.ts` (já na árvore; critério 11 do posto) |
| Header / overflow | suíte onda 7 + Fase 5 rename |
| Suíte 100% com fingerprint, safety, assertCanEdit, responsabilidade, selo e revision | `npx tsx src/tests/run_tests.ts` seção 20 |

Live condensado (persistir → selar → A+B → imutável):

```bash
npx tsx src/tests/checkpoint_live.ts
```

Sentinela: `CHECKPOINT_LIVE_OK`. Feitas depois deste checkpoint: fatiar App/Intra (6B), PDF final do contrato 4B (7F) e `transcript_original` (7E).

## Fase 5 (renomear `document` → `ficha` + higiene)

A ficha clínica no React **não** se chama mais `document`. Esse nome sombreava o `document` do DOM: o menu overflow e o download de modelos precisavam de `window.document` para não bater na ficha.

O estado em `App.tsx` e as props das abas/modais passaram a `ficha`. O tipo continua `AnesthesiaDocument`. Funções como `getBlankDocument` e `canEditDocument` não mudam. `signAndLockDocument` permanece só para testes locais de hash — o encerramento real é `closeProcedureAtomic`. A chave `document` no body da Edge Function `generate-description` também permanece (`{ document: toAIClinicalContext(ficha), models }`).

Depois do rename, o overflow escuta `document.addEventListener` direto. `App.tsx` e `IntraoperativeTab.tsx` foram fatiados na **Fase 6B**.

### Higiene (IDs, resíduos, settings reais)

- Um `DraggablePanel` por ID. O lançador de fármacos não envolve um segundo painel `id="drugs"`.
- Removidos módulos importados e não montados: `VitalsPanel`, `BolusDrugsPanel`, `SupportPanel`, `useMultiplayer`.
- Removidos `react-router-dom` (zero rotas), `bun.lock` (npm é o oficial) e scripts históricos `fix_*` / `patch_*` / `rewrite_*` da raiz.
- Settings deixam de ser decorativas: `vitalIntervalMinutes` e `soundAlertsEnabled` alimentam o intra (intervalo do alarme + beep). `compactMode` reduz padding (`anestflow-compact`). Dark já existia (`anesthesia_theme`).
- Error Boundary e o **chrome** do PDF Preview seguem o tema. As folhas do PDF continuam brancas para impressão.
- Supervisor de IA não usa `console.log` em produção (`supervisorDevLog` só em DEV).
- `deleteClinicalEventItem` **não** faz hard delete. Eventos clínicos permanecem nas tabelas filhas; exclusão de ficha no gestor continua só para **rascunho**. Tombstone completo (`voided_at` / `voided_by` / `void_reason` na UI) fica para quando houver fluxo de cancelamento auditável. `persistClinicalChildren` só faz upsert — não apaga linhas órfãs.

## Fase 6 (`revision` de concorrência)

A última gravação **não** ganha mais por `id` sozinho. Cada linha em `procedures` tem `revision` (inteiro, começa em 1). Um trigger `BEFORE UPDATE` no servidor incrementa sempre — o cliente **não** manda o valor no payload (mesmo padrão de `pending_transfer`).

`saveProcedure` faz `UPDATE … WHERE id = $1 AND revision = $esperado`. Zero linhas → `stale_revision`: a fila **não** retenta a cada 5s; recarrega a ficha da nuvem (servidor ganha, sem merge clínico) e o badge de sync mostra o erro. Fichas antigas e rascunhos em `sessionStorage` sem o campo tratam a revision esperada como **1**.

Mudar só `revision` / `updatedAt` **não** altera `clinicalChangeFingerprint` — o autosave não entra em loop. `docVersion` / `schema_version` continuam sendo versão de schema, não token de linha. `updatedAtServer` não foi removido.

Com um único usuário de teste o conflito é reproduzido gravando de novo com `revision` velha; duas abas reais ou um segundo médico não são necessários para validar o token.

### 6B — fatiar App / Intra

Extração **sem mudar comportamento**. `App.tsx` orquestra: `useClinicalDocument`, `useResponsibilityActions`, `useAiSupervisor`, `useOverflowMenu`, `AppHeader`, `AppNav`, `AppModalHost`. A ficha viva continua em `const [ficha, setFicha]` no hook clínico; as abas ainda recebem `ficha={ficha}`.

`IntraoperativeTab` vira orquestrador de layout. Cada painel vivo mora em `src/components/intra/` (`IntraoperativeVitalsLaunch`, bombas, gases, líquidos, eventos, suporte, fármacos, cronologia, gráfico) atrás de `IntraoperativeUiProvider`. Painéis mortos da Fase 5 (`VitalsPanel`, `BolusDrugsPanel`, `SupportPanel`) **não** voltam. Um `DraggablePanel id="drugs"`.

`getPublicSupabaseConfig()` é a única fonte de URL + chave publishable para o Express e `api/public-config.ts`. `passwordPolicy` e `authErrors` compartilham `PASSWORD_ERROR_LENGTH` / `PASSWORD_ERROR_CHARACTERS`.

A extração não altera merge de estado, fingerprint, `assertCanEdit`, responsabilidade nem selo.

## Fase 7 (tipos, PWA, IA e hardening)

Última fase do plano consolidado. `App.tsx` e `IntraoperativeTab.tsx` já foram fatiados na 6B. `strict` **não** foi ligado no `tsconfig.json` principal.

### 7A — TypeScript em `src/lib`

`tsconfig.lib.strict.json` aplica `strict` + `noImplicitAny` só em `src/lib`. Rode `npm run lint:lib`. O app **não** instala `@types/react` no projeto inteiro: isso quebra Intra, templates e TCLE (literais de fármaco e unions). Há um shim mínimo em `src/lib/ts-strict-shims`, excluído do `tsconfig.json` principal. Intra/PDF/chart ficam por último, como o plano pede.

### 7B — PWA

`PWA_CACHE_NAME` (`anestflow-pwa-v7`) vai para o `cacheId` do Workbox. Produção usa `autoUpdate` + `skipWaiting` + `clientsClaim` + `cleanupOutdatedCaches`. Em **dev**, `main.tsx` desregistra service workers de um `dist` antigo — isso **não** roda em produção.

### 7C — Headers no host real

O front em produção é a **Vercel**. `vercel.json` envia CSP, `X-Frame-Options: DENY` (`frame-ancestors 'none'`), `X-Content-Type-Options`, `Referrer-Policy`, HSTS e `Permissions-Policy: microphone=(self), camera=(), geolocation=(), payment=(), usb=()`. O Express local e `/api/public-config` usam a mesma lista em `src/lib/securityHeaders.ts`.

### 7D — Lock do posto vs logout

A onda 7 permanece: **12h** de timebox e **8h** ociosas **encerram a sessão** (logout). Separado disso:

- **20 min** ociosos → tela de bloqueio. A ficha **não** é apagada e **não** há logout. A senha do mesmo e-mail desbloqueia e volta à ficha (`touchSession`).
- **15 min** ociosos no encerramento/assinatura → o mesmo overlay pede a senha de novo (step-up). Depois de desbloquear, o médico confirma o encerramento outra vez.

### 7E — IA

`toAIClinicalContext(ficha)` omite CPF, nome, prontuário, admissão, leito, UIDs e **transcrições originais de voz**. `ReviewTab` e a descrição enviam esse contexto; a chave `document` da Edge `generate-description` não muda. A Edge ainda stripa na entrada (`_shared/aiStrip.ts`). Parse falho de review continua `AI_REVIEW_PARSE_FAILED` (HTTP 502), **não** `alerts: []`.

Modelo pinado: `gemini-3.1-flash-lite` (sem alias `gemini-flash-latest`). Cada função manda `prompt_version` (`review-v1`, `description-v1`, `voice-v2`) e devolve metadados técnicos (`provider`, `model`, `prompt_version`, `schema_version`, `timestamp`, `latency_ms`, `success`). JWT das Edge Functions permanece (`verify_jwt = true`).

Cadeia do escriba: áudio → `transcript_original` (o que foi ouvido, sem correção de jargão) → interpretação clínica (`identifiedActions`) → confirmação humana → comando na ficha. A transcrição original é persistida em `procedures.voice_transcripts` e entra no selo 4B só quando há itens (selos antigos sem a chave continuam byte-idênticos na checagem B). A interpretação **nunca** substitui o que foi ouvido.

### 7F — PDF final

O preview de captura (`html-to-image` / `PdfPreviewModal`) não foi reescrito. O PDF clínico definitivo (`toSignedAnesthesiaRecordV1` + `pdfFinalSearchableText` + `buildSignedRecordPdfBytes`) deriva do snapshot `SignedAnesthesiaRecordV1` do contrato 4B, com `integrityHash` sidecar (`content_hash`). Texto pesquisável, layout determinístico (Helvetica, data de criação fixa) e metadados (`procedureId`, `revision`, `signedAt`, responsável, hash). Ausência continua ausência (`Não registrado` / `UNREGISTERED`). O PDF **não** inventa `120/80`. Na Review de ficha selada há **PDF final (selo)**.

### 7G — CORS

Origem de deploy (preview Vercel) não é estável, então o default é `*`. Opcional: secret `ANESTFLOW_CORS_ORIGIN`. Isso **não** desliga o JWT.

```bash
npx tsc --noEmit
npm run lint:lib
npx tsx src/tests/run_tests.ts
npx tsx src/tests/fase07_live.ts
```



