-- Return only the fields needed for a learner's immediate checkout receipt.
-- Learners must not receive direct SELECT access to payment rows, which contain
-- private transaction data used only by staff review.

create or replace function public.get_own_payment_request_confirmation(p_payment_submission_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', ps.id,
    'amount', ps.amount,
    'currency', ps.currency,
    'transaction_reference', ps.transaction_reference,
    'plan_snapshot', ps.plan_snapshot
  )
  from public.payment_submissions ps
  where ps.id = p_payment_submission_id
    and ps.user_id = (select auth.uid());
$$;

revoke all on function public.get_own_payment_request_confirmation(uuid) from public, anon;
grant execute on function public.get_own_payment_request_confirmation(uuid) to authenticated;
