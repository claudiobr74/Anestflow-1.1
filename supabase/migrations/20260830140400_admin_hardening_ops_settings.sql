-- Operação sem telemetria falsa, AI real, settings enforcement, financeiro, paginação issues/audit.

create or replace function private.admin_operations_overview(p_range text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_admin_reader();
  started timestamptz := private.admin_range_start(p_range);
  day_start timestamptz := now() - interval '24 hours';
  scope uuid[] := private.admin_visible_org_ids();
  atomic_n integer;
  sign_n integer;
  mismatch_n integer;
  voice_fail integer;
  review_fail integer;
begin
  perform uid;

  select count(*)::int into atomic_n
  from private.audit_events e
  where e.action = 'save_atomic' and e.created_at >= day_start;

  select count(*)::int into sign_n
  from private.audit_events e
  where e.action = 'sign' and e.created_at >= day_start;

  select count(*)::int into mismatch_n
  from public.admin_issues i
  where i.incident_type = 'INTEGRITY_MISMATCH'
    and i.last_seen_at >= day_start
    and (scope is null or i.organization_id = any (scope));

  select count(*)::int into voice_fail
  from public.ai_usage u
  where u.created_at >= day_start
    and u.feature in ('voice_asr', 'voice_parser')
    and u.status is distinct from 'success'
    and (scope is null or u.organization_id = any (scope));

  select count(*)::int into review_fail
  from public.ai_usage u
  where u.created_at >= day_start
    and u.feature in ('clinical_review', 'narrative')
    and u.status is distinct from 'success'
    and (scope is null or u.organization_id = any (scope));

  return jsonb_build_object(
    'range', coalesce(p_range, '30d'),
    'subsystems', jsonb_build_array(
      jsonb_build_object('id', 'database', 'label', 'Database', 'status', 'operational', 'uptime_pct', null, 'note', 'Probe: RPC respondeu'),
      jsonb_build_object('id', 'auth', 'label', 'Auth', 'status', 'operational', 'uptime_pct', null, 'note', 'Probe: sessão autenticada'),
      jsonb_build_object('id', 'atomic', 'label', 'Atomic Save', 'status', case when atomic_n > 0 then 'operational' else 'unknown' end, 'uptime_pct', null),
      jsonb_build_object('id', 'realtime', 'label', 'Realtime Sync', 'status', 'unknown', 'uptime_pct', null),
      jsonb_build_object('id', 'voice', 'label', 'Voice Scribe', 'status', case when voice_fail > 0 then 'degraded' when exists (select 1 from public.ai_usage u where u.feature in ('voice_asr','voice_parser') and u.created_at >= day_start) then 'operational' else 'unknown' end, 'uptime_pct', null),
      jsonb_build_object('id', 'supervisor', 'label', 'Supervisor IA', 'status', 'unknown', 'uptime_pct', null),
      jsonb_build_object('id', 'pdf', 'label', 'Ficha PDF Engine', 'status', 'unknown', 'uptime_pct', null),
      jsonb_build_object('id', 'signing', 'label', 'Assinatura Digital', 'status', case when sign_n > 0 then 'operational' else 'unknown' end, 'uptime_pct', null)
    ),
    'metrics_24h', jsonb_build_object(
      'atomic_saves', atomic_n,
      'rollbacks', null,
      'stale_revisions', null,
      'tab_conflicts', null,
      'sync_failures', null,
      'sign_failures', null,
      'pdf_failures', null,
      'voice_failures', case when exists (select 1 from public.ai_usage) then voice_fail else null end,
      'review_failures', case when exists (select 1 from public.ai_usage) then review_fail else null end,
      'integrity_mismatches', mismatch_n,
      'signs', sign_n
    ),
    'by_status', jsonb_build_object(
      'draft', (select count(*) from public.procedures p where p.status = 'draft' and p.created_at >= started and (scope is null or p.organization_id = any (scope))),
      'in_progress', (select count(*) from public.procedures p where p.status = 'in_progress' and p.created_at >= started and (scope is null or p.organization_id = any (scope))),
      'signed', (select count(*) from public.procedures p where p.status = 'signed' and p.created_at >= started and (scope is null or p.organization_id = any (scope)))
    ),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'created_at', e.created_at,
        'action', e.action,
        'subsystem', coalesce(e.target_type, 'audit'),
        'label', coalesce(lab->>'descricao', e.action)
      ) order by e.created_at desc)
      from (
        select * from private.audit_events e
        where e.created_at >= started
        order by e.created_at desc
        limit 40
      ) e
      cross join lateral private.admin_audit_label(e.action) lab
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function private.admin_ai_overview(p_range text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_admin_reader();
  started timestamptz := private.admin_range_start(p_range);
  scope uuid[] := private.admin_visible_org_ids();
  has_data boolean;
begin
  perform uid;
  select exists (
    select 1 from public.ai_usage u
    where u.created_at >= started
      and (scope is null or u.organization_id = any (scope))
  ) into has_data;

  if not has_data then
    return jsonb_build_object(
      'range', coalesce(p_range, '30d'),
      'note', 'Sem telemetria de IA no período.',
      'voice_events', null,
      'review_events', null,
      'narrative_events', null,
      'total_ai_events', null,
      'success_rate_pct', null,
      'latency_p50_ms', null,
      'latency_p95_ms', null,
      'cost_brl', null,
      'cost_per_proc_brl', null,
      'errors', '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'range', coalesce(p_range, '30d'),
    'note', 'Métricas de ai_usage (sem conteúdo clínico).',
    'voice_events', (select count(*) from public.ai_usage u where u.created_at >= started and u.feature in ('voice_asr','voice_parser') and (scope is null or u.organization_id = any (scope))),
    'review_events', (select count(*) from public.ai_usage u where u.created_at >= started and u.feature = 'clinical_review' and (scope is null or u.organization_id = any (scope))),
    'narrative_events', (select count(*) from public.ai_usage u where u.created_at >= started and u.feature = 'narrative' and (scope is null or u.organization_id = any (scope))),
    'total_ai_events', (select count(*) from public.ai_usage u where u.created_at >= started and (scope is null or u.organization_id = any (scope))),
    'success_rate_pct', (
      select round(100.0 * count(*) filter (where status = 'success') / nullif(count(*), 0), 1)
      from public.ai_usage u
      where u.created_at >= started and (scope is null or u.organization_id = any (scope))
    ),
    'latency_p50_ms', (
      select percentile_cont(0.5) within group (order by latency_ms)
      from public.ai_usage u
      where u.created_at >= started and u.latency_ms is not null and (scope is null or u.organization_id = any (scope))
    ),
    'latency_p95_ms', (
      select percentile_cont(0.95) within group (order by latency_ms)
      from public.ai_usage u
      where u.created_at >= started and u.latency_ms is not null and (scope is null or u.organization_id = any (scope))
    ),
    'cost_brl', (
      select sum(estimated_cost) from public.ai_usage u
      where u.created_at >= started and (scope is null or u.organization_id = any (scope))
    ),
    'cost_per_proc_brl', (
      select sum(u.estimated_cost) / nullif(count(distinct u.procedure_id), 0)
      from public.ai_usage u
      where u.created_at >= started and (scope is null or u.organization_id = any (scope))
    ),
    'errors', coalesce((
      select jsonb_agg(jsonb_build_object('error_code', error_code, 'count', n) order by n desc)
      from (
        select coalesce(error_code, status) as error_code, count(*)::int as n
        from public.ai_usage u
        where u.created_at >= started and u.status is distinct from 'success'
          and (scope is null or u.organization_id = any (scope))
        group by 1
        limit 12
      ) e
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function private.admin_financial_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_super_admin();
  mrr bigint;
begin
  perform uid;
  select coalesce(sum(
    case
      when billing_cycle = 'annual' then (monthly_cents / 12)
      else monthly_cents
    end
  ), 0)::bigint
  into mrr
  from public.organizations
  where status = 'active' and plan is distinct from 'trial';

  return jsonb_build_object(
    'note', 'MRR contratual (sem gateway). Custo de IA só se ai_usage tiver estimated_cost.',
    'mrr_cents', mrr,
    'arr_cents', mrr * 12,
    'ticket_cents', (
      select case when count(*) = 0 then 0 else (sum(
        case when billing_cycle = 'annual' then monthly_cents / 12 else monthly_cents end
      ) / count(*)) end
      from public.organizations
      where status = 'active' and plan is distinct from 'trial'
    ),
    'ai_cost_cents', (
      select case when sum(estimated_cost) is null then null
        else round(sum(estimated_cost) * 100)::bigint end
      from public.ai_usage
      where created_at >= date_trunc('month', now())
    ),
    'margin_pct', null,
    'active_paid_orgs', (
      select count(*) from public.organizations
      where status = 'active' and plan is distinct from 'trial'
    ),
    'trial_orgs', (select count(*) from public.organizations where plan = 'trial'),
    'contracts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id,
        'name', o.name,
        'plan', o.plan,
        'monthly_cents', o.monthly_cents,
        'cycle', o.billing_cycle,
        'status', o.status,
        'renewal', o.renews_at
      ) order by o.name)
      from public.organizations o
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function private.admin_get_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_super_admin();
  row public.admin_settings%rowtype;
begin
  perform uid;
  select * into row from public.admin_settings where id = 'default';
  return jsonb_build_object(
    'id', row.id,
    'platform_name', row.platform_name,
    'base_url', row.base_url,
    'timezone', row.timezone,
    'locale', row.locale,
    'session_timeout_label', row.session_timeout_label,
    'require_2fa', false,
    'password_policy', row.password_policy,
    'maintenance_mode', false,
    'support_email', row.support_email,
    'feature_flags', jsonb_build_object(
      'voice_scribe', true,
      'ai_supervisor', true,
      'narrative_ai', true,
      'google_login', true,
      'pdf_final', true,
      'experimental', false
    ),
    'updated_at', row.updated_at,
    'session_policy_hours', 12,
    'enforcement', jsonb_build_object(
      'platform_name', 'DISPLAY_ONLY',
      'base_url', 'DISPLAY_ONLY',
      'timezone', 'DISPLAY_ONLY',
      'locale', 'DISPLAY_ONLY',
      'session_timeout_label', 'DISPLAY_ONLY',
      'require_2fa', 'NOT_IMPLEMENTED',
      'password_policy', 'DISPLAY_ONLY',
      'maintenance_mode', 'NOT_IMPLEMENTED',
      'support_email', 'DISPLAY_ONLY',
      'feature_flags', 'NOT_IMPLEMENTED'
    )
  );
end;
$$;

create or replace function private.admin_update_settings(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_super_admin();
begin
  -- Flags e 2FA não são enforced no runtime: recusar mutação enganosa.
  if p_patch ? 'require_2fa' or p_patch ? 'maintenance_mode' or p_patch ? 'feature_flags' then
    raise exception 'setting_not_enforced' using errcode = '42501';
  end if;
  update public.admin_settings
  set
    platform_name = coalesce(nullif(p_patch->>'platform_name', ''), platform_name),
    base_url = coalesce(p_patch->>'base_url', base_url),
    support_email = coalesce(p_patch->>'support_email', support_email)
  where id = 'default';
  perform private.admin_audit(uid, 'SETTINGS_UPDATED', 'settings', 'default', null, jsonb_build_object('keys', (select jsonb_agg(k) from jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)) k)));
  return private.admin_get_settings();
end;
$$;

create or replace function private.admin_list_issues()
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
    select jsonb_agg(jsonb_build_object(
      'id', i.id,
      'title', i.title,
      'incident_type', i.incident_type,
      'description', i.description,
      'technical_context', i.technical_context,
      'error_code', i.error_code,
      'severity', i.severity,
      'status', i.status,
      'occurrences', i.occurrences,
      'last_seen_at', i.last_seen_at,
      'resolved_at', i.resolved_at,
      'resolution_note', i.resolution_note,
      'organization_id', i.organization_id,
      'organization_name', o.name,
      'procedure_id', i.procedure_id,
      'timeline', i.timeline,
      'created_at', i.created_at,
      'updated_at', i.updated_at
    ) order by i.last_seen_at desc)
    from public.admin_issues i
    left join public.organizations o on o.id = i.organization_id
    where scope is null or i.organization_id = any (scope)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_list_issues_page(
  p_page integer default 1,
  p_page_size integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  items jsonb := private.admin_list_issues();
  page integer := greatest(coalesce(p_page, 1), 1);
  page_size integer := least(greatest(coalesce(p_page_size, 10), 1), 50);
begin
  return jsonb_build_object(
    'total_count', jsonb_array_length(items),
    'page', page,
    'page_size', page_size,
    'items', coalesce((
      select jsonb_agg(el)
      from (
        select el from jsonb_array_elements(items) el
        offset (page - 1) * page_size
        limit page_size
      ) q
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function private.admin_update_issue(p_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_admin_reader();
  st text := lower(trim(p_status));
  note text := null;
begin
  if st not in ('open', 'investigating', 'resolved', 'ignored') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  update public.admin_issues
  set
    status = st,
    resolved_at = case when st in ('resolved', 'ignored') then now() else resolved_at end,
    resolved_by = case when st in ('resolved', 'ignored') then uid else resolved_by end,
    timeline = coalesce(timeline, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', now(), 'status', st, 'actor_id', uid
    )),
    updated_at = now()
  where id = p_id;
  if not found then
    raise exception 'issue_not_found' using errcode = 'P0002';
  end if;
  perform private.admin_audit(uid, 'ISSUE_UPDATED', 'issue', p_id::text, null, jsonb_build_object('new_status', st, 'resolution_note', note));
  return private.admin_get_issue(p_id);
end;
$$;

create or replace function private.admin_list_audit_events(p_limit integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_admin_reader();
  lim integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  perform uid;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id,
      'created_at', e.created_at,
      'actor_id', e.actor_id,
      'action', e.action,
      'target_type', e.target_type,
      'target_id', e.target_id,
      'organization_id', e.organization_id,
      'metadata', e.metadata,
      'tipo', lab->>'tipo',
      'descricao', lab->>'descricao',
      'actor_name', pr.full_name,
      'organization_name', o.name,
      'ip', null
    ) order by e.created_at desc)
    from (
      select * from private.audit_events
      order by created_at desc
      limit lim
    ) e
    left join public.profiles pr on pr.id = e.actor_id
    left join public.organizations o on o.id = e.organization_id
    cross join lateral private.admin_audit_label(e.action) lab
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_list_audit_page(
  p_page integer default 1,
  p_page_size integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_admin_reader();
  page integer := greatest(coalesce(p_page, 1), 1);
  page_size integer := least(greatest(coalesce(p_page_size, 10), 1), 50);
  total integer;
begin
  perform uid;
  select count(*)::int into total from private.audit_events;
  return jsonb_build_object(
    'total_count', total,
    'page', page,
    'page_size', page_size,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'created_at', e.created_at,
        'actor_id', e.actor_id,
        'action', e.action,
        'target_type', e.target_type,
        'target_id', e.target_id,
        'organization_id', e.organization_id,
        'metadata', e.metadata,
        'tipo', lab->>'tipo',
        'descricao', lab->>'descricao',
        'actor_name', pr.full_name,
        'organization_name', o.name,
        'ip', null
      ) order by e.created_at desc)
      from (
        select * from private.audit_events
        order by created_at desc
        offset (page - 1) * page_size
        limit page_size
      ) e
      left join public.profiles pr on pr.id = e.actor_id
      left join public.organizations o on o.id = e.organization_id
      cross join lateral private.admin_audit_label(e.action) lab
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_update_organization(uuid, jsonb) from public, anon;
revoke all on function public.admin_archive_organization(uuid) from public, anon;
revoke all on function public.admin_set_user_status(uuid, text) from public, anon;
revoke all on function public.admin_add_membership(uuid, uuid, text) from public, anon;
revoke all on function public.admin_remove_membership(uuid, uuid) from public, anon;
revoke all on function public.admin_set_membership_role(uuid, uuid, text) from public, anon;
revoke all on function public.admin_list_procedures_page(integer, integer, text, text, uuid) from public, anon;
revoke all on function public.admin_list_users_page(integer, integer, text) from public, anon;
revoke all on function public.admin_list_organizations_page(integer, integer, text) from public, anon;
revoke all on function public.admin_list_issues_page(integer, integer) from public, anon;
revoke all on function public.admin_list_audit_page(integer, integer) from public, anon;

grant execute on function public.admin_update_organization(uuid, jsonb) to authenticated;
grant execute on function public.admin_archive_organization(uuid) to authenticated;
grant execute on function public.admin_set_user_status(uuid, text) to authenticated;
grant execute on function public.admin_add_membership(uuid, uuid, text) to authenticated;
grant execute on function public.admin_remove_membership(uuid, uuid) to authenticated;
grant execute on function public.admin_set_membership_role(uuid, uuid, text) to authenticated;
grant execute on function public.admin_list_procedures_page(integer, integer, text, text, uuid) to authenticated;
grant execute on function public.admin_list_users_page(integer, integer, text) to authenticated;
grant execute on function public.admin_list_organizations_page(integer, integer, text) to authenticated;
grant execute on function public.admin_list_issues_page(integer, integer) to authenticated;
grant execute on function public.admin_list_audit_page(integer, integer) to authenticated;
