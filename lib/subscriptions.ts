// Pure subscription logic. Dates are ISO strings "YYYY-MM-DD"; money is integer halalas.
// pay_subscription() in the database implements the same date rule.

export type Cycle = { count: number; unit: "month" | "year" };

export type Subscription = {
  amount: number;
  cycle: Cycle;
  paused: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");
const daysInMonth = (year: number, month1to12: number) => new Date(Date.UTC(year, month1to12, 0)).getUTCDate();

export const cycleMonths = (cycle: Cycle) => cycle.count * (cycle.unit === "year" ? 12 : 1);

/** The billing day to store for a subscription whose first payment is on `date`. */
export const billingDayOf = (date: string) => Number(date.slice(8, 10));

/**
 * The due date one cycle after `current`. `billingDay` is the original day of the
 * month (1-31): short months clamp to their last day, and later months return to
 * the original day, so 31 Jan -> 28 Feb -> 31 Mar never drifts to the 28th.
 */
export function nextDueDate(current: string, cycle: Cycle, billingDay: number): string {
  const months = cycleMonths(cycle);
  if (!Number.isInteger(months) || months < 1) throw new RangeError("cycle must be at least 1 month");
  if (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) throw new RangeError("billingDay must be 1-31");
  const index = Number(current.slice(0, 4)) * 12 + (Number(current.slice(5, 7)) - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${pad(month)}-${pad(Math.min(billingDay, daysInMonth(year, month)))}`;
}

/** Cost per month in halalas, rounded to the nearest halala. Derived, never stored. */
export const monthlyEquivalent = (amount: number, cycle: Cycle) => Math.round(amount / cycleMonths(cycle));

/** Cost per year in halalas, rounded to the nearest halala. Derived, never stored. */
export const yearlyEquivalent = (amount: number, cycle: Cycle) => Math.round((amount * 12) / cycleMonths(cycle));

/** Totals across active (not paused) subscriptions. Derived, never stored. */
export function totals(subscriptions: Subscription[]): { perMonth: number; perYear: number } {
  const active = subscriptions.filter((s) => !s.paused);
  return {
    perMonth: active.reduce((sum, s) => sum + monthlyEquivalent(s.amount, s.cycle), 0),
    perYear: active.reduce((sum, s) => sum + yearlyEquivalent(s.amount, s.cycle), 0),
  };
}

/** "شهري", "سنوي", "كل 3 أشهر", "كل سنتين" ... */
export function cycleLabel(cycle: Cycle): string {
  const n = cycle.count;
  if (cycle.unit === "month") {
    if (n === 1) return "شهري";
    if (n === 2) return "كل شهرين";
    return n <= 10 ? `كل ${n} أشهر` : `كل ${n} شهرًا`;
  }
  if (n === 1) return "سنوي";
  if (n === 2) return "كل سنتين";
  return n <= 10 ? `كل ${n} سنوات` : `كل ${n} سنة`;
}

/** Days left until a payment: "اليوم", "بعد 4 أيام", "متأخر 2 يوم". Negative = overdue. */
export function dueLabel(daysLeft: number): string {
  if (daysLeft === 0) return "اليوم";
  if (daysLeft < 0) return `متأخر ${-daysLeft} يوم`;
  if (daysLeft === 1) return "بعد يوم";
  if (daysLeft === 2) return "بعد يومين";
  return daysLeft <= 10 ? `بعد ${daysLeft} أيام` : `بعد ${daysLeft} يومًا`;
}
