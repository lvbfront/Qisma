import type { Segment } from "@/components/split-bar";
import type { RuleKind } from "@/lib/allocate";
import { formatPercent } from "@/lib/money";

// What confirm stores in incomes.snapshot (see distribute.tsx). History and the home
// screen read distributions from here, so they stay correct after rules change.
type SnapshotLine = {
  bucketId: string;
  kind: RuleKind;
  value: number;
  enabled: boolean;
  override?: number;
  name: string;
  color: number;
  accountName?: string;
};

export type SnapshotRow = {
  bucketId: string;
  name: string;
  color: number | "remainder";
  /** "ثابت", "15%" or "الباقي" */
  rule: string;
  /** halalas; 0 for a line that was switched off */
  amount: number;
  off: boolean;
  overridden: boolean;
  accountName: string;
};

/** The rows of a stored distribution, in the order it was split. Empty if the snapshot is unreadable. */
export function snapshotRows(snapshot: unknown): SnapshotRow[] {
  const s = snapshot as { lines?: SnapshotLine[]; allocations?: { bucketId: string; amount: number }[] } | null;
  if (!Array.isArray(s?.lines) || !Array.isArray(s?.allocations)) return [];
  const lineById = new Map(s.lines.map((l) => [l.bucketId, l]));
  const toRow = (line: SnapshotLine, amount: number): SnapshotRow => ({
    bucketId: line.bucketId,
    name: line.name ?? "",
    color: line.kind === "remainder" ? "remainder" : (line.color ?? 1),
    rule: line.kind === "fixed" ? "ثابت" : line.kind === "percent" ? formatPercent(line.value) : "الباقي",
    amount,
    off: !line.enabled,
    overridden: line.enabled && line.override !== undefined,
    accountName: line.accountName ?? "",
  });
  return [
    ...s.allocations.flatMap((a) => {
      const line = lineById.get(a.bucketId);
      return line ? [toRow(line, a.amount)] : [];
    }),
    // Lines switched off for that distribution: listed after, with no amount.
    ...s.lines.filter((l) => !l.enabled).map((l) => toRow(l, 0)),
  ];
}

export const snapshotSegments = (rows: SnapshotRow[]): Segment[] =>
  rows.filter((r) => !r.off).map((r) => ({ id: r.bucketId, label: r.name, amount: r.amount, color: r.color }));
