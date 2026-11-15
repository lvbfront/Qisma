// Pure allocation: no I/O, no React, no Supabase. All money is integer halalas.

export type RuleKind = "fixed" | "percent" | "remainder";

export type Line = {
  bucketId: string;
  kind: RuleKind;
  /** fixed: halalas. percent: basis points (10% = 1000). remainder: ignored. */
  value: number;
  priority: number;
  enabled: boolean;
  /** Exact halalas to use instead of the rule. Ignored on the remainder line. */
  override?: number;
};

export type Allocation = { bucketId: string; kind: RuleKind; amount: number };

export type AllocateError =
  | { code: "invalid"; message: string }
  /** Exactly one enabled remainder line is required; `count` is how many were found. */
  | { code: "remainder"; count: number }
  /** Fixed + percent lines need `missing` halalas more than the amount. */
  | { code: "shortfall"; missing: number };

export type Result =
  | { ok: true; allocations: Allocation[] }
  | { ok: false; error: AllocateError };

const BPS = 10_000;
const RIYAL = 100;
const MAX_AMOUNT = Math.floor(Number.MAX_SAFE_INTEGER / BPS); // keeps amount * bps exact

const isAmount = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_AMOUNT;

/** bps of `reference`, rounded DOWN to a whole riyal. Integer math only. */
export function percentToAmount(bps: number, reference: number): number {
  const scaled = reference * bps; // halalas x bps, exact below MAX_AMOUNT
  return ((scaled - (scaled % (BPS * RIYAL))) / (BPS * RIYAL)) * RIYAL;
}

/** What share of `reference` an amount is, in basis points (nearest). 0 if reference is 0. */
export function amountToPercent(halalas: number, reference: number): number {
  return reference > 0 ? Math.round((halalas * BPS) / reference) : 0;
}

/**
 * Split `amount` across `lines`.
 * Output order: fixed lines by priority, then percent lines by priority, then the remainder.
 * On success the allocations are all >= 0 and sum exactly to `amount`.
 */
export function allocate(amount: number, lines: Line[]): Result {
  const invalid = (message: string): Result => ({ ok: false, error: { code: "invalid", message } });
  if (!isAmount(amount)) return invalid("amount must be a non-negative integer of halalas");

  const enabled = lines.filter((l) => l.enabled);
  for (const l of enabled) {
    if (l.kind === "remainder") continue;
    if (!isAmount(l.value)) return invalid(`line ${l.bucketId}: value must be a non-negative integer`);
    if (l.kind === "percent" && l.value > BPS) return invalid(`line ${l.bucketId}: percent above 100%`);
    if (l.override !== undefined && !isAmount(l.override))
      return invalid(`line ${l.bucketId}: override must be a non-negative integer`);
  }

  const remainders = enabled.filter((l) => l.kind === "remainder");
  if (remainders.length !== 1) return { ok: false, error: { code: "remainder", count: remainders.length } };

  const byPriority = (kind: RuleKind) =>
    enabled.filter((l) => l.kind === kind).sort((a, b) => a.priority - b.priority); // stable

  const allocations: Allocation[] = [...byPriority("fixed"), ...byPriority("percent")].map((l) => ({
    bucketId: l.bucketId,
    kind: l.kind,
    amount: l.override ?? (l.kind === "fixed" ? l.value : percentToAmount(l.value, amount)),
  }));

  const taken = allocations.reduce((sum, a) => sum + a.amount, 0);
  if (taken > amount) return { ok: false, error: { code: "shortfall", missing: taken - amount } };

  allocations.push({ bucketId: remainders[0].bucketId, kind: "remainder", amount: amount - taken });
  return { ok: true, allocations };
}
