-- Google OAuth may send the display name as `name` instead of `full_name`.
-- Professional fields (CRM, UF, hospital) stay empty until Complete Profile.
-- Do not persist provider profile photos; AnestFlow does not store avatars.

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
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
