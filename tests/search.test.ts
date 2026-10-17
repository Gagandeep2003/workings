import { describe, it, expect } from "vitest";
import { TOOLS, toolPath } from "@/tools/registry";
import { search, editDistance, normalize, tokenize, type SearchEntry } from "@/lib/search";

const entries: SearchEntry[] = TOOLS.map((t) => ({ i: t.id, t: t.title, c: t.category, p: toolPath(t), d: t.shortDescription, a: t.aliases, k: t.keywords, h: t.phrases ?? [] }));
const top = (q: string, n = 1) => search(entries, q, n).map((e) => e.i);

describe("tool search", () => {
  it.each([
    ["percent", "percentage-calculator"],
    ["percentage", "percentage-calculator"],
    ["15% of 200", "percentage-calculator"],
    ["what is 15% of 200", "percentage-calculator"],
    ["emi", "emi-calculator"],
    ["EMI calculator", "emi-calculator"],
    ["home loan", "emi-calculator"],
    ["hex to rgb", "color-converter"],
    ["rgb to hex", "color-converter"],
    ["age", "age-calculator"],
    ["how old am i", "age-calculator"],
    ["json", "json-formatter"],
    ["days between", "days-between-dates-calculator"],
    ["gst", "gst-calculator"],
    ["cgpa to percentage", "cgpa-to-percentage-calculator"],
    ["percentage to cgpa", "percentage-to-cgpa-calculator"],
    ["qr", "qr-code-generator"],
    ["uuid", "uuid-generator"],
    ["jwt", "jwt-decoder"],
    ["sip", "sip-calculator"],
    ["mpg", "fuel-economy-converter"],
    ["kg to lbs", "weight-converter"],
    ["celsius to fahrenheit", "temperature-converter"],
    ["hcf", "hcf-lcm-calculator"],
    ["lcm of 4 and 6", "hcf-lcm-calculator"],
    ["ncr", "permutation-combination-calculator"],
    ["base64", "base64-encode-decode"],
    ["regex", "regex-tester"],
    ["ssc cgl", "ssc-cgl-tier-1-score-calculator"],
    ["last working day", "notice-period-calculator"],
    ["in hand salary", "ctc-to-take-home-calculator"],
    ["timestamp", "unix-timestamp-converter"],
    ["time zone", "timezone-converter"],
    ["working days", "working-days-calculator"],
    ["word count", "word-counter"],
    ["snake case", "case-converter"],
  ])("%s → %s", (query, id) => {
    expect(top(query, 3)).toContain(id);
    expect(top(query)[0]).toBe(id);
  });
  it("tolerates typos", () => {
    expect(top("percentge")).toEqual(["percentage-calculator"]);
    expect(top("calcualtor emi")).toContain("emi-calculator");
    expect(top("fraciton")).toContain("fraction-calculator");
  });
  it("returns nothing for gibberish and empty input", () => {
    expect(search(entries, "")).toEqual([]);
    expect(search(entries, "   ")).toEqual([]);
    expect(search(entries, "zzzzqqq")).toEqual([]);
  });
  it("handles generic words without matching everything", () => {
    const r = search(entries, "calculator", 100);
    expect(r.length).toBeLessThan(entries.length);
  });
  it("is fast", () => {
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) search(entries, "percentage increase");
    expect((performance.now() - t0) / 200).toBeLessThan(5);
  });
  it("helpers", () => {
    expect(normalize("15% of Km/L!")).toBe("15 percent of km l");
    expect(tokenize("Days Between Dates")).toEqual(["day", "between", "date"]);
    expect(editDistance("percentge", "percentage")).toBe(1);
    expect(editDistance("abc", "xyz", 1)).toBe(2);
    expect(editDistance("ab", "ba")).toBe(1);
  });
});

describe("exact names open the right tool", () => {
  const entries = TOOLS.map((t) => ({ i: t.id, t: t.title, c: t.category, p: toolPath(t), d: t.shortDescription, a: t.aliases, k: t.keywords, h: t.phrases ?? [] }));
  it("typing any tool's exact title ranks that tool first (a title contained in a longer title must not win)", () => {
    const wrong: string[] = [];
    for (const t of TOOLS) {
      for (const q of [t.title, t.title.toLowerCase(), t.title.toUpperCase()]) {
        const top = search(entries, q, 3)[0];
        if (top?.i !== t.id) wrong.push(`"${q}" → ${top?.t}`);
      }
    }
    expect(wrong).toEqual([]);
  });
  it("Percentage Calculator is not outranked by Marks Percentage Calculator", () => {
    expect(search(entries, "Percentage Calculator", 3)[0].i).toBe("percentage-calculator");
    expect(search(entries, "age calculator", 3)[0].i).toBe("age-calculator");
  });
});
