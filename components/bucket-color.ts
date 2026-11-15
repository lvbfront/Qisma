// Plain module (no "use client") so both server and client components can call it.

/** 1-8 = bucket colour token; "remainder" = the accent colour; "muted" = the quiet grey (money that is away). */
export type BucketColor = number | "remainder" | "muted";

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

/** Background class for a split-bar segment or the dot next to a bucket name. */
export const bucketBg = (color: BucketColor) =>
  color === "remainder" ? "bg-accent" : color === "muted" ? "bg-muted" : (BUCKET_BG[color - 1] ?? BUCKET_BG[0]);
