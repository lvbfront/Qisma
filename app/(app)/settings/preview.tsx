"use client";

import { SplitBar, type Segment } from "@/components/split-bar";
import { amountToPercent } from "@/lib/allocate";
import { formatAmount, formatPercent } from "@/lib/money";
import { previewSplit, type Bucket } from "./data";

/** Split bar for the reference income plus the "what is left to live on" line and warnings. */
export function Preview({
  buckets,
  referenceIncome,
  livingFloor,
}: {
  buckets: Bucket[];
  referenceIncome: number;
  livingFloor: number;
}) {
  if (!referenceIncome) {
    return (
      <div>
        <SplitBar segments={[]} />
        <p className="mt-3 text-label text-muted">أدخل الراتب المرجعي لعرض معاينة التوزيع.</p>
      </div>
    );
  }

  const split = previewSplit(buckets, referenceIncome);

  if (!split.ok) {
    const { error } = split;
    return (
      <div>
        <SplitBar segments={[]} shortfall={error.code === "shortfall" ? error.missing : 0} />
        <p role="alert" className="mt-3 text-label font-medium text-danger">
          {error.code === "shortfall" ? (
            <>
              البنود تتجاوز الراتب المرجعي بمقدار <span className="amount">{formatAmount(error.missing)}</span>.
            </>
          ) : error.code === "remainder" ? (
            error.count === 0 ? (
              "اختر بندًا واحدًا ليكون «الباقي»."
            ) : (
              "يوجد أكثر من بند للباقي. اجعل واحدًا فقط هو «الباقي»."
            )
          ) : (
            "في البنود قيمة غير صالحة."
          )}
        </p>
      </div>
    );
  }

  const byId = new Map(buckets.map((b) => [b.id, b]));
  const segments: Segment[] = split.allocations.map((a) => ({
    id: a.bucketId,
    label: byId.get(a.bucketId)?.name ?? "",
    amount: a.amount,
    color: a.kind === "remainder" ? "remainder" : (byId.get(a.bucketId)?.color ?? 1),
  }));
  const remainder = split.allocations[split.allocations.length - 1].amount;

  return (
    <div>
      <SplitBar segments={segments} />
      <p className="mt-3">
        الباقي للمعيشة: <span className="amount font-semibold">{formatAmount(remainder)}</span>{" "}
        <span className="amount text-muted">({formatPercent(amountToPercent(remainder, referenceIncome))})</span>
      </p>
      {remainder < livingFloor && (
        <p role="status" className="mt-1 text-label font-medium text-danger">
          تنبيه: الباقي أقل من الحد الأدنى للمعيشة (<span className="amount">{formatAmount(livingFloor)}</span>).
        </p>
      )}
    </div>
  );
}
