-- Admin / ERP Analytics: RBAC de plataforma, organizações e RPCs metadata-first.
-- Sem PHI. Sem billing inventado. Auditoria continua em private.audit_events.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id)
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'hospital'
    check (type in ('hospital', 'clinica', 'grupo', 'outro')),
  plan text not null default 'trial'
    check (plan in ('enterprise', 'standard', 'basic', 'trial')),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'trial')),
  city text,
  state text,
  monthly_cents integer not null default 0 check (monthly_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'anestesista'
    check (role in ('coordenador', 'anestesista', 'residente', 'admin')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.admin_issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  incident_type text not null default '',
  description text not null default '',
  technical_context text not null default '',
  error_code text not null default '',
  severity text not null default 'medium'
    check (severity in ('critical', 'high', 'medium', 'low')),
  status text not null default 'open'
    check (status in ('open', 'investigating', 'resolved')),
  organization_id uuid references public.organizations (id) on delete set null,
  procedure_id uuid references public.procedures (id) on delete set null,
  timeline jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_settings (
  id text primary key default 'default' check (id = 'default'),
  platform_name text not null default 'AnestFlow',
  base_url text not null default '',
  timezone text not null default 'America/Sao_Paulo',
  locale text not null default 'pt-BR',
  session_timeout_label text not null default '12h',
  require_2fa boolean not null default false,
  password_policy text not null default 'forte',
  maintenance_mode boolean not null default false,
  support_email text not null default '',
  feature_flags jsonb not null default jsonb_build_object(
    'voice_scribe', true,
    'ai_supervisor', true,
    'narrative_ai', true,
    'google_login', true,
    'pdf_final', true,
    'experimental', false
  ),
  updated_at timestamptz not null default now()
);

insert into public.admin_settings (id) values ('default') on conflict do nothing;

create index organizations_status_idx on public.organizations (status);
create index organization_members_user_idx on public.organization_members (user_id);
create index admin_issues_status_idx on public.admin_issues (status, created_at desc);
create index audit_events_created_idx on private.audit_events (created_at desc);
create index audit_events_actor_idx on private.audit_events (actor_id, created_at desc);
create index procedures_created_at_idx on public.procedures (created_at desc);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function private.set_updated_at();

create trigger admin_issues_set_updated_at
  before update on public.admin_issues
  for each row execute function private.set_updated_at();

create trigger admin_settings_set_updated_at
  before update on public.admin_settings
  for each row execute function private.set_updated_at();

alter table public.platform_admins enable row level security;
alter table public.platform_admins force row level security;
alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.organization_members enable row level security;
alter table public.organization_members force row level security;
alter table public.admin_issues enable row level security;
alter table public.admin_issues force row level security;
alter table public.admin_settings enable row level security;
alter table public.admin_settings force row level security;

revoke all on table public.platform_admins from public, anon, authenticated;
revoke all on table public.organizations from public, anon, authenticated;
revoke all on table public.organization_members from public, anon, authenticated;
revoke all on table public.admin_issues from public, anon, authenticated;
revoke all on table public.admin_settings from public, anon, authenticated;

create policy platform_admins_deny_authenticated on public.platform_admins for all to authenticated using (false) with check (false);
create policy platform_admins_deny_anon on public.platform_admins for all to anon using (false) with check (false);
create policy organizations_deny_authenticated on public.organizations for all to authenticated using (false) with check (false);
create policy organizations_deny_anon on public.organizations for all to anon using (false) with check (false);
create policy organization_members_deny_authenticated on public.organization_members for all to authenticated using (false) with check (false);
create policy organization_members_deny_anon on public.organization_members for all to anon using (false) with check (false);
create policy admin_issues_deny_authenticated on public.admin_issues for all to authenticated using (false) with check (false);
create policy admin_issues_deny_anon on public.admin_issues for all to anon using (false) with check (false);
create policy admin_settings_deny_authenticated on public.admin_settings for all to authenticated using (false) with check (false);
create policy admin_settings_deny_anon on public.admin_settings for all to anon using (false) with check (false);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins a
    where a.user_id = (select auth.uid())
  );
$$;

create or replace function private.assert_platform_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_signed_in_confirmed();
begin
  if not private.is_platform_admin() then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  return uid;
end;
$$;

create or replace function private.admin_range_start(p_range text)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case coalesce(p_range, '30d')
    when 'today' then date_trunc('day', now())
    when '7d' then now() - interval '7 days'
    when 'this_month' then date_trunc('month', now())
    when '3m' then now() - interval '3 months'
    else now() - interval '30 days'
  end;
$$;

create or replace function private.admin_try_tstz(p text)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p is null or length(trim(p)) = 0 then
    return null;
  end if;
  return p::timestamptz;
exception
  when others then
    return null;
end;
$$;

create or replace function private.admin_technique_label(t jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(t->>'combinedSpinalEpidural', '') in ('true', 't') then 'Combinadas'
    when coalesce(t->>'spinal', '') in ('true', 't') then 'Raquianestesia'
    when coalesce(t->>'epidural', '') in ('true', 't') then 'Peridural'
    when coalesce(t->>'regionalPeripheralBlock', '') in ('true', 't') then 'Bloqueios'
    when coalesce(t->>'sedation', '') in ('true', 't') then 'Sedação'
    when coalesce(t->>'generalIV', '') in ('true', 't')
      or coalesce(t->>'generalInhalational', '') in ('true', 't')
      or coalesce(t->>'balanced', '') in ('true', 't') then 'Geral'
    else 'Outras'
  end;
$$;

create or replace function private.admin_audit_label(p_action text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_action
    when 'save_atomic' then jsonb_build_object('tipo', 'ATOMIC_SAVE', 'descricao', 'Salvamento atômico da ficha')
    when 'sign' then jsonb_build_object('tipo', 'PROCEDURE_SIGNED', 'descricao', 'Procedimento assinado digitalmente')
    when 'amendment' then jsonb_build_object('tipo', 'ADDENDUM_CREATED', 'descricao', 'Adendo criado')
    when 'add_participant' then jsonb_build_object('tipo', 'ADMIN_ACTION', 'descricao', 'Participante adicionado à ficha')
    when 'remove_collaborator' then jsonb_build_object('tipo', 'ADMIN_ACTION', 'descricao', 'Colaborador removido da ficha')
    when 'request_transfer' then jsonb_build_object('tipo', 'RESPONSIBILITY_TRANSFER', 'descricao', 'Transferência de responsabilidade solicitada')
    when 'decline_pending_transfer' then jsonb_build_object('tipo', 'RESPONSIBILITY_TRANSFER', 'descricao', 'Transferência recusada')
    when 'claim_responsibility' then jsonb_build_object('tipo', 'RESPONSIBILITY_TRANSFER', 'descricao', 'Responsabilidade reivindicada')
    when 'transfer_responsibility' then jsonb_build_object('tipo', 'RESPONSIBILITY_TRANSFER', 'descricao', 'Responsabilidade transferida')
    when 'assume_responsibility_exceptional' then jsonb_build_object('tipo', 'RESPONSIBILITY_TRANSFER', 'descricao', 'Assunção excepcional de responsabilidade')
    when 'void_clinical' then jsonb_build_object('tipo', 'CLINICAL_VOID', 'descricao', 'Item clínico anulado')
    else jsonb_build_object('tipo', 'ADMIN_ACTION', 'descricao', coalesce(p_action, 'evento'))
  end;
$$;

create or replace function private.admin_log(p_actor uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.audit_events (procedure_id, actor_id, action)
  values (null, p_actor, p_action);
end;
$$;

-- ---------------------------------------------------------------------------
-- Bootstrap / gate
-- ---------------------------------------------------------------------------

create or replace function private.admin_bootstrap_self()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_signed_in_confirmed();
begin
  if private.is_platform_admin() then
    return true;
  end if;
  if exists (select 1 from public.platform_admins) then
    return false;
  end if;
  insert into public.platform_admins (user_id, granted_by)
  values (uid, uid);
  perform private.admin_log(uid, 'admin_bootstrap_self');
  return true;
end;
$$;

create or replace function public.admin_bootstrap_self()
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.admin_bootstrap_self();
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(private.is_platform_admin(), false);
$$;

-- ---------------------------------------------------------------------------
-- Dashboard
-- ---------------------------------------------------------------------------

create or replace function private.admin_dashboard_overview(p_range text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_platform_admin();
  started timestamptz := private.admin_range_start(p_range);
  today_start timestamptz := date_trunc('day', now());
  result jsonb;
begin
  perform uid;

  select jsonb_build_object(
    'range', coalesce(p_range, '30d'),
    'updated_at', now(),
    'metrics', jsonb_build_object(
      'users_active', (select count(*) from public.profiles),
      'organizations_active', (select count(*) from public.organizations where status = 'active'),
      'organizations', (select count(*) from public.organizations),
      'procedures', (
        select count(*) from public.procedures p
        where p.created_at >= started
      ),
      'procedures_today', (
        select count(*) from public.procedures p
        where p.created_at >= today_start
      ),
      'users_active_today', (
        select count(distinct p.responsible_id)
        from public.procedures p
        where p.updated_at >= today_start
      ),
      'success_rate_pct', (
        select case when count(*) = 0 then null
          else round(100.0 * count(*) filter (where status = 'signed') / count(*), 1)
        end
        from public.procedures p
        where p.created_at >= started
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
          and private.admin_try_tstz(p.timers->>'startAnesthesia') is not null
          and private.admin_try_tstz(p.timers->>'endAnesthesia') is not null
      ),
      'completed_pct', (
        select case when count(*) = 0 then null
          else round(100.0 * count(*) filter (where status = 'signed') / count(*), 1)
        end
        from public.procedures p
        where p.created_at >= started
      ),
      'in_progress', (select count(*) from public.procedures where status = 'in_progress'),
      'cancelled', 0,
      'with_addendum', (select count(distinct procedure_id) from public.procedure_amendments),
      'with_incident', (
        select count(*) from public.procedures p
        where jsonb_typeof(p.incidents) = 'array' and jsonb_array_length(p.incidents) > 0
      ),
      'drafts', (select count(*) from public.procedures where status = 'draft'),
      'signed', (select count(*) from public.procedures where status = 'signed')
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
      ) c on true
    ), '[]'::jsonb),
    'hospitals', coalesce((
      select jsonb_agg(jsonb_build_object('hospital', hospital, 'count', n) order by n desc)
      from (
        select nullif(p.patient->>'hospital', '') as hospital, count(*)::int as n
        from public.procedures p
        where p.created_at >= started
        group by 1
        having nullif(p.patient->>'hospital', '') is not null
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
        group by 1
      ) x
    ), '[]'::jsonb),
    'asa', coalesce((
      select jsonb_agg(jsonb_build_object('asa', asa, 'count', n) order by asa)
      from (
        select nullif(p.pre_evaluation->>'asa', '') as asa, count(*)::int as n
        from public.procedures p
        where p.created_at >= started
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
      group by 1, 2
    ), '[]'::jsonb),
    'issues_open', (select count(*) from public.admin_issues where status is distinct from 'resolved')
  ) into result;

  return result;
end;
$$;

create or replace function public.admin_dashboard_overview(p_range text default '30d')
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.admin_dashboard_overview(p_range);
$$;

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------

create or replace function private.admin_list_organizations()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_platform_admin();
begin
  perform uid;
  return coalesce((
    select jsonb_agg(row_to_json(x)::jsonb order by x.name)
    from (
      select
        o.id,
        o.name,
        o.type,
        o.plan,
        o.status,
        o.city,
        o.state,
        o.monthly_cents,
        o.created_at,
        (select count(*)::int from public.organization_members m where m.organization_id = o.id) as members,
        (
          select count(*)::int
          from public.procedures p
          where p.created_at >= date_trunc('month', now())
            and nullif(p.patient->>'hospital', '') = o.name
        ) as procedures_month
      from public.organizations o
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_list_organizations()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.admin_list_organizations();
$$;

create or replace function private.admin_get_organization(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_platform_admin();
  org public.organizations%rowtype;
begin
  perform uid;
  select * into org from public.organizations where id = p_id;
  if not found then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'id', org.id,
    'name', org.name,
    'type', org.type,
    'plan', org.plan,
    'status', org.status,
    'city', org.city,
    'state', org.state,
    'monthly_cents', org.monthly_cents,
    'created_at', org.created_at,
    'members', (
      select count(*)::int from public.organization_members m where m.organization_id = org.id
    ),
    'procedures_month', (
      select count(*)::int from public.procedures p
      where p.created_at >= date_trunc('month', now())
        and nullif(p.patient->>'hospital', '') = org.name
    ),
    'ai_calls', 0,
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
      from generate_series(date_trunc('month', now()), date_trunc('day', now()), interval '1 day') d
      left join lateral (
        select count(*)::int as n
        from public.procedures p
        where p.created_at >= d and p.created_at < d + interval '1 day'
          and nullif(p.patient->>'hospital', '') = org.name
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
        where p.created_at >= date_trunc('month', now())
          and nullif(p.patient->>'hospital', '') = org.name
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

create or replace function public.admin_get_organization(p_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.admin_get_organization(p_id);
$$;

create or replace function private.admin_create_organization(
  p_name text,
  p_type text,
  p_plan text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_platform_admin();
  new_id uuid;
  t text := coalesce(nullif(trim(p_type), ''), 'hospital');
  pl text := coalesce(nullif(trim(p_plan), ''), 'trial');
  n text := trim(p_name);
begin
  if n is null or length(n) = 0 then
    raise exception 'name_required' using errcode = '22023';
  end if;
  if t not in ('hospital', 'clinica', 'grupo', 'outro') then
    t := 'hospital';
  end if;
  if pl not in ('enterprise', 'standard', 'basic', 'trial') then
    pl := 'trial';
  end if;
  insert into public.organizations (name, type, plan, status)
  values (n, t, pl, case when pl = 'trial' then 'trial' else 'active' end)
  returning id into new_id;
  perform private.admin_log(uid, 'admin_create_organization');
  return private.admin_get_organization(new_id);
end;
$$;

create or replace function public.admin_create_organization(p_name text, p_type text default 'hospital', p_plan text default 'trial')
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_create_organization(p_name, p_type, p_plan);
$$;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

create or replace function private.admin_user_status(p_crm text, p_name text, p_confirmed timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_confirmed is null then 'convite_pendente'
    when coalesce(trim(p_crm), '') = '' or coalesce(trim(p_name), '') = '' then 'perfil_incompleto'
    else 'ativo'
  end;
$$;

create or replace function private.admin_list_users()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_platform_admin();
begin
  perform uid;
  return coalesce((
    select jsonb_agg(row_to_json(x)::jsonb order by x.full_name)
    from (
      select
        pr.id,
        pr.full_name,
        pr.email,
        pr.crm,
        pr.uf,
        pr.hospital,
        pr.created_at,
        u.last_sign_in_at,
        u.email_confirmed_at,
        private.admin_user_status(pr.crm, pr.full_name, u.email_confirmed_at) as status,
        exists (select 1 from public.platform_admins a where a.user_id = pr.id) as is_platform_admin,
        coalesce((
          select o.name
          from public.organization_members m
          join public.organizations o on o.id = m.organization_id
          where m.user_id = pr.id
          order by m.created_at
          limit 1
        ), nullif(pr.hospital, '')) as organization_name,
        (
          select i.provider
          from auth.identities i
          where i.user_id = pr.id
          order by i.created_at desc
          limit 1
        ) as login_provider
      from public.profiles pr
      join auth.users u on u.id = pr.id
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_list_users()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.admin_list_users();
$$;

create or replace function private.admin_get_user(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_platform_admin();
  row jsonb;
begin
  perform uid;
  select x from (
    select jsonb_build_object(
      'id', pr.id,
      'full_name', pr.full_name,
      'email', pr.email,
      'crm', pr.crm,
      'uf', pr.uf,
      'hospital', pr.hospital,
      'created_at', pr.created_at,
      'last_sign_in_at', u.last_sign_in_at,
      'email_confirmed_at', u.email_confirmed_at,
      'status', private.admin_user_status(pr.crm, pr.full_name, u.email_confirmed_at),
      'is_platform_admin', exists (select 1 from public.platform_admins a where a.user_id = pr.id),
      'login_provider', (
        select i.provider from auth.identities i
        where i.user_id = pr.id
        order by i.created_at desc limit 1
      ),
      'organization_name', coalesce((
        select o.name from public.organization_members m
        join public.organizations o on o.id = m.organization_id
        where m.user_id = pr.id
        order by m.created_at limit 1
      ), nullif(pr.hospital, '')),
      'memberships', coalesce((
        select jsonb_agg(jsonb_build_object(
          'organization_id', o.id,
          'name', o.name,
          'role', m.role
        ))
        from public.organization_members m
        join public.organizations o on o.id = m.organization_id
        where m.user_id = pr.id
      ), '[]'::jsonb),
      'recent_activity', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', e.id,
          'created_at', e.created_at,
          'action', e.action,
          'label', private.admin_audit_label(e.action)
        ) order by e.created_at desc)
        from (
          select * from private.audit_events e
          where e.actor_id = pr.id
          order by e.created_at desc
          limit 12
        ) e
      ), '[]'::jsonb)
    ) as x
    from public.profiles pr
    join auth.users u on u.id = pr.id
    where pr.id = p_id
  ) q into row;
  if row is null then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  return row;
end;
$$;

create or replace function public.admin_get_user(p_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.admin_get_user(p_id);
$$;

-- ---------------------------------------------------------------------------
-- Procedures metadata-first
-- ---------------------------------------------------------------------------

create or replace function private.admin_list_procedures_meta(p_limit integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_platform_admin();
  lim integer := least(greatest(coalesce(p_limit, 100), 1), 200);
begin
  perform uid;
  return coalesce((
    select jsonb_agg(row_to_json(x)::jsonb)
    from (
      select
        p.id,
        p.status,
        p.revision,
        p.created_at,
        p.updated_at,
        p.signed_at,
        (p.content_hash is not null and p.status = 'signed') as has_hash,
        pr.full_name as responsible_name,
        pr.crm as responsible_crm,
        pr.uf as responsible_uf,
        nullif(p.patient->>'hospital', '') as hospital,
        round((extract(epoch from (
          private.admin_try_tstz(p.timers->>'endAnesthesia')
          - private.admin_try_tstz(p.timers->>'startAnesthesia')
        )) / 60.0)::numeric, 0) as duration_anes_min,
        (jsonb_typeof(p.voice_transcripts) = 'array' and jsonb_array_length(p.voice_transcripts) > 0) as used_voice,
        (jsonb_typeof(p.incidents) = 'array' and jsonb_array_length(p.incidents) > 0) as has_incident
      from public.procedures p
      left join public.profiles pr on pr.id = p.responsible_id
      order by p.created_at desc
      limit lim
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_list_procedures_meta(p_limit integer default 100)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.admin_list_procedures_meta(p_limit);
$$;

-- ---------------------------------------------------------------------------
-- AI / operations / financial / issues / audit / settings
-- ---------------------------------------------------------------------------

create or replace function private.admin_ai_overview(p_range text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_platform_admin();
begin
  perform uid;
  return jsonb_build_object(
    'range', coalesce(p_range, '30d'),
    'note', 'Telemetria de tokens/latência ainda não é persistida. Catálogo de modelos vem do runtime.',
    'voice_events', 0,
    'review_events', 0,
    'narrative_events', 0,
    'total_ai_events', 0,
    'success_rate_pct', null,
    'latency_p50_ms', null,
    'latency_p95_ms', null,
    'cost_brl', 0,
    'cost_per_proc_brl', 0,
    'errors', '[]'::jsonb
  );
end;
$$;

create or replace function public.admin_ai_overview(p_range text default '30d')
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.admin_ai_overview(p_range);
$$;

create or replace function private.admin_operations_overview(p_range text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_platform_admin();
  started timestamptz := private.admin_range_start(p_range);
  day_start timestamptz := now() - interval '24 hours';
begin
  perform uid;
  return jsonb_build_object(
    'range', coalesce(p_range, '30d'),
    'subsystems', jsonb_build_array(
      jsonb_build_object('id', 'database', 'label', 'Database', 'status', 'operational', 'uptime_pct', null),
      jsonb_build_object('id', 'auth', 'label', 'Auth', 'status', 'operational', 'uptime_pct', null),
      jsonb_build_object('id', 'atomic', 'label', 'Atomic Save', 'status', 'operational', 'uptime_pct', null),
      jsonb_build_object('id', 'realtime', 'label', 'Realtime Sync', 'status', 'operational', 'uptime_pct', null),
      jsonb_build_object('id', 'voice', 'label', 'Voice Scribe', 'status', 'unknown', 'uptime_pct', null),
      jsonb_build_object('id', 'supervisor', 'label', 'Supervisor IA', 'status', 'unknown', 'uptime_pct', null),
      jsonb_build_object('id', 'pdf', 'label', 'Ficha PDF Engine', 'status', 'unknown', 'uptime_pct', null),
      jsonb_build_object('id', 'signing', 'label', 'Assinatura Digital', 'status', 'operational', 'uptime_pct', null)
    ),
    'metrics_24h', jsonb_build_object(
      'atomic_saves', (select count(*) from private.audit_events e where e.action = 'save_atomic' and e.created_at >= day_start),
      'rollbacks', 0,
      'stale_revisions', 0,
      'tab_conflicts', 0,
      'sync_failures', 0,
      'sign_failures', 0,
      'pdf_failures', 0,
      'voice_failures', 0,
      'review_failures', 0,
      'integrity_mismatches', 0,
      'signs', (select count(*) from private.audit_events e where e.action = 'sign' and e.created_at >= day_start)
    ),
    'by_status', (
      select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
      from (
        select p.status, count(*)::int as n
        from public.procedures p
        where p.created_at >= started
        group by 1
      ) s
    ),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'created_at', e.created_at,
        'action', e.action,
        'subsystem', case
          when e.action = 'save_atomic' then 'ATOMIC'
          when e.action = 'sign' then 'SIGNING'
          when e.action like '%transfer%' or e.action like '%claim%' or e.action like '%assume%' then 'AUTH'
          when e.action = 'void_clinical' then 'ATOMIC'
          else 'SYSTEM'
        end,
        'label', (private.admin_audit_label(e.action)->>'descricao')
      ) order by e.created_at desc)
      from (
        select * from private.audit_events e
        where e.created_at >= started
        order by e.created_at desc
        limit 40
      ) e
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_operations_overview(p_range text default '30d')
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.admin_operations_overview(p_range);
$$;

create or replace function private.admin_financial_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_platform_admin();
begin
  perform uid;
  return jsonb_build_object(
    'note', 'Faturamento ainda não integrado. Valores zerados.',
    'mrr_cents', 0,
    'arr_cents', 0,
    'ticket_cents', 0,
    'ai_cost_cents', 0,
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
        'cycle', 'mensal',
        'status', o.status,
        'renewal', null
      ) order by o.name)
      from public.organizations o
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_financial_overview()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.admin_financial_overview();
$$;

create or replace function private.admin_list_issues()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_platform_admin();
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
      'organization_id', i.organization_id,
      'organization_name', o.name,
      'procedure_id', i.procedure_id,
      'timeline', i.timeline,
      'created_at', i.created_at,
      'updated_at', i.updated_at
    ) order by i.created_at desc)
    from public.admin_issues i
    left join public.organizations o on o.id = i.organization_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_list_issues()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.admin_list_issues();
$$;

create or replace function private.admin_get_issue(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_platform_admin();
  row jsonb;
begin
  perform uid;
  select jsonb_build_object(
    'id', i.id,
    'title', i.title,
    'incident_type', i.incident_type,
    'description', i.description,
    'technical_context', i.technical_context,
    'error_code', i.error_code,
    'severity', i.severity,
    'status', i.status,
    'organization_id', i.organization_id,
    'organization_name', o.name,
    'procedure_id', i.procedure_id,
    'timeline', i.timeline,
    'created_at', i.created_at,
    'updated_at', i.updated_at
  ) into row
  from public.admin_issues i
  left join public.organizations o on o.id = i.organization_id
  where i.id = p_id;
  if row is null then
    raise exception 'issue_not_found' using errcode = 'P0002';
  end if;
  return row;
end;
$$;

create or replace function public.admin_get_issue(p_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.admin_get_issue(p_id);
$$;

create or replace function private.admin_update_issue(p_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_platform_admin();
  st text := lower(trim(p_status));
begin
  if st not in ('open', 'investigating', 'resolved') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  update public.admin_issues
  set
    status = st,
    timeline = coalesce(timeline, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'at', now(),
      'status', st,
      'actor_id', uid
    ))
  where id = p_id;
  if not found then
    raise exception 'issue_not_found' using errcode = 'P0002';
  end if;
  perform private.admin_log(uid, 'admin_update_issue');
  return private.admin_get_issue(p_id);
end;
$$;

create or replace function public.admin_update_issue(p_id uuid, p_status text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_update_issue(p_id, p_status);
$$;

create or replace function private.admin_list_audit_events(p_limit integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_platform_admin();
  lim integer := least(greatest(coalesce(p_limit, 100), 1), 200);
begin
  perform uid;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id,
      'created_at', e.created_at,
      'actor_id', e.actor_id,
      'action', e.action,
      'tipo', lab->>'tipo',
      'descricao', lab->>'descricao',
      'actor_name', pr.full_name,
      'organization_name', nullif(pr.hospital, ''),
      'ip', null
    ) order by e.created_at desc)
    from (
      select * from private.audit_events
      order by created_at desc
      limit lim
    ) e
    left join public.profiles pr on pr.id = e.actor_id
    cross join lateral private.admin_audit_label(e.action) lab
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_list_audit_events(p_limit integer default 100)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.admin_list_audit_events(p_limit);
$$;

create or replace function private.admin_get_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_platform_admin();
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
    'require_2fa', row.require_2fa,
    'password_policy', row.password_policy,
    'maintenance_mode', row.maintenance_mode,
    'support_email', row.support_email,
    'feature_flags', row.feature_flags,
    'updated_at', row.updated_at,
    'session_policy_hours', 12
  );
end;
$$;

create or replace function public.admin_get_settings()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.admin_get_settings();
$$;

create or replace function private.admin_update_settings(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_platform_admin();
  flags jsonb;
begin
  flags := coalesce(p_patch->'feature_flags', '{}'::jsonb);
  update public.admin_settings
  set
    platform_name = coalesce(nullif(p_patch->>'platform_name', ''), platform_name),
    base_url = coalesce(p_patch->>'base_url', base_url),
    timezone = coalesce(nullif(p_patch->>'timezone', ''), timezone),
    locale = coalesce(nullif(p_patch->>'locale', ''), locale),
    require_2fa = coalesce((p_patch->>'require_2fa')::boolean, require_2fa),
    password_policy = coalesce(nullif(p_patch->>'password_policy', ''), password_policy),
    maintenance_mode = coalesce((p_patch->>'maintenance_mode')::boolean, maintenance_mode),
    support_email = coalesce(p_patch->>'support_email', support_email),
    feature_flags = feature_flags || jsonb_build_object(
      'voice_scribe', coalesce((flags->>'voice_scribe')::boolean, (feature_flags->>'voice_scribe')::boolean, true),
      'ai_supervisor', coalesce((flags->>'ai_supervisor')::boolean, (feature_flags->>'ai_supervisor')::boolean, true),
      'narrative_ai', coalesce((flags->>'narrative_ai')::boolean, (feature_flags->>'narrative_ai')::boolean, true),
      'google_login', coalesce((flags->>'google_login')::boolean, (feature_flags->>'google_login')::boolean, true),
      'pdf_final', coalesce((flags->>'pdf_final')::boolean, (feature_flags->>'pdf_final')::boolean, true),
      'experimental', coalesce((flags->>'experimental')::boolean, (feature_flags->>'experimental')::boolean, false)
    )
  where id = 'default';
  perform private.admin_log(uid, 'admin_update_settings');
  return private.admin_get_settings();
end;
$$;

create or replace function public.admin_update_settings(p_patch jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_update_settings(p_patch);
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function private.is_platform_admin() from public, anon;
revoke all on function private.assert_platform_admin() from public, anon;
revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.admin_bootstrap_self() from public, anon;
revoke all on function public.admin_dashboard_overview(text) from public, anon;
revoke all on function public.admin_list_organizations() from public, anon;
revoke all on function public.admin_get_organization(uuid) from public, anon;
revoke all on function public.admin_create_organization(text, text, text) from public, anon;
revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_get_user(uuid) from public, anon;
revoke all on function public.admin_list_procedures_meta(integer) from public, anon;
revoke all on function public.admin_ai_overview(text) from public, anon;
revoke all on function public.admin_operations_overview(text) from public, anon;
revoke all on function public.admin_financial_overview() from public, anon;
revoke all on function public.admin_list_issues() from public, anon;
revoke all on function public.admin_get_issue(uuid) from public, anon;
revoke all on function public.admin_update_issue(uuid, text) from public, anon;
revoke all on function public.admin_list_audit_events(integer) from public, anon;
revoke all on function public.admin_get_settings() from public, anon;
revoke all on function public.admin_update_settings(jsonb) from public, anon;

grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.assert_platform_admin() to authenticated;
grant execute on function private.admin_bootstrap_self() to authenticated;
grant execute on function private.admin_dashboard_overview(text) to authenticated;
grant execute on function private.admin_list_organizations() to authenticated;
grant execute on function private.admin_get_organization(uuid) to authenticated;
grant execute on function private.admin_create_organization(text, text, text) to authenticated;
grant execute on function private.admin_list_users() to authenticated;
grant execute on function private.admin_get_user(uuid) to authenticated;
grant execute on function private.admin_list_procedures_meta(integer) to authenticated;
grant execute on function private.admin_ai_overview(text) to authenticated;
grant execute on function private.admin_operations_overview(text) to authenticated;
grant execute on function private.admin_financial_overview() to authenticated;
grant execute on function private.admin_list_issues() to authenticated;
grant execute on function private.admin_get_issue(uuid) to authenticated;
grant execute on function private.admin_update_issue(uuid, text) to authenticated;
grant execute on function private.admin_list_audit_events(integer) to authenticated;
grant execute on function private.admin_get_settings() to authenticated;
grant execute on function private.admin_update_settings(jsonb) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.admin_bootstrap_self() to authenticated;
grant execute on function public.admin_dashboard_overview(text) to authenticated;
grant execute on function public.admin_list_organizations() to authenticated;
grant execute on function public.admin_get_organization(uuid) to authenticated;
grant execute on function public.admin_create_organization(text, text, text) to authenticated;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_get_user(uuid) to authenticated;
grant execute on function public.admin_list_procedures_meta(integer) to authenticated;
grant execute on function public.admin_ai_overview(text) to authenticated;
grant execute on function public.admin_operations_overview(text) to authenticated;
grant execute on function public.admin_financial_overview() to authenticated;
grant execute on function public.admin_list_issues() to authenticated;
grant execute on function public.admin_get_issue(uuid) to authenticated;
grant execute on function public.admin_update_issue(uuid, text) to authenticated;
grant execute on function public.admin_list_audit_events(integer) to authenticated;
grant execute on function public.admin_get_settings() to authenticated;
grant execute on function public.admin_update_settings(jsonb) to authenticated;

comment on table public.platform_admins is 'Admins de plataforma. Sem PHI. Acesso só via RPC.';
comment on table public.organizations is 'Instituições do ERP. Isolamento via memberships + RPC admin.';
comment on function public.admin_list_procedures_meta(integer) is 'Metadata operacional. Não retorna PHI de paciente.';
