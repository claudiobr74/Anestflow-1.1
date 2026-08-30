-- Integrity real (mesmo algoritmo A+B) + pipeline de issues.

create or replace function private.verify_procedure_integrity_core(p_procedure_id uuid)
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
  select * into v_row
  from public.procedures
  where id = p_procedure_id;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_row.status is distinct from 'signed'
     or v_row.signed_canonical is null
     or v_row.content_hash is null then
    return jsonb_build_object(
      'snapshot_ok', false,
      'persisted_ok', null,
      'stored_hash', v_row.content_hash,
      'snapshot_hash', null,
      'schema', null,
      'legacy', false,
      'integrity_status', 'not_verified'
    );
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
    'legacy', v_legacy,
    'integrity_status', case
      when v_legacy then 'legacy'
      when v_snapshot_ok and v_persisted_ok then 'intact'
      when v_snapshot_ok and not v_persisted_ok then 'persisted_mismatch'
      when (not v_snapshot_ok) and v_persisted_ok then 'snapshot_mismatch'
      else 'both_mismatch'
    end
  );
end;
$$;

create or replace function private.verify_procedure_integrity(p_procedure_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
begin
  perform private.assert_signed_in_confirmed();
  if not private.is_procedure_participant(p_procedure_id) then
    raise exception 'not_participant' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.procedures p
    where p.id = p_procedure_id
      and p.status = 'signed'
      and p.signed_canonical is not null
      and p.content_hash is not null
  ) then
    raise exception 'not_signed' using errcode = '22023';
  end if;
  return private.verify_procedure_integrity_core(p_procedure_id);
end;
$$;

create or replace function private.admin_upsert_issue(
  p_type text,
  p_title text,
  p_severity text,
  p_error_code text,
  p_description text,
  p_technical_context text,
  p_organization_id uuid,
  p_procedure_id uuid,
  p_stable_key boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_id uuid;
begin
  if p_stable_key then
    v_key := concat_ws('|', p_type, coalesce(p_procedure_id::text, ''), coalesce(p_error_code, ''));
  else
    v_key := concat_ws(
      '|',
      p_type,
      coalesce(p_organization_id::text, ''),
      coalesce(p_procedure_id::text, ''),
      coalesce(p_error_code, ''),
      to_char(date_trunc('hour', now()), 'YYYY-MM-DD"T"HH24')
    );
  end if;

  update public.admin_issues
  set
    occurrences = occurrences + case when last_seen_at < now() - interval '2 minutes' then 1 else 0 end,
    last_seen_at = now(),
    updated_at = now(),
    title = p_title,
    description = p_description,
    technical_context = p_technical_context,
    error_code = coalesce(p_error_code, error_code)
  where dedup_key = v_key
    and status in ('open', 'investigating')
  returning id into v_id;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.admin_issues (
    title, incident_type, description, technical_context, error_code,
    severity, status, organization_id, procedure_id, dedup_key, occurrences, last_seen_at
  ) values (
    p_title, p_type, coalesce(p_description, ''), coalesce(p_technical_context, ''),
    coalesce(p_error_code, ''), p_severity, 'open', p_organization_id, p_procedure_id,
    v_key, 1, now()
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.admin_integrity_status(p_procedure_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report jsonb;
  v_status text;
  v_org uuid;
begin
  v_report := private.verify_procedure_integrity_core(p_procedure_id);
  v_status := v_report->>'integrity_status';
  select organization_id into v_org from public.procedures where id = p_procedure_id;

  if v_status in ('snapshot_mismatch', 'persisted_mismatch', 'both_mismatch') then
    perform private.admin_upsert_issue(
      'INTEGRITY_MISMATCH',
      'Inconsistência de integridade',
      'critical',
      v_status,
      'Verificação real A+B falhou (snapshotOk/persistedOk).',
      concat('procedure=', p_procedure_id::text, ' status=', v_status),
      v_org,
      p_procedure_id,
      true
    );
  end if;

  return v_report;
end;
$$;

create or replace function public.record_ai_usage(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_signed_in_confirmed();
  v_id uuid;
  v_cost numeric;
  v_rates public.admin_ai_cost_rates%rowtype;
  v_org uuid;
  v_status text := coalesce(nullif(p_payload->>'status', ''), 'success');
  v_feature text := coalesce(p_payload->>'feature', '');
  v_err text := nullif(p_payload->>'error_code', '');
begin
  if v_feature not in ('voice_asr', 'voice_parser', 'clinical_review', 'narrative') then
    raise exception 'invalid_feature' using errcode = '22023';
  end if;

  select * into v_rates from public.admin_ai_cost_rates where id = 'default';
  v_cost :=
    coalesce((p_payload->>'input_tokens')::numeric, 0) * coalesce(v_rates.input_token_rate, 0)
    + coalesce((p_payload->>'output_tokens')::numeric, 0) * coalesce(v_rates.output_token_rate, 0)
    + coalesce((p_payload->>'audio_seconds')::numeric, 0) * coalesce(v_rates.audio_second_rate, 0);
  if v_cost = 0 then
    v_cost := null;
  end if;

  v_org := private.resolve_procedure_organization_id(uid, null);
  if (p_payload->>'procedure_id') is not null then
    select organization_id into v_org
    from public.procedures
    where id = (p_payload->>'procedure_id')::uuid;
  end if;

  insert into public.ai_usage (
    organization_id, user_id, procedure_id, feature, provider, model,
    prompt_version, schema_version, latency_ms, status, error_code,
    input_tokens, output_tokens, audio_seconds, estimated_cost
  ) values (
    v_org,
    uid,
    nullif(p_payload->>'procedure_id', '')::uuid,
    v_feature,
    coalesce(nullif(p_payload->>'provider', ''), 'google-gemini'),
    coalesce(nullif(p_payload->>'model', ''), 'unknown'),
    nullif(p_payload->>'prompt_version', ''),
    nullif(p_payload->>'schema_version', ''),
    nullif(p_payload->>'latency_ms', '')::integer,
    v_status,
    v_err,
    nullif(p_payload->>'input_tokens', '')::integer,
    nullif(p_payload->>'output_tokens', '')::integer,
    nullif(p_payload->>'audio_seconds', '')::numeric,
    v_cost
  )
  returning id into v_id;

  if v_status is distinct from 'success' then
    perform private.admin_upsert_issue(
      case v_feature
        when 'voice_asr' then 'VOICE_TRANSCRIPTION_FAILED'
        when 'voice_parser' then 'VOICE_PARSE_FAILED'
        when 'clinical_review' then 'AI_REVIEW_FAILED'
        else 'AI_REVIEW_FAILED'
      end,
      'Falha de IA',
      'high',
      coalesce(v_err, v_status),
      'Chamada de IA falhou.',
      concat('feature=', v_feature, ' status=', v_status),
      v_org,
      nullif(p_payload->>'procedure_id', '')::uuid,
      false
    );
  end if;
  return v_id;
end;
$$;

revoke all on function public.record_ai_usage(jsonb) from public, anon;
grant execute on function public.record_ai_usage(jsonb) to authenticated;
