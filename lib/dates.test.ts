import { expect, test } from "vitest";
import { formatDate } from "./dates";

test("formatDate: Gregorian, Arabic month name, Western digits, no timezone shift", () => {
  expect(formatDate("2026-11-15")).toBe("15 نوفمبر 2026");
  expect(formatDate("2026-01-01")).toBe("1 يناير 2026");
  expect(formatDate("2026-12-31")).toBe("31 ديسمبر 2026");
});
