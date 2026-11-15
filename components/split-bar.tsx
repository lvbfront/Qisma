"use client";

import { motion, useReducedMotion } from "motion/react";
import { formatAmount } from "@/lib/money";

export type Segment = {
  id: string;
  label: string;
  /** halalas */
  amount: number;
  /** 1-8 = bucket colour token; "remainder" = the accent colour */
  color: number | "remainder";
};

// Full class names so Tailwind can see them.
const BUCKET_BG = [
  "bg-bucket-1",
  "bg-bucket-2",
  "bg-bucket-3",
  "bg-bucket-4",
  "bg-bucket-5",
  "bg-bucket-6",
  "bg-bucket-7",
  "bg-bucket-8",
];

/** Background class for a bucket colour (also used for the dot next to a bucket name). */
export const bucketBg = (color: Segment["color"]) =>
  color === "remainder" ? "bg-accent" : (BUCKET_BG[color - 1] ?? BUCKET_BG[0]);

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
