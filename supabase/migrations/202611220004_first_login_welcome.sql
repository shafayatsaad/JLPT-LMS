-- Show an in-app welcome message exactly once for each provisioned account.
begin;

alter table public.profiles
  add column if not exists welcome_seen_at timestamptz;

create or replace function public.claim_welcome_message()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  update public.profiles
  set welcome_seen_at = now()
  where user_id = (select auth.uid())
    and welcome_seen_at is null;

  return found;
end;
$$;

revoke all on function public.claim_welcome_message() from public, anon;
grant execute on function public.claim_welcome_message() to authenticated;

commit;
