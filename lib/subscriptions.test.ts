import { expect, test } from "vitest";
import { billingDayOf, monthlyEquivalent, nextDueDate, totals, yearlyEquivalent, type Cycle } from "./subscriptions";

const SAR = 100;
const monthly: Cycle = { count: 1, unit: "month" };
const quarterly: Cycle = { count: 3, unit: "month" };
const yearly: Cycle = { count: 1, unit: "year" };

/** Pay `n` times in a row, like the app does. */
const walk = (start: string, cycle: Cycle, n: number) => {
  const day = billingDayOf(start);
  const dates = [start];
  for (let i = 0; i < n; i++) dates.push(nextDueDate(dates[dates.length - 1], cycle, day));
  return dates;
};

test("month-end: clamps to short months and returns to the original day", () => {
  expect(walk("2026-01-31", monthly, 4)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
  expect(walk("2028-01-31", monthly, 2)).toEqual(["2028-01-31", "2028-02-29", "2028-03-31"]); // leap year
  expect(walk("2026-01-30", monthly, 2)).toEqual(["2026-01-30", "2026-02-28", "2026-03-30"]);
});

test("ordinary days and year rollover", () => {
  expect(walk("2026-11-15", monthly, 3)).toEqual(["2026-11-15", "2026-12-15", "2027-01-15", "2027-02-15"]);
  expect(walk("2026-11-30", quarterly, 2)).toEqual(["2026-11-30", "2027-02-28", "2027-05-30"]);
});

test("yearly cycles, including 29 Feb", () => {
  expect(walk("2026-03-10", yearly, 2)).toEqual(["2026-03-10", "2027-03-10", "2028-03-10"]);
  expect(walk("2028-02-29", yearly, 4)).toEqual(["2028-02-29", "2029-02-28", "2030-02-28", "2031-02-28", "2032-02-29"]);
  expect(nextDueDate("2026-06-01", { count: 2, unit: "year" }, 1)).toBe("2028-06-01");
});

test("rejects a bad cycle or billing day", () => {
  expect(() => nextDueDate("2026-01-31", { count: 0, unit: "month" }, 31)).toThrow();
  expect(() => nextDueDate("2026-01-31", monthly, 32)).toThrow();
});

test("monthly and yearly equivalents", () => {
  expect(monthlyEquivalent(30 * SAR, monthly)).toBe(30 * SAR);
  expect(monthlyEquivalent(1_200 * SAR, yearly)).toBe(100 * SAR);
  expect(monthlyEquivalent(90 * SAR, quarterly)).toBe(30 * SAR);
  expect(monthlyEquivalent(100 * SAR, yearly)).toBe(833); // 8.333… SAR -> 8.33
  expect(yearlyEquivalent(30 * SAR, monthly)).toBe(360 * SAR);
  expect(yearlyEquivalent(90 * SAR, quarterly)).toBe(360 * SAR);
});

test("totals skip paused subscriptions", () => {
  const subs = [
    { amount: 30 * SAR, cycle: monthly, paused: false },
    { amount: 1_200 * SAR, cycle: yearly, paused: false },
    { amount: 90 * SAR, cycle: quarterly, paused: false },
    { amount: 500 * SAR, cycle: monthly, paused: true },
  ];
  expect(totals(subs)).toEqual({ perMonth: 160 * SAR, perYear: 1_920 * SAR });
  expect(totals([])).toEqual({ perMonth: 0, perYear: 0 });
});
