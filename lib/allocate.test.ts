import { expect, test } from "vitest";
import { allocate, amountToPercent, percentToAmount, type Line } from "./allocate";

const SAR = 100;
const line = (bucketId: string, kind: Line["kind"], value: number, priority: number, extra: Partial<Line> = {}): Line => ({
  bucketId,
  kind,
  value,
  priority,
  enabled: true,
  ...extra,
});

// The 10,000 SAR example: fixed 2,000 + 1,200, percents 15% / 5% / 5% / 5%.
const example = (): Line[] => [
  line("rest", "remainder", 0, 99),
  line("p15", "percent", 1500, 3),
  line("f2", "fixed", 1_200 * SAR, 2),
  line("f1", "fixed", 2_000 * SAR, 1),
  line("p5a", "percent", 500, 4),
  line("p5b", "percent", 500, 5),
  line("p5c", "percent", 500, 6),
];

const amounts = (r: ReturnType<typeof allocate>) => {
  if (!r.ok) throw new Error("expected ok, got " + JSON.stringify(r.error));
  return Object.fromEntries(r.allocations.map((a) => [a.bucketId, a.amount / SAR]));
};

test("10,000 SAR example", () => {
  const r = allocate(10_000 * SAR, example());
  expect(amounts(r)).toEqual({ f1: 2000, f2: 1200, p15: 1500, p5a: 500, p5b: 500, p5c: 500, rest: 3800 });
  // fixed by priority, then percent by priority, remainder last
  expect(r.ok && r.allocations.map((a) => a.bucketId)).toEqual(["f1", "f2", "p15", "p5a", "p5b", "p5c", "rest"]);
});

test("percent is taken from the full amount and rounded down to a whole riyal", () => {
  // 15% of 7,333 = 1,099.95 -> 1,099; the 0.95 lands in the remainder
  const r = allocate(7_333 * SAR, [line("p", "percent", 1500, 1), line("rest", "remainder", 0, 2)]);
  expect(amounts(r)).toEqual({ p: 1099, rest: 6234 });
  // halalas in the amount also end up in the remainder
  const r2 = allocate(733_399, [line("p", "percent", 1500, 1), line("rest", "remainder", 0, 2)]);
  expect(r2.ok && r2.allocations.map((a) => a.amount)).toEqual([110_000, 623_399]);
});

test("shortfall names the missing amount", () => {
  expect(allocate(3_000 * SAR, example())).toEqual({
    ok: false,
    // fixed 3,200 + percents of 3,000 (450 + 150 * 3) = 4,100
    error: { code: "shortfall", missing: 1_100 * SAR },
  });
  const fixedOnly = [line("f", "fixed", 2_000 * SAR, 1), line("rest", "remainder", 0, 2)];
  expect(allocate(1_500 * SAR, fixedOnly)).toEqual({ ok: false, error: { code: "shortfall", missing: 500 * SAR } });
  expect(amounts(allocate(2_000 * SAR, fixedOnly))).toEqual({ f: 2000, rest: 0 }); // exact fit is fine
});

test("disabled line is skipped and its share goes to the remainder", () => {
  const lines = example().map((l) => (l.bucketId === "p15" ? { ...l, enabled: false } : l));
  expect(amounts(allocate(10_000 * SAR, lines))).toEqual({ f1: 2000, f2: 1200, p5a: 500, p5b: 500, p5c: 500, rest: 5300 });
});

test("override replaces the rule and the remainder is recalculated", () => {
  const lines = example().map((l) => (l.bucketId === "p15" ? { ...l, override: 1_000 * SAR } : l));
  expect(amounts(allocate(10_000 * SAR, lines))).toMatchObject({ p15: 1000, rest: 4300 });
  const zero = example().map((l) => (l.bucketId === "f1" ? { ...l, override: 0 } : l));
  expect(amounts(allocate(10_000 * SAR, zero))).toMatchObject({ f1: 0, rest: 5800 });
  const tooMuch = example().map((l) => (l.bucketId === "f1" ? { ...l, override: 6_000 * SAR } : l));
  expect(allocate(10_000 * SAR, tooMuch)).toEqual({ ok: false, error: { code: "shortfall", missing: 200 * SAR } });
});

test("exactly one enabled remainder line is required", () => {
  const none = example().filter((l) => l.kind !== "remainder");
  expect(allocate(10_000 * SAR, none)).toEqual({ ok: false, error: { code: "remainder", count: 0 } });
  expect(allocate(10_000 * SAR, [...example(), line("rest2", "remainder", 0, 100)])).toEqual({
    ok: false,
    error: { code: "remainder", count: 2 },
  });
  // a disabled second remainder does not count
  expect(allocate(10_000 * SAR, [...example(), line("rest2", "remainder", 0, 100, { enabled: false })]).ok).toBe(true);
});

test("rejects non-integer and negative input", () => {
  const rest = line("rest", "remainder", 0, 9);
  for (const bad of [-1, 0.5, NaN, Infinity]) {
    expect(allocate(bad, [rest]), String(bad)).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(allocate(1000, [rest, line("f", "fixed", bad, 1)])).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(allocate(1000, [rest, line("f", "fixed", 0, 1, { override: bad })])).toMatchObject({ ok: false, error: { code: "invalid" } });
  }
  expect(allocate(1000, [rest, line("p", "percent", 10_001, 1)])).toMatchObject({ ok: false, error: { code: "invalid" } });
});

test("property: allocations are never negative and always sum exactly to the amount", () => {
  let seed = 20261115; // fixed seed so failures reproduce
  const rand = (n: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % Math.max(1, Math.floor(n));
  };
  let ok = 0;
  for (let i = 0; i < 5000; i++) {
    const amount = rand(3) === 0 ? rand(1_000) : rand(5_000_000_00);
    const lines: Line[] = [line("rest", "remainder", 0, rand(10))];
    for (let j = rand(8); j > 0; j--) {
      const kind = rand(2) ? "fixed" : "percent";
      lines.push({
        bucketId: "b" + j,
        kind,
        value: kind === "fixed" ? rand(amount / 4 + 2) : rand(3_000),
        priority: rand(10),
        enabled: rand(5) !== 0,
        override: rand(6) === 0 ? rand(amount / 4 + 2) : undefined,
      });
    }
    const r = allocate(amount, lines);
    if (r.ok) {
      ok++;
      expect(r.allocations.reduce((s, a) => s + a.amount, 0)).toBe(amount);
      expect(r.allocations.every((a) => Number.isInteger(a.amount) && a.amount >= 0)).toBe(true);
      expect(r.allocations.length).toBe(lines.filter((l) => l.enabled).length);
    } else {
      expect(r.error.code).toBe("shortfall");
      expect(r.error.code === "shortfall" && r.error.missing).toBeGreaterThan(0);
    }
  }
  expect(ok).toBeGreaterThan(1000); // the generator must exercise the success path
});

test("percent helpers", () => {
  expect(percentToAmount(1500, 10_000 * SAR)).toBe(1_500 * SAR);
  expect(percentToAmount(1500, 7_333 * SAR)).toBe(1_099 * SAR);
  expect(percentToAmount(0, 10_000 * SAR)).toBe(0);
  expect(amountToPercent(1_500 * SAR, 10_000 * SAR)).toBe(1500);
  expect(amountToPercent(1_200 * SAR, 10_000 * SAR)).toBe(1200);
  expect(amountToPercent(500 * SAR, 0)).toBe(0);
});
