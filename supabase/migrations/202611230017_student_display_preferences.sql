-- Add per-account time-zone and reduced-motion preferences.
-- Apply after migrations 001 through 016.

begin;

alter table public.profiles
  add column if not exists preferred_timezone text not null default 'Asia/Dhaka'
    check (length(preferred_timezone) between 1 and 64 and preferred_timezone = trim(preferred_timezone)),
  add column if not exists reduced_motion boolean not null default false;

grant update (preferred_timezone, reduced_motion, updated_at) on public.profiles to authenticated;

create or replace function private.validate_profile_timezone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from pg_catalog.pg_timezone_names zone
    where zone.name = new.preferred_timezone
  ) then
    raise exception 'Choose a supported IANA time zone';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_profile_timezone() from public, anon, authenticated;
drop trigger if exists profiles_validate_timezone on public.profiles;
create trigger profiles_validate_timezone
  before insert or update of preferred_timezone on public.profiles
  for each row execute function private.validate_profile_timezone();

comment on column public.profiles.preferred_timezone is
  'IANA time zone used for learner-facing dates and date filters.';
comment on column public.profiles.reduced_motion is
  'Learner preference to minimize app motion in addition to the operating-system preference.';

commit;
