import { expect, test } from "vitest";
import { formatAmount, formatNumber, formatPercent, formatSigned, parseAmount } from "./money";

test("parseAmount", () => {
  expect(parseAmount("10000")).toBe(1_000_000);
  expect(parseAmount("10,000")).toBe(1_000_000);
  expect(parseAmount(" 1 500.5 ")).toBe(150_050);
  expect(parseAmount("0.07")).toBe(7);
  expect(parseAmount("19.99")).toBe(1999); // 19.99 * 100 is 1998.9999… in floats
  expect(parseAmount("١٢٬٥٠٠٫٢٥")).toBe(1_250_025);
  expect(parseAmount("0")).toBe(0);
});

test("parseAmount rejects bad input", () => {
  for (const bad of ["", "abc", "-5", "1.234", "1.2.3", ".", "1e3", "99999999999999999999"]) {
    expect(parseAmount(bad), bad).toBeNull();
  }
});

test("formatAmount", () => {
  expect(formatAmount(1_000_000)).toBe("10,000 ر.س");
  expect(formatAmount(1_000_050)).toBe("10,000.50 ر.س");
  expect(formatAmount(7)).toBe("0.07 ر.س");
  expect(formatAmount(0)).toBe("0 ر.س");
  expect(formatAmount(-150_000)).toBe("⁦-1,500⁩ ر.س");
  expect(() => formatAmount(1.5)).toThrow();
});

test("round trip", () => {
  for (const h of [0, 1, 99, 100, 123_456_789]) {
    expect(parseAmount(formatAmount(h).replace(" ر.س", ""))).toBe(h);
  }
});

test("formatNumber and formatPercent", () => {
  expect(formatNumber(1_000_000)).toBe("10,000");
  expect(parseAmount(formatNumber(1_000_050))).toBe(1_000_050);
  expect(formatPercent(2000)).toBe("\u206620%\u2069"); // LTR isolate keeps % after the digits in RTL text
  expect(formatPercent(1250)).toBe("\u206612.5%\u2069");
  expect(parseAmount("12.5")).toBe(1250); // a typed percent parses to basis points
  expect(formatPercent(800, true)).toBe("\u2066+8%\u2069");
  expect(formatPercent(-10000, true)).toBe("\u2066-100%\u2069");
});

test("formatSigned keeps the sign in front of the digits", () => {
  expect(formatSigned(50_000)).toBe("\u2066+500\u2069 ر.س");
  expect(formatSigned(-20_000)).toBe("\u2066-200\u2069 ر.س");
  expect(formatSigned(0)).toBe("0 ر.س");
});
