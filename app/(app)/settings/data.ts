import type { SupabaseClient } from "@supabase/supabase-js";
import type { Segment } from "@/components/split-bar";
import { allocate, type Allocation, type Line, type RuleKind } from "@/lib/allocate";

export type AccountKind = "current" | "savings" | "investment" | "cash";

export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  sort_order: number;
  receives_income: boolean;
};

export type Bucket = {
  id: string;
  name: string;
  rule_kind: RuleKind;
  /** fixed: halalas. percent: basis points. remainder: 0. */
  rule_value: number;
  priority: number;
  account_id: string;
  /** 1-8, a bucket-N colour token */
  color: number;
  active: boolean;
  is_investment: boolean;
};

/** Just enough of a subscription to compare its monthly cost with its bucket. */
export type LinkedSubscription = {
  amount: number;
  cycle_count: number;
  cycle_unit: "month" | "year";
  bucket_id: string | null;
  paused: boolean;
};

export type SettingsData = {
  referenceIncome: number;
  livingFloor: number;
  accounts: Account[];
  buckets: Bucket[];
  subscriptions: LinkedSubscription[];
  /** The bucket a subscription with no bucket of its own is paid from. */
  defaultSubscriptionBucketId: string | null;
};

/** Everything the settings screen shows. Works with the server or the browser client. */
export async function loadSettings(supabase: SupabaseClient): Promise<SettingsData> {
  const [settings, accounts, buckets, subscriptions] = await Promise.all([
    supabase.from("settings").select("reference_income, living_floor, default_subscription_bucket_id").maybeSingle(),
    supabase.from("accounts").select("id, name, kind, sort_order, receives_income").order("sort_order").order("created_at"),
    supabase
      .from("buckets")
      .select("id, name, rule_kind, rule_value, priority, account_id, color, active, is_investment")
      .order("priority")
      .order("created_at"),
    supabase.from("subscriptions").select("amount, cycle_count, cycle_unit, bucket_id, paused"),
  ]);
  const error = settings.error ?? accounts.error ?? buckets.error ?? subscriptions.error;
  if (error) throw new Error(error.message);
  return {
    referenceIncome: settings.data?.reference_income ?? 0,
    livingFloor: settings.data?.living_floor ?? 0,
    accounts: accounts.data as Account[],
    buckets: buckets.data as Bucket[],
    subscriptions: subscriptions.data as LinkedSubscription[],
    defaultSubscriptionBucketId: settings.data?.default_subscription_bucket_id ?? null,
  };
}

export const toLine = (b: Bucket): Line => ({
  bucketId: b.id,
  kind: b.rule_kind,
  value: b.rule_value,
  priority: b.priority,
  enabled: b.active,
});

/** The split of the reference income under the given buckets (the real allocate()). */
export const previewSplit = (buckets: Bucket[], referenceIncome: number) =>
  allocate(referenceIncome, buckets.map(toLine));

/** Split-bar segments for a set of allocations: bucket colours, accent for the remainder. */
export function toSegments(allocations: Allocation[], buckets: Pick<Bucket, "id" | "name" | "color">[]): Segment[] {
  const byId = new Map(buckets.map((b) => [b.id, b]));
  return allocations.map((a) => ({
    id: a.bucketId,
    label: byId.get(a.bucketId)?.name ?? "",
    amount: a.amount,
    color: a.kind === "remainder" ? "remainder" : (byId.get(a.bucketId)?.color ?? 1),
  }));
}

/** Classes shared by the forms. */
export const ui = {
  field:
    "w-full rounded-control border border-hairline bg-surface px-3 py-2.5 text-base outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30",
  label: "block text-label font-medium",
  primary:
    "rounded-control bg-accent px-4 py-3 font-semibold text-on-accent transition-opacity disabled:opacity-50",
  secondary: "rounded-control border border-hairline bg-surface px-4 py-3 font-medium",
  card: "rounded-card border border-hairline bg-surface p-4",
};

/** Arabic message for a failed Supabase write. */
export function errorText(error: { code?: string }): string {
  if (error.code === "23503") return "لا يمكن الحذف لأنه مرتبط ببيانات أخرى.";
  if (error.code === "23505") return "هذه الصفة مسموحة لعنصر واحد فقط.";
  return "تعذّر الحفظ. حاول مرة أخرى.";
}
