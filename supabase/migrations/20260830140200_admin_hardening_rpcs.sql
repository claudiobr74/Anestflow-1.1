-- RPCs de hardening: tenancy, gestão, telemetria real, settings, paginação, financeiro.

create or replace function private.admin_visible_org_ids()
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.is_platform_admin() then
    return null;
  end if;
  return private.clinic_admin_org_ids();
end;
$$;

create or replace function private.admin_procedure_in_scope(p_org uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ids uuid[] := private.admin_visible_org_ids();
begin
  if ids is null then
    return true;
  end if;
  return p_org is not null and p_org = any (ids);
end;
$$;

-- Dashboard
create or replace function private.admin_dashboard_overview(p_range text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_admin_reader();
  started timestamptz := private.admin_range_start(p_range);
  today_start timestamptz := date_trunc('day', now());
  scope uuid[] := private.admin_visible_org_ids();
  result jsonb;
begin
  perform uid;
  select jsonb_build_object(
    'range', coalesce(p_range, '30d'),
    'updated_at', now(),
    'metric_definitions', jsonb_build_object(
      'users_registered', 'Contagem de profiles cadastrados no escopo.',
      'users_active', 'Usuários com last_sign_in_at no período.',
      'users_active_today', 'Responsáveis com ficha atualizada hoje.',
      'signature_rate_pct', 'signed / total de procedimentos criados no período.',
      'in_progress', 'Snapshot atual (não filtrado pelo período).'
    ),
    'metrics', jsonb_build_object(
      'users_registered', (select count(*) from public.profiles pr
        where scope is null or exists (
          select 1 from public.organization_members m
          where m.user_id = pr.id and m.organization_id = any (scope)
        )),
      'users_active', (
        select count(*) from auth.users u
        where u.last_sign_in_at >= started
          and (scope is null or exists (
            select 1 from public.organization_members m
            where m.user_id = u.id and m.organization_id = any (scope)
          ))
      ),
      'organizations_active', (
        select count(*) from public.organizations o
        where o.status = 'active'
          and (scope is null or o.id = any (scope))
      ),
      'organizations', (
        select count(*) from public.organizations o
        where scope is null or o.id = any (scope)
      ),
      'procedures', (
        select count(*) from public.procedures p
        where p.created_at >= started
          and (scope is null or p.organization_id = any (scope))
      ),
      'procedures_today', (
        select count(*) from public.procedures p
        where p.created_at >= today_start
          and (scope is null or p.organization_id = any (scope))
      ),
      'users_active_today', (
        select count(distinct p.responsible_id)
        from public.procedures p
        where p.updated_at >= today_start
          and (scope is null or p.organization_id = any (scope))
      ),
      'signature_rate_pct', (
        select case when count(*) = 0 then null
          else round(100.0 * count(*) filter (where status = 'signed') / count(*), 1)
        end
        from public.procedures p
        where p.created_at >= started
          and (scope is null or p.organization_id = any (scope))
      ),
      'success_rate_pct', (
        select case when count(*) = 0 then null
          else round(100.0 * count(*) filter (where status = 'signed') / count(*), 1)
        end
        from public.procedures p
        where p.created_at >= started
          and (scope is null or p.organization_id = any (scope))
      )
    ),
    'kpis', jsonb_build_object(
      'proc_per_room_avg', null,
      'duration_proc_min', (
        select round(avg(extract(epoch from (
          private.admin_try_tstz(p.timers->>'endSurgery')
          - private.admin_try_tstz(p.timers->>'startSurgery')
        )) / 60.0)::numeric, 1)
        from public.procedures p
        where p.created_at >= started
          and (scope is null or p.organization_id = any (scope))
          and private.admin_try_tstz(p.timers->>'startSurgery') is not null
          and private.admin_try_tstz(p.timers->>'endSurgery') is not null
      ),
      'duration_anes_min', (
        select round(avg(extract(epoch from (
          private.admin_try_tstz(p.timers->>'endAnesthesia')
          - private.admin_try_tstz(p.timers->>'startAnesthesia')
        )) / 60.0)::numeric, 1)
        from public.procedures p
        where p.created_at >= started
          and (scope is null or p.organization_id = any (scope))
          and private.admin_try_tstz(p.timers->>'startAnesthesia') is not null
          and private.admin_try_tstz(p.timers->>'endAnesthesia') is not null
      ),
      'completed_pct', (
        select case when count(*) = 0 then null
          else round(100.0 * count(*) filter (where status = 'signed') / count(*), 1)
        end
        from public.procedures p
        where p.created_at >= started
          and (scope is null or p.organization_id = any (scope))
      ),
      'in_progress', (
        select count(*) from public.procedures p
        where p.status = 'in_progress'
          and (scope is null or p.organization_id = any (scope))
      ),
      'cancelled', null,
      'with_addendum', (
        select count(distinct a.procedure_id)
        from public.procedure_amendments a
        join public.procedures p on p.id = a.procedure_id
        where p.created_at >= started
          and (scope is null or p.organization_id = any (scope))
      ),
      'with_incident', (
        select count(*) from public.procedures p
        where p.created_at >= started
          and (scope is null or p.organization_id = any (scope))
          and jsonb_typeof(p.incidents) = 'array' and jsonb_array_length(p.incidents) > 0
      ),
      'drafts', (select count(*) from public.procedures p where p.status = 'draft' and (scope is null or p.organization_id = any (scope))),
      'signed', (select count(*) from public.procedures p where p.status = 'signed' and (scope is null or p.organization_id = any (scope)))
    ),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', to_char(d, 'YYYY-MM-DD'),
        'total', coalesce(c.total, 0),
        'completed', coalesce(c.completed, 0)
      ) order by d)
      from generate_series(date_trunc('day', started), date_trunc('day', now()), interval '1 day') d
      left join lateral (
        select
          count(*) as total,
          count(*) filter (where p.status = 'signed') as completed
        from public.procedures p
        where p.created_at >= d and p.created_at < d + interval '1 day'
          and (scope is null or p.organization_id = any (scope))
      ) c on true
    ), '[]'::jsonb),
    'hospitals', coalesce((
      select jsonb_agg(jsonb_build_object('hospital', hospital, 'count', n) order by n desc)
      from (
        select coalesce(o.name, nullif(p.patient->>'hospital', '')) as hospital, count(*)::int as n
        from public.procedures p
        left join public.organizations o on o.id = p.organization_id
        where p.created_at >= started
          and (scope is null or p.organization_id = any (scope))
        group by 1
        having coalesce(o.name, nullif(p.patient->>'hospital', '')) is not null
        order by n desc
        limit 12
      ) h
    ), '[]'::jsonb),
    'techniques', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'count', n) order by n desc)
      from (
        select private.admin_technique_label(p.technique) as name, count(*)::int as n
        from public.procedures p
        where p.created_at >= started
          and (scope is null or p.organization_id = any (scope))
        group by 1
      ) x
    ), '[]'::jsonb),
    'asa', coalesce((
      select jsonb_agg(jsonb_build_object('asa', asa, 'count', n) order by asa)
      from (
        select nullif(p.pre_evaluation->>'asa', '') as asa, count(*)::int as n
        from public.procedures p
        where p.created_at >= started
          and (scope is null or p.organization_id = any (scope))
        group by 1
        having nullif(p.pre_evaluation->>'asa', '') is not null
      ) a
    ), '[]'::jsonb),
    'durations', jsonb_build_object(
      'anestesia_min', (
        select round(avg(extract(epoch from (
          private.admin_try_tstz(p.timers->>'endAnesthesia')
          - private.admin_try_tstz(p.timers->>'startAnesthesia')
        )) / 60.0)::numeric, 0)
        from public.procedures p
        where p.created_at >= started
          and (scope is null or p.organization_id = any (scope))
          and private.admin_try_tstz(p.timers->>'startAnesthesia') is not null
          and private.admin_try_tstz(p.timers->>'endAnesthesia') is not null
      ),
      'sala_min', (
        select round(avg(extract(epoch from (
          private.admin_try_tstz(p.timers->>'endSurgery')
          - private.admin_try_tstz(p.timers->>'startSurgery')
        )) / 60.0)::numeric, 0)
        from public.procedures p
        where p.created_at >= started
          and (scope is null or p.organization_id = any (scope))
          and private.admin_try_tstz(p.timers->>'startSurgery') is not null
          and private.admin_try_tstz(p.timers->>'endSurgery') is not null
      ),
      'srpa_min', null,
      'inicio_incisao_min', (
        select round(avg(extract(epoch from (
          private.admin_try_tstz(p.timers->>'startSurgery')
          - private.admin_try_tstz(p.timers->>'startAnesthesia')
        )) / 60.0)::numeric, 0)
        from public.procedures p
        where p.created_at >= started
          and (scope is null or p.organization_id = any (scope))
          and private.admin_try_tstz(p.timers->>'startAnesthesia') is not null
          and private.admin_try_tstz(p.timers->>'startSurgery') is not null
      ),
      'fim_saida_min', (
        select round(avg(extract(epoch from (
          private.admin_try_tstz(p.timers->>'endAnesthesia')
          - private.admin_try_tstz(p.timers->>'endSurgery')
        )) / 60.0)::numeric, 0)
        from public.procedures p
        where p.created_at >= started
          and (scope is null or p.organization_id = any (scope))
          and private.admin_try_tstz(p.timers->>'endSurgery') is not null
          and private.admin_try_tstz(p.timers->>'endAnesthesia') is not null
      )
    ),
    'heatmap', coalesce((
      select jsonb_agg(jsonb_build_object(
        'dow', extract(isodow from p.created_at)::int,
        'hour', extract(hour from p.created_at)::int,
        'count', count(*)::int
      ))
      from public.procedures p
      where p.created_at >= started
        and (scope is null or p.organization_id = any (scope))
      group by 1, 2
    ), '[]'::jsonb),
    'issues_open', (
      select count(*) from public.admin_issues i
      where i.status not in ('resolved', 'ignored')
        and (scope is null or i.organization_id = any (scope))
    )
  ) into result;
  return result;
end;
$$;

create or replace function private.admin_org_row(org public.organizations)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return jsonb_build_object(
    'id', org.id,
    'name', org.name,
    'legal_name', org.legal_name,
    'cnpj', org.cnpj,
    'type', org.type,
    'plan', org.plan,
    'status', org.status,
    'city', org.city,
    'state', org.state,
    'monthly_cents', org.monthly_cents,
    'billing_cycle', org.billing_cycle,
    'starts_at', org.starts_at,
    'renews_at', org.renews_at,
    'notes', org.notes,
    'created_at', org.created_at,
    'members', (select count(*)::int from public.organization_members m where m.organization_id = org.id),
    'procedures_month', (
      select count(*)::int from public.procedures p
      where p.created_at >= date_trunc('month', now())
        and p.organization_id = org.id
    )
  );
end;
$$;

create or replace function private.admin_list_organizations()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_admin_reader();
  scope uuid[] := private.admin_visible_org_ids();
begin
  perform uid;
  return coalesce((
    select jsonb_agg(private.admin_org_row(o) order by o.name)
    from public.organizations o
    where (scope is null or o.id = any (scope))
  ), '[]'::jsonb);
end;
$$;

create or replace function private.admin_get_organization(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_admin_reader();
  org public.organizations%rowtype;
  started timestamptz := date_trunc('month', now());
begin
  perform uid;
  if not private.admin_can_access_org(p_id) then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  select * into org from public.organizations where id = p_id;
  if not found then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;
  return private.admin_org_row(org) || jsonb_build_object(
    'ai_calls', (
      select count(*) from public.ai_usage u
      where u.organization_id = org.id and u.created_at >= started
    ),
    'members_list', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', pr.id,
        'full_name', pr.full_name,
        'email', pr.email,
        'crm', pr.crm,
        'uf', pr.uf,
        'role', m.role
      ) order by pr.full_name)
      from public.organization_members m
      join public.profiles pr on pr.id = m.user_id
      where m.organization_id = org.id
    ), '[]'::jsonb),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'), 'count', coalesce(c.n, 0)) order by d)
      from generate_series(started, date_trunc('day', now()), interval '1 day') d
      left join lateral (
        select count(*)::int as n
        from public.procedures p
        where p.created_at >= d and p.created_at < d + interval '1 day'
          and p.organization_id = org.id
      ) c on true
    ), '[]'::jsonb),
    'top_anesthetists', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', pr.id,
        'full_name', pr.full_name,
        'role', coalesce(m.role, 'anestesista'),
        'count', x.n
      ) order by x.n desc)
      from (
        select p.responsible_id, count(*)::int as n
        from public.procedures p
        where p.created_at >= started and p.organization_id = org.id
        group by 1
        order by n desc
        limit 5
      ) x
      join public.profiles pr on pr.id = x.responsible_id
      left join public.organization_members m
        on m.user_id = pr.id and m.organization_id = org.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function private.admin_create_organization(p_name text, p_type text, p_plan text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_super_admin();
  new_id uuid;
  t text := coalesce(nullif(trim(p_type), ''), 'hospital');
  pl text := coalesce(nullif(trim(p_plan), ''), 'trial');
  n text := trim(p_name);
begin
  if n is null or length(n) = 0 then
    raise exception 'name_required' using errcode = '22023';
  end if;
  if t not in ('hospital', 'clinica', 'grupo', 'outro') then t := 'hospital'; end if;
  if pl not in ('enterprise', 'standard', 'basic', 'trial') then pl := 'trial'; end if;
  insert into public.organizations (name, type, plan, status)
  values (n, t, pl, case when pl = 'trial' then 'trial' else 'active' end)
  returning id into new_id;
  perform private.admin_audit(uid, 'ORGANIZATION_CREATED', 'organization', new_id::text, new_id, '{}'::jsonb);
  return private.admin_get_organization(new_id);
end;
$$;

create or replace function public.admin_update_organization(p_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_super_admin();
begin
  update public.organizations
  set
    name = coalesce(nullif(trim(p_patch->>'name'), ''), name),
    legal_name = coalesce(p_patch->>'legal_name', legal_name),
    type = case when p_patch->>'type' in ('hospital','clinica','grupo','outro') then p_patch->>'type' else type end,
    cnpj = coalesce(p_patch->>'cnpj', cnpj),
    city = coalesce(p_patch->>'city', city),
    state = coalesce(p_patch->>'state', state),
    status = case when p_patch->>'status' in ('active','suspended','trial','archived') then p_patch->>'status' else status end,
    plan = case when p_patch->>'plan' in ('enterprise','standard','basic','trial') then p_patch->>'plan' else plan end,
    monthly_cents = coalesce(nullif(p_patch->>'monthly_cents','')::int, monthly_cents),
    billing_cycle = case when p_patch->>'billing_cycle' in ('monthly','annual') then p_patch->>'billing_cycle' else billing_cycle end,
    starts_at = coalesce(nullif(p_patch->>'starts_at','')::date, starts_at),
    renews_at = coalesce(nullif(p_patch->>'renews_at','')::date, renews_at),
    notes = coalesce(p_patch->>'notes', notes),
    updated_at = now()
  where id = p_id;
  if not found then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;
  perform private.admin_audit(uid, 'ORGANIZATION_UPDATED', 'organization', p_id::text, p_id, jsonb_build_object('keys', (select jsonb_agg(k) from jsonb_object_keys(p_patch) k)));
  return private.admin_get_organization(p_id);
end;
$$;

create or replace function public.admin_archive_organization(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_super_admin();
begin
  update public.organizations
  set status = 'archived', archived_at = now(), updated_at = now()
  where id = p_id;
  if not found then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;
  perform private.admin_audit(uid, 'ORGANIZATION_ARCHIVED', 'organization', p_id::text, p_id, '{}'::jsonb);
  return private.admin_get_organization(p_id);
end;
$$;
