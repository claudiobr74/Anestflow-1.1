-- Onda 1 (cont.): correções de advisors — auditoria, grants, FKs e RPCs fora do schema exposto.

-- ---------------------------------------------------------------------------
-- audit_events: RLS sem policy gerava INFO. Cliente não lê/grava auditoria.
-- ---------------------------------------------------------------------------

create policy audit_events_deny_authenticated
  on private.audit_events
  for all
  to authenticated
  using (false)
  with check (false);

create policy audit_events_deny_anon
  on private.audit_events
  for all
  to anon
  using (false)
  with check (false);

-- Event trigger da plataforma: não deve ser RPC anon/authenticated.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Índices nas FKs apontadas pelo advisor de performance
-- ---------------------------------------------------------------------------

create index procedure_vitals_created_by_idx on public.procedure_vitals (created_by);
create index procedure_medications_created_by_idx on public.procedure_medications (created_by);
create index procedure_fluids_created_by_idx on public.procedure_fluids (created_by);
create index procedure_infusions_created_by_idx on public.procedure_infusions (created_by);
create index procedure_events_created_by_idx on public.procedure_events (created_by);
create index procedure_amendments_created_by_idx on public.procedure_amendments (created_by);
create index procedure_transfers_created_by_idx on public.procedure_transfers (created_by);
create index procedure_transfers_outgoing_user_id_idx on public.procedure_transfers (outgoing_user_id);
create index procedure_transfers_incoming_user_id_idx on public.procedure_transfers (incoming_user_id);

-- ---------------------------------------------------------------------------
-- RPCs: IMPLEMENTAÇÃO no schema private (DEFINER). Wrappers public INVOKER.
-- O cliente continua chamando /rest/v1/rpc/*; o lint 0029 some do schema exposto.
-- ---------------------------------------------------------------------------

alter function public.lookup_profile_by_email(text) set schema private;
alter function public.add_participant_by_email(uuid, text) set schema private;
alter function public.sign_procedure(uuid, text, jsonb) set schema private;
alter function public.transfer_responsibility(uuid, uuid, jsonb) set schema private;
alter function public.claim_responsibility(uuid, jsonb) set schema private;
alter function public.add_procedure_amendment(uuid, text, text, text, text, text) set schema private;

revoke all on function private.lookup_profile_by_email(text) from public, anon;
revoke all on function private.add_participant_by_email(uuid, text) from public, anon;
revoke all on function private.sign_procedure(uuid, text, jsonb) from public, anon;
revoke all on function private.transfer_responsibility(uuid, uuid, jsonb) from public, anon;
revoke all on function private.claim_responsibility(uuid, jsonb) from public, anon;
revoke all on function private.add_procedure_amendment(uuid, text, text, text, text, text) from public, anon;

grant execute on function private.lookup_profile_by_email(text) to authenticated;
grant execute on function private.add_participant_by_email(uuid, text) to authenticated;
grant execute on function private.sign_procedure(uuid, text, jsonb) to authenticated;
grant execute on function private.transfer_responsibility(uuid, uuid, jsonb) to authenticated;
grant execute on function private.claim_responsibility(uuid, jsonb) to authenticated;
grant execute on function private.add_procedure_amendment(uuid, text, text, text, text, text) to authenticated;

create or replace function public.lookup_profile_by_email(p_email text)
returns table (
  id uuid,
  full_name text,
  crm text,
  uf text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.lookup_profile_by_email(p_email);
$$;

create or replace function public.add_participant_by_email(p_procedure_id uuid, p_email text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.add_participant_by_email(p_procedure_id, p_email);
$$;

create or replace function public.sign_procedure(p_procedure_id uuid, p_canonical text, p_signer jsonb)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.sign_procedure(p_procedure_id, p_canonical, p_signer);
$$;

create or replace function public.transfer_responsibility(
  p_procedure_id uuid,
  p_incoming_user_id uuid,
  p_handover jsonb
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.transfer_responsibility(p_procedure_id, p_incoming_user_id, p_handover);
$$;

create or replace function public.claim_responsibility(
  p_procedure_id uuid,
  p_handover jsonb default '{}'::jsonb
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.claim_responsibility(p_procedure_id, p_handover);
$$;

create or replace function public.add_procedure_amendment(
  p_procedure_id uuid,
  p_body text,
  p_reason text,
  p_author_name text,
  p_author_crm text,
  p_author_uf text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.add_procedure_amendment(
    p_procedure_id, p_body, p_reason, p_author_name, p_author_crm, p_author_uf
  );
$$;

revoke all on function public.lookup_profile_by_email(text) from public, anon;
revoke all on function public.add_participant_by_email(uuid, text) from public, anon;
revoke all on function public.sign_procedure(uuid, text, jsonb) from public, anon;
revoke all on function public.transfer_responsibility(uuid, uuid, jsonb) from public, anon;
revoke all on function public.claim_responsibility(uuid, jsonb) from public, anon;
revoke all on function public.add_procedure_amendment(uuid, text, text, text, text, text) from public, anon;

grant execute on function public.lookup_profile_by_email(text) to authenticated;
grant execute on function public.add_participant_by_email(uuid, text) to authenticated;
grant execute on function public.sign_procedure(uuid, text, jsonb) to authenticated;
grant execute on function public.transfer_responsibility(uuid, uuid, jsonb) to authenticated;
grant execute on function public.claim_responsibility(uuid, jsonb) to authenticated;
grant execute on function public.add_procedure_amendment(uuid, text, text, text, text, text) to authenticated;

comment on function public.transfer_responsibility(uuid, uuid, jsonb) is
  'Wrapper invoker. incoming_user_id deve ser o colega, nunca o uid de quem transfere.';
