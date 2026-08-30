-- Admin hardening: schema, bootstrap neutralization, integrity core, tenancy.
-- Sem PHI. Sem hard delete. Sem alteração do algoritmo de selo.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists account_status text not null default 'active';

alter table public.profiles
  drop constraint if exists profiles_account_status_check;

alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status = any (array['active'::text, 'inactive'::text, 'suspended'::text]));

alter table public.procedures
  add column if not exists organization_id uuid references public.organizations (id) on delete set null;

create index if not exists procedures_organization_id_idx
  on public.procedures (organization_id, created_at desc);

alter table public.organizations
  add column if not exists legal_name text,
  add column if not exists cnpj text,
  add column if not exists billing_cycle text not null default 'monthly',
  add column if not exists starts_at date,
  add column if not exists renews_at date,
  add column if not exists notes text,
  add column if not exists archived_at timestamptz;

alter table public.organizations
  drop constraint if exists organizations_billing_cycle_check;

alter table public.organizations
  add constraint organizations_billing_cycle_check
  check (billing_cycle = any (array['monthly'::text, 'annual'::text]));

alter table public.organizations
  drop constraint if exists organizations_status_check;

alter table public.organizations
  add constraint organizations_status_check
  check (status = any (array['active'::text, 'suspended'::text, 'trial'::text, 'archived'::text]));

alter table public.admin_issues
  add column if not exists occurrences integer not null default 1,
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users (id),
  add column if not exists resolution_note text,
  add column if not exists dedup_key text;

alter table public.admin_issues
  drop constraint if exists admin_issues_status_check;

alter table public.admin_issues
  add constraint admin_issues_status_check
  check (status = any (array['open'::text, 'investigating'::text, 'resolved'::text, 'ignored'::text]));

create unique index if not exists admin_issues_dedup_key_uidx
  on public.admin_issues (dedup_key)
  where dedup_key is not null and status = any (array['open'::text, 'investigating'::text]);

alter table private.audit_events
  add column if not exists target_type text,
  add column if not exists target_id text,
  add column if not exists organization_id uuid,
  add column if not exists correlation_id uuid,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid references public.organizations (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  procedure_id uuid references public.procedures (id) on delete set null,
  feature text not null,
  provider text not null default 'google-gemini',
  model text not null,
  prompt_version text,
  schema_version text,
  latency_ms integer,
  status text not null,
  error_code text,
  input_tokens integer,
  output_tokens integer,
  audio_seconds numeric,
  estimated_cost numeric
);

comment on table public.ai_usage is 'Telemetria técnica de IA. Sem transcript, resposta clínica, nome de paciente, prompt ou áudio.';

alter table public.ai_usage enable row level security;
alter table public.ai_usage force row level security;
revoke all on table public.ai_usage from public, anon, authenticated;

drop policy if exists ai_usage_deny_authenticated on public.ai_usage;
drop policy if exists ai_usage_deny_anon on public.ai_usage;
create policy ai_usage_deny_authenticated on public.ai_usage for all to authenticated using (false) with check (false);
create policy ai_usage_deny_anon on public.ai_usage for all to anon using (false) with check (false);

create index if not exists ai_usage_created_idx on public.ai_usage (created_at desc);
create index if not exists ai_usage_feature_idx on public.ai_usage (feature, created_at desc);
create index if not exists ai_usage_org_idx on public.ai_usage (organization_id, created_at desc);

create table if not exists public.admin_ai_cost_rates (
  id text primary key default 'default',
  currency text not null default 'BRL',
  input_token_rate numeric not null default 0,
  output_token_rate numeric not null default 0,
  audio_second_rate numeric not null default 0,
  updated_at timestamptz not null default now(),
  check (id = 'default')
);

alter table public.admin_ai_cost_rates enable row level security;
alter table public.admin_ai_cost_rates force row level security;
revoke all on table public.admin_ai_cost_rates from public, anon, authenticated;

insert into public.admin_ai_cost_rates (id)
values ('default')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Bootstrap: nunca promover pelo /admin
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
  -- Hardening: visita a /admin NÃO cria Super Admin.
  return private.is_platform_admin();
end;
$$;

comment on function private.admin_bootstrap_self() is
  'Neutralizado. Não insere em platform_admins. Provisionar Super Admin só via SQL/service_role.';

create or replace function private.provision_platform_admin(p_user_id uuid, p_granted_by uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'provision_forbidden' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'user_required' using errcode = '22023';
  end if;
  insert into public.platform_admins (user_id, granted_by)
  values (p_user_id, p_granted_by)
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function private.provision_platform_admin(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Account lock
-- ---------------------------------------------------------------------------

create or replace function private.is_account_active(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.account_status = 'active'
    from public.profiles p
    where p.id = p_uid
  ), true);
$$;

create or replace function private.assert_signed_in_confirmed()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not private.is_email_confirmed() then
    raise exception 'email_not_confirmed' using errcode = '42501';
  end if;
  if not private.is_account_active(uid) then
    raise exception 'account_inactive' using errcode = '42501';
  end if;
  return uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Clinic admin / tenancy helpers
-- ---------------------------------------------------------------------------

create or replace function private.is_clinic_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.user_id = (select auth.uid())
      and m.role = 'admin'
      and o.status is distinct from 'archived'
  );
$$;

create or replace function private.clinic_admin_org_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(m.organization_id), '{}'::uuid[])
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = (select auth.uid())
    and m.role = 'admin'
    and o.status is distinct from 'archived';
$$;

create or replace function private.assert_admin_reader()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_signed_in_confirmed();
begin
  if private.is_platform_admin() or private.is_clinic_admin() then
    return uid;
  end if;
  raise exception 'not_platform_admin' using errcode = '42501';
end;
$$;

create or replace function private.assert_super_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return private.assert_platform_admin();
end;
$$;

create or replace function private.admin_can_access_org(p_org_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.is_platform_admin() then
    return true;
  end if;
  if p_org_id is null then
    return false;
  end if;
  return p_org_id = any (private.clinic_admin_org_ids());
end;
$$;

create or replace function private.normalize_org_name(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(trim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')));
$$;

create or replace function private.resolve_procedure_organization_id(p_uid uuid, p_hospital text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_count integer;
begin
  select count(*)::int, min(m.organization_id)
  into v_count, v_org
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = p_uid
    and o.status is distinct from 'archived';
  if v_count = 1 then
    return v_org;
  end if;

  if p_hospital is null or length(trim(p_hospital)) = 0 then
    return null;
  end if;

  select count(*)::int, min(o.id)
  into v_count, v_org
  from public.organizations o
  where private.normalize_org_name(o.name) = private.normalize_org_name(p_hospital)
    and o.status is distinct from 'archived';
  if v_count = 1 then
    return v_org;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- organization_id no INSERT clínico (sem reescrever save_atomic)
-- ---------------------------------------------------------------------------

create or replace function private.procedures_assign_organization_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is null then
    new.organization_id := private.resolve_procedure_organization_id(
      new.created_by,
      new.patient->>'hospital'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists procedures_assign_organization_id on public.procedures;
create trigger procedures_assign_organization_id
before insert on public.procedures
for each row
execute function private.procedures_assign_organization_id();

-- ---------------------------------------------------------------------------
-- Audit enrichment
-- ---------------------------------------------------------------------------

create or replace function private.admin_audit(
  p_actor uuid,
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_organization_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.audit_events (
    procedure_id, actor_id, action, target_type, target_id, organization_id, metadata
  ) values (
    null,
    p_actor,
    p_action,
    p_target_type,
    p_target_id,
    p_organization_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.is_clinic_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(private.is_clinic_admin(), false);
$$;

create or replace function public.admin_whoami()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_signed_in_confirmed();
  role text;
begin
  if private.is_platform_admin() then
    role := 'SUPER_ADMIN';
  elsif private.is_clinic_admin() then
    role := 'CLINIC_ADMIN';
  else
    role := 'USER';
  end if;
  return jsonb_build_object(
    'user_id', uid,
    'role', role,
    'organization_ids', case
      when role = 'SUPER_ADMIN' then '[]'::jsonb
      else to_jsonb(private.clinic_admin_org_ids())
    end
  );
end;
$$;

revoke all on function public.is_clinic_admin() from public, anon;
revoke all on function public.admin_whoami() from public, anon;
grant execute on function public.is_clinic_admin() to authenticated;
grant execute on function public.admin_whoami() to authenticated;
