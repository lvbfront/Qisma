import { expect, test } from "vitest";
import { addDays, daysBetween, formatDate } from "./dates";

test("formatDate: Gregorian, Arabic month name, Western digits, no timezone shift", () => {
  expect(formatDate("2026-11-15")).toBe("15 نوفمبر 2026");
  expect(formatDate("2026-01-01")).toBe("1 يناير 2026");
  expect(formatDate("2026-12-31")).toBe("31 ديسمبر 2026");
});

test("daysBetween and addDays", () => {
  expect(daysBetween("2026-11-15", "2026-11-19")).toBe(4);
  expect(daysBetween("2026-11-15", "2026-11-13")).toBe(-2);
  expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  expect(addDays("2026-11-28", 7)).toBe("2026-12-05");
  expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
});
