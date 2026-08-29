-- Fase 4B: o servidor é a autoridade do JSON selado (SignedAnesthesiaRecordV1).
-- O cliente envia só p_procedure_id. Canonical, hash e identidade vêm de
-- procedures + filhos + profiles. SHA-256 é selo de integridade, não
-- assinatura digital do médico.

create or replace function private.try_timestamptz(p_value text)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_value is null or length(trim(p_value)) = 0 then
    return null;
  end if;
  return trim(p_value)::timestamptz;
exception
  when others then
    return null;
end;
$$;

create or replace function private.jsonb_child_rows(p_procedure_id uuid, p_source text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  result jsonb;
begin
  if p_source = 'vitals' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.clinical_at, x.id), '[]'::jsonb)
    into result
    from (
      select v.id, v.clinical_at, v.minutes_from_start, v.payload
      from public.procedure_vitals v
      where v.procedure_id = p_procedure_id
    ) x;
  elsif p_source = 'medications' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.clinical_at, x.id), '[]'::jsonb)
    into result
    from (
      select v.id, v.clinical_at, v.minutes_from_start, v.payload
      from public.procedure_medications v
      where v.procedure_id = p_procedure_id
    ) x;
  elsif p_source = 'fluids' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.clinical_at, x.id), '[]'::jsonb)
    into result
    from (
      select v.id, v.clinical_at, v.payload
      from public.procedure_fluids v
      where v.procedure_id = p_procedure_id
    ) x;
  elsif p_source = 'infusions' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.clinical_at, x.id), '[]'::jsonb)
    into result
    from (
      select v.id, v.clinical_at, v.payload
      from public.procedure_infusions v
      where v.procedure_id = p_procedure_id
    ) x;
  elsif p_source = 'events' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.clinical_at, x.id), '[]'::jsonb)
    into result
    from (
      select v.id, v.clinical_at, v.payload
      from public.procedure_events v
      where v.procedure_id = p_procedure_id
    ) x;
  elsif p_source = 'transfers' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.clinical_at, x.id), '[]'::jsonb)
    into result
    from (
      select v.id, v.clinical_at, v.outgoing_user_id, v.incoming_user_id, v.payload
      from public.procedure_transfers v
      where v.procedure_id = p_procedure_id
    ) x;
  else
    result := '[]'::jsonb;
  end if;
  return coalesce(result, '[]'::jsonb);
end;
$$;

create or replace function private.build_signed_record_v1(
  p_procedure_id uuid,
  p_signed_at timestamptz,
  p_signer jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  r public.procedures;
  v_revision integer;
begin
  select * into r
  from public.procedures
  where id = p_procedure_id;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- Na primeira selagem o UPDATE incrementa revision; na verificação a linha
  -- já está signed e o valor atual é o selado.
  if r.status = 'signed' then
    v_revision := coalesce(r.revision, 1);
  else
    v_revision := coalesce(r.revision, 1) + 1;
  end if;

  return jsonb_build_object(
    'schema', 'SignedAnesthesiaRecordV1',
    'schemaVersion', 1,
    'integrityAlgo', 'SHA-256',
    'procedureId', r.id,
    'status', 'signed',
    'revision', v_revision,
    'documentSchemaVersion', coalesce(r.schema_version, '2.0.0'),
    'createdBy', r.created_by,
    'responsibleId', r.responsible_id,
    'createdAt', r.created_at,
    'updatedAt', p_signed_at,
    'signedAt', p_signed_at,
    'signedBy', coalesce(p_signer, '{}'::jsonb),
    'patient', coalesce(r.patient, '{}'::jsonb),
    'procedure', jsonb_build_object(
      'scheduled', coalesce(r.patient->>'scheduledProcedure', ''),
      'actual', coalesce(r.patient->>'actualProcedure', ''),
      'diagnosis', coalesce(r.patient->>'diagnosis', '')
    ),
    'team', coalesce(r.team, '{}'::jsonb),
    'preEvaluation', coalesce(r.pre_evaluation, '{}'::jsonb),
    'technique', coalesce(r.technique, '{}'::jsonb),
    'airway', coalesce(r.airway, '{}'::jsonb),
    'monitorConfig', coalesce(r.monitor_config, '{}'::jsonb),
    'equipmentConfig', coalesce(r.equipment_config, '{}'::jsonb),
    'vascularAccesses', coalesce(r.vascular_accesses, '[]'::jsonb),
    'vitals', private.jsonb_child_rows(p_procedure_id, 'vitals'),
    'bolusDrugs', private.jsonb_child_rows(p_procedure_id, 'medications'),
    'continuousInfusions', private.jsonb_child_rows(p_procedure_id, 'infusions'),
    'inhalationAgents', coalesce(r.inhalation_agents, '[]'::jsonb),
    'fluids', private.jsonb_child_rows(p_procedure_id, 'fluids'),
    'outputs', coalesce(r.outputs, '[]'::jsonb),
    'events', private.jsonb_child_rows(p_procedure_id, 'events'),
    'incidents', coalesce(r.incidents, '[]'::jsonb),
    'timers', coalesce(r.timers, '{}'::jsonb),
    'transfers', private.jsonb_child_rows(p_procedure_id, 'transfers'),
    'checklist', coalesce(r.checklist, '{}'::jsonb),
    'recovery', coalesce(r.recovery, '{}'::jsonb),
    'handover', coalesce(r.handover, '{}'::jsonb),
    'narrativeLaunches', coalesce(r.narratives, '[]'::jsonb)
  );
end;
$$;

create or replace function private.assert_signing_readiness(p_procedure_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.procedures;
  v_start timestamptz;
  v_surg_start timestamptz;
  v_surg_end timestamptz;
  v_name text;
begin
  select * into r
  from public.procedures
  where id = p_procedure_id;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  v_start := private.try_timestamptz(r.timers->>'startAnesthesia');
  if v_start is null then
    raise exception 'signing_not_ready' using errcode = '22023';
  end if;

  v_surg_start := private.try_timestamptz(r.timers->>'startSurgery');
  v_surg_end := private.try_timestamptz(r.timers->>'endSurgery');

  if v_surg_start is not null and v_surg_start < v_start then
    raise exception 'signing_not_ready' using errcode = '22023';
  end if;
  if v_surg_start is not null and v_surg_end is not null and v_surg_end < v_surg_start then
    raise exception 'signing_not_ready' using errcode = '22023';
  end if;

  v_name := trim(coalesce(r.patient->>'fullName', ''));
  if length(v_name) < 5 then
    raise exception 'signing_not_ready' using errcode = '22023';
  end if;

  if r.responsible_id is null then
    raise exception 'signing_not_ready' using errcode = '22023';
  end if;

  if length(trim(coalesce(r.team->>'anesthesiologistLead', ''))) = 0
     or length(trim(coalesce(r.team->>'crmLead', ''))) = 0 then
    raise exception 'signing_not_ready' using errcode = '22023';
  end if;
end;
$$;

drop function if exists public.sign_procedure(uuid, text, jsonb);
drop function if exists private.sign_procedure(uuid, text, jsonb);

create or replace function private.sign_procedure(p_procedure_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  uid uuid := private.assert_signed_in_confirmed();
  v_row public.procedures;
  v_signer jsonb;
  v_now timestamptz := clock_timestamp();
  v_record jsonb;
  v_canonical text;
  v_hash text;
begin
  select * into v_row
  from public.procedures
  where id = p_procedure_id
  for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_row.status = 'signed' then
    raise exception 'already_signed' using errcode = '42501';
  end if;
  if v_row.responsible_id is distinct from uid then
    raise exception 'not_responsible' using errcode = '42501';
  end if;

  perform private.assert_signing_readiness(p_procedure_id);

  select jsonb_build_object(
    'uid', pr.id,
    'name', coalesce(pr.full_name, ''),
    'crm', coalesce(pr.crm, ''),
    'uf', coalesce(pr.uf, ''),
    'email', coalesce(pr.email, '')
  )
  into v_signer
  from public.profiles pr
  where pr.id = uid;

  if v_signer is null then
    raise exception 'profile_required' using errcode = 'P0002';
  end if;

  v_record := private.build_signed_record_v1(p_procedure_id, v_now, v_signer);
  v_canonical := v_record::text;
  v_hash := upper(encode(extensions.digest(convert_to(v_canonical, 'UTF8'), 'sha256'), 'hex'));

  update public.procedures
  set
    status = 'signed',
    signed_at = v_now,
    signed_by = v_signer,
    signed_canonical = v_canonical,
    content_hash = v_hash,
    pending_transfer = null
  where id = p_procedure_id;

  insert into private.audit_events (procedure_id, actor_id, action)
  values (p_procedure_id, uid, 'sign');

  return v_hash;
end;
$$;

create or replace function public.sign_procedure(p_procedure_id uuid)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.sign_procedure(p_procedure_id);
$$;

create or replace function private.verify_procedure_integrity(p_procedure_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_row public.procedures;
  v_snapshot_hash text;
  v_snapshot_ok boolean := false;
  v_persisted_ok boolean := false;
  v_legacy boolean := true;
  v_schema text := null;
  v_json jsonb;
  v_rebuilt jsonb;
begin
  perform private.assert_signed_in_confirmed();
  if not private.is_procedure_participant(p_procedure_id) then
    raise exception 'not_participant' using errcode = '42501';
  end if;

  select * into v_row
  from public.procedures
  where id = p_procedure_id;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_row.status is distinct from 'signed'
     or v_row.signed_canonical is null
     or v_row.content_hash is null then
    raise exception 'not_signed' using errcode = '22023';
  end if;

  v_snapshot_hash := upper(encode(
    extensions.digest(convert_to(v_row.signed_canonical, 'UTF8'), 'sha256'),
    'hex'
  ));
  v_snapshot_ok := (v_snapshot_hash = upper(v_row.content_hash));

  begin
    v_json := v_row.signed_canonical::jsonb;
    v_schema := v_json->>'schema';
  exception
    when others then
      v_json := null;
      v_schema := null;
  end;

  if v_schema = 'SignedAnesthesiaRecordV1' then
    v_legacy := false;
    v_rebuilt := private.build_signed_record_v1(p_procedure_id, v_row.signed_at, v_row.signed_by);
    v_persisted_ok := (v_rebuilt::text = v_row.signed_canonical);
  else
    v_legacy := true;
    v_persisted_ok := false;
  end if;

  return jsonb_build_object(
    'snapshot_ok', v_snapshot_ok,
    'persisted_ok', v_persisted_ok,
    'stored_hash', v_row.content_hash,
    'snapshot_hash', v_snapshot_hash,
    'schema', v_schema,
    'legacy', v_legacy
  );
end;
$$;

create or replace function public.verify_procedure_integrity(p_procedure_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.verify_procedure_integrity(p_procedure_id);
$$;

create or replace function private.add_procedure_amendment(
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
  signed_ts timestamptz;
  v_name text;
  v_crm text;
  v_uf text;
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

  -- Identidade oficial do perfil. p_author_* do cliente não é fonte.
  select
    coalesce(pr.full_name, ''),
    coalesce(pr.crm, ''),
    coalesce(pr.uf, '')
  into v_name, v_crm, v_uf
  from public.profiles pr
  where pr.id = uid;

  if not found then
    raise exception 'profile_required' using errcode = 'P0002';
  end if;

  select content_hash, signed_at
  into doc_hash, signed_ts
  from public.procedures
  where id = p_procedure_id;

  canonical := concat_ws(
    chr(10),
    'amendment',
    new_id::text,
    p_procedure_id::text,
    trim(p_body),
    trim(coalesce(p_reason, '')),
    uid::text,
    coalesce(doc_hash, ''),
    coalesce(signed_ts::text, ''),
    v_name,
    v_crm,
    v_uf
  );
  hash_hex := upper(encode(extensions.digest(convert_to(canonical, 'UTF8'), 'sha256'), 'hex'));

  insert into public.procedure_amendments (
    id, procedure_id, created_by, body, reason, hash, doc_hash_ref,
    author_name, author_crm, author_uf
  ) values (
    new_id, p_procedure_id, uid, trim(p_body), trim(coalesce(p_reason, '')),
    hash_hex, doc_hash,
    v_name, v_crm, v_uf
  );

  insert into private.audit_events (procedure_id, actor_id, action)
  values (p_procedure_id, uid, 'amendment');

  return new_id;
end;
$$;

revoke all on function private.try_timestamptz(text) from public, anon, authenticated;
revoke all on function private.jsonb_child_rows(uuid, text) from public, anon, authenticated;
revoke all on function private.build_signed_record_v1(uuid, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function private.assert_signing_readiness(uuid) from public, anon, authenticated;
revoke all on function private.sign_procedure(uuid) from public, anon;
revoke all on function public.sign_procedure(uuid) from public, anon;
revoke all on function private.verify_procedure_integrity(uuid) from public, anon;
revoke all on function public.verify_procedure_integrity(uuid) from public, anon;

grant execute on function private.sign_procedure(uuid) to authenticated;
grant execute on function public.sign_procedure(uuid) to authenticated;
grant execute on function private.verify_procedure_integrity(uuid) to authenticated;
grant execute on function public.verify_procedure_integrity(uuid) to authenticated;

comment on function public.sign_procedure(uuid) is
  'Sela SignedAnesthesiaRecordV1 no servidor. Cliente envia só p_procedure_id. SHA-256 é selo de integridade, não assinatura digital do médico.';
comment on function public.verify_procedure_integrity(uuid) is
  'Checagem A: hash(snapshot)=stored_hash. Checagem B: canonical(dados atuais)=signed_snapshot. Íntegro só se A e B passam.';
