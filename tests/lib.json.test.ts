import { describe, it, expect } from "vitest";
import { parseJson, printJson, errorExcerpt } from "@/lib/json";
import { formatNumber, formatMoney, formatValue, formatDuration, formatBigInt, N, P, M, DUR } from "@/lib/format";

const fmt = (s: string, indent = "  ", sortKeys = false) => {
  const r = parseJson(s);
  if (!r.ok) throw new Error(r.error.message);
  return printJson(r.node, { indent, sortKeys });
};

describe("json parser", () => {
  it("formats without altering data", () => {
    expect(fmt('{"a":1,"b":[1.0,2e3,12345678901234567890],"c":"x\\ny"}')).toBe(
      '{\n  "a": 1,\n  "b": [\n    1.0,\n    2e3,\n    12345678901234567890\n  ],\n  "c": "x\\ny"\n}',
    );
    expect(fmt("[]")).toBe("[]");
    expect(fmt("{}")).toBe("{}");
    expect(fmt('{"a":{},"b":[]}')).toBe('{\n  "a": {},\n  "b": []\n}');
  });
  it("minifies and supports tab and sorted keys", () => {
    expect(fmt('{ "b": 1, "a": [ 1, 2 ] }', "")).toBe('{"b":1,"a":[1,2]}');
    expect(fmt('{"b":1,"a":2}', "\t", true)).toBe('{\n\t"a": 2,\n\t"b": 1\n}');
  });
  it("accepts all valid scalar roots and a BOM", () => {
    for (const s of ["1", "-0.5e-3", '"hi"', "true", "false", "null", " [1] "]) expect(parseJson(s).ok, s).toBe(true);
    expect(parseJson("\ufeff{}").ok).toBe(true);
  });
  it("reports line and column for errors", () => {
    const r = parseJson('{\n  "a": 1,\n  "b": }\n');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.line).toBe(3);
      expect(r.error.column).toBe(8);
      expect(errorExcerpt('{\n  "a": 1,\n  "b": }\n', r.error)).toContain("^");
    }
  });
  it.each([
    ["", /end of JSON/],
    ["{", /Expected a double-quoted property name|end/],
    ['{"a":1,}', /trailing comma/i],
    ["[1,2,]", /trailing comma/i],
    ["{'a':1}", /double quotes/],
    ['{"a" 1}', /Expected ':'/],
    ['{"a":1 "b":2}', /Expected ',' or '}'/],
    ["[1 2]", /Expected ',' or '\]'/],
    ["01", /leading zeros/],
    ["1.", /decimal point/],
    ["+1", /Unexpected character/],
    [".5", /Unexpected character/],
    ["NaN", /not valid JSON/],
    ["undefined", /not valid JSON/],
    ['"abc', /not closed/],
    ['"a\nb"', /line break/],
    ['"\\x"', /Invalid escape/],
    ['"\\u12"', /four hexadecimal/],
    ["{} {}", /after the end/],
    ["tru", /Unexpected text/],
    ["nulll", /Unexpected text|after the end/],
  ])("rejects %j", (input, message) => {
    const r = parseJson(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(message);
  });
  it("collects stats and duplicate keys", () => {
    const r = parseJson('{"a":1,"a":2,"b":[true,null,"x",12345678901234567890]}');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.stats).toMatchObject({ rootType: "object", keys: 3, arrays: 1, objects: 1, booleans: 1, nulls: 1, strings: 1, numbers: 3, unsafeNumbers: 1, depth: 3 });
      expect(r.stats.duplicateKeys).toEqual(["a"]);
    }
  });
  it("guards against deep nesting", () => {
    const r = parseJson("[".repeat(400) + "]".repeat(400));
    expect(r.ok).toBe(false);
  });
});

describe("value formatting", () => {
  it("formats numbers with grouping, rounding and extremes", () => {
    expect(formatNumber(1234567.891)).toBe("1,234,567.891");
    expect(formatNumber(0.1 + 0.2)).toBe("0.3");
    expect(formatNumber(1 / 3)).toBe("0.333333");
    expect(formatNumber(2 / 3, { maxDecimals: 2 })).toBe("0.67");
    expect(formatNumber(-0.000000001234)).toBe("−1.234 × 10⁻⁹");
    expect(formatNumber(1.5e21)).toBe("1.5 × 10²¹");
    expect(formatNumber(0.0000001234)).toBe("0.0000001234");
    expect(formatNumber(-0.0000001, { maxDecimals: 2 })).toBe("−0.0000001");
    expect(formatNumber(-0.001, { maxDecimals: 2 })).toBe("−0.001");
    expect(formatNumber(NaN)).toBe("—");
    expect(formatNumber(Infinity)).toBe("∞");
    expect(formatNumber(5, { minDecimals: 2 })).toBe("5.00");
  });
  it("formats money, percent, duration and units", () => {
    expect(formatMoney(1234.5)).toBe("1,234.50");
    expect(formatMoney(1234567.891, "INR")).toBe("₹12,34,567.89");
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
    expect(formatMoney(-5, "USD")).toBe("−$5.00");
    expect(formatValue(M(0.001))).toBe("0.00");
    expect(formatValue(P(12.3456))).toBe("12.35%");
    expect(formatValue(N(5, "km/h"))).toBe("5 km/h");
    expect(formatValue(N(98.6, "°F"))).toBe("98.6°F");
    expect(formatDuration({ years: 1, months: 0, days: 5 })).toBe("1 year, 5 days");
    expect(formatValue(DUR({ years: 0, months: 0, days: 0 }))).toBe("0 days");
  });
  it("groups big integers", () => {
    expect(formatBigInt("1234567")).toBe("1,234,567");
    expect(formatBigInt("1".padEnd(30, "0"))).toContain("≈ 1 × 10²⁹");
    expect(formatBigInt("1".padEnd(60, "0"))).toBe("≈ 1 × 10⁵⁹  (60 digits)");
  });
});
