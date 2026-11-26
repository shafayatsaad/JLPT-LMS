-- Additive setup for the shared remote demo admin. This does not reset local data.
-- Never run against hosted Supabase.

update auth.users
set encrypted_password = crypt('admin123', gen_salt('bf')),
    updated_at = now()
where email = 'admin@n5.test';

insert into auth.users (
  instance_id, id, aud, role, email, phone, phone_confirmed_at,
  encrypted_password, email_confirmed_at, confirmation_token, recovery_token,
  email_change_token_new, email_change, phone_change, phone_change_token,
  email_change_token_current, reauthentication_token,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '30000000-0000-4000-8000-000000000005',
  'authenticated', 'authenticated', 'public-admin@n5.test', '+15550000006', now(),
  crypt('admin123', gen_salt('bf')), now(), '', '', '', '', '', '', '', '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Shared Demo Administrator","target_level":"N5","ui_language":"en","phone_number":"+15550000006"}'::jsonb,
  now(), now()
)
on conflict (id) do update set
  email = excluded.email,
  phone = excluded.phone,
  phone_confirmed_at = excluded.phone_confirmed_at,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
values (
  '30000000-0000-4000-8000-000000000005',
  '30000000-0000-4000-8000-000000000005',
  '{"sub":"30000000-0000-4000-8000-000000000005","email":"public-admin@n5.test","email_verified":true,"phone_verified":true}'::jsonb,
  'email', 'public-admin@n5.test', now(), now(), now()
)
on conflict (provider_id, provider) do update set
  identity_data = excluded.identity_data,
  updated_at = now();

insert into public.profiles (user_id, display_name, target_level, explanation_language, ui_language)
values ('30000000-0000-4000-8000-000000000005', 'Shared Demo Administrator', 'N5', 'en', 'en')
on conflict (user_id) do update set
  display_name = excluded.display_name,
  target_level = excluded.target_level,
  explanation_language = excluded.explanation_language,
  ui_language = excluded.ui_language,
  updated_at = now();

insert into public.user_roles (user_id, role)
values
  ('30000000-0000-4000-8000-000000000005', 'student'),
  ('30000000-0000-4000-8000-000000000005', 'admin')
on conflict (user_id, role) do nothing;

-- Local-only exception for this fake account so the public demo can exercise
-- staff workflows without sharing a real authenticator factor. The exception
-- is applied only by this Docker launcher, never by a hosted migration.
create or replace function private.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = required_role
      and (
        ur.role = 'student'::public.app_role
        or coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
        or (select auth.uid()) = '30000000-0000-4000-8000-000000000005'::uuid
      )
  );
$$;

create or replace function private.has_any_role(required_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = any(required_roles)
      and (
        ur.role = 'student'::public.app_role
        or coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
        or (select auth.uid()) = '30000000-0000-4000-8000-000000000005'::uuid
      )
  );
$$;
