-- Fase 6: token de concorrência da linha em procedures.
-- O servidor incrementa em todo UPDATE; o cliente não manda o valor.

alter table public.procedures
  add column if not exists revision integer not null default 1;

alter table public.procedures
  drop constraint if exists procedures_revision_positive_chk;

alter table public.procedures
  add constraint procedures_revision_positive_chk check (revision >= 1);

comment on column public.procedures.revision is
  'Token de concorrência otimista. Incrementado só no servidor a cada UPDATE da linha.';

create or replace function private.bump_procedure_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.revision := coalesce(old.revision, 1) + 1;
  return new;
end;
$$;

drop trigger if exists procedures_bump_revision on public.procedures;

create trigger procedures_bump_revision
  before update on public.procedures
  for each row execute function private.bump_procedure_revision();
