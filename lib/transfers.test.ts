import { expect, test } from "vitest";
import { adjustmentDelta, needsBankTransfer, transferError, transferLegs } from "./transfers";

const SAR = 100;
const base = { balance: 3_800 * SAR, fromBucketId: "living", toBucketId: "travel" };

test("a valid transfer", () => {
  expect(transferError({ ...base, amount: 500 * SAR })).toBeNull();
  expect(transferError({ ...base, amount: 3_800 * SAR })).toBeNull(); // the whole balance is allowed
  expect(transferError({ ...base, amount: 1 })).toBeNull();
});

test("refuses more than the source balance", () => {
  expect(transferError({ ...base, amount: 3_800 * SAR + 1 })).toBe("exceeds-balance");
  expect(transferError({ ...base, balance: 0, amount: 1 })).toBe("exceeds-balance");
  expect(transferError({ ...base, balance: -500, amount: 1 })).toBe("exceeds-balance");
});

test("refuses a missing or bad amount, the same bucket, or no destination", () => {
  for (const amount of [null, 0, -100, 1.5, NaN]) expect(transferError({ ...base, amount })).toBe("invalid-amount");
  expect(transferError({ ...base, toBucketId: "living", amount: 100 })).toBe("same-bucket");
  expect(transferError({ ...base, toBucketId: "", amount: 100 })).toBe("no-destination");
});

test("the two legs always sum to zero, so the total across buckets does not change", () => {
  const balances = { living: 3_800 * SAR, travel: 500 * SAR, rent: 2_000 * SAR };
  const total = (b: Record<string, number>) => Object.values(b).reduce((s, x) => s + x, 0);
  const before = total(balances);
  let seed = 7;
  const rand = (n: number) => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) % n);
  const names = Object.keys(balances) as (keyof typeof balances)[];
  let made = 0;
  for (let i = 0; i < 2000; i++) {
    const from = names[rand(3)];
    const to = names[rand(3)];
    const amount = rand(1_000 * SAR);
    if (transferError({ amount, balance: balances[from], fromBucketId: from, toBucketId: to })) continue;
    const legs = transferLegs(amount);
    expect(legs.source + legs.destination).toBe(0);
    balances[from] += legs.source;
    balances[to] += legs.destination;
    made++;
    expect(balances[from]).toBeGreaterThanOrEqual(0); // never overdrawn
  }
  expect(made).toBeGreaterThan(200);
  expect(total(balances)).toBe(before);
});

test("a bank transfer is needed only across accounts", () => {
  expect(needsBankTransfer("current", "savings")).toBe(true);
  expect(needsBankTransfer("current", "current")).toBe(false);
});

test("an adjustment, unlike a transfer, changes the total by its delta", () => {
  expect(adjustmentDelta(300 * SAR, 350 * SAR)).toBe(50 * SAR);
  expect(adjustmentDelta(300 * SAR, 250 * SAR)).toBe(-50 * SAR);
  expect(adjustmentDelta(300 * SAR, 300 * SAR)).toBe(0);
});
