// Pure investment logic. Cost basis only: no market prices, no unrealised gains.
// Dates are ISO strings "YYYY-MM-DD"; money is integer halalas.
// The investment_positions view in the database computes the same figures.

export type Investment = {
  /** Amount invested (halalas, > 0). */
  amount: number;
  status: "open" | "closed";
  expectedReturnOn?: string | null;
};

/** Total of all money that came back (each return is a positive amount). */
export const totalReturned = (returns: number[]) => returns.reduce((sum, r) => sum + r, 0);

/** Money still out with the platform. Never negative; nothing is outstanding once closed. */
export const outstanding = (investment: Investment, returns: number[]) =>
  investment.status === "closed" ? 0 : Math.max(investment.amount - totalReturned(returns), 0);

/**
 * Total returned minus amount invested: positive = profit, negative = loss.
 * It only becomes the investment's final result when the investment is closed.
 */
export const result = (investment: Investment, returns: number[]) => totalReturned(returns) - investment.amount;

/** Whole days from `today` to the expected return date (negative = late). Null if not applicable. */
export function daysToExpectedReturn(investment: Investment, today: string): number | null {
  if (investment.status === "closed" || !investment.expectedReturnOn) return null;
  return Math.round((Date.parse(investment.expectedReturnOn) - Date.parse(today)) / 86_400_000);
}

/** Open and past its expected return date. */
export const isOverdue = (investment: Investment, today: string) => (daysToExpectedReturn(investment, today) ?? 0) < 0;
