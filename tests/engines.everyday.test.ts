import { describe, it, expect } from "vitest";
import { engines as dates } from "@/engines/everyday/dates";
import { engines as conv } from "@/engines/everyday/convert";
import { engines as tz } from "@/engines/everyday/timezone";
import { makeContext } from "@/engines/helpers";
import { ctx, errs, label, out, primary, raw, run, sec } from "./util";

const today = (d: string) => makeContext({ today: d });

describe("age calculator", () => {
  it("counts years, months and days", () => {
    const r = run(dates, "age-calculator", { dob: "1990-05-15", asof: "2024-05-14" });
    expect(primary(r)).toBe(JSON.stringify({ years: 33, months: 11, days: 29 }));
    expect(sec(r, "Total days")).toBe(12418);
    expect(sec(r, "Born on a")).toBe("Tuesday");
    expect(sec(r, "Next birthday")).toBe("2024-05-15 (in 1 day)");
  });
  it("uses the injected today when no date is given", () => {
    const r = run(dates, "age-calculator", { dob: "2000-02-29" }, today("2025-02-28"));
    // 29 Feb is treated as 28 Feb in non-leap years, so this is exactly 25 years
    expect(primary(r)).toBe(JSON.stringify({ years: 25, months: 0, days: 0 }));
    expect(sec(r, "Next birthday")).toBe("Today! 🎂");
  });
  it("handles leap-day birthdays, same-day and future births", () => {
    expect(sec(run(dates, "age-calculator", { dob: "2000-02-29", asof: "2023-03-01" }), "Next birthday")).toBe("2024-02-29 (in 365 days)");
    expect(sec(run(dates, "age-calculator", { dob: "2000-01-01", asof: "2000-01-01" }), "Total days")).toBe(0);
    expect(errs(run(dates, "age-calculator", { dob: "2030-01-01", asof: "2025-01-01" }))).toMatch(/after the/);
    expect(errs(run(dates, "age-calculator", { dob: "2023-02-29", asof: "2025-01-01" }))).toMatch(/real calendar date/);
    expect(errs(run(dates, "age-calculator", { dob: "2000-01-01", asof: "2025-02-30" }))).toMatch(/real calendar date/);
  });
});

describe("date differences", () => {
  it("days between dates across a leap year", () => {
    const r = run(dates, "days-between-dates-calculator", { start: "2024-01-01", end: "2025-01-01", include: "no" });
    expect(primary(r)).toBe(366);
    expect(sec(r, "Weeks and days")).toBe("52 weeks, 2 days");
    expect(primary(run(dates, "days-between-dates-calculator", { start: "2024-01-01", end: "2025-01-01", include: "yes" }))).toBe(367);
    expect(primary(run(dates, "days-between-dates-calculator", { start: "2023-12-31", end: "2024-01-01", include: "no" }))).toBe(1);
    expect(primary(run(dates, "days-between-dates-calculator", { start: "2024-03-01", end: "2024-03-01", include: "no" }))).toBe(0);
  });
  it("swaps reversed dates with a note and counts weekdays", () => {
    const r = run(dates, "days-between-dates-calculator", { start: "2024-01-15", end: "2024-01-01", include: "no" });
    expect(primary(r)).toBe(14);
    expect(out(r).notes?.[0]).toMatch(/swapped/);
    // Mon 1 Jan -> Mon 15 Jan, end exclusive: 10 weekdays
    expect(sec(r, "Weekdays (Mon–Fri) in the range")).toBe(10);
    expect(sec(run(dates, "days-between-dates-calculator", { start: "2024-01-01", end: "2024-01-15", include: "yes" }), "Weekdays (Mon–Fri) in the range")).toBe(11);
    expect(errs(run(dates, "days-between-dates-calculator", { start: "2024-02-30", end: "2024-03-01", include: "no" }))).toMatch(/real calendar date/);
  });
  it("days until a date uses the injected today", () => {
    const r = run(dates, "days-until-date-calculator", { target: "2026-12-25", label: "Christmas" }, today("2026-10-03"));
    expect(primary(r)).toBe(83);
    expect(label(r)).toBe("Days until Christmas");
    expect(label(run(dates, "days-until-date-calculator", { target: "2026-10-03" }, today("2026-10-03")))).toBe("That's today");
    const past = run(dates, "days-until-date-calculator", { target: "2026-09-01" }, today("2026-10-03"));
    expect(label(past)).toBe("Days since");
    expect(primary(past)).toBe(32);
  });
  it("adds and subtracts calendar time", () => {
    const add = (extra: Record<string, number | string>) => primary(run(dates, "date-add-subtract-calculator", { start: "2024-01-31", op: "add", ...extra }));
    expect(add({ months: 1 })).toBe("2024-02-29");
    expect(add({ days: 30 })).toBe("2024-03-01");
    expect(add({ years: 1, months: 1 })).toBe("2025-02-28");
    expect(add({ weeks: 2 })).toBe("2024-02-14");
    expect(primary(run(dates, "date-add-subtract-calculator", { start: "2024-03-01", op: "subtract", days: 1 }))).toBe("2024-02-29");
    expect(primary(run(dates, "date-add-subtract-calculator", { start: "2024-01-01", op: "subtract", days: 1 }))).toBe("2023-12-31");
    expect(errs(run(dates, "date-add-subtract-calculator", { start: "2024-01-01", op: "add" }))).toMatch(/at least one/);
    expect(errs(run(dates, "date-add-subtract-calculator", { start: "9999-12-31", op: "add", days: 5 }))).toMatch(/supported years/);
  });
  it("counts working days with weekends and holidays", () => {
    const base = { mode: "count", weekend: "sat-sun", holidays: "" };
    expect(primary(run(dates, "working-days-calculator", { ...base, start: "2024-01-01", end: "2024-01-31" }))).toBe(23);
    expect(primary(run(dates, "working-days-calculator", { ...base, start: "2024-01-01", end: "2024-01-31", holidays: "2024-01-01, 2024-01-26\n2024-01-27" }))).toBe(21);
    expect(primary(run(dates, "working-days-calculator", { ...base, start: "2024-01-04", end: "2024-01-05" }))).toBe(2);
    expect(primary(run(dates, "working-days-calculator", { ...base, start: "2024-01-04", end: "2024-01-05", weekend: "fri-sat" }))).toBe(1);
    expect(primary(run(dates, "working-days-calculator", { ...base, start: "2024-01-06", end: "2024-01-07" }))).toBe(0);
    expect(primary(run(dates, "working-days-calculator", { ...base, start: "2024-03-04", end: "2024-03-04" }))).toBe(1);
    expect(errs(run(dates, "working-days-calculator", { ...base, start: "2024-02-01", end: "2024-01-01" }))).toMatch(/before the start/);
    expect(errs(run(dates, "working-days-calculator", { ...base, start: "2024-01-01", end: "2024-01-31", holidays: "2024-13-01" }))).toMatch(/Couldn't read/);
  });
  it("adds working days", () => {
    const add = (count: number, extra: Record<string, string> = {}) => primary(run(dates, "working-days-calculator", { mode: "add", weekend: "sat-sun", holidays: "", start: "2024-01-05", count, ...extra }));
    expect(add(1)).toBe("2024-01-08"); // Friday + 1 working day = Monday
    expect(add(5)).toBe("2024-01-12");
    expect(add(1, { holidays: "2024-01-08" })).toBe("2024-01-09");
    expect(errs(run(dates, "working-days-calculator", { mode: "add", weekend: "sat-sun", holidays: "", start: "2024-01-05", count: 99999 }))).toMatch(/too many/);
  });
});

describe("unit converters", () => {
  it("convert correctly through the shared registry", () => {
    expect(primary(run(conv, "length-converter", { value: 1, from: "mi", to: "km" }))).toBe(1.609344);
    expect(primary(run(conv, "weight-converter", { value: 100, from: "kg", to: "lb" }))).toBeCloseTo(220.462262, 6);
    expect(primary(run(conv, "temperature-converter", { value: 100, from: "c", to: "f" }))).toBe(212);
    expect(primary(run(conv, "temperature-converter", { value: -40, from: "f", to: "c" }))).toBe(-40);
    expect(primary(run(conv, "area-converter", { value: 1, from: "ac", to: "ft2" }))).toBeCloseTo(43560, 4);
    expect(primary(run(conv, "volume-converter", { value: 1, from: "gal_us", to: "l" }))).toBe(3.785411784);
    expect(primary(run(conv, "speed-converter", { value: 100, from: "kmh", to: "mph" }))).toBeCloseTo(62.1371192, 6);
    expect(primary(run(conv, "fuel-economy-converter", { value: 8, from: "l100", to: "kmpl" }))).toBe(12.5);
    expect(primary(run(conv, "unit-converter", { category: "data", value: 1, from: "GiB", to: "MB" }))).toBeCloseTo(1073.741824, 6);
    expect(primary(run(conv, "unit-converter", { category: "time", value: 2, from: "h", to: "min" }))).toBe(120);
  });
  it("describes conversions and keeps the value", () => {
    const r = run(conv, "length-converter", { value: 5, from: "ft", to: "m" });
    expect(raw(out(r).primary.value)).toBe(1.524);
    expect(out(r).steps?.[0]).toBe("1 ft = 0.3048 m");
    expect(out(r).table?.rows.length).toBe(10);
    expect(primary(run(conv, "length-converter", { value: 0, from: "ft", to: "m" }))).toBe(0);
    expect(primary(run(conv, "length-converter", { value: -3, from: "m", to: "cm" }))).toBe(-300);
  });
  it("rejects physically impossible inputs", () => {
    expect(errs(run(conv, "temperature-converter", { value: -300, from: "c", to: "f" }))).toMatch(/absolute zero/);
    expect(errs(run(conv, "temperature-converter", { value: -1, from: "k", to: "c" }))).toMatch(/absolute zero/);
    expect(primary(run(conv, "temperature-converter", { value: -273.15, from: "c", to: "k" }))).toBe(0);
    expect(errs(run(conv, "fuel-economy-converter", { value: 0, from: "kmpl", to: "l100" }))).toMatch(/isn't meaningful/);
    expect(errs(run(conv, "unit-converter", { category: "nope", value: 1, from: "a", to: "b" }))).toMatch(/Unknown unit category/);
    expect(errs(run(conv, "length-converter", { value: 1, from: "zz", to: "m" }))).toMatch(/Choose a unit/);
  });
});

describe("time zone converter", () => {
  const base = { date: "2026-01-15", time: "09:30", from: "Asia/Kolkata", to: "America/New_York" };
  it("converts between zones", () => {
    const r = run(tz, "timezone-converter", base, ctx);
    expect(primary(r)).toBe("Wed, 14 Jan 2026, 23:00 (UTC-05:00)");
    expect(sec(r, "Date there")).toBe("2026-01-14");
    expect(sec(r, "Difference")).toBe("10.5 hours behind Kolkata");
    expect(sec(r, "Unix timestamp (seconds)")).toBe(Date.UTC(2026, 0, 15, 4, 0, 0) / 1000);
  });
  it("handles daylight saving transitions", () => {
    expect(errs(run(tz, "timezone-converter", { date: "2024-03-10", time: "02:30", from: "America/New_York", to: "UTC" }, ctx))).toMatch(/doesn't exist/);
    const amb = run(tz, "timezone-converter", { date: "2024-11-03", time: "01:30", from: "America/New_York", to: "UTC" }, ctx);
    expect(primary(amb)).toBe("Sun, 3 Nov 2024, 05:30 (UTC+00:00)");
    expect(out(amb).notes?.[0]).toMatch(/happens twice/);
    expect(primary(run(tz, "timezone-converter", { date: "2024-07-01", time: "12:00", from: "Europe/London", to: "Asia/Tokyo" }, ctx))).toBe("Mon, 1 Jul 2024, 20:00 (UTC+09:00)");
  });
  it("converts across the date line and rejects bad input", () => {
    expect(primary(run(tz, "timezone-converter", { date: "2026-12-31", time: "23:00", from: "UTC", to: "Pacific/Auckland" }, ctx))).toBe("Fri, 1 Jan 2027, 12:00 (UTC+13:00)");
    expect(errs(run(tz, "timezone-converter", { ...base, from: "Mars/Base" }, ctx))).toMatch(/recognise/);
    expect(errs(run(tz, "timezone-converter", { ...base, date: "2026-02-30" }, ctx))).toMatch(/real calendar/);
  });
});
