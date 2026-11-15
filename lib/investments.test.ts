import { expect, test } from "vitest";
import { daysToExpectedReturn, groupByPlatform, isOverdue, outstanding, result, totalReturned, type Investment } from "./investments";

const SAR = 100;
const open: Investment = { amount: 10_000 * SAR, status: "open", expectedReturnOn: "2027-01-31" };
const closed: Investment = { ...open, status: "closed" };

test("partial returns reduce what is outstanding", () => {
  expect(outstanding(open, [])).toBe(10_000 * SAR);
  expect(outstanding(open, [2_000 * SAR, 1_500 * SAR])).toBe(6_500 * SAR);
  expect(totalReturned([2_000 * SAR, 1_500 * SAR])).toBe(3_500 * SAR);
  // returns beyond the amount invested are profit, not negative outstanding
  expect(outstanding(open, [6_000 * SAR, 6_000 * SAR])).toBe(0);
  expect(outstanding(closed, [2_000 * SAR])).toBe(0);
});

test("profit", () => {
  expect(result(closed, [5_000 * SAR, 5_000 * SAR, 500 * SAR])).toBe(500 * SAR);
});

test("loss, including nothing returned at all", () => {
  expect(result(closed, [7_000 * SAR])).toBe(-3_000 * SAR);
  expect(result(closed, [])).toBe(-10_000 * SAR);
});

test("break-even", () => {
  expect(result(closed, [10_000 * SAR])).toBe(0);
});

test("overdue and days to expected return", () => {
  expect(daysToExpectedReturn(open, "2027-01-01")).toBe(30);
  expect(isOverdue(open, "2027-01-01")).toBe(false);
  expect(daysToExpectedReturn(open, "2027-01-31")).toBe(0);
  expect(isOverdue(open, "2027-01-31")).toBe(false); // due today is not overdue
  expect(daysToExpectedReturn(open, "2027-02-03")).toBe(-3);
  expect(isOverdue(open, "2027-02-03")).toBe(true);
  // closed, or no expected date: never overdue
  expect(isOverdue(closed, "2030-01-01")).toBe(false);
  expect(daysToExpectedReturn(closed, "2030-01-01")).toBeNull();
  expect(isOverdue({ amount: 100, status: "open" }, "2030-01-01")).toBe(false);
});

test("groupByPlatform: alphabetical groups, subtotal of what is outstanding, soonest first", () => {
  const groups = groupByPlatform([
    { platform: "ب", outstanding: 500 * SAR, expectedReturnOn: null, id: 1 },
    { platform: "أ", outstanding: 300 * SAR, expectedReturnOn: "2027-03-01", id: 2 },
    { platform: "ب", outstanding: 200 * SAR, expectedReturnOn: "2027-01-01", id: 3 },
  ]);
  expect(groups.map((g) => [g.platform, g.subtotal / SAR, g.items.map((i) => i.id)])).toEqual([
    ["أ", 300, [2]],
    ["ب", 700, [3, 1]],
  ]);
});

test("example: invest 500, receive 540, close -> profit 40", () => {
  const inv: Investment = { amount: 500 * SAR, status: "open" };
  expect(outstanding(inv, [540 * SAR])).toBe(0);
  expect(result(inv, [540 * SAR])).toBe(40 * SAR);
});
