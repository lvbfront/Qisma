"use client";

import { motion, useReducedMotion } from "motion/react";
import { formatAmount } from "@/lib/money";
import { bucketBg, type BucketColor } from "./bucket-color";

export type Segment = {
  id: string;
  label: string;
  /** halalas */
  amount: number;
  color: BucketColor;
};

/**
 * The split bar: one amount divided into coloured segments, in the order given.
 * In RTL it fills from the inline-start (right) edge.
 * `shortfall` > 0 switches the whole bar to the warning state.
 */
export function SplitBar({ segments, shortfall = 0 }: { segments: Segment[]; shortfall?: number }) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const };

  // Text alternative: every bucket and its amount, including zero ones.
  const label =
    shortfall > 0
      ? `البنود تتجاوز المبلغ بمقدار ${formatAmount(shortfall)}`
      : segments.length
        ? segments.map((s) => `${s.label}: ${formatAmount(s.amount)}`).join("، ")
        : "لا توجد بنود";

  return (
    <div role="img" aria-label={label} className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full bg-hairline">
      {shortfall > 0 ? (
        <div className="w-full bg-danger" />
      ) : (
        segments
          .filter((s) => s.amount > 0)
          .map((s) => (
            <motion.div
              key={s.id}
              className={`h-full min-w-0 basis-0 ${bucketBg(s.color)}`}
              initial={{ flexGrow: 0 }}
              animate={{ flexGrow: s.amount }}
              transition={transition}
            />
          ))
      )}
    </div>
  );
}
