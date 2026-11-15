import type { SupabaseClient } from "@supabase/supabase-js";

/** One row of the investment_positions view, camelCased. Cost basis only. */
export type Position = {
  id: string;
  platform: string;
  title: string | null;
  status: "open" | "closed";
  investedOn: string;
  expectedReturnOn: string | null;
  expectedProfit: number | null;
  closedOn: string | null;
  /** halalas */
  invested: number;
  returned: number;
  outstanding: number;
  /** Fixed at closing: returned - invested. Null while open. */
  result: number | null;
};

export type Summary = { available: number; invested: number; realisedProfit: number };

export type InvestmentsData = {
  /** False until a bucket is flagged as the investment bucket in settings. */
  hasInvestmentBucket: boolean;
  summary: Summary;
  positions: Position[];
};

export async function loadInvestments(supabase: SupabaseClient): Promise<InvestmentsData> {
  const [bucket, summary, positions] = await Promise.all([
    supabase.from("buckets").select("id").eq("is_investment", true).eq("active", true).maybeSingle(),
    supabase.from("investment_summary").select("available, currently_invested, realised_profit").maybeSingle(),
    supabase
      .from("investment_positions")
      .select(
        "investment_id, platform, title, status, invested_on, expected_return_on, expected_profit, closed_on, invested, returned, outstanding, result",
      )
      .order("invested_on", { ascending: false }),
  ]);
  const error = bucket.error ?? summary.error ?? positions.error;
  if (error) throw new Error(error.message);
  return {
    hasInvestmentBucket: !!bucket.data,
    summary: {
      available: summary.data?.available ?? 0,
      invested: summary.data?.currently_invested ?? 0,
      realisedProfit: summary.data?.realised_profit ?? 0,
    },
    positions: (positions.data ?? []).map((p) => ({
      id: p.investment_id,
      platform: p.platform,
      title: p.title,
      status: p.status,
      investedOn: p.invested_on,
      expectedReturnOn: p.expected_return_on,
      expectedProfit: p.expected_profit,
      closedOn: p.closed_on,
      invested: p.invested,
      returned: p.returned,
      outstanding: p.outstanding,
      result: p.result,
    })),
  };
}
