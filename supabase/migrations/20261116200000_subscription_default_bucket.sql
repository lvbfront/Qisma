-- Qisma: every subscription payment must come out of a bucket.
-- Before: pay_subscription() advanced the due date of a subscription with no bucket
-- without recording any spend. Now it pays from the subscription's own bucket, or else
-- from the user's default payment bucket, and refuses to do anything if neither is set.

-- The default payment bucket for subscriptions (optional). Deleting that bucket clears it.
alter table public.settings
  add column default_subscription_bucket_id uuid,
  add constraint settings_default_subscription_bucket_fkey
    foreign key (default_subscription_bucket_id, user_id)
    references public.buckets (id, user_id)
    on delete set null (default_subscription_bucket_id);

-- Same name, arguments and return value as before, so existing grants stay in place.
create or replace function public.pay_subscription(
  p_id              uuid,
  p_subscription_id uuid,
  p_paid_on         date
) returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := auth.uid();
  v_sub    public.subscriptions;
  v_bucket uuid;
  v_first  date;
  v_days   integer;
  v_next   date;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_id is null or p_subscription_id is null or p_paid_on is null then
    raise exception 'id, subscription and payment date are required' using errcode = '22023';
  end if;

  select * into v_sub from public.subscriptions s
  where s.id = p_subscription_id and s.user_id = v_user
  for update;
  if not found then
    raise exception 'subscription not found' using errcode = 'P0002';
  end if;
  if v_sub.last_payment_id = p_id then
    raise exception 'this payment was already recorded' using errcode = '23505';
  end if;
  if v_sub.paused then
    raise exception 'subscription is paused' using errcode = '22023';
  end if;

  -- The subscription's own bucket, otherwise the default payment bucket.
  v_bucket := coalesce(
    v_sub.bucket_id,
    (select st.default_subscription_bucket_id from public.settings st where st.user_id = v_user)
  );
  -- No bucket: change nothing. QS001 tells the app to ask the user to choose one.
  if v_bucket is null then
    raise exception 'no payment bucket: choose a bucket for this subscription or set a default'
      using errcode = 'QS001';
  end if;

  insert into public.entries (id, user_id, bucket_id, kind, amount, note, occurred_on, subscription_id)
  values (p_id, v_user, v_bucket, 'spend', -v_sub.amount, v_sub.name, p_paid_on, v_sub.id);

  -- First day of the target month, then the billing day clamped to that month's length.
  v_first := (date_trunc('month', v_sub.next_due_on::timestamp)
              + make_interval(months => v_sub.cycle_count * case v_sub.cycle_unit when 'year' then 12 else 1 end))::date;
  v_days  := extract(day from (v_first + interval '1 month - 1 day'))::integer;
  v_next  := v_first + (least(v_sub.billing_day::integer, v_days) - 1);

  update public.subscriptions
  set next_due_on = v_next, last_payment_id = p_id
  where id = v_sub.id;

  return v_next;
end;
$$;
