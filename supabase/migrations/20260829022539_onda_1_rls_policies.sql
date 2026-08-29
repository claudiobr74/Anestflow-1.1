-- Onda 1 (cont.): helpers RLS, policies, grants e view.

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------

create or replace function private.is_procedure_participant(_procedure_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.procedure_participants p
    where p.procedure_id = _procedure_id
      and p.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.procedures proc
    where proc.id = _procedure_id
      and (
        proc.created_by = (select auth.uid())
        or proc.responsible_id = (select auth.uid())
      )
  );
$$;

create or replace function private.is_procedure_responsible(_procedure_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.procedures proc
    where proc.id = _procedure_id
      and proc.responsible_id = (select auth.uid())
  );
$$;

create or replace function private.is_procedure_open(_procedure_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.procedures proc
    where proc.id = _procedure_id
      and proc.status is distinct from 'signed'
  );
$$;

grant execute on function private.is_email_confirmed() to authenticated;
grant execute on function private.is_procedure_participant(uuid) to authenticated;
grant execute on function private.is_procedure_responsible(uuid) to authenticated;
grant execute on function private.is_procedure_open(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.procedures enable row level security;
alter table public.procedure_participants enable row level security;
alter table public.procedure_vitals enable row level security;
alter table public.procedure_medications enable row level security;
alter table public.procedure_fluids enable row level security;
alter table public.procedure_infusions enable row level security;
alter table public.procedure_events enable row level security;
alter table public.procedure_transfers enable row level security;
alter table public.procedure_amendments enable row level security;
alter table public.worklist_entries enable row level security;

alter table public.profiles force row level security;
alter table public.procedures force row level security;
alter table public.procedure_participants force row level security;
alter table public.procedure_vitals force row level security;
alter table public.procedure_medications force row level security;
alter table public.procedure_fluids force row level security;
alter table public.procedure_infusions force row level security;
alter table public.procedure_events force row level security;
alter table public.procedure_transfers force row level security;
alter table public.procedure_amendments force row level security;
alter table public.worklist_entries force row level security;

-- profiles: never list all doctors
create policy profiles_select_own
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_insert_own
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_own
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- procedures
create policy procedures_select_participant
  on public.procedures for select to authenticated
  using (
    (select private.is_email_confirmed())
    and (select private.is_procedure_participant(id))
  );

create policy procedures_insert_own
  on public.procedures for insert to authenticated
  with check (
    (select private.is_email_confirmed())
    and created_by = (select auth.uid())
    and responsible_id = (select auth.uid())
  );

-- Cliente não assina nem troca responsible_id por UPDATE direto (RPCs DEFINER fazem isso).
-- WITH CHECK recusa status=signed para o papel authenticated; created_by é imutável no trigger.
create policy procedures_update_responsible_open
  on public.procedures for update to authenticated
  using (
    (select private.is_email_confirmed())
    and (select private.is_procedure_responsible(id))
    and status is distinct from 'signed'
  )
  with check (
    (select private.is_email_confirmed())
    and status is distinct from 'signed'
    and responsible_id = (select auth.uid())
  );

create policy procedures_delete_creator_draft
  on public.procedures for delete to authenticated
  using (
    (select private.is_email_confirmed())
    and created_by = (select auth.uid())
    and status = 'draft'
  );

-- participants: readable if on the chart; writes via RPC/trigger
create policy procedure_participants_select
  on public.procedure_participants for select to authenticated
  using (
    (select private.is_email_confirmed())
    and (select private.is_procedure_participant(procedure_id))
  );

-- child event policies
create policy procedure_vitals_select
  on public.procedure_vitals for select to authenticated
  using (
    (select private.is_email_confirmed())
    and (select private.is_procedure_participant(procedure_id))
  );
create policy procedure_vitals_insert
  on public.procedure_vitals for insert to authenticated
  with check (
    (select private.is_email_confirmed())
    and (select private.is_procedure_responsible(procedure_id))
    and (select private.is_procedure_open(procedure_id))
    and created_by = (select auth.uid())
  );
create policy procedure_vitals_update
  on public.procedure_vitals for update to authenticated
  using (
    (select private.is_email_confirmed())
    and (select private.is_procedure_responsible(procedure_id))
    and (select private.is_procedure_open(procedure_id))
  )
  with check (
    (select private.is_procedure_responsible(procedure_id))
    and (select private.is_procedure_open(procedure_id))
  );
create policy procedure_vitals_delete
  on public.procedure_vitals for delete to authenticated
  using (
    (select private.is_email_confirmed())
    and (select private.is_procedure_responsible(procedure_id))
    and (select private.is_procedure_open(procedure_id))
  );

create policy procedure_medications_select
  on public.procedure_medications for select to authenticated
  using (
    (select private.is_email_confirmed())
    and (select private.is_procedure_participant(procedure_id))
  );
create policy procedure_medications_insert
  on public.procedure_medications for insert to authenticated
  with check (
    (select private.is_email_confirmed())
    and (select private.is_procedure_responsible(procedure_id))
    and (select private.is_procedure_open(procedure_id))
    and created_by = (select auth.uid())
  );
create policy procedure_medications_update
  on public.procedure_medications for update to authenticated
  using (
    (select private.is_email_confirmed())
    and (select private.is_procedure_responsible(procedure_id))
    and (select private.is_procedure_open(procedure_id))
  )
  with check (
    (select private.is_procedure_responsible(procedure_id))
    and (select private.is_procedure_open(procedure_id))
  );
create policy procedure_medications_delete
  on public.procedure_medications for delete to authenticated
  using (
    (select private.is_email_confirmed())
    and (select private.is_procedure_responsible(procedure_id))
    and (select private.is_procedure_open(procedure_id))
  );

create policy procedure_fluids_select
  on public.procedure_fluids for select to authenticated
  using (
    (select private.is_email_confirmed())
    and (select private.is_procedure_participant(procedure_id))
  );
create policy procedure_fluids_insert
  on public.procedure_fluids for insert to authenticated
  with check (
    (select private.is_email_confirmed())
    and (select private.is_procedure_responsible(procedure_id))
    and (select private.is_procedure_open(procedure_id))
    and created_by = (select auth.uid())
  );
create policy procedure_fluids_update
  on public.procedure_fluids for update to authenticated
  using (
    (select private.is_email_confirmed())
    and (select private.is_procedure_responsible(procedure_id))
    and (select private.is_procedure_open(procedure_id))
  )
  with check (
    (select private.is_procedure_responsible(procedure_id))
    and (select private.is_procedure_open(procedure_id))
  );
create policy procedure_fluids_delete
  on public.procedure_fluids for delete to authenticated
  using (
    (select private.is_email_confirmed())
    and (select private.is_procedure_responsible(procedure_id))
    and (select private.is_procedure_open(procedure_id))
  );

create policy procedure_infusions_select
  on public.procedure_infusions for select to authenticated
  using (
    (select private.is_email_confirmed())
    and (select private.is_procedure_participant(procedure_id))
  );
create policy procedure_infusions_insert
  on public.procedure_infusions for insert to authenticated
  with check (
    (select private.is_email_confirmed())
    and (select private.is_procedure_responsible(procedure_id))
    and (select private.is_procedure_open(procedure_id))
    and created_by = (select auth.uid())
  );
create policy procedure_infusions_update
  on public.procedure_infusions for update to authenticated
  using (
    (select private.is_email_confirmed())
    and (select private.is_procedure_responsible(procedure_id))
    and (select private.is_procedure_open(procedure_id))
  )
  with check (
    (select private.is_procedure_responsible(procedure_id))
    and (select private.is_procedure_open(procedure_id))
  );
create policy procedure_infusions_delete
  on public.procedure_infusions for delete to authenticated
  using (
    (select private.is_email_confirmed())
    and (select private.is_procedure_responsible(procedure_id))
    and (select private.is_procedure_open(procedure_id))
  );

create policy procedure_events_select
  on public.procedure_events for select to authenticated
  using (
    (select private.is_email_confirmed())
    and (select private.is_procedure_participant(procedure_id))
  );
create policy procedure_events_insert
  on public.procedure_events for insert to authenticated
  with check (
    (select private.is_email_confirmed())
    and (select private.is_procedure_responsible(procedure_id))
    and (select private.is_procedure_open(procedure_id))
    and created_by = (select auth.uid())
  );
create policy procedure_events_update
  on public.procedure_events for update to authenticated
  using (
    (select private.is_email_confirmed())
    and (select private.is_procedure_responsible(procedure_id))
    and (select private.is_procedure_open(procedure_id))
  )
  with check (
    (select private.is_procedure_responsible(procedure_id))
    and (select private.is_procedure_open(procedure_id))
  );
create policy procedure_events_delete
  on public.procedure_events for delete to authenticated
  using (
    (select private.is_email_confirmed())
    and (select private.is_procedure_responsible(procedure_id))
    and (select private.is_procedure_open(procedure_id))
  );

create policy procedure_transfers_select
  on public.procedure_transfers for select to authenticated
  using (
    (select private.is_email_confirmed())
    and (select private.is_procedure_participant(procedure_id))
  );
create policy procedure_transfers_insert
  on public.procedure_transfers for insert to authenticated
  with check (
    (select private.is_email_confirmed())
    and (select private.is_procedure_responsible(procedure_id))
    and (select private.is_procedure_open(procedure_id))
    and created_by = (select auth.uid())
  );

create policy procedure_amendments_select
  on public.procedure_amendments for select to authenticated
  using (
    (select private.is_email_confirmed())
    and (select private.is_procedure_participant(procedure_id))
  );
create policy procedure_amendments_insert
  on public.procedure_amendments for insert to authenticated
  with check (
    (select private.is_email_confirmed())
    and (select private.is_procedure_participant(procedure_id))
    and not (select private.is_procedure_open(procedure_id))
    and created_by = (select auth.uid())
  );

create policy worklist_select_own
  on public.worklist_entries for select to authenticated
  using (
    (select private.is_email_confirmed())
    and created_by = (select auth.uid())
  );
create policy worklist_insert_own
  on public.worklist_entries for insert to authenticated
  with check (
    (select private.is_email_confirmed())
    and created_by = (select auth.uid())
  );
create policy worklist_update_own
  on public.worklist_entries for update to authenticated
  using (
    (select private.is_email_confirmed())
    and created_by = (select auth.uid())
  )
  with check (
    created_by = (select auth.uid())
  );
create policy worklist_delete_own
  on public.worklist_entries for delete to authenticated
  using (
    (select private.is_email_confirmed())
    and created_by = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Grants (anon has nothing clinical)
-- ---------------------------------------------------------------------------

revoke all on table public.profiles from anon, public;
revoke all on table public.procedures from anon, public;
revoke all on table public.procedure_participants from anon, public;
revoke all on table public.procedure_vitals from anon, public;
revoke all on table public.procedure_medications from anon, public;
revoke all on table public.procedure_fluids from anon, public;
revoke all on table public.procedure_infusions from anon, public;
revoke all on table public.procedure_events from anon, public;
revoke all on table public.procedure_transfers from anon, public;
revoke all on table public.procedure_amendments from anon, public;
revoke all on table public.worklist_entries from anon, public;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.procedures to authenticated;
grant select on table public.procedure_participants to authenticated;
grant select, insert, update, delete on table public.procedure_vitals to authenticated;
grant select, insert, update, delete on table public.procedure_medications to authenticated;
grant select, insert, update, delete on table public.procedure_fluids to authenticated;
grant select, insert, update, delete on table public.procedure_infusions to authenticated;
grant select, insert, update, delete on table public.procedure_events to authenticated;
grant select, insert on table public.procedure_transfers to authenticated;
grant select, insert on table public.procedure_amendments to authenticated;
grant select, insert, update, delete on table public.worklist_entries to authenticated;

-- ---------------------------------------------------------------------------
-- Summary view (invoker → inherits procedures RLS)
-- ---------------------------------------------------------------------------

create view public.procedure_summaries
  with (security_invoker = true)
as
select
  p.id,
  p.created_by,
  p.responsible_id,
  p.status,
  p.created_at,
  p.updated_at,
  p.patient ->> 'fullName' as patient_name,
  p.patient ->> 'recordNumber' as record_number,
  p.patient ->> 'hospital' as hospital
from public.procedures p;

grant select on table public.procedure_summaries to authenticated;
revoke all on table public.procedure_summaries from anon, public;
