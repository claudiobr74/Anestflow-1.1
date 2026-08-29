-- Fase 4A: claim_responsibility só aceita pending; assunção excepcional é RPC próprio.

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
  pending jsonb;
  incoming_txt text;
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

  select pending_transfer into pending
  from public.procedures
  where id = p_procedure_id;

  if pending is null or pending = 'null'::jsonb then
    raise exception 'claim_requires_pending' using errcode = '22023';
  end if;

  incoming_txt := nullif(pending->>'incomingUid', '');
  if incoming_txt is distinct from uid::text then
    raise exception 'not_allowed' using errcode = '42501';
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
        'Aceite de transferência: Dr(a). ',
        coalesce(p_handover->>'incomingName', '')
      ),
      'category', 'Equipe',
      'outgoingUid', outgoing,
      'incomingUid', uid,
      'notes', concat(
        'Responsabilidade clínica transferida mediante aceite. CRM ',
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

create or replace function private.assume_responsibility(
  p_procedure_id uuid,
  p_reason text,
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
  reason text;
begin
  reason := trim(both from coalesce(p_reason, ''));
  if char_length(reason) < 10 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if not private.is_procedure_open(p_procedure_id) then
    raise exception 'signed_procedure_immutable' using errcode = '42501';
  end if;
  if private.is_procedure_responsible(p_procedure_id) then
    return;
  end if;
  if not private.is_procedure_participant(p_procedure_id) then
    raise exception 'not_participant' using errcode = '42501';
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
    handover = coalesce(p_handover, '{}'::jsonb) || jsonb_build_object(
      'assumptionKind', 'exceptional',
      'exceptionalReason', reason
    ),
    team = coalesce(team, '{}'::jsonb) || coalesce(team_patch, '{}'::jsonb)
  where id = p_procedure_id;

  insert into public.procedure_transfers (
    procedure_id, created_by, outgoing_user_id, incoming_user_id, payload
  ) values (
    p_procedure_id,
    uid,
    outgoing,
    uid,
    coalesce(p_handover, '{}'::jsonb) || jsonb_build_object(
      'assumptionKind', 'exceptional',
      'exceptionalReason', reason
    )
  );

  insert into public.procedure_events (
    procedure_id, created_by, clinical_at, payload
  ) values (
    p_procedure_id,
    uid,
    now(),
    jsonb_build_object(
      'name', concat(
        'Assunção excepcional de responsabilidade: Dr(a). ',
        coalesce(p_handover->>'incomingName', '')
      ),
      'category', 'Equipe',
      'outgoingUid', outgoing,
      'incomingUid', uid,
      'assumptionKind', 'exceptional',
      'notes', concat('Motivo: ', reason)
    )
  );

  insert into private.audit_events (procedure_id, actor_id, action)
  values (p_procedure_id, uid, 'assume_responsibility_exceptional');
end;
$$;

create or replace function public.assume_responsibility(
  p_procedure_id uuid,
  p_reason text,
  p_handover jsonb default '{}'::jsonb
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.assume_responsibility(p_procedure_id, p_reason, p_handover);
$$;

revoke all on function private.assume_responsibility(uuid, text, jsonb) from public, anon;
revoke all on function public.assume_responsibility(uuid, text, jsonb) from public, anon;

grant execute on function private.assume_responsibility(uuid, text, jsonb) to authenticated;
grant execute on function public.assume_responsibility(uuid, text, jsonb) to authenticated;

comment on function public.claim_responsibility(uuid, jsonb) is
  'Aceite de transferência pendente. Sem pending_transfer → claim_requires_pending.';
comment on function public.assume_responsibility(uuid, text, jsonb) is
  'Assunção excepcional. Motivo obrigatório (≥ 10 caracteres). Auditoria assume_responsibility_exceptional.';
