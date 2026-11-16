-- Qisma: reopen an investment that was closed by mistake.
-- Closing fixes status, closed_on and result, and the app cannot write those columns,
-- so undoing it needs its own function. Entries are not touched.
-- Needs no app-generated id: reopening an investment that is not closed is rejected,
-- so a double submit cannot change anything.
create function public.reopen_investment(p_investment_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := auth.uid();
  v_status text;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select i.status into v_status from public.investments i
  where i.id = p_investment_id and i.user_id = v_user
  for update;
  if not found then
    raise exception 'investment not found' using errcode = 'P0002';
  end if;
  if v_status <> 'closed' then
    raise exception 'investment is not closed' using errcode = '22023';
  end if;

  update public.investments
  set status = 'open', closed_on = null, result = null
  where id = p_investment_id;
end;
$$;

revoke all on function public.reopen_investment(uuid) from public, anon;
grant execute on function public.reopen_investment(uuid) to authenticated;
