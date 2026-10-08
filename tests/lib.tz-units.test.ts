import { describe, it, expect } from "vitest";
import { TIME_ZONES, instantToZoned, isValidTimeZone, tzOffsetMs, wallTimeToInstant, formatOffset } from "@/lib/tz";
import { UNIT_CATEGORIES, convert, getUnit, conversionFactor } from "@/lib/units";

describe("time zones", () => {
  it("all curated zones exist in this runtime", () => {
    for (const z of TIME_ZONES) expect(isValidTimeZone(z.id), z.id).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
  it("reports offsets, including half-hour zones", () => {
    const t = Date.UTC(2026, 0, 15, 12, 0, 0);
    expect(tzOffsetMs(t, "Asia/Kolkata")).toBe(5.5 * 3600_000);
    expect(tzOffsetMs(t, "Asia/Kathmandu")).toBe(5.75 * 3600_000);
    expect(tzOffsetMs(t, "America/New_York")).toBe(-5 * 3600_000);
    expect(tzOffsetMs(Date.UTC(2026, 6, 15), "America/New_York")).toBe(-4 * 3600_000);
    expect(formatOffset(330)).toBe("UTC+05:30");
    expect(formatOffset(-210)).toBe("UTC-03:30");
  });
  it("converts a wall-clock time to an instant and back", () => {
    const r = wallTimeToInstant({ y: 2026, m: 1, d: 15, hh: 9, mm: 30 }, "Asia/Kolkata");
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.epochMs).toBe(Date.UTC(2026, 0, 15, 4, 0, 0));
      const ny = instantToZoned(r.epochMs, "America/New_York");
      expect(ny).toMatchObject({ y: 2026, m: 1, d: 14, hh: 23, mm: 0, weekday: 3 });
    }
  });
  it("detects daylight-saving gaps and overlaps", () => {
    // US spring forward: 2024-03-10 02:30 does not exist in New York
    expect(wallTimeToInstant({ y: 2024, m: 3, d: 10, hh: 2, mm: 30 }, "America/New_York").status).toBe("gap");
    // US fall back: 2024-11-03 01:30 happens twice
    const amb = wallTimeToInstant({ y: 2024, m: 11, d: 3, hh: 1, mm: 30 }, "America/New_York");
    expect(amb.status).toBe("ambiguous");
    if (amb.status === "ambiguous") expect(amb.alternative - amb.epochMs).toBe(3600_000);
    // a normal time right after the change
    expect(wallTimeToInstant({ y: 2024, m: 3, d: 10, hh: 3, mm: 30 }, "America/New_York").status).toBe("ok");
    // a zone with no DST has no gaps
    expect(wallTimeToInstant({ y: 2024, m: 3, d: 10, hh: 2, mm: 30 }, "Asia/Kolkata").status).toBe("ok");
  });
});

describe("unit registry", () => {
  it("uses authoritative exact factors", () => {
    expect(convert("length", "in", "cm", 1)).toBe(2.54);
    expect(convert("length", "mi", "km", 1)).toBe(1.609344);
    expect(convert("length", "ft", "m", 1)).toBe(0.3048);
    expect(convert("mass", "lb", "kg", 1)).toBe(0.45359237);
    expect(convert("mass", "oz", "g", 1)).toBe(28.349523125);
    expect(convert("volume", "gal_us", "l", 1)).toBe(3.785411784);
    expect(convert("volume", "gal_uk", "l", 1)).toBe(4.54609);
    expect(convert("area", "ac", "m2", 1)).toBe(4046.8564224);
    expect(convert("area", "ha", "ac", 1)).toBeCloseTo(2.47105381, 8);
    expect(convert("speed", "mph", "kmh", 60)).toBeCloseTo(96.56064, 9);
    expect(convert("speed", "kn", "kmh", 1)).toBe(1.852);
    expect(convert("data", "GiB", "MiB", 1)).toBe(1024);
    expect(convert("data", "GB", "MB", 1)).toBe(1000);
    expect(convert("data", "B", "bit", 1)).toBe(8);
    expect(convert("time", "d", "h", 1)).toBe(24);
    expect(convert("time", "wk", "d", 2)).toBe(14);
  });
  it("converts temperature (non-linear)", () => {
    expect(convert("temperature", "c", "f", 100)).toBe(212);
    expect(convert("temperature", "c", "f", -40)).toBe(-40);
    expect(convert("temperature", "f", "c", 98.6)).toBe(37);
    expect(convert("temperature", "c", "k", 0)).toBe(273.15);
    expect(convert("temperature", "k", "c", 0)).toBe(-273.15);
    expect(convert("temperature", "f", "k", 32)).toBe(273.15);
    expect(convert("temperature", "c", "r", 0)).toBe(491.67);
  });
  it("converts fuel economy (reciprocal)", () => {
    expect(convert("fuel", "kmpl", "l100", 20)).toBe(5);
    expect(convert("fuel", "l100", "kmpl", 8)).toBe(12.5);
    expect(convert("fuel", "mpg_us", "l100", 30)).toBeCloseTo(7.84049, 4);
    expect(convert("fuel", "mpg_us", "mpg_uk", 30)).toBeCloseTo(36.0285, 3);
    expect(convert("fuel", "kmpl", "mpg_us", 10)).toBeCloseTo(23.5215, 3);
  });
  it("round-trips and keeps identity exact", () => {
    for (const c of UNIT_CATEGORIES) {
      for (const a of c.units) {
        for (const b of c.units) {
          const there = convert(c.id, a.id, b.id, 12.5);
          const back = convert(c.id, b.id, a.id, there);
          expect(back, `${c.id} ${a.id}->${b.id}`).toBeCloseTo(12.5, 6);
        }
      }
      expect(convert(c.id, c.units[0].id, c.units[0].id, 7.123456789)).toBe(7.123456789);
    }
    expect(getUnit("length", "xx")).toBeUndefined();
    expect(() => convert("length", "m", "xx", 1)).toThrow();
    expect(conversionFactor("length", "ft", "m")).toBe(0.3048);
    expect(conversionFactor("temperature", "c", "f")).toBeNull();
  });
  it("has unique unit ids per category", () => {
    for (const c of UNIT_CATEGORIES) expect(new Set(c.units.map((u) => u.id)).size).toBe(c.units.length);
  });
});
