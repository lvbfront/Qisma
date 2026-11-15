// Dates are ISO strings "YYYY-MM-DD" everywhere in data. This is for display only.

const arabic = new Intl.DateTimeFormat("ar-u-nu-latn-ca-gregory", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-11-15" -> "15 نوفمبر 2026" (Gregorian, Western digits). A bare ISO date is reordered by RTL text. */
export const formatDate = (iso: string): string => arabic.format(new Date(iso + "T00:00:00Z"));

/** Whole days from `from` to `to` (negative if `to` is earlier). Both are ISO dates. */
export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/** The ISO date `days` after `iso`. */
export const addDays = (iso: string, days: number): string =>
  new Date(Date.parse(iso) + days * 86_400_000).toISOString().slice(0, 10);
