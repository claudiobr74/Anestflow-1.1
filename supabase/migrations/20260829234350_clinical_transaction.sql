-- Save clínico atômico, void auditável e readiness de encerramento no servidor.
-- Não altera jsonb_child_rows (selos SignedAnesthesiaRecordV1 já gravados
-- precisam permanecer byte-idênticos na checagem B).

-- ---------------------------------------------------------------------------
-- Void columns (identidade só o servidor preenche)
-- ---------------------------------------------------------------------------

alter table public.procedure_vitals
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users (id),
  add column if not exists void_reason text;

alter table public.procedure_medications
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users (id),
  add column if not exists void_reason text;

alter table public.procedure_fluids
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users (id),
  add column if not exists void_reason text;

alter table public.procedure_infusions
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users (id),
  add column if not exists void_reason text;

alter table public.procedure_events
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users (id),
  add column if not exists void_reason text;

alter table public.procedure_vitals
  drop constraint if exists procedure_vitals_void_chk;
alter table public.procedure_vitals
  add constraint procedure_vitals_void_chk check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and voided_by is not null and length(trim(void_reason)) >= 3)
  );

alter table public.procedure_medications
  drop constraint if exists procedure_medications_void_chk;
alter table public.procedure_medications
  add constraint procedure_medications_void_chk check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and voided_by is not null and length(trim(void_reason)) >= 3)
  );

alter table public.procedure_fluids
  drop constraint if exists procedure_fluids_void_chk;
alter table public.procedure_fluids
  add constraint procedure_fluids_void_chk check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and voided_by is not null and length(trim(void_reason)) >= 3)
  );

alter table public.procedure_infusions
  drop constraint if exists procedure_infusions_void_chk;
alter table public.procedure_infusions
  add constraint procedure_infusions_void_chk check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and voided_by is not null and length(trim(void_reason)) >= 3)
  );

alter table public.procedure_events
  drop constraint if exists procedure_events_void_chk;
alter table public.procedure_events
  add constraint procedure_events_void_chk check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and voided_by is not null and length(trim(void_reason)) >= 3)
  );

create or replace function private.strip_client_void()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.voided_at := null;
    new.voided_by := null;
    new.void_reason := null;
  end if;
  return new;
end;
$$;

drop trigger if exists procedure_vitals_strip_void on public.procedure_vitals;
create trigger procedure_vitals_strip_void
  before insert on public.procedure_vitals
  for each row execute function private.strip_client_void();

drop trigger if exists procedure_medications_strip_void on public.procedure_medications;
create trigger procedure_medications_strip_void
  before insert on public.procedure_medications
  for each row execute function private.strip_client_void();

drop trigger if exists procedure_fluids_strip_void on public.procedure_fluids;
create trigger procedure_fluids_strip_void
  before insert on public.procedure_fluids
  for each row execute function private.strip_client_void();

drop trigger if exists procedure_infusions_strip_void on public.procedure_infusions;
create trigger procedure_infusions_strip_void
  before insert on public.procedure_infusions
  for each row execute function private.strip_client_void();

drop trigger if exists procedure_events_strip_void on public.procedure_events;
create trigger procedure_events_strip_void
  before insert on public.procedure_events
  for each row execute function private.strip_client_void();

-- ---------------------------------------------------------------------------
-- Hard delete clínico: políticas e grants
-- ---------------------------------------------------------------------------

drop policy if exists procedure_vitals_delete on public.procedure_vitals;
drop policy if exists procedure_medications_delete on public.procedure_medications;
drop policy if exists procedure_fluids_delete on public.procedure_fluids;
drop policy if exists procedure_infusions_delete on public.procedure_infusions;
drop policy if exists procedure_events_delete on public.procedure_events;

revoke delete on table public.procedure_vitals from authenticated;
revoke delete on table public.procedure_medications from authenticated;
revoke delete on table public.procedure_fluids from authenticated;
revoke delete on table public.procedure_infusions from authenticated;
revoke delete on table public.procedure_events from authenticated;

revoke update on table public.procedure_vitals from authenticated;
revoke update on table public.procedure_medications from authenticated;
revoke update on table public.procedure_fluids from authenticated;
revoke update on table public.procedure_infusions from authenticated;
revoke update on table public.procedure_events from authenticated;

grant update (clinical_at, minutes_from_start, payload, updated_at)
  on table public.procedure_vitals to authenticated;
grant update (clinical_at, minutes_from_start, payload, updated_at)
  on table public.procedure_medications to authenticated;
grant update (clinical_at, payload, updated_at)
  on table public.procedure_fluids to authenticated;
grant update (clinical_at, payload, updated_at)
  on table public.procedure_infusions to authenticated;
grant update (clinical_at, payload, updated_at)
  on table public.procedure_events to authenticated;

-- ---------------------------------------------------------------------------
-- Child upsert (mesma transação do save)
-- ---------------------------------------------------------------------------

create or replace function private.child_row_pk(
  p_procedure_id uuid,
  p_kind text,
  p_item jsonb
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_raw text := trim(coalesce(p_item->>'id', ''));
  v_id uuid;
begin
  if jsonb_typeof(p_item) is distinct from 'object' then
    raise exception 'invalid_child_payload' using errcode = '22023';
  end if;
  if v_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return v_raw::uuid;
  end if;
  if v_raw = '' then
    return gen_random_uuid();
  end if;

  if p_kind = 'vitals' then
    select v.id into v_id from public.procedure_vitals v
      where v.procedure_id = p_procedure_id and v.payload->>'id' = v_raw limit 1;
  elsif p_kind = 'medications' then
    select v.id into v_id from public.procedure_medications v
      where v.procedure_id = p_procedure_id and v.payload->>'id' = v_raw limit 1;
  elsif p_kind = 'fluids' then
    select v.id into v_id from public.procedure_fluids v
      where v.procedure_id = p_procedure_id and v.payload->>'id' = v_raw limit 1;
  elsif p_kind = 'infusions' then
    select v.id into v_id from public.procedure_infusions v
      where v.procedure_id = p_procedure_id and v.payload->>'id' = v_raw limit 1;
  elsif p_kind = 'events' then
    select v.id into v_id from public.procedure_events v
      where v.procedure_id = p_procedure_id and v.payload->>'id' = v_raw limit 1;
  else
    raise exception 'invalid_child_payload' using errcode = '22023';
  end if;

  return coalesce(v_id, gen_random_uuid());
end;
$$;

create or replace function private.assert_child_belongs(
  p_procedure_id uuid,
  p_kind text,
  p_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if p_kind = 'vitals' then
    select v.procedure_id into v_owner from public.procedure_vitals v where v.id = p_id;
  elsif p_kind = 'medications' then
    select v.procedure_id into v_owner from public.procedure_medications v where v.id = p_id;
  elsif p_kind = 'fluids' then
    select v.procedure_id into v_owner from public.procedure_fluids v where v.id = p_id;
  elsif p_kind = 'infusions' then
    select v.procedure_id into v_owner from public.procedure_infusions v where v.id = p_id;
  elsif p_kind = 'events' then
    select v.procedure_id into v_owner from public.procedure_events v where v.id = p_id;
  end if;
  if v_owner is not null and v_owner is distinct from p_procedure_id then
    raise exception 'invalid_child_payload' using errcode = '22023';
  end if;
end;
$$;

create or replace function private.upsert_clinical_child_items(
  p_procedure_id uuid,
  p_uid uuid,
  p_kind text,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_id uuid;
  v_at timestamptz;
  v_minutes integer;
  v_payload jsonb;
  v_client_id text;
begin
  if p_items is null then
    return;
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'invalid_child_payload' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_id := private.child_row_pk(p_procedure_id, p_kind, v_item);
    perform private.assert_child_belongs(p_procedure_id, p_kind, v_id);

    v_at := coalesce(
      private.try_timestamptz(v_item->>'timestamp'),
      private.try_timestamptz(v_item->>'time'),
      private.try_timestamptz(v_item->>'startTime'),
      private.try_timestamptz(v_item->>'clinicalTimestamp'),
      clock_timestamp()
    );
    begin
      v_minutes := (v_item->>'minutesFromStart')::integer;
    exception when others then
      v_minutes := null;
    end;

    v_client_id := trim(coalesce(v_item->>'id', v_id::text));
    v_payload := v_item || jsonb_build_object('id', v_client_id);

    if p_kind = 'vitals' then
      insert into public.procedure_vitals (id, procedure_id, created_by, clinical_at, minutes_from_start, payload)
      values (v_id, p_procedure_id, p_uid, v_at, v_minutes, v_payload)
      on conflict (id) do update
        set clinical_at = excluded.clinical_at,
            minutes_from_start = excluded.minutes_from_start,
            payload = excluded.payload
        where public.procedure_vitals.procedure_id = p_procedure_id
          and public.procedure_vitals.voided_at is null;
    elsif p_kind = 'medications' then
      insert into public.procedure_medications (id, procedure_id, created_by, clinical_at, minutes_from_start, payload)
      values (v_id, p_procedure_id, p_uid, v_at, v_minutes, v_payload)
      on conflict (id) do update
        set clinical_at = excluded.clinical_at,
            minutes_from_start = excluded.minutes_from_start,
            payload = excluded.payload
        where public.procedure_medications.procedure_id = p_procedure_id
          and public.procedure_medications.voided_at is null;
    elsif p_kind = 'fluids' then
      insert into public.procedure_fluids (id, procedure_id, created_by, clinical_at, payload)
      values (v_id, p_procedure_id, p_uid, v_at, v_payload)
      on conflict (id) do update
        set clinical_at = excluded.clinical_at,
            payload = excluded.payload
        where public.procedure_fluids.procedure_id = p_procedure_id
          and public.procedure_fluids.voided_at is null;
    elsif p_kind = 'infusions' then
      insert into public.procedure_infusions (id, procedure_id, created_by, clinical_at, payload)
      values (v_id, p_procedure_id, p_uid, v_at, v_payload)
      on conflict (id) do update
        set clinical_at = excluded.clinical_at,
            payload = excluded.payload
        where public.procedure_infusions.procedure_id = p_procedure_id
          and public.procedure_infusions.voided_at is null;
    elsif p_kind = 'events' then
      insert into public.procedure_events (id, procedure_id, created_by, clinical_at, payload)
      values (v_id, p_procedure_id, p_uid, v_at, v_payload)
      on conflict (id) do update
        set clinical_at = excluded.clinical_at,
            payload = excluded.payload
        where public.procedure_events.procedure_id = p_procedure_id
          and public.procedure_events.voided_at is null;
    else
      raise exception 'invalid_child_payload' using errcode = '22023';
    end if;
  end loop;
end;
$$;

create or replace function private.save_procedure_atomic(
  p_procedure_id uuid,
  p_expected_revision integer,
  p_parent jsonb,
  p_children jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  uid uuid := private.assert_signed_in_confirmed();
  v_row public.procedures;
  v_status text;
  v_revision integer;
  v_updated timestamptz;
begin
  if p_procedure_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_parent is null or jsonb_typeof(p_parent) is distinct from 'object' then
    raise exception 'invalid_child_payload' using errcode = '22023';
  end if;

  v_status := coalesce(p_parent->>'status', 'draft');
  if v_status not in ('draft', 'in_progress') then
    v_status := 'in_progress';
  end if;

  select * into v_row
  from public.procedures
  where id = p_procedure_id
  for update;

  if not found then
    insert into public.procedures (
      id, created_by, responsible_id, status, schema_version,
      patient, team, pre_evaluation, technique, airway, checklist,
      recovery, handover, timers, monitor_config, equipment_config,
      vascular_accesses, incidents, outputs, inhalation_agents,
      narratives, voice_transcripts
    ) values (
      p_procedure_id,
      uid,
      uid,
      v_status,
      coalesce(p_parent->>'schema_version', '2.0.0'),
      coalesce(p_parent->'patient', '{}'::jsonb),
      coalesce(p_parent->'team', '{}'::jsonb),
      coalesce(p_parent->'pre_evaluation', '{}'::jsonb),
      coalesce(p_parent->'technique', '{}'::jsonb),
      coalesce(p_parent->'airway', '{}'::jsonb),
      coalesce(p_parent->'checklist', '{}'::jsonb),
      coalesce(p_parent->'recovery', '{}'::jsonb),
      coalesce(p_parent->'handover', '{}'::jsonb),
      coalesce(p_parent->'timers', '{}'::jsonb),
      coalesce(p_parent->'monitor_config', '{}'::jsonb),
      coalesce(p_parent->'equipment_config', '{}'::jsonb),
      coalesce(p_parent->'vascular_accesses', '[]'::jsonb),
      coalesce(p_parent->'incidents', '[]'::jsonb),
      coalesce(p_parent->'outputs', '[]'::jsonb),
      coalesce(p_parent->'inhalation_agents', '[]'::jsonb),
      coalesce(p_parent->'narratives', '[]'::jsonb),
      coalesce(p_parent->'voice_transcripts', '[]'::jsonb)
    )
    returning revision, updated_at into v_revision, v_updated;
  else
    if v_row.status = 'signed' then
      raise exception 'signed_procedure_immutable' using errcode = '42501';
    end if;
    if v_row.responsible_id is distinct from uid then
      raise exception 'not_responsible' using errcode = '42501';
    end if;
    if coalesce(v_row.revision, 1) is distinct from coalesce(p_expected_revision, 1) then
      raise exception 'stale_revision' using errcode = 'P0001';
    end if;

    update public.procedures
    set
      status = v_status,
      schema_version = coalesce(p_parent->>'schema_version', schema_version),
      patient = coalesce(p_parent->'patient', patient),
      team = coalesce(p_parent->'team', team),
      pre_evaluation = coalesce(p_parent->'pre_evaluation', pre_evaluation),
      technique = coalesce(p_parent->'technique', technique),
      airway = coalesce(p_parent->'airway', airway),
      checklist = coalesce(p_parent->'checklist', checklist),
      recovery = coalesce(p_parent->'recovery', recovery),
      handover = coalesce(p_parent->'handover', handover),
      timers = coalesce(p_parent->'timers', timers),
      monitor_config = coalesce(p_parent->'monitor_config', monitor_config),
      equipment_config = coalesce(p_parent->'equipment_config', equipment_config),
      vascular_accesses = coalesce(p_parent->'vascular_accesses', vascular_accesses),
      incidents = coalesce(p_parent->'incidents', incidents),
      outputs = coalesce(p_parent->'outputs', outputs),
      inhalation_agents = coalesce(p_parent->'inhalation_agents', inhalation_agents),
      narratives = coalesce(p_parent->'narratives', narratives),
      voice_transcripts = coalesce(p_parent->'voice_transcripts', voice_transcripts)
    where id = p_procedure_id
    returning revision, updated_at into v_revision, v_updated;
  end if;

  perform private.upsert_clinical_child_items(p_procedure_id, uid, 'vitals', p_children->'vitals');
  perform private.upsert_clinical_child_items(p_procedure_id, uid, 'medications', p_children->'medications');
  perform private.upsert_clinical_child_items(p_procedure_id, uid, 'fluids', p_children->'fluids');
  perform private.upsert_clinical_child_items(p_procedure_id, uid, 'infusions', p_children->'infusions');
  perform private.upsert_clinical_child_items(p_procedure_id, uid, 'events', p_children->'events');

  insert into private.audit_events (procedure_id, actor_id, action)
  values (p_procedure_id, uid, 'save_atomic');

  return jsonb_build_object(
    'id', p_procedure_id,
    'revision', v_revision,
    'updated_at', v_updated
  );
end;
$$;

create or replace function public.save_procedure_atomic(
  p_procedure_id uuid,
  p_expected_revision integer,
  p_parent jsonb,
  p_children jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.save_procedure_atomic(p_procedure_id, p_expected_revision, p_parent, p_children);
$$;

-- ---------------------------------------------------------------------------
-- Void auditável (voided_by = auth.uid() no servidor)
-- ---------------------------------------------------------------------------

create or replace function private.void_clinical_item(
  p_kind text,
  p_item_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  uid uuid := private.assert_signed_in_confirmed();
  v_procedure uuid;
  v_reason text := trim(coalesce(p_reason, ''));
  v_now timestamptz := clock_timestamp();
  v_revision integer;
  v_already timestamptz;
  v_payload jsonb;
begin
  if p_kind not in ('vitals', 'medications', 'fluids', 'infusions', 'events') then
    raise exception 'invalid_child_payload' using errcode = '22023';
  end if;
  if length(v_reason) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  if p_kind = 'vitals' then
    select v.procedure_id, v.voided_at, v.payload into v_procedure, v_already, v_payload
    from public.procedure_vitals v where v.id = p_item_id;
  elsif p_kind = 'medications' then
    select v.procedure_id, v.voided_at, v.payload into v_procedure, v_already, v_payload
    from public.procedure_medications v where v.id = p_item_id;
  elsif p_kind = 'fluids' then
    select v.procedure_id, v.voided_at, v.payload into v_procedure, v_already, v_payload
    from public.procedure_fluids v where v.id = p_item_id;
  elsif p_kind = 'infusions' then
    select v.procedure_id, v.voided_at, v.payload into v_procedure, v_already, v_payload
    from public.procedure_infusions v where v.id = p_item_id;
  else
    select v.procedure_id, v.voided_at, v.payload into v_procedure, v_already, v_payload
    from public.procedure_events v where v.id = p_item_id;
  end if;

  if v_procedure is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not private.is_procedure_responsible(v_procedure) then
    raise exception 'not_responsible' using errcode = '42501';
  end if;
  if not private.is_procedure_open(v_procedure) then
    raise exception 'signed_procedure_immutable' using errcode = '42501';
  end if;

  v_payload := coalesce(v_payload, '{}'::jsonb) || jsonb_build_object(
    'voidedAt', v_now,
    'voidedBy', uid::text,
    'voidReason', v_reason
  );

  if v_already is not null then
    select revision into v_revision from public.procedures where id = v_procedure;
    return jsonb_build_object(
      'id', p_item_id,
      'procedure_id', v_procedure,
      'revision', v_revision,
      'already_voided', true
    );
  end if;

  if p_kind = 'vitals' then
    update public.procedure_vitals
      set voided_at = v_now, voided_by = uid, void_reason = v_reason, payload = v_payload
      where id = p_item_id;
  elsif p_kind = 'medications' then
    update public.procedure_medications
      set voided_at = v_now, voided_by = uid, void_reason = v_reason, payload = v_payload
      where id = p_item_id;
  elsif p_kind = 'fluids' then
    update public.procedure_fluids
      set voided_at = v_now, voided_by = uid, void_reason = v_reason, payload = v_payload
      where id = p_item_id;
  elsif p_kind = 'infusions' then
    update public.procedure_infusions
      set voided_at = v_now, voided_by = uid, void_reason = v_reason, payload = v_payload
      where id = p_item_id;
  else
    update public.procedure_events
      set voided_at = v_now, voided_by = uid, void_reason = v_reason, payload = v_payload
      where id = p_item_id;
  end if;

  update public.procedures
    set schema_version = schema_version
    where id = v_procedure
    returning revision into v_revision;

  insert into private.audit_events (procedure_id, actor_id, action)
  values (v_procedure, uid, 'void_clinical');

  return jsonb_build_object(
    'id', p_item_id,
    'procedure_id', v_procedure,
    'revision', v_revision,
    'already_voided', false
  );
end;
$$;

create or replace function public.void_clinical_item(
  p_kind text,
  p_item_id uuid,
  p_reason text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.void_clinical_item(p_kind, p_item_id, p_reason);
$$;

-- ---------------------------------------------------------------------------
-- Signing readiness: término coerente + transferência pendente
-- ---------------------------------------------------------------------------

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
  v_end timestamptz;
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

  v_end := private.try_timestamptz(r.timers->>'endAnesthesia');
  if v_end is null then
    raise exception 'signing_not_ready' using errcode = '22023';
  end if;
  if v_end < v_start then
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

  if r.pending_transfer is not null then
    raise exception 'pending_transfer_blocks_sign' using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function private.strip_client_void() from public, anon, authenticated;
revoke all on function private.child_row_pk(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function private.assert_child_belongs(uuid, text, uuid) from public, anon, authenticated;
revoke all on function private.upsert_clinical_child_items(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function private.save_procedure_atomic(uuid, integer, jsonb, jsonb) from public, anon;
revoke all on function public.save_procedure_atomic(uuid, integer, jsonb, jsonb) from public, anon;
revoke all on function private.void_clinical_item(text, uuid, text) from public, anon;
revoke all on function public.void_clinical_item(text, uuid, text) from public, anon;
revoke all on function private.assert_signing_readiness(uuid) from public, anon, authenticated;

grant execute on function public.save_procedure_atomic(uuid, integer, jsonb, jsonb) to authenticated;
grant execute on function private.save_procedure_atomic(uuid, integer, jsonb, jsonb) to authenticated;
grant execute on function public.void_clinical_item(text, uuid, text) to authenticated;
grant execute on function private.void_clinical_item(text, uuid, text) to authenticated;

comment on function public.save_procedure_atomic(uuid, integer, jsonb, jsonb) is
  'Grava pai + filhos clínicos numa transação. CAS em revision. Browser não escolhe a revision nova.';
comment on function public.void_clinical_item(text, uuid, text) is
  'Cancela lançamento clínico sem hard delete. voided_by = auth.uid(). Ficha signed recusa.';
