-- Learners can save approved questions for later review.
-- Apply after migrations 001 through 012.

begin;

create table if not exists public.user_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

alter table public.user_bookmarks enable row level security;
revoke all on public.user_bookmarks from anon, authenticated;
grant select, insert, delete on public.user_bookmarks to authenticated;

create policy "bookmarks: read own"
  on public.user_bookmarks for select to authenticated
  using (user_id = (select auth.uid()));

create policy "bookmarks: save approved questions"
  on public.user_bookmarks for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.questions q
      where q.id = question_id
        and q.status in ('approved', 'eligible_for_exam')
    )
  );

create policy "bookmarks: remove own"
  on public.user_bookmarks for delete to authenticated
  using (user_id = (select auth.uid()));

comment on table public.user_bookmarks is
  'Learner-owned list of approved questions saved for later review.';

commit;
