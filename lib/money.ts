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

/** Format halalas as "10,000 ر.س" (halalas shown only when non-zero: "10,000.50 ر.س"). */
export function formatAmount(halalas: number): string {
  if (!Number.isSafeInteger(halalas)) throw new RangeError("halalas must be an integer");
  const abs = Math.abs(halalas);
  const frac = abs % 100;
  const num =
    Math.trunc(abs / 100).toLocaleString("en-US") +
    (frac ? "." + String(frac).padStart(2, "0") : "");
  // LTR isolate keeps the minus sign in front of the digits inside RTL text.
  return (halalas < 0 ? `⁦-${num}⁩` : num) + " ر.س";
}
