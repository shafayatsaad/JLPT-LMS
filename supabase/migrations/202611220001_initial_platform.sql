create extension if not exists pgcrypto;

create type public.jlpt_level as enum ('N1', 'N2', 'N3', 'N4', 'N5');
create type public.app_role as enum ('student', 'content_editor', 'reviewer', 'payment_reviewer', 'admin');
create type public.content_status as enum ('draft', 'needs_review', 'approved', 'eligible_for_exam', 'rejected', 'retired');
create type public.form_status as enum ('draft', 'validated', 'published', 'retired');
create type public.attempt_status as enum ('created', 'in_progress', 'submitted', 'expired');
create type public.section_status as enum ('locked', 'active', 'completed', 'expired');
create type public.payment_status as enum ('pending', 'verified', 'rejected', 'needs_review');
create type public.entitlement_status as enum ('active', 'expired', 'cancelled', 'revoked');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  target_level public.jlpt_level,
  explanation_language text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  assigned_by uuid references auth.users(id),
  assigned_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  tag_type text not null,
  created_at timestamptz not null default now()
);

create table public.passage_groups (
  id uuid primary key default gen_random_uuid(),
  content_key uuid not null,
  revision integer not null check (revision > 0),
  level public.jlpt_level not null,
  group_type text not null check (group_type in ('passage', 'dialogue', 'listening_script')),
  content jsonb not null,
  status public.content_status not null default 'draft',
  authored_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (content_key, revision)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  content_key uuid not null,
  revision integer not null check (revision > 0),
  level public.jlpt_level not null,
  test_section_code text not null,
  score_category_code text not null,
  item_type_code text not null,
  difficulty_estimate smallint check (difficulty_estimate between 1 and 5),
  stimulus_group_id uuid references public.passage_groups(id),
  prompt jsonb not null,
  options jsonb not null,
  status public.content_status not null default 'draft',
  authored_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (content_key, revision),
  check (jsonb_typeof(prompt) = 'array'),
  check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) >= 2)
);

create table public.question_answer_keys (
  question_id uuid primary key references public.questions(id) on delete restrict,
  correct_option_id text not null,
  explanation jsonb not null,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(explanation) = 'object')
);

create table public.question_tags (
  question_id uuid not null references public.questions(id) on delete restrict,
  tag_id uuid not null references public.tags(id) on delete restrict,
  primary key (question_id, tag_id)
);

create table public.content_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  media_type text not null,
  checksum_sha256 text,
  duration_seconds numeric(8, 3),
  status public.content_status not null default 'draft',
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.question_assets (
  question_id uuid not null references public.questions(id) on delete restrict,
  asset_id uuid not null references public.content_assets(id) on delete restrict,
  purpose text not null,
  primary key (question_id, asset_id, purpose)
);

create table public.question_reviews (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete restrict,
  reviewer_id uuid not null references auth.users(id),
  decision text not null check (decision in ('approved', 'rejected', 'needs_changes')),
  notes text,
  created_at timestamptz not null default now()
);

create table public.exam_blueprints (
  id uuid primary key default gen_random_uuid(),
  level public.jlpt_level not null,
  version integer not null check (version > 0),
  status public.content_status not null default 'draft',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (level, version)
);

create table public.blueprint_slots (
  id uuid primary key default gen_random_uuid(),
  blueprint_id uuid not null references public.exam_blueprints(id) on delete restrict,
  slot_order integer not null check (slot_order > 0),
  test_section_code text not null,
  score_category_code text not null,
  item_type_code text not null,
  question_quota integer not null check (question_quota > 0),
  difficulty_targets jsonb not null default '{}'::jsonb,
  required_asset_types text[] not null default '{}',
  unique (blueprint_id, slot_order)
);

create table public.exam_forms (
  id uuid primary key default gen_random_uuid(),
  blueprint_id uuid not null references public.exam_blueprints(id) on delete restrict,
  level public.jlpt_level not null,
  form_code text not null unique,
  version integer not null check (version > 0),
  status public.form_status not null default 'draft',
  assembly_seed text,
  manifest jsonb not null default '{}'::jsonb,
  is_frozen boolean not null default false,
  published_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (blueprint_id, version)
);

create table public.exam_form_items (
  id uuid primary key default gen_random_uuid(),
  exam_form_id uuid not null references public.exam_forms(id) on delete restrict,
  question_id uuid not null references public.questions(id) on delete restrict,
  position integer not null check (position > 0),
  group_position integer,
  unique (exam_form_id, position),
  unique (exam_form_id, question_id)
);

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_form_id uuid not null references public.exam_forms(id) on delete restrict,
  level public.jlpt_level not null,
  status public.attempt_status not null default 'created',
  attempt_number integer not null check (attempt_number > 0),
  started_at timestamptz,
  deadline_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, exam_form_id, attempt_number),
  check (deadline_at is null or started_at is null or deadline_at >= started_at)
);

create table public.attempt_sections (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  section_code text not null,
  section_order integer not null check (section_order > 0),
  status public.section_status not null default 'locked',
  started_at timestamptz,
  deadline_at timestamptz,
  completed_at timestamptz,
  unique (attempt_id, section_code),
  unique (attempt_id, section_order)
);

create table public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  selected_option_id text,
  saved_at timestamptz not null default now(),
  time_spent_seconds integer check (time_spent_seconds >= 0),
  graded_correct boolean,
  unique (attempt_id, question_id)
);

create table public.exam_results (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.exam_attempts(id) on delete cascade,
  raw_correct integer not null check (raw_correct >= 0),
  raw_incorrect integer not null check (raw_incorrect >= 0),
  raw_unanswered integer not null check (raw_unanswered >= 0),
  section_breakdown jsonb not null,
  score_category_breakdown jsonb not null,
  published_at timestamptz not null default now(),
  check (jsonb_typeof(section_breakdown) = 'object'),
  check (jsonb_typeof(score_category_breakdown) = 'object')
);

create table public.user_question_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  times_seen integer not null default 0 check (times_seen >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  last_seen_at timestamptz,
  primary key (user_id, question_id)
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price numeric(12, 2) not null check (price >= 0),
  currency text not null,
  duration_days integer not null check (duration_days > 0),
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  provider text not null,
  payment_method text not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null,
  transaction_reference text,
  sender_identifier text,
  evidence_storage_path text,
  status public.payment_status not null default 'pending',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index payment_submissions_provider_reference_unique
  on public.payment_submissions (provider, transaction_reference)
  where transaction_reference is not null;

create table public.user_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  status public.entitlement_status not null default 'active',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  source_payment_submission_id uuid unique references public.payment_submissions(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.payment_audit_events (
  id uuid primary key default gen_random_uuid(),
  payment_submission_id uuid not null references public.payment_submissions(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id),
  action text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create table public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index questions_level_section_status_idx
  on public.questions (level, test_section_code, status);
create index questions_stimulus_group_idx on public.questions (stimulus_group_id);
create index exam_forms_level_status_idx on public.exam_forms (level, status);
create index exam_attempts_user_created_idx on public.exam_attempts (user_id, created_at desc);
create index attempt_sections_attempt_status_idx on public.attempt_sections (attempt_id, status);
create index payment_submissions_user_created_idx on public.payment_submissions (user_id, created_at desc);
create index user_entitlements_user_status_idx on public.user_entitlements (user_id, status, ends_at);

create function public.prevent_approved_question_mutation()
returns trigger
language plpgsql
as $$
declare
  question_id_to_check uuid;
  current_status public.content_status;
begin
  if tg_table_name = 'questions' then
    question_id_to_check := coalesce(new.id, old.id);
    current_status := old.status;
    if current_status in ('approved', 'eligible_for_exam', 'retired') then
      if tg_op = 'DELETE' or row(
        new.content_key, new.revision, new.level, new.test_section_code, new.score_category_code,
        new.item_type_code, new.difficulty_estimate, new.stimulus_group_id, new.prompt,
        new.options, new.authored_by
      ) is distinct from row(
        old.content_key, old.revision, old.level, old.test_section_code, old.score_category_code,
        old.item_type_code, old.difficulty_estimate, old.stimulus_group_id, old.prompt,
        old.options, old.authored_by
      ) then
        raise exception 'Approved question revisions are immutable';
      end if;
    end if;
  else
    question_id_to_check := coalesce(new.question_id, old.question_id);
    select status into current_status from public.questions where id = question_id_to_check;
    if current_status in ('approved', 'eligible_for_exam', 'retired') then
      if tg_op = 'DELETE' or row(new.correct_option_id, new.explanation)
        is distinct from row(old.correct_option_id, old.explanation) then
        raise exception 'Approved question answer keys are immutable';
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger question_answer_key_immutable
  before update or delete on public.question_answer_keys
  for each row execute function public.prevent_approved_question_mutation();

create trigger approved_question_immutable
  before update or delete on public.questions
  for each row when (old.status in ('approved', 'eligible_for_exam', 'retired'))
  execute function public.prevent_approved_question_mutation();

create function public.prevent_frozen_form_mutation()
returns trigger
language plpgsql
as $$
declare
  form_id uuid;
  frozen boolean;
  current_status public.form_status;
begin
  if tg_table_name = 'exam_forms' then
    form_id := coalesce(new.id, old.id);
  else
    form_id := coalesce(new.exam_form_id, old.exam_form_id);
  end if;
  select is_frozen, status into frozen, current_status from public.exam_forms where id = form_id;
  if frozen or current_status in ('published', 'retired') then
    raise exception 'Published or frozen exam forms are immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger frozen_exam_form_immutable
  before update or delete on public.exam_forms
  for each row when (old.is_frozen or old.status in ('published', 'retired'))
  execute function public.prevent_frozen_form_mutation();

create trigger frozen_exam_form_item_immutable
  before insert or update or delete on public.exam_form_items
  for each row execute function public.prevent_frozen_form_mutation();

create function public.prevent_audit_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Audit events are append-only';
end;
$$;

create trigger payment_audit_append_only
  before update or delete on public.payment_audit_events
  for each row execute function public.prevent_audit_event_mutation();

create trigger admin_audit_append_only
  before update or delete on public.admin_audit_events
  for each row execute function public.prevent_audit_event_mutation();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.tags enable row level security;
alter table public.passage_groups enable row level security;
alter table public.questions enable row level security;
alter table public.question_answer_keys enable row level security;
alter table public.question_tags enable row level security;
alter table public.content_assets enable row level security;
alter table public.question_assets enable row level security;
alter table public.question_reviews enable row level security;
alter table public.exam_blueprints enable row level security;
alter table public.blueprint_slots enable row level security;
alter table public.exam_forms enable row level security;
alter table public.exam_form_items enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.attempt_sections enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.exam_results enable row level security;
alter table public.user_question_stats enable row level security;
alter table public.plans enable row level security;
alter table public.payment_submissions enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.payment_audit_events enable row level security;
alter table public.admin_audit_events enable row level security;

create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = user_id);
create policy "profiles: create own" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "attempts: read own" on public.exam_attempts
  for select using (auth.uid() = user_id);
create policy "results: read after completion" on public.exam_results
  for select using (
    exists (
      select 1 from public.exam_attempts a
      where a.id = attempt_id
        and a.user_id = auth.uid()
        and a.status in ('submitted', 'expired')
    )
  );
create policy "question stats: read own" on public.user_question_stats
  for select using (auth.uid() = user_id);
create policy "plans: read active" on public.plans
  for select using (is_active = true);
create policy "payment submissions: read own" on public.payment_submissions
  for select using (auth.uid() = user_id);
create policy "entitlements: read own" on public.user_entitlements
  for select using (auth.uid() = user_id);

-- Content, answer keys, form manifests, answer writes, attempt transitions, payment reviews,
-- and entitlement mutations have no browser policies. Protected server operations enforce roles,
-- deadlines, ownership, one-time transitions, and payment idempotency before writing.
