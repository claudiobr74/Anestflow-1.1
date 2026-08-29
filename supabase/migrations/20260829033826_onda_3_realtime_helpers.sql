-- Onda 3: replica identity FULL para postgres_changes com RLS.

alter table public.procedures replica identity full;
alter table public.procedure_participants replica identity full;
alter table public.procedure_vitals replica identity full;
alter table public.procedure_medications replica identity full;
alter table public.procedure_fluids replica identity full;
alter table public.procedure_infusions replica identity full;
alter table public.procedure_events replica identity full;
alter table public.procedure_transfers replica identity full;
alter table public.procedure_amendments replica identity full;
