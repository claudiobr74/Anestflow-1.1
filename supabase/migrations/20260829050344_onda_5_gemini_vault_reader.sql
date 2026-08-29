-- Onda 5: leitura da GEMINI_API_KEY no Vault (sem gravar o valor neste arquivo).
-- O secret em si é inserido no projeto hospedado, não no git.
-- Preferir também `supabase secrets set GEMINI_API_KEY=...` quando houver token CLI.

create or replace function private.read_gemini_api_key()
returns text
language sql
stable
security definer
set search_path = vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'GEMINI_API_KEY'
  limit 1;
$$;

revoke all on function private.read_gemini_api_key() from public, anon, authenticated;
grant execute on function private.read_gemini_api_key() to service_role;
grant usage on schema private to service_role;

-- Wrapper INVOKER no schema exposto, só para o service_role das Edge Functions.
create or replace function public.read_gemini_api_key()
returns text
language sql
stable
security invoker
set search_path = private
as $$
  select private.read_gemini_api_key();
$$;

revoke all on function public.read_gemini_api_key() from public, anon, authenticated;
grant execute on function public.read_gemini_api_key() to service_role;
