-- Users, memberships, procedures pagination, ops, AI, settings, finance.

create or replace function private.admin_display_user_status(
  p_account text,
  p_crm text,
  p_name text,
  p_confirmed timestamptz
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_account in ('inactive', 'suspended') then p_account
    when p_confirmed is null then 'convite_pendente'
    when coalesce(trim(p_crm), '') = '' or coalesce(trim(p_name), '') = '' then 'perfil_incompleto'
    else 'active'
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
  uid uuid := private.assert_admin_reader();
  scope uuid[] := private.admin_visible_org_ids();
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
        pr.account_status,
        u.last_sign_in_at,
        u.email_confirmed_at,
        private.admin_display_user_status(pr.account_status, pr.crm, pr.full_name, u.email_confirmed_at) as status,
        exists (select 1 from public.platform_admins a where a.user_id = pr.id) as is_platform_admin,
        exists (
          select 1 from public.organization_members m
          where m.user_id = pr.id and m.role = 'admin'
        ) as is_clinic_admin,
        coalesce((
          select o.name
          from public.organization_members m
          join public.organizations o on o.id = m.organization_id
          where m.user_id = pr.id
          order by m.created_at
          limit 1
        ), nullif(pr.hospital, '')) as organization_name,
        (
          select i.provider from auth.identities i
          where i.user_id = pr.id
          order by i.created_at desc limit 1
        ) as login_provider
      from public.profiles pr
      join auth.users u on u.id = pr.id
      where scope is null or exists (
        select 1 from public.organization_members m
        where m.user_id = pr.id and m.organization_id = any (scope)
      )
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function private.admin_get_user(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_admin_reader();
  scope uuid[] := private.admin_visible_org_ids();
  row jsonb;
begin
  perform uid;
  if scope is not null and not exists (
    select 1 from public.organization_members m
    where m.user_id = p_id and m.organization_id = any (scope)
  ) then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  select x from (
    select jsonb_build_object(
      'id', pr.id,
      'full_name', pr.full_name,
      'email', pr.email,
      'crm', pr.crm,
      'uf', pr.uf,
      'hospital', pr.hospital,
      'created_at', pr.created_at,
      'account_status', pr.account_status,
      'last_sign_in_at', u.last_sign_in_at,
      'email_confirmed_at', u.email_confirmed_at,
      'status', private.admin_display_user_status(pr.account_status, pr.crm, pr.full_name, u.email_confirmed_at),
      'is_platform_admin', exists (select 1 from public.platform_admins a where a.user_id = pr.id),
      'is_clinic_admin', exists (select 1 from public.organization_members m where m.user_id = pr.id and m.role = 'admin'),
      'login_provider', (
        select i.provider from auth.identities i
        where i.user_id = pr.id order by i.created_at desc limit 1
      ),
      'organization_name', coalesce((
        select o.name from public.organization_members m
        join public.organizations o on o.id = m.organization_id
        where m.user_id = pr.id order by m.created_at limit 1
      ), nullif(pr.hospital, '')),
      'memberships', coalesce((
        select jsonb_agg(jsonb_build_object(
          'organization_id', o.id, 'name', o.name, 'role', m.role
        ))
        from public.organization_members m
        join public.organizations o on o.id = m.organization_id
        where m.user_id = pr.id
      ), '[]'::jsonb),
      'recent_activity', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', e.id, 'created_at', e.created_at, 'action', e.action,
          'label', private.admin_audit_label(e.action)
        ) order by e.created_at desc)
        from (
          select * from private.audit_events e
          where e.actor_id = pr.id
          order by e.created_at desc limit 12
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

create or replace function public.admin_set_user_status(p_user_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_super_admin();
  st text := lower(trim(p_status));
begin
  if st not in ('active', 'inactive', 'suspended') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if exists (select 1 from public.platform_admins a where a.user_id = p_user_id) then
    raise exception 'cannot_change_super_admin' using errcode = '42501';
  end if;
  update public.profiles set account_status = st, updated_at = now() where id = p_user_id;
  if not found then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  perform private.admin_audit(
    uid,
    case st when 'active' then 'USER_ACTIVATED' else 'USER_DEACTIVATED' end,
    'user', p_user_id::text, null,
    jsonb_build_object('new_status', st)
  );
  return private.admin_get_user(p_user_id);
end;
$$;

create or replace function public.admin_add_membership(p_user_id uuid, p_organization_id uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_super_admin();
  role text := coalesce(nullif(trim(p_role), ''), 'anestesista');
begin
  if role not in ('coordenador', 'anestesista', 'residente', 'admin') then
    role := 'anestesista';
  end if;
  if not private.admin_can_access_org(p_organization_id) then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  insert into public.organization_members (organization_id, user_id, role)
  values (p_organization_id, p_user_id, role)
  on conflict (organization_id, user_id) do update set role = excluded.role;
  perform private.admin_audit(
    uid,
    case when role = 'admin' then 'CLINIC_ADMIN_GRANTED' else 'MEMBER_ADDED' end,
    'membership', p_user_id::text, p_organization_id,
    jsonb_build_object('role', role)
  );
  return private.admin_get_user(p_user_id);
end;
$$;

create or replace function public.admin_remove_membership(p_user_id uuid, p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_super_admin();
  old_role text;
begin
  select role into old_role
  from public.organization_members
  where user_id = p_user_id and organization_id = p_organization_id;
  delete from public.organization_members
  where user_id = p_user_id and organization_id = p_organization_id;
  perform private.admin_audit(
    uid,
    case when old_role = 'admin' then 'CLINIC_ADMIN_REVOKED' else 'MEMBER_REMOVED' end,
    'membership', p_user_id::text, p_organization_id,
    jsonb_build_object('old_role', old_role)
  );
  return private.admin_get_user(p_user_id);
end;
$$;

create or replace function public.admin_set_membership_role(p_user_id uuid, p_organization_id uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_super_admin();
  v_role text := trim(p_role);
  old_role text;
begin
  if v_role not in ('coordenador', 'anestesista', 'residente', 'admin') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  select m.role into old_role
  from public.organization_members m
  where m.user_id = p_user_id and m.organization_id = p_organization_id;
  if old_role is null then
    raise exception 'membership_not_found' using errcode = 'P0002';
  end if;
  update public.organization_members
  set role = v_role
  where user_id = p_user_id and organization_id = p_organization_id;
  perform private.admin_audit(
    uid,
    case
      when v_role = 'admin' and old_role is distinct from 'admin' then 'CLINIC_ADMIN_GRANTED'
      when old_role = 'admin' and v_role is distinct from 'admin' then 'CLINIC_ADMIN_REVOKED'
      else 'MEMBER_ROLE_CHANGED'
    end,
    'membership', p_user_id::text, p_organization_id,
    jsonb_build_object('old_role', old_role, 'new_role', v_role)
  );
  return private.admin_get_user(p_user_id);
end;
$$;

create or replace function private.admin_list_procedures_meta(p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_admin_reader();
  scope uuid[] := private.admin_visible_org_ids();
  lim integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  perform uid;
  return coalesce((
    select jsonb_agg(x.item)
    from (
      select jsonb_build_object(
        'id', p.id,
        'status', p.status,
        'revision', p.revision,
        'created_at', p.created_at,
        'updated_at', p.updated_at,
        'signed_at', p.signed_at,
        'has_hash', (p.content_hash is not null and p.status = 'signed'),
        'organization_id', p.organization_id,
        'responsible_name', pr.full_name,
        'responsible_crm', pr.crm,
        'responsible_uf', pr.uf,
        'hospital', coalesce(o.name, nullif(p.patient->>'hospital', '')),
        'duration_anes_min', round((extract(epoch from (
          private.admin_try_tstz(p.timers->>'endAnesthesia')
          - private.admin_try_tstz(p.timers->>'startAnesthesia')
        )) / 60.0)::numeric, 0),
        'used_voice', (jsonb_typeof(p.voice_transcripts) = 'array' and jsonb_array_length(p.voice_transcripts) > 0),
        'has_incident', (jsonb_typeof(p.incidents) = 'array' and jsonb_array_length(p.incidents) > 0),
        'integrity', private.verify_procedure_integrity_core(p.id)
      ) as item
      from public.procedures p
      left join public.profiles pr on pr.id = p.responsible_id
      left join public.organizations o on o.id = p.organization_id
      where scope is null or p.organization_id = any (scope)
      order by p.created_at desc
      limit lim
    ) x
  ), '[]'::jsonb);
end;
$$;

-- NOTE: admin_integrity_status is called 3x per row above — replace with a page RPC.

create or replace function public.admin_list_procedures_page(
  p_page integer default 1,
  p_page_size integer default 10,
  p_search text default null,
  p_status text default null,
  p_organization_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_admin_reader();
  scope uuid[] := private.admin_visible_org_ids();
  page integer := greatest(coalesce(p_page, 1), 1);
  page_size integer := least(greatest(coalesce(p_page_size, 10), 1), 50);
  total integer;
begin
  perform uid;
  if p_organization_id is not null and not private.admin_can_access_org(p_organization_id) then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;

  select count(*)::int into total
  from public.procedures p
  left join public.profiles pr on pr.id = p.responsible_id
  left join public.organizations o on o.id = p.organization_id
  where (scope is null or p.organization_id = any (scope))
    and (p_organization_id is null or p.organization_id = p_organization_id)
    and (p_status is null or p_status = 'all' or p.status = p_status)
    and (
      p_search is null or length(trim(p_search)) = 0
      or p.id::text ilike '%' || trim(p_search) || '%'
      or coalesce(pr.full_name, '') ilike '%' || trim(p_search) || '%'
      or coalesce(o.name, p.patient->>'hospital', '') ilike '%' || trim(p_search) || '%'
    );

  return jsonb_build_object(
    'total_count', total,
    'page', page,
    'page_size', page_size,
    'items', coalesce((
      select jsonb_agg(item)
      from (
        select jsonb_build_object(
          'id', p.id,
          'status', p.status,
          'revision', p.revision,
          'created_at', p.created_at,
          'updated_at', p.updated_at,
          'signed_at', p.signed_at,
          'has_hash', (p.content_hash is not null and p.status = 'signed'),
          'organization_id', p.organization_id,
          'responsible_name', pr.full_name,
          'responsible_crm', pr.crm,
          'responsible_uf', pr.uf,
          'hospital', coalesce(o.name, nullif(p.patient->>'hospital', '')),
          'duration_anes_min', round((extract(epoch from (
            private.admin_try_tstz(p.timers->>'endAnesthesia')
            - private.admin_try_tstz(p.timers->>'startAnesthesia')
          )) / 60.0)::numeric, 0),
          'used_voice', (jsonb_typeof(p.voice_transcripts) = 'array' and jsonb_array_length(p.voice_transcripts) > 0),
          'has_incident', (jsonb_typeof(p.incidents) = 'array' and jsonb_array_length(p.incidents) > 0),
          'integrity', private.admin_integrity_status(p.id)
        ) as item
        from public.procedures p
        left join public.profiles pr on pr.id = p.responsible_id
        left join public.organizations o on o.id = p.organization_id
        where (scope is null or p.organization_id = any (scope))
          and (p_organization_id is null or p.organization_id = p_organization_id)
          and (p_status is null or p_status = 'all' or p.status = p_status)
          and (
            p_search is null or length(trim(p_search)) = 0
            or p.id::text ilike '%' || trim(p_search) || '%'
            or coalesce(pr.full_name, '') ilike '%' || trim(p_search) || '%'
            or coalesce(o.name, p.patient->>'hospital', '') ilike '%' || trim(p_search) || '%'
          )
        order by p.created_at desc
        offset (page - 1) * page_size
        limit page_size
      ) q
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_list_users_page(
  p_page integer default 1,
  p_page_size integer default 10,
  p_search text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_admin_reader();
  items jsonb := private.admin_list_users();
  page integer := greatest(coalesce(p_page, 1), 1);
  page_size integer := least(greatest(coalesce(p_page_size, 10), 1), 50);
  filtered jsonb;
begin
  perform uid;
  filtered := coalesce((
    select jsonb_agg(el)
    from jsonb_array_elements(items) el
    where p_search is null or length(trim(p_search)) = 0
      or el->>'full_name' ilike '%' || trim(p_search) || '%'
      or el->>'email' ilike '%' || trim(p_search) || '%'
      or el->>'crm' ilike '%' || trim(p_search) || '%'
  ), '[]'::jsonb);
  return jsonb_build_object(
    'total_count', jsonb_array_length(filtered),
    'page', page,
    'page_size', page_size,
    'items', coalesce((
      select jsonb_agg(el)
      from (
        select el
        from jsonb_array_elements(filtered) el
        offset (page - 1) * page_size
        limit page_size
      ) q
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_list_organizations_page(
  p_page integer default 1,
  p_page_size integer default 10,
  p_search text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.assert_admin_reader();
  items jsonb := private.admin_list_organizations();
  page integer := greatest(coalesce(p_page, 1), 1);
  page_size integer := least(greatest(coalesce(p_page_size, 10), 1), 50);
  filtered jsonb;
begin
  perform uid;
  filtered := coalesce((
    select jsonb_agg(el)
    from jsonb_array_elements(items) el
    where p_search is null or length(trim(p_search)) = 0
      or el->>'name' ilike '%' || trim(p_search) || '%'
  ), '[]'::jsonb);
  return jsonb_build_object(
    'total_count', jsonb_array_length(filtered),
    'page', page,
    'page_size', page_size,
    'items', coalesce((
      select jsonb_agg(el)
      from (
        select el from jsonb_array_elements(filtered) el
        offset (page - 1) * page_size
        limit page_size
      ) q
    ), '[]'::jsonb)
  );
end;
$$;
