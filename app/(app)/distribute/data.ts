import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account, Bucket } from "../settings/data";

export type TransferEntry = { id: string; bucket_id: string; amount: number; transfer_done: boolean };

export type TransfersData = {
  income: { id: string; amount: number; received_on: string; note: string | null };
  entries: TransferEntry[];
  accounts: Account[];
  buckets: Bucket[];
};

export type TransferGroup = {
  account: Account | undefined;
  total: number;
  items: { entryId: string; name: string; color: number; isRemainder: boolean; amount: number }[];
  done: boolean;
};

const BUCKET_COLUMNS = "id, name, rule_kind, rule_value, priority, account_id, color, active, is_investment";
const ACCOUNT_COLUMNS = "id, name, kind, sort_order, receives_income";

/** One confirmed distribution with everything its transfers checklist needs. Null if not found. */
export async function loadTransfers(supabase: SupabaseClient, incomeId: string): Promise<TransfersData | null> {
  const [income, entries, accounts, buckets] = await Promise.all([
    supabase.from("incomes").select("id, amount, received_on, note").eq("id", incomeId).maybeSingle(),
    supabase.from("entries").select("id, bucket_id, amount, transfer_done").eq("income_id", incomeId).eq("kind", "allocation"),
    supabase.from("accounts").select(ACCOUNT_COLUMNS).order("sort_order").order("created_at"),
    supabase.from("buckets").select(BUCKET_COLUMNS).order("priority").order("created_at"),
  ]);
  const error = income.error ?? entries.error ?? accounts.error ?? buckets.error;
  if (error) throw new Error(error.message);
  if (!income.data) return null;
  return {
    income: income.data,
    entries: entries.data as TransferEntry[],
    accounts: accounts.data as Account[],
    buckets: buckets.data as Bucket[],
  };
}

/**
 * Groups a distribution's entries by the account each bucket lives in.
 * `stay` = buckets in the income account (nothing to do); `transfers` = one group per other account.
 */
export function groupTransfers({ entries, accounts, buckets }: Pick<TransfersData, "entries" | "accounts" | "buckets">) {
  const bucketById = new Map(buckets.map((b) => [b.id, b]));
  const incomeAccount = accounts.find((a) => a.receives_income);
  const groups = new Map<string, TransferGroup>();

  // Buckets are already in priority order; keep that order inside each group.
  const ordered = [...entries].sort(
    (a, b) => buckets.findIndex((x) => x.id === a.bucket_id) - buckets.findIndex((x) => x.id === b.bucket_id),
  );
  for (const e of ordered) {
    const bucket = bucketById.get(e.bucket_id);
    const accountId = bucket?.account_id ?? "";
    const group = groups.get(accountId) ?? {
      account: accounts.find((a) => a.id === accountId),
      total: 0,
      items: [],
      done: true,
    };
    group.total += e.amount;
    group.done &&= e.transfer_done;
    group.items.push({
      entryId: e.id,
      name: bucket?.name ?? "",
      color: bucket?.color ?? 1,
      isRemainder: bucket?.rule_kind === "remainder",
      amount: e.amount,
    });
    groups.set(accountId, group);
  }

  const stay = incomeAccount ? groups.get(incomeAccount.id) : undefined;
  const transfers = [...groups.values()]
    .filter((g) => g !== stay)
    .sort((a, b) => (a.account?.sort_order ?? 0) - (b.account?.sort_order ?? 0));
  return { incomeAccount, stay, transfers };
}

export type PendingDistribution = {
  incomeId: string;
  amount: number;
  receivedOn: string;
  /** Still to move out of the income account. */
  remaining: number;
  accounts: number;
};

/** Distributions that still have unticked transfers (for the home screen). */
export async function loadPending(supabase: SupabaseClient): Promise<PendingDistribution[]> {
  const [entries, buckets, accounts] = await Promise.all([
    supabase
      .from("entries")
      .select("income_id, bucket_id, amount")
      .eq("kind", "allocation")
      .eq("transfer_done", false),
    supabase.from("buckets").select("id, account_id"),
    supabase.from("accounts").select("id, receives_income"),
  ]);
  const error = entries.error ?? buckets.error ?? accounts.error;
  if (error) throw new Error(error.message);

  const accountOf = new Map((buckets.data ?? []).map((b) => [b.id, b.account_id]));
  const incomeAccount = (accounts.data ?? []).find((a) => a.receives_income)?.id;
  // Money that stays in the income account never needs a transfer, so it is never pending.
  const open = (entries.data ?? []).filter((e) => accountOf.get(e.bucket_id) !== incomeAccount);
  const ids = [...new Set(open.map((e) => e.income_id as string))];
  if (ids.length === 0) return [];

  const incomes = await supabase.from("incomes").select("id, amount, received_on").in("id", ids).order("received_on", { ascending: false });
  if (incomes.error) throw new Error(incomes.error.message);
  return incomes.data.map((income) => {
    const mine = open.filter((e) => e.income_id === income.id);
    return {
      incomeId: income.id,
      amount: income.amount,
      receivedOn: income.received_on,
      remaining: mine.reduce((sum, e) => sum + e.amount, 0),
      accounts: new Set(mine.map((e) => accountOf.get(e.bucket_id))).size,
    };
  });
}
