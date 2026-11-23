-- Store the student's English/Bangla interface preference on the profile.
-- Apply after migrations 001 through 011.

begin;

alter table public.profiles
  add column if not exists ui_language text not null default 'en'
    check (ui_language in ('en', 'bn'));

grant update (ui_language, updated_at) on public.profiles to authenticated;

-- Preserve the chosen interface language for accounts created through email or Google.
create or replace function private.provision_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_level public.jlpt_level;
  requested_ui_language text;
begin
  requested_level := case upper(coalesce(new.raw_user_meta_data ->> 'target_level', ''))
    when 'N1' then 'N1'::public.jlpt_level
    when 'N2' then 'N2'::public.jlpt_level
    when 'N3' then 'N3'::public.jlpt_level
    when 'N4' then 'N4'::public.jlpt_level
    when 'N5' then 'N5'::public.jlpt_level
    else null
  end;
  requested_ui_language := case lower(coalesce(new.raw_user_meta_data ->> 'ui_language', 'en'))
    when 'bn' then 'bn'
    else 'en'
  end;

  insert into public.profiles (
    user_id, display_name, target_level, explanation_language, ui_language
  )
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    requested_level,
    'en',
    requested_ui_language
  )
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'student'::public.app_role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

revoke all on function private.provision_auth_user() from public, anon, authenticated;

comment on column public.profiles.ui_language is
  'Preferred student interface language. Published Japanese questions and answer choices remain unchanged.';

commit;
