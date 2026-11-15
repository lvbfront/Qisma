-- Qisma: subscriptions and investments.
-- Same rules as the first migration: integer halalas, user_id + Row Level Security on
-- every table, entries stay immutable, money movements go through atomic functions.
-- No bank account numbers, IBANs or credentials: an investing platform is just a name.

-- ---------------------------------------------------------------- buckets: the investment bucket
alter table public.buckets
  add column is_investment boolean not null default false,
  add constraint buckets_investment_not_remainder check (not (is_investment and rule_kind = 'remainder'));
-- At most one active investment bucket per user. Its balance means "available to invest".
create unique index buckets_one_active_investment on public.buckets (user_id) where is_investment and active;

-- ---------------------------------------------------------------- subscriptions
create table public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            text not null check (length(btrim(name)) between 1 and 60),
  amount          bigint not null check (amount > 0),
  -- Billing cycle = every cycle_count cycle_units: (1, month), (1, year), (3, month) ...
  cycle_count     integer not null default 1 check (cycle_count between 1 and 120),
  cycle_unit      text not null default 'month' check (cycle_unit in ('month', 'year')),
  next_due_on     date not null,
  -- The original day of the month (1-31). Kept so that 31 Jan -> 28 Feb -> 31 Mar does not drift.
  billing_day     smallint not null check (billing_day between 1 and 31),
  bucket_id       uuid, -- the bucket it is paid from (optional)
  paused          boolean not null default false,
  note            text check (length(note) <= 500),
  -- Written only by pay_subscription(): rejects a repeated submit of the same payment.
  last_payment_id uuid,
  created_at      timestamptz not null default now(),
  unique (id, user_id),
  foreign key (bucket_id, user_id) references public.buckets (id, user_id) on delete restrict,
  -- next_due_on must be the billing day, or the last day of a month that is too short for it.
  constraint subscriptions_due_matches_billing_day check (
    extract(day from next_due_on) = least(
      billing_day,
      extract(day from (date_trunc('month', next_due_on::timestamp) + interval '1 month - 1 day'))
    )
  )
);
create index subscriptions_user_due on public.subscriptions (user_id, next_due_on);

-- ---------------------------------------------------------------- investments (cost basis only)
create table public.investments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  platform           text not null check (length(btrim(platform)) between 1 and 60),
  title              text check (length(title) <= 200),
  amount             bigint not null check (amount > 0), -- amount invested
  invested_on        date not null,
  expected_return_on date,
  expected_profit    bigint check (expected_profit >= 0),
  status             text not null default 'open' check (status in ('open', 'closed')),
  closed_on          date,
  -- Fixed at closing: total returned minus amount invested. Negative = loss.
  result             bigint,
  created_at         timestamptz not null default now(),
  unique (id, user_id),
  constraint investments_closed_has_result check (
    (status = 'open' and result is null and closed_on is null)
    or (status = 'closed' and result is not null and closed_on is not null)
  )
);
create index investments_user_status on public.investments (user_id, status);

-- ---------------------------------------------------------------- entries: new kinds and links
alter table public.entries
  add column investment_id uuid,
  add column subscription_id uuid,
  add foreign key (investment_id, user_id) references public.investments (id, user_id) on delete restrict,
  -- Deleting a subscription keeps its payment history; only the link is cleared.
  add foreign key (subscription_id, user_id) references public.subscriptions (id, user_id)
    on delete set null (subscription_id);

alter table public.entries drop constraint entries_kind_check;
alter table public.entries
  add constraint entries_kind_check
    check (kind in ('allocation', 'spend', 'adjustment', 'transfer', 'invest', 'return')),
  -- invest: money leaves the investment bucket. return: money comes back. Both name their investment.
  add constraint entries_investment_kinds check (
    case kind
      when 'invest' then investment_id is not null and amount < 0
      when 'return' then investment_id is not null and amount > 0
      else investment_id is null
    end
  ),
  add constraint entries_subscription_is_spend check (subscription_id is null or kind = 'spend');

create index entries_investment_id on public.entries (investment_id);
create index entries_subscription_id on public.entries (subscription_id);

-- ---------------------------------------------------------------- privileges
revoke all on public.subscriptions, public.investments from anon, authenticated, public;

-- Subscriptions are settings, not ledger: the user edits them freely,
-- except last_payment_id, which only pay_subscription() writes.
grant select, delete on public.subscriptions to authenticated;
grant insert (id, name, amount, cycle_count, cycle_unit, next_due_on, billing_day, bucket_id, paused, note)
  on public.subscriptions to authenticated;
grant update (name, amount, cycle_count, cycle_unit, next_due_on, billing_day, bucket_id, paused, note)
  on public.subscriptions to authenticated;

-- Investments are created, repaid and closed only by the functions below.
-- The user may correct the descriptive fields and the expectation, never the money.
grant select on public.investments to authenticated;
grant update (platform, title, expected_return_on, expected_profit) on public.investments to authenticated;

-- ---------------------------------------------------------------- row level security
alter table public.subscriptions enable row level security;
alter table public.investments   enable row level security;

create policy subscriptions_own on public.subscriptions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy investments_select_own on public.investments for select to authenticated
  using ((select auth.uid()) = user_id);
create policy investments_update_own on public.investments for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Direct inserts stay limited to plain spend / adjustment / transfer entries.
-- allocation, invest, return and subscription payments only come from the functions.
drop policy entries_insert_own on public.entries;
create policy entries_insert_own on public.entries for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and kind in ('spend', 'adjustment', 'transfer')
    and investment_id is null
    and subscription_id is null
  );

-- ---------------------------------------------------------------- views
-- Per investment. Dates are compared with "today" in Riyadh, not UTC.
create view public.investment_positions with (security_invoker = true) as
  select i.id as investment_id, i.user_id, i.platform, i.title, i.status,
         i.invested_on, i.expected_return_on, i.expected_profit, i.closed_on,
         i.amount as invested,
         coalesce(r.returned, 0)::bigint as returned,
         (case when i.status = 'open' then greatest(i.amount - coalesce(r.returned, 0), 0) else 0 end)::bigint as outstanding,
         i.result, -- null while open: there are no unrealised gains
         case when i.status = 'open'
              then i.expected_return_on - (now() at time zone 'Asia/Riyadh')::date end as days_to_expected_return,
         (i.status = 'open' and i.expected_return_on is not null
            and i.expected_return_on < (now() at time zone 'Asia/Riyadh')::date) as overdue
  from public.investments i
  left join (
    select e.investment_id, sum(e.amount) as returned
    from public.entries e
    where e.kind = 'return'
    group by e.investment_id
  ) r on r.investment_id = i.id;

-- One row per user.
create view public.investment_summary with (security_invoker = true) as
  select u.user_id,
         coalesce((select bb.balance
                   from public.bucket_balances bb
                   join public.buckets b on b.id = bb.bucket_id
                   where b.user_id = u.user_id and b.is_investment and b.active), 0)::bigint as available,
         coalesce((select sum(p.outstanding) from public.investment_positions p
                   where p.user_id = u.user_id), 0)::bigint as currently_invested,
         coalesce((select sum(p.result) from public.investment_positions p
                   where p.user_id = u.user_id and p.status = 'closed'), 0)::bigint as realised_profit
  from (select distinct user_id from public.buckets) u;

revoke all on public.investment_positions, public.investment_summary from anon, authenticated, public;
grant select on public.investment_positions, public.investment_summary to authenticated;

-- ---------------------------------------------------------------- pay_subscription
-- "Mark as paid": records a spend entry on the linked bucket (if one is linked) and
-- advances next_due_on by one cycle, keeping the original billing day.
-- p_id is generated by the app; submitting the same payment twice is rejected.
-- Returns the new next_due_on.
create function public.pay_subscription(
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

  if v_sub.bucket_id is not null then
    insert into public.entries (id, user_id, bucket_id, kind, amount, note, occurred_on, subscription_id)
    values (p_id, v_user, v_sub.bucket_id, 'spend', -v_sub.amount, v_sub.name, p_paid_on, v_sub.id);
  end if;

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

-- ---------------------------------------------------------------- open_investment
-- Places money: creates the investment and an 'invest' entry (negative) on the
-- investment bucket. Refuses an amount larger than the available balance.
-- p_id is the new investment's id, generated by the app (double submit fails on the key).
create function public.open_investment(
  p_id                 uuid,
  p_platform           text,
  p_title              text,
  p_amount             bigint,
  p_invested_on        date,
  p_expected_return_on date,
  p_expected_profit    bigint
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user      uuid := auth.uid();
  v_bucket    uuid;
  v_available bigint;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_id is null or p_amount is null or p_amount <= 0 or p_invested_on is null then
    raise exception 'id, a positive amount and a date are required' using errcode = '22023';
  end if;

  -- Lock the investment bucket so two placements cannot both spend the same balance.
  select b.id into v_bucket from public.buckets b
  where b.user_id = v_user and b.is_investment and b.active
  for update;
  if not found then
    raise exception 'no investment bucket is set' using errcode = 'P0002';
  end if;

  select coalesce(sum(e.amount), 0) into v_available
  from public.entries e where e.bucket_id = v_bucket;
  if p_amount > v_available then
    raise exception 'amount % is larger than the available balance %', p_amount, v_available
      using errcode = '22023';
  end if;

  insert into public.investments (id, user_id, platform, title, amount, invested_on, expected_return_on, expected_profit)
  values (p_id, v_user, btrim(p_platform), nullif(btrim(p_title), ''), p_amount, p_invested_on,
          p_expected_return_on, p_expected_profit);

  insert into public.entries (user_id, bucket_id, kind, amount, note, occurred_on, investment_id)
  values (v_user, v_bucket, 'invest', -p_amount, btrim(p_platform), p_invested_on, p_id);

  return p_id;
end;
$$;

-- ---------------------------------------------------------------- record_investment_return
-- Money coming back: a 'return' entry (positive) on the investment bucket, linked to
-- the investment. Several returns per investment are allowed.
-- p_id is the new entry's id, generated by the app (double submit fails on the key).
create function public.record_investment_return(
  p_id            uuid,
  p_investment_id uuid,
  p_amount        bigint,
  p_returned_on   date,
  p_note          text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := auth.uid();
  v_status text;
  v_bucket uuid;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_id is null or p_amount is null or p_amount <= 0 or p_returned_on is null then
    raise exception 'id, a positive amount and a date are required' using errcode = '22023';
  end if;

  select i.status into v_status from public.investments i
  where i.id = p_investment_id and i.user_id = v_user
  for update;
  if not found then
    raise exception 'investment not found' using errcode = 'P0002';
  end if;
  if v_status <> 'open' then
    raise exception 'investment is closed' using errcode = '22023';
  end if;

  select b.id into v_bucket from public.buckets b
  where b.user_id = v_user and b.is_investment and b.active;
  if not found then
    raise exception 'no investment bucket is set' using errcode = 'P0002';
  end if;

  insert into public.entries (id, user_id, bucket_id, kind, amount, note, occurred_on, investment_id)
  values (p_id, v_user, v_bucket, 'return', p_amount, nullif(btrim(p_note), ''), p_returned_on, p_investment_id);

  return p_id;
end;
$$;

-- ---------------------------------------------------------------- close_investment
-- Fixes the result: total returned minus amount invested. A loss (even with nothing
-- returned) can be closed. Needs no app-generated id: closing an already closed
-- investment is rejected, so a double submit cannot change anything.
-- Returns the result.
create function public.close_investment(
  p_investment_id uuid,
  p_closed_on     date
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := auth.uid();
  v_inv    public.investments;
  v_result bigint;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_closed_on is null then
    raise exception 'a closing date is required' using errcode = '22023';
  end if;

  select * into v_inv from public.investments i
  where i.id = p_investment_id and i.user_id = v_user
  for update;
  if not found then
    raise exception 'investment not found' using errcode = 'P0002';
  end if;
  if v_inv.status <> 'open' then
    raise exception 'investment is already closed' using errcode = '22023';
  end if;

  select coalesce(sum(e.amount), 0) - v_inv.amount into v_result
  from public.entries e
  where e.investment_id = v_inv.id and e.kind = 'return';

  update public.investments
  set status = 'closed', closed_on = p_closed_on, result = v_result
  where id = v_inv.id;

  return v_result;
end;
$$;

revoke all on function public.pay_subscription(uuid, uuid, date) from public, anon;
revoke all on function public.open_investment(uuid, text, text, bigint, date, date, bigint) from public, anon;
revoke all on function public.record_investment_return(uuid, uuid, bigint, date, text) from public, anon;
revoke all on function public.close_investment(uuid, date) from public, anon;
grant execute on function public.pay_subscription(uuid, uuid, date) to authenticated;
grant execute on function public.open_investment(uuid, text, text, bigint, date, date, bigint) to authenticated;
grant execute on function public.record_investment_return(uuid, uuid, bigint, date, text) to authenticated;
grant execute on function public.close_investment(uuid, date) to authenticated;
