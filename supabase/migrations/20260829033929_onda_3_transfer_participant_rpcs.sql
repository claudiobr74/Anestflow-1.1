-- Onda 3: team na transferência/claim e RPCs de participantes da ficha.

create or replace function private.transfer_responsibility(
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
  team_patch jsonb;
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

  update public.procedure_participants
  set role = 'collaborator'
  where procedure_id = p_procedure_id
    and user_id = outgoing
    and role = 'responsible';

  insert into public.procedure_participants (procedure_id, user_id, role)
  values (p_procedure_id, p_incoming_user_id, 'responsible')
  on conflict (procedure_id, user_id) do update set role = 'responsible';

  team_patch := jsonb_strip_nulls(jsonb_build_object(
    'anesthesiologistLead', nullif(p_handover->>'incomingName', ''),
    'crmLead', nullif(p_handover->>'incomingCRM', ''),
    'ufLead', nullif(p_handover->>'incomingUF', ''),
    'anesthesiologistAssistant',
      case
        when coalesce(p_handover->>'outgoingName', '') = '' then null
        else concat(
          'Anterior: ',
          p_handover->>'outgoingName',
          ' (',
          coalesce(p_handover->>'outgoingCRM', ''),
          '/',
          coalesce(p_handover->>'outgoingUF', ''),
          ')'
        )
      end
  ));

  update public.procedures
  set
    responsible_id = p_incoming_user_id,
    pending_transfer = null,
    handover = coalesce(p_handover, '{}'::jsonb),
    team = coalesce(team, '{}'::jsonb) || coalesce(team_patch, '{}'::jsonb)
  where id = p_procedure_id;

  insert into public.procedure_transfers (
    procedure_id, created_by, outgoing_user_id, incoming_user_id, payload
  ) values (
    p_procedure_id, uid, outgoing, p_incoming_user_id, coalesce(p_handover, '{}'::jsonb)
  );

  insert into public.procedure_events (
    procedure_id, created_by, clinical_at, payload
  ) values (
    p_procedure_id,
    uid,
    now(),
    jsonb_build_object(
      'name', concat(
        'Troca de Responsabilidade Concluída: Dr(a). ',
        coalesce(nullif(p_handover->>'outgoingName', ''), 'Anterior'),
        ' ➔ Dr(a). ',
        coalesce(p_handover->>'incomingName', '')
      ),
      'category', 'Equipe',
      'outgoingUid', outgoing,
      'incomingUid', p_incoming_user_id,
      'notes', concat(
        'Novo responsável: CRM ',
        coalesce(p_handover->>'incomingCRM', ''),
        '/',
        coalesce(p_handover->>'incomingUF', ''),
        '. Condições: ',
        coalesce(p_handover->>'clinicalConditions', 'Estável'),
        '.'
      )
    )
  );

  insert into private.audit_events (procedure_id, actor_id, action)
  values (p_procedure_id, uid, 'transfer_responsibility');
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
    'ufLead', nullif(p_handover->>'incomingUF', '')
  ));

  update public.procedures
  set
    responsible_id = uid,
    handover = coalesce(p_handover, '{}'::jsonb),
    team = coalesce(team, '{}'::jsonb) || coalesce(team_patch, '{}'::jsonb)
  where id = p_procedure_id;

  insert into public.procedure_transfers (
    procedure_id, created_by, outgoing_user_id, incoming_user_id, payload
  ) values (
    p_procedure_id, uid, outgoing, uid, coalesce(p_handover, '{}'::jsonb)
  );

  insert into private.audit_events (procedure_id, actor_id, action)
  values (p_procedure_id, uid, 'claim_responsibility');
end;
$$;

create or replace function private.list_procedure_participant_profiles(p_procedure_id uuid)
returns table (
  id uuid,
  full_name text,
  crm text,
  uf text,
  email text,
  role text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_signed_in_confirmed();
  if not private.is_procedure_participant(p_procedure_id) then
    raise exception 'not_participant' using errcode = '42501';
  end if;

  return query
    select pr.id, pr.full_name, pr.crm, pr.uf, pr.email, pp.role
    from public.procedure_participants pp
    join public.profiles pr on pr.id = pp.user_id
    where pp.procedure_id = p_procedure_id
    order by pp.created_at;
end;
$$;

create or replace function private.remove_procedure_collaborator(
  p_procedure_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_signed_in_confirmed();
  creator uuid;
  responsible uuid;
begin
  if p_user_id is null then
    raise exception 'user_required' using errcode = '22023';
  end if;

  select p.created_by, p.responsible_id
    into creator, responsible
  from public.procedures p
  where p.id = p_procedure_id;

  if creator is null then
    raise exception 'procedure_not_found' using errcode = 'P0002';
  end if;

  if uid is distinct from creator and uid is distinct from responsible then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not private.is_procedure_open(p_procedure_id) then
    raise exception 'signed_procedure_immutable' using errcode = '42501';
  end if;
  if p_user_id = creator or p_user_id = responsible then
    raise exception 'cannot_remove_lead' using errcode = '42501';
  end if;

  delete from public.procedure_participants
  where procedure_id = p_procedure_id
    and user_id = p_user_id
    and role = 'collaborator';

  insert into private.audit_events (procedure_id, actor_id, action)
  values (p_procedure_id, uid, 'remove_collaborator');
end;
$$;

revoke all on function private.list_procedure_participant_profiles(uuid) from public, anon;
revoke all on function private.remove_procedure_collaborator(uuid, uuid) from public, anon;
grant execute on function private.list_procedure_participant_profiles(uuid) to authenticated;
grant execute on function private.remove_procedure_collaborator(uuid, uuid) to authenticated;

create or replace function public.list_procedure_participant_profiles(p_procedure_id uuid)
returns table (
  id uuid,
  full_name text,
  crm text,
  uf text,
  email text,
  role text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.list_procedure_participant_profiles(p_procedure_id);
$$;

create or replace function public.remove_procedure_collaborator(
  p_procedure_id uuid,
  p_user_id uuid
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.remove_procedure_collaborator(p_procedure_id, p_user_id);
$$;

revoke all on function public.list_procedure_participant_profiles(uuid) from public, anon;
revoke all on function public.remove_procedure_collaborator(uuid, uuid) from public, anon;
grant execute on function public.list_procedure_participant_profiles(uuid) to authenticated;
grant execute on function public.remove_procedure_collaborator(uuid, uuid) to authenticated;
