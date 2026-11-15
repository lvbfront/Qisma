// Money is integer halalas (1 SAR = 100 halalas). No floats pass through here.

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;

/** Parse user input ("10,000", "1500.5", "١٢٫٥٠") to halalas. Returns null if invalid. */
export function parseAmount(input: string): number | null {
  const s = input
    .replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) & 0xf)) // both Arabic digit blocks end in 0-9 nibbles
    .replace(/٫/g, ".")
    .replace(/[,٬\s]/g, "");
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const halalas = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(halalas) ? halalas : null;
}

/** Halalas as a plain number string: "10,000" or "10,000.50". Safe to feed back to parseAmount. */
export function formatNumber(halalas: number): string {
  if (!Number.isSafeInteger(halalas)) throw new RangeError("halalas must be an integer");
  const abs = Math.abs(halalas);
  const frac = abs % 100;
  const num =
    Math.trunc(abs / 100).toLocaleString("en-US") +
    (frac ? "." + String(frac).padStart(2, "0") : "");
  // LTR isolate keeps the minus sign in front of the digits inside RTL text.
  return halalas < 0 ? `\u2066-${num}\u2069` : num;
}

/** Format halalas as "10,000 ر.س" (halalas shown only when non-zero: "10,000.50 ر.س"). */
export const formatAmount = (halalas: number): string => formatNumber(halalas) + " ر.س";

/**
 * Like formatAmount, with an explicit "+" on gains: "+500 ر.س", "-200 ر.س", "0 ر.س".
 * The sign and digits sit in an LTR isolate; in RTL text a bare "+50" is drawn as "50+".
 */
export const formatSigned = (halalas: number): string =>
  halalas > 0 ? `\u2066+${formatNumber(halalas)}\u2069 ر.س` : formatAmount(halalas);

/**
 * Basis points as "20%" or "12.5%".
 * Wrapped in an LTR isolate: after Arabic letters a bare "38%" is drawn as "%38".
 */
export const formatPercent = (bps: number): string => `\u2066${bps / 100}%\u2069`;
