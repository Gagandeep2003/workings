import { describe, it, expect } from "vitest";
import { clean, round, roundMoney, toMinor, sumExact, groupDigits, gcdBig, lcmBig, decimalPlaces } from "@/lib/numeric";
import {
  addDays, addMonths, addYMD, dayOfWeek, daysInMonth, diffYMD, formatDateLong, fromEpochDay,
  isLeapYear, parseISODate, toEpochDay, parseDateList,
} from "@/lib/dates";

describe("numeric", () => {
  it("cleans floating point noise", () => {
    expect(clean(0.1 + 0.2)).toBe(0.3);
    expect(clean(1.1 * 3)).toBe(3.3);
  });
  it("rounds half away from zero on the decimal representation", () => {
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(2.5)).toBe(3);
    expect(round(-2.5)).toBe(-3);
    expect(round(1.45, 1)).toBe(1.5);
    expect(round(8.345, 2)).toBe(8.35);
    expect(round(0.000001234, 8)).toBe(0.00000123);
    expect(round(-0.0001, 2)).toBe(0);
    expect(Object.is(round(-0.0001, 2), -0)).toBe(false);
    expect(round(1e21, 2)).toBe(1e21);
    expect(round(NaN)).toBeNaN();
  });
  it("handles money as minor units", () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(toMinor(19.99)).toBe(1999);
    expect(toMinor(0.1 + 0.2)).toBe(30);
  });
  it("sums exactly", () => {
    expect(sumExact([0.1, 0.2, 0.3])).toBe(0.6);
    expect(sumExact([])).toBe(0);
    expect(sumExact([1.15, 2.35, 3.5])).toBe(7);
    expect(decimalPlaces(1.2345)).toBe(4);
    expect(decimalPlaces(1e-7)).toBe(7);
  });
  it("groups digits and computes gcd/lcm", () => {
    expect(groupDigits("1234567")).toBe("1,234,567");
    expect(groupDigits("-1000")).toBe("-1,000");
    expect(gcdBig(48n, 18n)).toBe(6n);
    expect(lcmBig(4n, 6n)).toBe(12n);
    expect(lcmBig(0n, 6n)).toBe(0n);
  });
});

describe("dates", () => {
  it("validates calendar dates strictly", () => {
    expect(parseISODate("2024-02-29")).toEqual({ y: 2024, m: 2, d: 29 });
    expect(parseISODate("2023-02-29")).toBeNull();
    expect(parseISODate("2023-13-01")).toBeNull();
    expect(parseISODate("2023-1-1")).toBeNull();
    expect(parseISODate("")).toBeNull();
    expect(parseISODate("1900-02-29")).toBeNull();
    expect(parseISODate("2000-02-29")).not.toBeNull();
  });
  it("knows leap years and month lengths", () => {
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2024)).toBe(true);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
  });
  it("round-trips epoch days and finds weekdays", () => {
    expect(toEpochDay({ y: 1970, m: 1, d: 1 })).toBe(0);
    expect(dayOfWeek(0)).toBe(4); // Thursday
    for (const day of [-800000, -1, 0, 19000, 20000, 2932896]) {
      expect(toEpochDay(fromEpochDay(day))).toBe(day);
    }
    expect(dayOfWeek(toEpochDay({ y: 2026, m: 10, d: 3 }))).toBe(6); // Saturday
    expect(formatDateLong("2024-02-29")).toBe("Thursday, 29 February 2024");
  });
  it("adds days across month and year boundaries", () => {
    expect(addDays({ y: 2023, m: 12, d: 31 }, 1)).toEqual({ y: 2024, m: 1, d: 1 });
    expect(addDays({ y: 2024, m: 2, d: 28 }, 2)).toEqual({ y: 2024, m: 3, d: 1 });
    expect(addDays({ y: 2023, m: 3, d: 1 }, -1)).toEqual({ y: 2023, m: 2, d: 28 });
  });
  it("adds months with clamping", () => {
    expect(addMonths({ y: 2024, m: 1, d: 31 }, 1)).toEqual({ y: 2024, m: 2, d: 29 });
    expect(addMonths({ y: 2023, m: 1, d: 31 }, 1)).toEqual({ y: 2023, m: 2, d: 28 });
    expect(addMonths({ y: 2024, m: 11, d: 30 }, 3)).toEqual({ y: 2025, m: 2, d: 28 });
    expect(addMonths({ y: 2024, m: 3, d: 31 }, -1)).toEqual({ y: 2024, m: 2, d: 29 });
    expect(addYMD({ y: 2024, m: 2, d: 29 }, 1, 0, 0)).toEqual({ y: 2025, m: 2, d: 28 });
  });
  it("computes calendar differences", () => {
    expect(diffYMD({ y: 2000, m: 1, d: 1 }, { y: 2000, m: 1, d: 1 })).toMatchObject({ years: 0, months: 0, days: 0, totalDays: 0 });
    expect(diffYMD({ y: 1990, m: 5, d: 15 }, { y: 2024, m: 5, d: 14 })).toMatchObject({ years: 33, months: 11, days: 29 });
    expect(diffYMD({ y: 2024, m: 1, d: 31 }, { y: 2024, m: 3, d: 1 })).toMatchObject({ years: 0, months: 1, days: 1 });
    expect(diffYMD({ y: 2000, m: 2, d: 29 }, { y: 2001, m: 2, d: 28 })).toMatchObject({ years: 1, months: 0, days: 0 });
    expect(diffYMD({ y: 2024, m: 1, d: 1 }, { y: 2025, m: 1, d: 1 }).totalDays).toBe(366);
    expect(diffYMD({ y: 2023, m: 12, d: 31 }, { y: 2024, m: 1, d: 1 })).toMatchObject({ months: 0, days: 1 });
    expect(() => diffYMD({ y: 2024, m: 1, d: 2 }, { y: 2024, m: 1, d: 1 })).toThrow();
  });
  it("parses date lists", () => {
    const { dates, invalid } = parseDateList("2024-01-01, 2024-02-30\n2024-03-01");
    expect(dates).toHaveLength(2);
    expect(invalid).toEqual(["2024-02-30"]);
  });
});
