-- Live: save_atomic falhava com "function min(uuid) does not exist".
-- Postgres não agrega uuid com min(); resolve membership única sem min().

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
  select count(*)::int
  into v_count
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = p_uid
    and o.status is distinct from 'archived';
  if v_count = 1 then
    select m.organization_id
    into v_org
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.user_id = p_uid
      and o.status is distinct from 'archived';
    return v_org;
  end if;

  if p_hospital is null or length(trim(p_hospital)) = 0 then
    return null;
  end if;

  select count(*)::int
  into v_count
  from public.organizations o
  where private.normalize_org_name(o.name) = private.normalize_org_name(p_hospital)
    and o.status is distinct from 'archived';
  if v_count = 1 then
    select o.id
    into v_org
    from public.organizations o
    where private.normalize_org_name(o.name) = private.normalize_org_name(p_hospital)
      and o.status is distinct from 'archived';
    return v_org;
  end if;
  return null;
end;
$$;
