-- Live E2E: jsonb_agg(count(*)) no heatmap do dashboard viola nested aggregates.
-- Agrega em subquery e depois serializa, no mesmo padrão de hospitals/techniques/asa.

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
        'dow', h.dow,
        'hour', h.hour,
        'count', h.n
      ) order by h.dow, h.hour)
      from (
        select
          extract(isodow from p.created_at)::int as dow,
          extract(hour from p.created_at)::int as hour,
          count(*)::int as n
        from public.procedures p
        where p.created_at >= started
          and (scope is null or p.organization_id = any (scope))
        group by 1, 2
      ) h
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
