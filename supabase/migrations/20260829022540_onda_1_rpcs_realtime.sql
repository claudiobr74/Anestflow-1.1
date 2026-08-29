-- Onda 1 (cont.): RPCs SECURITY DEFINER e Realtime.

-- ---------------------------------------------------------------------------
-- RPCs (SECURITY DEFINER, search_path vazio, revoke public)
-- ---------------------------------------------------------------------------

create or replace function public.lookup_profile_by_email(p_email text)
returns table (
  id uuid,
  full_name text,
  crm text,
  uf text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized text := lower(trim(p_email));
begin
  perform private.assert_signed_in_confirmed();
  if normalized is null or position('@' in normalized) = 0 then
    return;
  end if;
  return query
    select pr.id, pr.full_name, pr.crm, pr.uf
    from public.profiles pr
    where pr.email = normalized
    limit 1;
end;
$$;

create or replace function public.add_participant_by_email(p_procedure_id uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_signed_in_confirmed();
  target uuid;
  normalized text := lower(trim(p_email));
begin
  if not private.is_procedure_responsible(p_procedure_id)
     and not exists (
       select 1 from public.procedures p
       where p.id = p_procedure_id and p.created_by = uid
     ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not private.is_procedure_open(p_procedure_id) then
    raise exception 'signed_procedure_immutable' using errcode = '42501';
  end if;

  select pr.id into target
  from public.profiles pr
  where pr.email = normalized;

  if target is null then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  insert into public.procedure_participants (procedure_id, user_id, role)
  values (p_procedure_id, target, 'collaborator')
  on conflict (procedure_id, user_id) do nothing;

  insert into private.audit_events (procedure_id, actor_id, action)
  values (p_procedure_id, uid, 'add_participant');

  return target;
end;
$$;

create or replace function public.sign_procedure(p_procedure_id uuid, p_canonical text, p_signer jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_signed_in_confirmed();
  hash_hex text;
  signer jsonb;
begin
  if not private.is_procedure_responsible(p_procedure_id) then
    raise exception 'not_responsible' using errcode = '42501';
  end if;
  if not private.is_procedure_open(p_procedure_id) then
    raise exception 'already_signed' using errcode = '42501';
  end if;
  if p_canonical is null or length(trim(p_canonical)) = 0 then
    raise exception 'canonical_required' using errcode = '22023';
  end if;

  hash_hex := upper(encode(extensions.digest(convert_to(p_canonical, 'UTF8'), 'sha256'), 'hex'));
  signer := coalesce(p_signer, '{}'::jsonb)
    || jsonb_build_object('uid', uid);

  update public.procedures
  set
    status = 'signed',
    signed_at = now(),
    signed_by = signer,
    signed_canonical = p_canonical,
    content_hash = hash_hex,
    pending_transfer = null
  where id = p_procedure_id;

  insert into private.audit_events (procedure_id, actor_id, action)
  values (p_procedure_id, uid, 'sign');

  return hash_hex;
end;
$$;

create or replace function public.transfer_responsibility(
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

  update public.procedures
  set
    responsible_id = p_incoming_user_id,
    pending_transfer = null,
    handover = coalesce(p_handover, '{}'::jsonb)
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
      'name', 'Troca de responsabilidade',
      'category', 'Equipe',
      'outgoingUid', outgoing,
      'incomingUid', p_incoming_user_id
    )
  );

  insert into private.audit_events (procedure_id, actor_id, action)
  values (p_procedure_id, uid, 'transfer_responsibility');
end;
$$;

create or replace function public.claim_responsibility(p_procedure_id uuid, p_handover jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_signed_in_confirmed();
  outgoing uuid;
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

  update public.procedures
  set
    responsible_id = uid,
    handover = coalesce(p_handover, '{}'::jsonb)
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

create or replace function public.add_procedure_amendment(
  p_procedure_id uuid,
  p_body text,
  p_reason text,
  p_author_name text,
  p_author_crm text,
  p_author_uf text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_signed_in_confirmed();
  canonical text;
  hash_hex text;
  new_id uuid := gen_random_uuid();
  doc_hash text;
begin
  if private.is_procedure_open(p_procedure_id) then
    raise exception 'amendment_requires_signed' using errcode = '42501';
  end if;
  if not private.is_procedure_participant(p_procedure_id) then
    raise exception 'not_participant' using errcode = '42501';
  end if;
  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'body_required' using errcode = '22023';
  end if;

  select content_hash into doc_hash from public.procedures where id = p_procedure_id;
  canonical := concat_ws(chr(10), new_id::text, p_procedure_id::text, trim(p_body), trim(p_reason), uid::text);
  hash_hex := upper(encode(extensions.digest(convert_to(canonical, 'UTF8'), 'sha256'), 'hex'));

  insert into public.procedure_amendments (
    id, procedure_id, created_by, body, reason, hash, doc_hash_ref,
    author_name, author_crm, author_uf
  ) values (
    new_id, p_procedure_id, uid, trim(p_body), trim(coalesce(p_reason, '')),
    hash_hex, doc_hash,
    coalesce(p_author_name, ''), coalesce(p_author_crm, ''), coalesce(p_author_uf, '')
  );

  insert into private.audit_events (procedure_id, actor_id, action)
  values (p_procedure_id, uid, 'amendment');

  return new_id;
end;
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

-- ---------------------------------------------------------------------------
-- Realtime (onda 3 usará; publicação agora evita drift)
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'procedures',
    'procedure_participants',
    'procedure_vitals',
    'procedure_medications',
    'procedure_fluids',
    'procedure_infusions',
    'procedure_events',
    'procedure_transfers',
    'procedure_amendments'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
      when undefined_object then null;
    end;
  end loop;
end;
$$;

comment on table public.procedures is 'Ficha anestésica. status=signed é imutável (trigger + RLS).';
comment on table public.worklist_entries is 'Pré-cadastro por criador. cpf_hash SHA-256 hex; sem índice global de CPF.';
comment on function public.transfer_responsibility(uuid, uuid, jsonb) is 'incoming_user_id deve ser o colega, nunca o uid de quem transfere.';
