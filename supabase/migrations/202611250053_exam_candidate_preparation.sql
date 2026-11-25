begin;

alter table public.exam_attempts
  add column if not exists preparation_required boolean not null default false,
  add column if not exists preparation_started_at timestamptz,
  add column if not exists preparation_deadline_at timestamptz,
  add column if not exists candidate_name text,
  add column if not exists candidate_number text;

create table if not exists public.attempt_media_playbacks (
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  storage_path text not null,
  play_count smallint not null default 1 check (play_count between 1 and 2),
  recovery_used boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (attempt_id, storage_path),
  check (not recovery_used or play_count = 2)
);

alter table public.attempt_media_playbacks enable row level security;
revoke all on table public.attempt_media_playbacks from public, anon, authenticated;

-- New attempts begin at the candidate cover. Pre-existing attempts are kept on
-- their original clocks and are deliberately not converted when resumed.
alter function public.start_exam_attempt(uuid, uuid) rename to start_exam_attempt_before_preparation;
revoke all on function public.start_exam_attempt_before_preparation(uuid, uuid) from public, anon, authenticated;

create or replace function public.start_exam_attempt(p_exam_form_id uuid, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  prior_attempt_id uuid;
  new_attempt_id uuid;
  account_name text;
begin
  if actor_id is null then raise exception 'Sign in before starting an exam'; end if;
  if p_idempotency_key is null then raise exception 'An idempotency key is required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(actor_id::text, 0));
  select a.id into prior_attempt_id
  from public.exam_attempts a
  where a.user_id = actor_id and a.start_request_key = p_idempotency_key;
  if not found then
    select a.id into prior_attempt_id
    from public.exam_attempts a
    where a.user_id = actor_id and a.status = 'in_progress'
    order by a.created_at desc limit 1;
  end if;

  new_attempt_id := public.start_exam_attempt_before_preparation(p_exam_form_id, p_idempotency_key);
  if prior_attempt_id is null then
    select nullif(pg_catalog.btrim(p.display_name), '') into account_name
    from public.profiles p where p.user_id = actor_id;

    update public.exam_attempts
    set preparation_required = true,
        preparation_started_at = null,
        preparation_deadline_at = null,
        candidate_name = account_name,
        candidate_number = null,
        started_at = null,
        deadline_at = null
    where id = new_attempt_id and user_id = actor_id;

    update public.attempt_sections
    set status = 'locked', started_at = null, deadline_at = null, completed_at = null
    where attempt_id = new_attempt_id;
  end if;
  return new_attempt_id;
end;
$$;

revoke all on function public.start_exam_attempt(uuid, uuid) from public, anon;
grant execute on function public.start_exam_attempt(uuid, uuid) to authenticated;

create or replace function private.catch_up_exam_sections(p_attempt_id uuid, p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_row public.exam_attempts%rowtype;
  active_row public.attempt_sections%rowtype;
  next_row public.attempt_sections%rowtype;
  prior_order integer := 0;
  scheduled_start timestamptz;
  scheduled_deadline timestamptz;
  now_at timestamptz := clock_timestamp();
begin
  select a.* into attempt_row
  from public.exam_attempts a
  where a.id = p_attempt_id and a.user_id = p_actor_id
  for update;
  if not found or attempt_row.status <> 'in_progress' then return; end if;

  if attempt_row.preparation_required then
    if attempt_row.preparation_started_at is null then return; end if;
    if attempt_row.preparation_deadline_at > now_at then return; end if;
  end if;

  loop
    select s.* into active_row
    from public.attempt_sections s
    where s.attempt_id = p_attempt_id and s.status = 'active'
    order by s.section_order limit 1 for update;

    if found then
      if active_row.deadline_at > now_at then return; end if;
      prior_order := active_row.section_order;
      scheduled_start := active_row.deadline_at;
      update public.attempt_sections
      set status = 'expired', completed_at = active_row.deadline_at
      where id = active_row.id;
    else
      select s.section_order, s.completed_at into prior_order, scheduled_start
      from public.attempt_sections s
      where s.attempt_id = p_attempt_id and s.status in ('completed', 'expired')
      order by s.section_order desc limit 1;
      if not found then
        prior_order := 0;
        scheduled_start := case
          when attempt_row.preparation_required then attempt_row.preparation_deadline_at
          else attempt_row.started_at
        end;
      end if;
    end if;

    select s.* into next_row
    from public.attempt_sections s
    where s.attempt_id = p_attempt_id and s.status = 'locked' and s.section_order > prior_order
    order by s.section_order limit 1 for update;

    if not found then
      if attempt_row.deadline_at is not null and attempt_row.deadline_at <= now_at then
        perform private.finalize_exam_attempt(p_attempt_id, p_actor_id, true);
      end if;
      return;
    end if;

    scheduled_deadline := scheduled_start + (next_row.duration_seconds * interval '1 second');
    if scheduled_deadline <= now_at then
      update public.attempt_sections
      set status = 'expired', started_at = scheduled_start,
          deadline_at = scheduled_deadline, completed_at = scheduled_deadline
      where id = next_row.id;
      prior_order := next_row.section_order;
      scheduled_start := scheduled_deadline;
    else
      update public.attempt_sections
      set status = 'active', started_at = scheduled_start, deadline_at = scheduled_deadline
      where id = next_row.id;
      return;
    end if;
  end loop;
end;
$$;

create or replace function public.begin_exam_preparation(
  p_attempt_id uuid,
  p_candidate_name text,
  p_candidate_number text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  attempt_row public.exam_attempts%rowtype;
  candidate_name_value text := nullif(pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_candidate_name, ''), '[[:cntrl:]]', '', 'g')), '');
  candidate_number_value text := nullif(pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_candidate_number, ''), '[[:cntrl:]]', '', 'g')), '');
  section_seconds bigint;
  prep_started timestamptz := clock_timestamp();
begin
  if actor_id is null then raise exception 'Sign in before beginning exam preparation'; end if;
  if candidate_name_value is null or char_length(candidate_name_value) > 120 then
    raise exception 'Enter a candidate name of 1 to 120 characters';
  end if;
  if candidate_number_value is not null and char_length(candidate_number_value) > 60 then
    raise exception 'Candidate number is limited to 60 characters';
  end if;

  select a.* into attempt_row from public.exam_attempts a
  where a.id = p_attempt_id and a.user_id = actor_id for update;
  if not found or attempt_row.status <> 'in_progress' then raise exception 'This exam attempt is not active'; end if;
  if not attempt_row.preparation_required then raise exception 'This attempt does not use the new preparation flow'; end if;
  if attempt_row.preparation_started_at is not null then return attempt_row.preparation_deadline_at; end if;

  select coalesce(sum(s.duration_seconds), 0)::bigint into section_seconds
  from public.attempt_sections s where s.attempt_id = p_attempt_id;
  if section_seconds <= 0 then raise exception 'The exam has no valid section timing'; end if;

  update public.exam_attempts
  set candidate_name = candidate_name_value,
      candidate_number = candidate_number_value,
      preparation_started_at = prep_started,
      preparation_deadline_at = prep_started + interval '5 minutes',
      started_at = prep_started,
      deadline_at = prep_started + interval '5 minutes' + (section_seconds * interval '1 second')
  where id = p_attempt_id;

  return prep_started + interval '5 minutes';
end;
$$;

revoke all on function public.begin_exam_preparation(uuid, text, text) from public, anon;
grant execute on function public.begin_exam_preparation(uuid, text, text) to authenticated;

alter function public.submit_exam_attempt(uuid) rename to submit_exam_attempt_before_preparation;
revoke all on function public.submit_exam_attempt_before_preparation(uuid) from public, anon, authenticated;

create or replace function public.submit_exam_attempt(p_attempt_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  attempt_row public.exam_attempts%rowtype;
begin
  if actor_id is null then raise exception 'Sign in before submitting this exam'; end if;
  select a.* into attempt_row from public.exam_attempts a
  where a.id = p_attempt_id and a.user_id = actor_id for update;
  if not found then raise exception 'Exam attempt was not found'; end if;
  if attempt_row.preparation_required and (
    attempt_row.preparation_started_at is null
    or attempt_row.preparation_deadline_at is null
    or attempt_row.preparation_deadline_at > clock_timestamp()
  ) then
    raise exception 'Complete the preparation window before submitting the exam';
  end if;
  return public.submit_exam_attempt_before_preparation(p_attempt_id);
end;
$$;

revoke all on function public.submit_exam_attempt(uuid) from public, anon;
grant execute on function public.submit_exam_attempt(uuid) to authenticated;

alter function public.get_exam_attempt_payload(uuid) rename to get_exam_attempt_payload_before_preparation;
revoke all on function public.get_exam_attempt_payload_before_preparation(uuid) from public, anon, authenticated;

create or replace function public.get_exam_attempt_payload(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  attempt_row public.exam_attempts%rowtype;
  payload jsonb;
  enriched_assets jsonb;
begin
  if actor_id is null then raise exception 'Sign in to access this exam'; end if;
  payload := public.get_exam_attempt_payload_before_preparation(p_attempt_id);
  select a.* into attempt_row from public.exam_attempts a
  where a.id = p_attempt_id and a.user_id = actor_id;
  if not found then raise exception 'Exam attempt was not found'; end if;

  select coalesce(jsonb_agg(asset.value || jsonb_build_object(
    'play_count', coalesce(playback.play_count, 0),
    'recovery_used', coalesce(playback.recovery_used, false),
    'playback_completed_at', playback.completed_at
  )), '[]'::jsonb)
  into enriched_assets
  from jsonb_array_elements(coalesce(payload -> 'assets', '[]'::jsonb)) as asset(value)
  left join public.attempt_media_playbacks playback
    on playback.attempt_id = p_attempt_id
    and playback.storage_path = asset.value ->> 'storage_path';

  payload := jsonb_set(payload, '{assets}', enriched_assets, true);
  payload := jsonb_set(payload, '{attempt}', coalesce(payload -> 'attempt', '{}'::jsonb) || jsonb_build_object(
    'preparation_required', attempt_row.preparation_required,
    'preparation_started_at', attempt_row.preparation_started_at,
    'preparation_deadline_at', attempt_row.preparation_deadline_at,
    'candidate_name', attempt_row.candidate_name,
    'candidate_number', attempt_row.candidate_number
  ), true);
  return payload;
end;
$$;

revoke all on function public.get_exam_attempt_payload(uuid) from public, anon;
grant execute on function public.get_exam_attempt_payload(uuid) to authenticated;

create or replace function public.claim_exam_audio_playback(p_attempt_id uuid, p_storage_path text, p_recovery boolean default false)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  attempt_row public.exam_attempts%rowtype;
  active_section public.attempt_sections%rowtype;
begin
  if actor_id is null then raise exception 'Sign in before playing exam audio'; end if;
  select a.* into attempt_row from public.exam_attempts a
  where a.id = p_attempt_id and a.user_id = actor_id for update;
  if not found or attempt_row.status <> 'in_progress' then raise exception 'This exam attempt is not active'; end if;

  perform private.catch_up_exam_sections(p_attempt_id, actor_id);
  select a.* into attempt_row from public.exam_attempts a where a.id = p_attempt_id;
  select s.* into active_section from public.attempt_sections s
  where s.attempt_id = p_attempt_id and s.status = 'active' for update;
  if not found or active_section.deadline_at <= clock_timestamp() then
    raise exception 'The timed listening section has ended';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(attempt_row.form_snapshot -> 'items') item
    join public.question_assets qa on qa.question_id = (item.value ->> 'question_id')::uuid
    join public.content_assets ca on ca.id = qa.asset_id
    where item.value ->> 'section_code' = active_section.section_code
      and ca.storage_path = p_storage_path
      and ca.media_type like 'audio/%'
      and qa.purpose in ('question_audio', 'stimulus_audio')
      and ca.status in ('approved', 'eligible_for_exam')
  ) then raise exception 'This audio is not part of the active listening section'; end if;

  if p_recovery then
    update public.attempt_media_playbacks
    set play_count = 2, recovery_used = true, started_at = clock_timestamp()
    where attempt_id = p_attempt_id and storage_path = p_storage_path
      and play_count = 1 and not recovery_used and completed_at is null;
    return found;
  end if;

  insert into public.attempt_media_playbacks (attempt_id, storage_path)
  values (p_attempt_id, p_storage_path)
  on conflict (attempt_id, storage_path) do nothing;
  return found;
end;
$$;

revoke all on function public.claim_exam_audio_playback(uuid, text, boolean) from public, anon;
grant execute on function public.claim_exam_audio_playback(uuid, text, boolean) to authenticated;

create or replace function public.complete_exam_audio_playback(p_attempt_id uuid, p_storage_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then raise exception 'Sign in before completing exam audio'; end if;
  update public.attempt_media_playbacks playback
  set completed_at = coalesce(playback.completed_at, clock_timestamp())
  from public.exam_attempts attempt
  where playback.attempt_id = p_attempt_id
    and playback.storage_path = p_storage_path
    and attempt.id = playback.attempt_id
    and attempt.user_id = actor_id
    and playback.play_count between 1 and 2;
  if not found then raise exception 'This audio playback was not started for the current attempt'; end if;
end;
$$;

revoke all on function public.complete_exam_audio_playback(uuid, text) from public, anon;
grant execute on function public.complete_exam_audio_playback(uuid, text) to authenticated;

commit;
