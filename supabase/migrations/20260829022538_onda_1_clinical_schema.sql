-- Onda 1: tabelas clínicas, helpers e auditoria no projeto Anestflow.
-- Não expõe perfis globalmente. Ficha signed é imutável. Worklist só do criador.

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
alter default privileges in schema private revoke all on functions from public;
alter default privileges in schema private revoke all on functions from anon;
alter default privileges in schema private revoke all on functions from authenticated;

grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.is_email_confirmed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users
    where id = (select auth.uid())
      and email_confirmed_at is not null
  );
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
  return uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  crm text not null default '',
  uf text not null default '',
  hospital text not null default '',
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_lowercase check (email is null or email = lower(email))
);

create unique index profiles_email_unique_idx
  on public.profiles (email)
  where email is not null;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- procedures
-- ---------------------------------------------------------------------------

create table public.procedures (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id),
  responsible_id uuid not null references auth.users (id),
  status text not null default 'draft'
    check (status in ('draft', 'in_progress', 'signed')),
  schema_version text not null default '2.0.0',
  signed_at timestamptz,
  signed_by jsonb,
  content_hash text,
  signed_canonical text,
  patient jsonb not null default '{}'::jsonb,
  team jsonb not null default '{}'::jsonb,
  pre_evaluation jsonb not null default '{}'::jsonb,
  technique jsonb not null default '{}'::jsonb,
  airway jsonb not null default '{}'::jsonb,
  checklist jsonb not null default '{}'::jsonb,
  recovery jsonb not null default '{}'::jsonb,
  handover jsonb not null default '{}'::jsonb,
  timers jsonb not null default '{}'::jsonb,
  monitor_config jsonb not null default '{}'::jsonb,
  equipment_config jsonb not null default '{}'::jsonb,
  vascular_accesses jsonb not null default '[]'::jsonb,
  incidents jsonb not null default '[]'::jsonb,
  outputs jsonb not null default '[]'::jsonb,
  inhalation_agents jsonb not null default '[]'::jsonb,
  narratives jsonb not null default '[]'::jsonb,
  pending_transfer jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint procedures_signed_fields_chk check (
    (status <> 'signed')
    or (signed_at is not null and content_hash is not null)
  )
);

create index procedures_created_by_idx on public.procedures (created_by);
create index procedures_responsible_id_idx on public.procedures (responsible_id);
create index procedures_status_idx on public.procedures (status);
create index procedures_updated_at_idx on public.procedures (updated_at desc);

create trigger procedures_set_updated_at
  before update on public.procedures
  for each row execute function private.set_updated_at();

create or replace function private.protect_procedure_immutability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.created_by is distinct from old.created_by then
      raise exception 'created_by_immutable' using errcode = '42501';
    end if;
    if old.status = 'signed' then
      raise exception 'signed_procedure_immutable' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' and old.status = 'signed' then
    raise exception 'signed_procedure_immutable' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger procedures_protect_immutability
  before update or delete on public.procedures
  for each row execute function private.protect_procedure_immutability();

-- ---------------------------------------------------------------------------
-- participants
-- ---------------------------------------------------------------------------

create table public.procedure_participants (
  procedure_id uuid not null references public.procedures (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('creator', 'responsible', 'collaborator')),
  created_at timestamptz not null default now(),
  primary key (procedure_id, user_id)
);

create index procedure_participants_user_id_idx on public.procedure_participants (user_id);

create or replace function private.sync_procedure_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.procedure_participants (procedure_id, user_id, role)
  values (new.id, new.created_by, case
    when new.created_by = new.responsible_id then 'responsible'
    else 'creator'
  end)
  on conflict (procedure_id, user_id) do update
    set role = excluded.role;

  if new.responsible_id is distinct from new.created_by then
    insert into public.procedure_participants (procedure_id, user_id, role)
    values (new.id, new.responsible_id, 'responsible')
    on conflict (procedure_id, user_id) do update
      set role = 'responsible';
  end if;

  return new;
end;
$$;

create trigger procedures_sync_participants
  after insert on public.procedures
  for each row execute function private.sync_procedure_participants();

-- ---------------------------------------------------------------------------
-- Clinical event tables (high-write)
-- ---------------------------------------------------------------------------

create table public.procedure_vitals (
  id uuid primary key default gen_random_uuid(),
  procedure_id uuid not null references public.procedures (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  clinical_at timestamptz not null,
  minutes_from_start integer,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.procedure_medications (
  id uuid primary key default gen_random_uuid(),
  procedure_id uuid not null references public.procedures (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  clinical_at timestamptz not null,
  minutes_from_start integer,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.procedure_fluids (
  id uuid primary key default gen_random_uuid(),
  procedure_id uuid not null references public.procedures (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  clinical_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.procedure_infusions (
  id uuid primary key default gen_random_uuid(),
  procedure_id uuid not null references public.procedures (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  clinical_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.procedure_events (
  id uuid primary key default gen_random_uuid(),
  procedure_id uuid not null references public.procedures (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  clinical_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.procedure_transfers (
  id uuid primary key default gen_random_uuid(),
  procedure_id uuid not null references public.procedures (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  outgoing_user_id uuid references auth.users (id),
  incoming_user_id uuid not null references auth.users (id),
  clinical_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.procedure_amendments (
  id uuid primary key default gen_random_uuid(),
  procedure_id uuid not null references public.procedures (id) on delete restrict,
  created_by uuid not null references auth.users (id),
  body text not null,
  reason text not null,
  hash text not null,
  doc_hash_ref text,
  author_name text not null default '',
  author_crm text not null default '',
  author_uf text not null default '',
  created_at timestamptz not null default now()
);

create index procedure_vitals_procedure_clinical_idx
  on public.procedure_vitals (procedure_id, clinical_at);
create index procedure_medications_procedure_clinical_idx
  on public.procedure_medications (procedure_id, clinical_at);
create index procedure_fluids_procedure_clinical_idx
  on public.procedure_fluids (procedure_id, clinical_at);
create index procedure_infusions_procedure_clinical_idx
  on public.procedure_infusions (procedure_id, clinical_at);
create index procedure_events_procedure_clinical_idx
  on public.procedure_events (procedure_id, clinical_at);
create index procedure_transfers_procedure_clinical_idx
  on public.procedure_transfers (procedure_id, clinical_at);
create index procedure_amendments_procedure_created_idx
  on public.procedure_amendments (procedure_id, created_at);

create trigger procedure_vitals_set_updated_at
  before update on public.procedure_vitals
  for each row execute function private.set_updated_at();
create trigger procedure_medications_set_updated_at
  before update on public.procedure_medications
  for each row execute function private.set_updated_at();
create trigger procedure_fluids_set_updated_at
  before update on public.procedure_fluids
  for each row execute function private.set_updated_at();
create trigger procedure_infusions_set_updated_at
  before update on public.procedure_infusions
  for each row execute function private.set_updated_at();
create trigger procedure_events_set_updated_at
  before update on public.procedure_events
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- worklist (v1: only creator)
-- ---------------------------------------------------------------------------

create table public.worklist_entries (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id),
  cpf_hash text not null,
  patient jsonb not null default '{}'::jsonb,
  pre_evaluation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint worklist_cpf_hash_sha256 check (cpf_hash ~ '^[0-9a-f]{64}$')
);

create unique index worklist_entries_owner_cpf_idx
  on public.worklist_entries (created_by, cpf_hash);

create trigger worklist_entries_set_updated_at
  before update on public.worklist_entries
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- audit (no clinical payload)
-- ---------------------------------------------------------------------------

create table private.audit_events (
  id uuid primary key default gen_random_uuid(),
  procedure_id uuid references public.procedures (id) on delete set null,
  actor_id uuid,
  action text not null,
  created_at timestamptz not null default now()
);

create index audit_events_procedure_idx on private.audit_events (procedure_id, created_at desc);

alter table private.audit_events enable row level security;
alter table private.audit_events force row level security;
revoke all on table private.audit_events from public, anon, authenticated;
