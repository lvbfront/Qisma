-- Qisma schema.
-- All money is integer halalas (bigint). Balances are never stored: see the views.
-- Every table has user_id + Row Level Security: a user reads and writes only their own rows.
-- No bank account numbers, IBANs or credentials are stored anywhere; an account is just a name.

-- ---------------------------------------------------------------- accounts
create table public.accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            text not null check (length(btrim(name)) between 1 and 60),
  kind            text not null check (kind in ('current', 'savings', 'investment', 'cash')),
  sort_order      integer not null default 0,
  receives_income boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (id, user_id) -- target for composite foreign keys: a child row can only point at its own user's row
);
-- Salary lands in at most one account.
create unique index accounts_one_income_account on public.accounts (user_id) where receives_income;

-- ---------------------------------------------------------------- buckets
create table public.buckets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 60),
  rule_kind    text not null check (rule_kind in ('fixed', 'percent', 'remainder')),
  -- fixed: halalas. percent: basis points (10% = 1000). remainder: 0.
  rule_value   bigint not null default 0 check (rule_value >= 0),
  priority     integer not null default 0,
  account_id   uuid not null,
  color        smallint not null default 1 check (color between 1 and 8), -- design token bucket-1 .. bucket-8
  is_remainder boolean generated always as (rule_kind = 'remainder') stored,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (id, user_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  check (rule_kind <> 'percent' or rule_value <= 10000),
  check (rule_kind <> 'remainder' or rule_value = 0)
);
-- At most one active remainder bucket per user.
create unique index buckets_one_active_remainder on public.buckets (user_id) where is_remainder and active;
create index buckets_account_id on public.buckets (account_id);

-- ---------------------------------------------------------------- incomes
create table public.incomes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  received_on date not null default current_date,
  amount      bigint not null check (amount > 0),
  note        text check (length(note) <= 500),
  -- The exact lines and rules used, so history stays correct after rules change.
  snapshot    jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at  timestamptz not null default now(),
  unique (id, user_id)
);
create index incomes_user_received on public.incomes (user_id, received_on desc);

-- ---------------------------------------------------------------- entries
create table public.entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  bucket_id     uuid not null,
  income_id     uuid,
  kind          text not null check (kind in ('allocation', 'spend', 'adjustment', 'transfer')),
  amount        bigint not null, -- signed halalas: + into the bucket, - out of it
  note          text check (length(note) <= 500),
  transfer_done boolean not null default false,
  occurred_on   date not null default current_date,
  created_at    timestamptz not null default now(),
  foreign key (bucket_id, user_id) references public.buckets (id, user_id) on delete restrict,
  foreign key (income_id, user_id) references public.incomes (id, user_id) on delete restrict,
  check (kind <> 'allocation' or (income_id is not null and amount >= 0))
);
create index entries_bucket_id on public.entries (bucket_id);
create index entries_income_id on public.entries (income_id);
create index entries_user_occurred on public.entries (user_id, occurred_on desc);

-- ---------------------------------------------------------------- settings (one row per user)
create table public.settings (
  user_id          uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  reference_income bigint not null default 0 check (reference_income >= 0),
  living_floor     bigint not null default 0 check (living_floor >= 0),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------- privileges
-- Start from nothing, then grant exactly what the app needs to signed-in users.
-- anon (not signed in) gets no access at all.
revoke all on public.accounts, public.buckets, public.incomes, public.entries, public.settings
  from anon, authenticated, public;

grant select, insert, update, delete on public.accounts, public.buckets to authenticated;
grant select, insert, update on public.settings to authenticated;
-- Confirmed distributions are never edited: incomes are read-only to the client
-- and are created only by confirm_distribution().
grant select on public.incomes to authenticated;
-- Entries are append-only; the only thing that may change later is transfer_done.
grant select, insert on public.entries to authenticated;
grant update (transfer_done) on public.entries to authenticated;

-- ---------------------------------------------------------------- row level security
alter table public.accounts enable row level security;
alter table public.buckets  enable row level security;
alter table public.incomes  enable row level security;
alter table public.entries  enable row level security;
alter table public.settings enable row level security;

create policy accounts_own on public.accounts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy buckets_own on public.buckets for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy settings_own on public.settings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy incomes_select_own on public.incomes for select to authenticated
  using ((select auth.uid()) = user_id);

create policy entries_select_own on public.entries for select to authenticated
  using ((select auth.uid()) = user_id);
-- Allocation entries can only come from confirm_distribution().
create policy entries_insert_own on public.entries for insert to authenticated
  with check ((select auth.uid()) = user_id and kind <> 'allocation');
create policy entries_update_own on public.entries for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- balance views
-- security_invoker: the views run with the caller's rights, so RLS on the tables applies.
create view public.bucket_balances with (security_invoker = true) as
  select b.id as bucket_id, b.user_id, b.account_id,
         coalesce(sum(e.amount), 0)::bigint as balance
  from public.buckets b
  left join public.entries e on e.bucket_id = b.id
  group by b.id;

create view public.account_balances with (security_invoker = true) as
  select a.id as account_id, a.user_id,
         coalesce(sum(bb.balance), 0)::bigint as balance
  from public.accounts a
  left join public.bucket_balances bb on bb.account_id = a.id
  group by a.id;

revoke all on public.bucket_balances, public.account_balances from anon, authenticated, public;
grant select on public.bucket_balances, public.account_balances to authenticated;

-- ---------------------------------------------------------------- confirm_distribution
-- Atomic: inserts the income row and all its allocation entries in one transaction
-- (a function call is a single transaction; any error rolls everything back).
--
-- p_id is generated by the client, so a repeated submit of the same distribution
-- fails on the primary key instead of recording the salary twice.
-- p_allocations: [{"bucket_id": uuid, "amount": halalas}, ...] and must sum exactly to p_amount.
--
-- SECURITY DEFINER because the client has no insert right on incomes and may not
-- insert allocation entries. It only ever writes rows for auth.uid().
create function public.confirm_distribution(
  p_id          uuid,
  p_amount      bigint,
  p_received_on date,
  p_note        text,
  p_snapshot    jsonb,
  p_allocations jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_count integer;
  v_sum   numeric;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_id is null or p_amount is null or p_amount <= 0 or p_received_on is null then
    raise exception 'id, a positive amount and a date are required' using errcode = '22023';
  end if;
  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array' then
    raise exception 'allocations must be a json array' using errcode = '22023';
  end if;

  select count(*), coalesce(sum(a.amount), 0) into v_count, v_sum
  from jsonb_to_recordset(p_allocations) as a(bucket_id uuid, amount bigint);

  if v_count = 0 then
    raise exception 'at least one allocation is required' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_allocations) as a(bucket_id uuid, amount bigint)
    where a.bucket_id is null or a.amount is null or a.amount < 0
  ) then
    raise exception 'every allocation needs a bucket_id and a non-negative amount' using errcode = '22023';
  end if;
  if (select count(distinct a.bucket_id) from jsonb_to_recordset(p_allocations) as a(bucket_id uuid, amount bigint)) <> v_count then
    raise exception 'a bucket appears more than once' using errcode = '22023';
  end if;
  if v_sum <> p_amount then
    raise exception 'allocations sum to % but the amount is %', v_sum, p_amount using errcode = '22023';
  end if;

  insert into public.incomes (id, user_id, received_on, amount, note, snapshot)
  values (p_id, v_user, p_received_on, p_amount, nullif(btrim(p_note), ''), p_snapshot);

  -- The composite foreign key (bucket_id, user_id) rejects buckets of another user.
  insert into public.entries (user_id, bucket_id, income_id, kind, amount, occurred_on)
  select v_user, a.bucket_id, p_id, 'allocation', a.amount, p_received_on
  from jsonb_to_recordset(p_allocations) as a(bucket_id uuid, amount bigint)
  where a.amount > 0;

  return p_id;
end;
$$;

revoke all on function public.confirm_distribution(uuid, bigint, date, text, jsonb, jsonb) from public, anon;
grant execute on function public.confirm_distribution(uuid, bigint, date, text, jsonb, jsonb) to authenticated;
