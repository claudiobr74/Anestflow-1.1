-- Fase 4: pedido/recusa de transferência via RPC; claim limpa pending e registra equipe anterior.

create or replace function private.request_transfer(
  p_procedure_id uuid,
  p_incoming_user_id uuid,
  p_handover jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_signed_in_confirmed();
  outgoing uuid;
  incoming_email text;
  pending jsonb;
begin
  if p_incoming_user_id is null then
    raise exception 'incoming_required' using errcode = '22023';
  end if;
  if p_incoming_user_id = uid then
    raise exception 'incoming_must_differ' using errcode = '22023';
  end if;
  if not private.is_procedure_responsible(p_procedure_id) then
    raise exception 'not_responsible' using errcode = '42501';
  end if;
  if not private.is_procedure_open(p_procedure_id) then
    raise exception 'signed_procedure_immutable' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles pr where pr.id = p_incoming_user_id) then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  select responsible_id into outgoing from public.procedures where id = p_procedure_id;

  insert into public.procedure_participants (procedure_id, user_id, role)
  values (p_procedure_id, p_incoming_user_id, 'collaborator')
  on conflict (procedure_id, user_id) do nothing;

  select pr.email into incoming_email
  from public.profiles pr
  where pr.id = p_incoming_user_id;

  pending := coalesce(p_handover, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'id', gen_random_uuid()::text,
    'outgoingUid', outgoing,
    'incomingUid', p_incoming_user_id,
    'incomingEmail', coalesce(nullif(p_handover->>'incomingEmail', ''), incoming_email),
    'requestedAt', timezone('utc', now())
  ));

  update public.procedures
  set pending_transfer = pending
  where id = p_procedure_id;

  insert into public.procedure_events (
    procedure_id, created_by, clinical_at, payload
  ) values (
    p_procedure_id,
    uid,
    now(),
    jsonb_build_object(
      'name', concat(
        'Solicitação de Troca de Responsabilidade: Dr(a). ',
        coalesce(nullif(p_handover->>'outgoingName', ''), 'Responsável'),
        ' ➔ Dr(a). ',
        coalesce(p_handover->>'incomingName', '')
      ),
      'category', 'Equipe',
      'outgoingUid', outgoing,
      'incomingUid', p_incoming_user_id,
      'notes', concat(
        'Aguardando aceite. Condições: ',
        coalesce(p_handover->>'clinicalConditions', 'Estável'),
        '.'
      )
    )
  );

  insert into private.audit_events (procedure_id, actor_id, action)
  values (p_procedure_id, uid, 'request_transfer');
end;
$$;

create or replace function private.decline_pending_transfer(p_procedure_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_signed_in_confirmed();
  pending jsonb;
  incoming_txt text;
  is_responsible boolean;
begin
  if not private.is_procedure_open(p_procedure_id) then
    raise exception 'signed_procedure_immutable' using errcode = '42501';
  end if;

  select pending_transfer, private.is_procedure_responsible(p_procedure_id)
    into pending, is_responsible
  from public.procedures
  where id = p_procedure_id;

  if not found then
    raise exception 'procedure_not_found' using errcode = 'P0002';
  end if;
  if pending is null or pending = 'null'::jsonb then
    raise exception 'pending_not_found' using errcode = 'P0002';
  end if;

  incoming_txt := nullif(pending->>'incomingUid', '');
  if not is_responsible and incoming_txt is distinct from uid::text then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  update public.procedures
  set pending_transfer = null
  where id = p_procedure_id;

  insert into public.procedure_events (
    procedure_id, created_by, clinical_at, payload
  ) values (
    p_procedure_id,
    uid,
    now(),
    jsonb_build_object(
      'name', 'Solicitação de troca de responsabilidade recusada',
      'category', 'Equipe',
      'notes', 'A pendência de handover foi cancelada. O responsável atual permanece o mesmo.'
    )
  );

  insert into private.audit_events (procedure_id, actor_id, action)
  values (p_procedure_id, uid, 'decline_pending_transfer');
end;
$$;

create or replace function private.claim_responsibility(
  p_procedure_id uuid,
  p_handover jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_signed_in_confirmed();
  outgoing uuid;
  team_patch jsonb;
  outgoing_name text;
  outgoing_crm text;
  outgoing_uf text;
begin
  if not private.is_procedure_participant(p_procedure_id) then
    raise exception 'not_participant' using errcode = '42501';
  end if;
  if private.is_procedure_responsible(p_procedure_id) then
    return;
  end if;
  if not private.is_procedure_open(p_procedure_id) then
    raise exception 'signed_procedure_immutable' using errcode = '42501';
  end if;

  select responsible_id into outgoing from public.procedures where id = p_procedure_id;

  select pr.full_name, pr.crm, pr.uf
    into outgoing_name, outgoing_crm, outgoing_uf
  from public.profiles pr
  where pr.id = outgoing;

  update public.procedure_participants
  set role = 'collaborator'
  where procedure_id = p_procedure_id
    and user_id = outgoing
    and role = 'responsible';

  insert into public.procedure_participants (procedure_id, user_id, role)
  values (p_procedure_id, uid, 'responsible')
  on conflict (procedure_id, user_id) do update set role = 'responsible';

  team_patch := jsonb_strip_nulls(jsonb_build_object(
    'anesthesiologistLead', nullif(p_handover->>'incomingName', ''),
    'crmLead', nullif(p_handover->>'incomingCRM', ''),
    'ufLead', nullif(p_handover->>'incomingUF', ''),
    'anesthesiologistAssistant',
      case
        when coalesce(nullif(p_handover->>'outgoingName', ''), outgoing_name, '') = '' then null
        else concat(
          'Anterior: ',
          coalesce(nullif(p_handover->>'outgoingName', ''), outgoing_name),
          ' (',
          coalesce(nullif(p_handover->>'outgoingCRM', ''), outgoing_crm, ''),
          '/',
          coalesce(nullif(p_handover->>'outgoingUF', ''), outgoing_uf, ''),
          ')'
        )
      end
  ));

  update public.procedures
  set
    responsible_id = uid,
    pending_transfer = null,
    handover = coalesce(p_handover, '{}'::jsonb),
    team = coalesce(team, '{}'::jsonb) || coalesce(team_patch, '{}'::jsonb)
  where id = p_procedure_id;

  insert into public.procedure_transfers (
    procedure_id, created_by, outgoing_user_id, incoming_user_id, payload
  ) values (
    p_procedure_id, uid, outgoing, uid, coalesce(p_handover, '{}'::jsonb)
  );

  insert into public.procedure_events (
    procedure_id, created_by, clinical_at, payload
  ) values (
    p_procedure_id,
    uid,
    now(),
    jsonb_build_object(
      'name', concat(
        'Assunção de Responsabilidade: Dr(a). ',
        coalesce(p_handover->>'incomingName', '')
      ),
      'category', 'Equipe',
      'outgoingUid', outgoing,
      'incomingUid', uid,
      'notes', concat(
        'Responsabilidade clínica assumida. CRM ',
        coalesce(p_handover->>'incomingCRM', ''),
        '/',
        coalesce(p_handover->>'incomingUF', ''),
        '.'
      )
    )
  );

  insert into private.audit_events (procedure_id, actor_id, action)
  values (p_procedure_id, uid, 'claim_responsibility');
end;
$$;

create or replace function public.request_transfer(
  p_procedure_id uuid,
  p_incoming_user_id uuid,
  p_handover jsonb
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.request_transfer(p_procedure_id, p_incoming_user_id, p_handover);
$$;

create or replace function public.decline_pending_transfer(p_procedure_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.decline_pending_transfer(p_procedure_id);
$$;

revoke all on function private.request_transfer(uuid, uuid, jsonb) from public, anon;
revoke all on function private.decline_pending_transfer(uuid) from public, anon;
revoke all on function public.request_transfer(uuid, uuid, jsonb) from public, anon;
revoke all on function public.decline_pending_transfer(uuid) from public, anon;

grant execute on function private.request_transfer(uuid, uuid, jsonb) to authenticated;
grant execute on function private.decline_pending_transfer(uuid) to authenticated;
grant execute on function public.request_transfer(uuid, uuid, jsonb) to authenticated;
grant execute on function public.decline_pending_transfer(uuid) to authenticated;

comment on function public.request_transfer(uuid, uuid, jsonb) is
  'Wrapper invoker. Grava pending_transfer e inclui o colega como participante, sem mudar o responsável.';
comment on function public.decline_pending_transfer(uuid) is
  'Wrapper invoker. Responsável atual ou o colega indicado em pending_transfer podem recusar.';
comment on function public.claim_responsibility(uuid, jsonb) is
  'Wrapper invoker. Participante assume o caso; limpa pending_transfer.';
