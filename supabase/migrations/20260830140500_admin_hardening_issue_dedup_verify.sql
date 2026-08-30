-- Dedup real de issues, verify explícito, organization_id no insert clínico.
-- Listagem Admin NÃO incrementa occurrences (usa verify_core).

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
    occurrences = coalesce(occurrences, 1) + 1,
    last_seen_at = now(),
    updated_at = now(),
    title = p_title,
    description = p_description,
    technical_context = p_technical_context,
    error_code = coalesce(p_error_code, error_code),
    status = case when status in ('resolved', 'ignored') then 'open' else status end
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

create or replace function public.admin_list_procedures_page(
  p_page integer default 1,
  p_page_size integer default 10,
  p_search text default null,
  p_status text default null,
  p_organization_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_admin_reader();
  scope uuid[] := private.admin_visible_org_ids();
  page integer := greatest(coalesce(p_page, 1), 1);
  page_size integer := least(greatest(coalesce(p_page_size, 10), 1), 50);
  total integer;
begin
  perform uid;
  if p_organization_id is not null and not private.admin_can_access_org(p_organization_id) then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;

  select count(*)::int into total
  from public.procedures p
  left join public.profiles pr on pr.id = p.responsible_id
  left join public.organizations o on o.id = p.organization_id
  where (scope is null or p.organization_id = any (scope))
    and (p_organization_id is null or p.organization_id = p_organization_id)
    and (p_status is null or p_status = 'all' or p.status = p_status)
    and (
      p_search is null or length(trim(p_search)) = 0
      or p.id::text ilike '%' || trim(p_search) || '%'
      or coalesce(pr.full_name, '') ilike '%' || trim(p_search) || '%'
      or coalesce(o.name, p.patient->>'hospital', '') ilike '%' || trim(p_search) || '%'
    );

  return jsonb_build_object(
    'total_count', total,
    'page', page,
    'page_size', page_size,
    'items', coalesce((
      select jsonb_agg(item)
      from (
        select jsonb_build_object(
          'id', p.id,
          'status', p.status,
          'revision', p.revision,
          'created_at', p.created_at,
          'updated_at', p.updated_at,
          'signed_at', p.signed_at,
          'has_hash', (p.content_hash is not null and p.status = 'signed'),
          'organization_id', p.organization_id,
          'responsible_name', pr.full_name,
          'responsible_crm', pr.crm,
          'responsible_uf', pr.uf,
          'hospital', coalesce(o.name, nullif(p.patient->>'hospital', '')),
          'duration_anes_min', round((extract(epoch from (
            private.admin_try_tstz(p.timers->>'endAnesthesia')
            - private.admin_try_tstz(p.timers->>'startAnesthesia')
          )) / 60.0)::numeric, 0),
          'used_voice', (jsonb_typeof(p.voice_transcripts) = 'array' and jsonb_array_length(p.voice_transcripts) > 0),
          'has_incident', (jsonb_typeof(p.incidents) = 'array' and jsonb_array_length(p.incidents) > 0),
          'integrity', private.verify_procedure_integrity_core(p.id)
        ) as item
        from public.procedures p
        left join public.profiles pr on pr.id = p.responsible_id
        left join public.organizations o on o.id = p.organization_id
        where (scope is null or p.organization_id = any (scope))
          and (p_organization_id is null or p.organization_id = p_organization_id)
          and (p_status is null or p_status = 'all' or p.status = p_status)
          and (
            p_search is null or length(trim(p_search)) = 0
            or p.id::text ilike '%' || trim(p_search) || '%'
            or coalesce(pr.full_name, '') ilike '%' || trim(p_search) || '%'
            or coalesce(o.name, p.patient->>'hospital', '') ilike '%' || trim(p_search) || '%'
          )
        order by p.created_at desc
        offset (page - 1) * page_size
        limit page_size
      ) q
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_verify_procedure(p_procedure_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_admin_reader();
  v_org uuid;
begin
  perform uid;
  select organization_id into v_org from public.procedures where id = p_procedure_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not private.admin_procedure_in_scope(v_org) then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  return private.admin_integrity_status(p_procedure_id);
end;
$$;

create or replace function public.resolve_my_organization_id(p_hospital text default null)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select private.resolve_procedure_organization_id(auth.uid(), p_hospital);
$$;

revoke all on function public.admin_verify_procedure(uuid) from public, anon;
revoke all on function public.resolve_my_organization_id(text) from public, anon;
grant execute on function public.admin_verify_procedure(uuid) to authenticated;
grant execute on function public.resolve_my_organization_id(text) to authenticated;
grant execute on function public.admin_list_procedures_page(integer, integer, text, text, uuid) to authenticated;
