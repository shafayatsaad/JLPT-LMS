-- Gate unrecognized user sessions at the Data API role boundary until they
-- complete TOTP. Remembered devices are explicitly approved after AAL2 and
-- expire after 30 days. No IP address alone is used as an identity signal.

create table if not exists private.auth_trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz
);

create index if not exists auth_trusted_devices_user_expiry_idx
  on private.auth_trusted_devices (user_id, expires_at desc);

create table if not exists private.auth_trusted_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references private.auth_trusted_devices(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists auth_trusted_sessions_user_expiry_idx
  on private.auth_trusted_sessions (user_id, expires_at desc);

revoke all on private.auth_trusted_devices from public, anon, authenticated, service_role;
revoke all on private.auth_trusted_sessions from public, anon, authenticated, service_role;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  claims jsonb := event -> 'claims';
  actor_id uuid := nullif(event ->> 'user_id', '')::uuid;
  current_session_id uuid := nullif(claims ->> 'session_id', '')::uuid;
  has_verified_totp boolean := false;
  session_is_trusted boolean := false;
begin
  if actor_id is null or claims is null then
    raise exception 'Access-token hook received an incomplete event';
  end if;

  select exists (
    select 1 from auth.mfa_factors factor
    where factor.user_id = actor_id
      and factor.factor_type = 'totp'
      and factor.status = 'verified'
  ) into has_verified_totp;

  if current_session_id is not null then
    select exists (
      select 1
      from private.auth_trusted_sessions trusted
      where trusted.user_id = actor_id
        and trusted.session_id = current_session_id
        and trusted.expires_at > now()
    ) into session_is_trusted;
  end if;

  if not has_verified_totp then
    claims := jsonb_set(claims, '{role}', to_jsonb('authenticated'::text), true);
    claims := jsonb_set(claims, '{jlpt_step_up_required}', 'false'::jsonb, true);
  elsif coalesce(claims ->> 'aal', 'aal1') = 'aal2' or session_is_trusted then
    claims := jsonb_set(claims, '{role}', to_jsonb('authenticated'::text), true);
    claims := jsonb_set(claims, '{jlpt_step_up_required}', 'false'::jsonb, true);
  else
    -- A valid Supabase user session remains available to Auth MFA endpoints,
    -- while PostgREST/Storage/Realtime operate as anon until step-up passes.
    claims := jsonb_set(claims, '{role}', to_jsonb('anon'::text), true);
    claims := jsonb_set(claims, '{jlpt_step_up_required}', 'true'::jsonb, true);
  end if;

  return jsonb_build_object('claims', claims);
end;
$$;

revoke all on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant usage on schema private to supabase_auth_admin;
grant usage on schema auth to supabase_auth_admin;
grant select on private.auth_trusted_sessions to supabase_auth_admin;
grant select on auth.mfa_factors to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

create or replace function public.authorize_trusted_device_session(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_session_id uuid := nullif((select auth.jwt()) ->> 'session_id', '')::uuid;
  trusted_device private.auth_trusted_devices%rowtype;
begin
  if actor_id is null or current_session_id is null then return false; end if;
  if coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal1' then return false; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return false; end if;

  select * into trusted_device
  from private.auth_trusted_devices d
  where d.user_id = actor_id
    and d.token_hash = p_token_hash
    and d.expires_at > now()
  for update;
  if not found then return false; end if;

  update private.auth_trusted_devices
  set last_used_at = now()
  where id = trusted_device.id;

  insert into private.auth_trusted_sessions (session_id, user_id, device_id, expires_at)
  values (current_session_id, actor_id, trusted_device.id, trusted_device.expires_at)
  on conflict (session_id) do update
    set device_id = excluded.device_id,
        expires_at = excluded.expires_at
    where private.auth_trusted_sessions.user_id = excluded.user_id;

  return exists (
    select 1 from private.auth_trusted_sessions s
    where s.session_id = current_session_id and s.user_id = actor_id
      and s.device_id = trusted_device.id and s.expires_at > now()
  );
end;
$$;

create or replace function public.register_trusted_device(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_session_id uuid := nullif((select auth.jwt()) ->> 'session_id', '')::uuid;
  device_id uuid;
  device_expiry timestamptz := now() + interval '30 days';
begin
  if actor_id is null or current_session_id is null then raise exception 'Sign in before trusting a device'; end if;
  if coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal2' then raise exception 'Verify an authenticator code before trusting a device'; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Trusted-device token is invalid'; end if;

  delete from private.auth_trusted_devices where user_id = actor_id and expires_at <= now();

  insert into private.auth_trusted_devices (user_id, token_hash, expires_at)
  values (actor_id, p_token_hash, device_expiry)
  returning id into device_id;

  insert into private.auth_trusted_sessions (session_id, user_id, device_id, expires_at)
  values (current_session_id, actor_id, device_id, device_expiry)
  on conflict (session_id) do update
    set device_id = excluded.device_id,
        expires_at = excluded.expires_at
    where private.auth_trusted_sessions.user_id = excluded.user_id;

  return true;
end;
$$;

create or replace function public.revoke_trusted_devices()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  removed_count integer;
begin
  if actor_id is null then raise exception 'Sign in before removing remembered devices'; end if;
  if coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal2' then raise exception 'Verify an authenticator code before removing remembered devices'; end if;

  delete from private.auth_trusted_devices where user_id = actor_id;
  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;

create or replace function public.is_current_user_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = (select auth.uid())
      and r.role in ('admin', 'content_editor', 'reviewer', 'payment_reviewer', 'support_agent')
  );
$$;

revoke all on function public.authorize_trusted_device_session(text) from public;
revoke all on function public.register_trusted_device(text) from public;
revoke all on function public.revoke_trusted_devices() from public;
revoke all on function public.is_current_user_staff() from public;
grant execute on function public.authorize_trusted_device_session(text) to anon, authenticated;
grant execute on function public.register_trusted_device(text) to authenticated;
grant execute on function public.revoke_trusted_devices() to authenticated;
grant execute on function public.is_current_user_staff() to anon, authenticated;
