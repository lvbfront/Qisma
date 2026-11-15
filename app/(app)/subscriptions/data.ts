import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cycle } from "@/lib/subscriptions";

export type SubscriptionRow = {
  id: string;
  name: string;
  /** halalas */
  amount: number;
  cycle_count: number;
  cycle_unit: "month" | "year";
  /** ISO date */
  next_due_on: string;
  /** The original day of the month (1-31); see CLAUDE.md, Database. */
  billing_day: number;
  bucket_id: string | null;
  paused: boolean;
  note: string | null;
};

export const SUBSCRIPTION_COLUMNS =
  "id, name, amount, cycle_count, cycle_unit, next_due_on, billing_day, bucket_id, paused, note";

export const cycleOf = (s: Pick<SubscriptionRow, "cycle_count" | "cycle_unit">): Cycle => ({
  count: s.cycle_count,
  unit: s.cycle_unit,
});

/** All subscriptions, nearest payment first. */
export async function loadSubscriptions(supabase: SupabaseClient): Promise<SubscriptionRow[]> {
  const { data, error } = await supabase.from("subscriptions").select(SUBSCRIPTION_COLUMNS).order("next_due_on").order("created_at");
  if (error) throw new Error(error.message);
  return data as SubscriptionRow[];
}

/** Today's date in Riyadh, "YYYY-MM-DD". Call only at request time. */
export const todayInRiyadh = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
