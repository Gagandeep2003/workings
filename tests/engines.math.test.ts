import { describe, it, expect } from "vitest";
import { engines as pct } from "@/engines/math/percentage";
import { engines as frac } from "@/engines/math/fractions";
import { engines as nums } from "@/engines/math/numbers";
import { engines as com } from "@/engines/math/commerce";
import { engines as mot } from "@/engines/math/motion";
import { errs, label, out, primary, run, sec } from "./util";

describe("percentage tools", () => {
  it("X% of Y", () => {
    expect(primary(run(pct, "percentage-calculator", { mode: "of", p: 15, x: 200 }))).toBe(30);
    expect(primary(run(pct, "percentage-calculator", { mode: "of", p: 12.5, x: 80 }))).toBe(10);
    expect(primary(run(pct, "percentage-calculator", { mode: "of", p: 0, x: 50 }))).toBe(0);
    expect(primary(run(pct, "percentage-calculator", { mode: "of", p: 0.1, x: 1_000_000 }))).toBe(1000);
    expect(primary(run(pct, "percentage-calculator", { mode: "of", p: 250, x: 40 }))).toBe(100);
    expect(primary(run(pct, "percentage-calculator", { mode: "of", p: 0.07, x: 0.3 }))).toBe(0.00021);
  });
  it("X is what % of Y, and X is Y% of what", () => {
    expect(primary(run(pct, "percentage-calculator", { mode: "is", part: 30, total: 200 }))).toBe(15);
    expect(primary(run(pct, "percentage-calculator", { mode: "is", part: 1, total: 3 }))).toBeCloseTo(33.3333333, 6);
    expect(errs(run(pct, "percentage-calculator", { mode: "is", part: 1, total: 0 }))).toMatch(/total can't be zero/);
    expect(primary(run(pct, "percentage-calculator", { mode: "whole", part2: 30, pct2: 15 }))).toBe(200);
    expect(errs(run(pct, "percentage-calculator", { mode: "whole", part2: 30, pct2: 0 }))).toMatch(/can't be zero/);
  });
  it("percentage increase", () => {
    expect(primary(run(pct, "percentage-increase-calculator", { mode: "between", from: 50, to: 75 }))).toBe(50);
    const down = run(pct, "percentage-increase-calculator", { mode: "between", from: 80, to: 60 });
    expect(primary(down)).toBe(-25);
    expect(out(down).notes?.[0]).toMatch(/decrease of 25%/);
    expect(errs(run(pct, "percentage-increase-calculator", { mode: "between", from: 0, to: 5 }))).toMatch(/can't be zero/);
    expect(primary(run(pct, "percentage-increase-calculator", { mode: "add", value: 200, pct: 15 }))).toBe(230);
    expect(sec(run(pct, "percentage-increase-calculator", { mode: "add", value: 200, pct: 15 }), "Amount added")).toBe(30);
    expect(primary(run(pct, "percentage-increase-calculator", { mode: "between", from: -50, to: -25 }))).toBe(50);
  });
  it("percentage decrease", () => {
    expect(primary(run(pct, "percentage-decrease-calculator", { mode: "between", from: 80, to: 60 }))).toBe(25);
    expect(primary(run(pct, "percentage-decrease-calculator", { mode: "subtract", value: 200, pct: 15 }))).toBe(170);
    expect(out(run(pct, "percentage-decrease-calculator", { mode: "subtract", value: 100, pct: 150 })).notes?.[0]).toMatch(/below zero/);
    expect(out(run(pct, "percentage-decrease-calculator", { mode: "between", from: 50, to: 80 })).notes?.[0]).toMatch(/increase/);
  });
  it("percentage change is signed and relative to the start", () => {
    expect(primary(run(pct, "percentage-change-calculator", { from: 50, to: 60 }))).toBe(20);
    expect(primary(run(pct, "percentage-change-calculator", { from: 60, to: 50 }))).toBeCloseTo(-16.6666667, 6);
    expect(primary(run(pct, "percentage-change-calculator", { from: 100, to: 100 }))).toBe(0);
    expect(sec(run(pct, "percentage-change-calculator", { from: 60, to: 50 }), "Direction")).toBe("Decrease");
    expect(errs(run(pct, "percentage-change-calculator", { from: 0, to: 1 }))).toMatch(/starting value/);
  });
  it("percentage difference is symmetric", () => {
    const a = primary(run(pct, "percentage-difference-calculator", { a: 10, b: 20 }));
    const b = primary(run(pct, "percentage-difference-calculator", { a: 20, b: 10 }));
    expect(a).toBeCloseTo(66.6666667, 6);
    expect(a).toBe(b);
    expect(primary(run(pct, "percentage-difference-calculator", { a: 5, b: 5 }))).toBe(0);
    expect(errs(run(pct, "percentage-difference-calculator", { a: 0, b: 0 }))).toMatch(/Both values are zero/);
  });
});

describe("fraction tools", () => {
  const calc = (v: Record<string, number | string>) => run(frac, "fraction-calculator", { w1: undefined, w2: undefined, d1: 1, d2: 1, ...v });
  it("adds, subtracts, multiplies, divides", () => {
    expect(primary(calc({ n1: 1, d1: 2, op: "add", n2: 1, d2: 3 }))).toBe("5/6");
    expect(primary(calc({ n1: 3, d1: 4, op: "sub", n2: 1, d2: 4 }))).toBe("1/2");
    expect(primary(calc({ n1: 2, d1: 3, op: "mul", n2: 3, d2: 4 }))).toBe("1/2");
    expect(primary(calc({ n1: 1, d1: 2, op: "div", n2: 1, d2: 4 }))).toBe("2");
    expect(primary(calc({ n1: -1, d1: 2, op: "add", n2: 1, d2: 4 }))).toBe("-1/4");
  });
  it("handles mixed numbers", () => {
    const r = calc({ w1: 1, n1: 1, d1: 2, op: "add", w2: 2, n2: 3, d2: 4 });
    expect(primary(r)).toBe("17/4");
    expect(sec(r, "Mixed number")).toBe("4 1/4");
    expect(sec(r, "Decimal")).toBe(4.25);
    expect(primary(calc({ w1: -1, n1: 1, d1: 2, op: "add", n2: 0, d2: 1 }))).toBe("-3/2");
    expect(errs(calc({ w1: 1, n1: -1, d1: 2, op: "add", n2: 1, d2: 2 }))).toMatch(/mixed number/);
  });
  it("rejects zero denominators and division by zero", () => {
    expect(errs(calc({ n1: 1, d1: 0, op: "add", n2: 1, d2: 2 }))).toMatch(/denominator can't be zero/);
    expect(errs(calc({ n1: 1, d1: 2, op: "div", n2: 0, d2: 5 }))).toMatch(/divide by zero/);
  });
  it("fraction to decimal detects repeating decimals", () => {
    const d = (n: number, den: number) => sec(run(frac, "fraction-to-decimal-calculator", { n, d: den }), "Exact decimal expansion");
    expect(d(1, 3)).toBe("0.(3)");
    expect(d(1, 4)).toBe("0.25");
    expect(d(22, 7)).toBe("3.(142857)");
    expect(d(1, 6)).toBe("0.1(6)");
    expect(d(-5, 8)).toBe("-0.625");
    expect(d(7, 7)).toBe("1");
    expect(d(0, 5)).toBe("0");
    expect(primary(run(frac, "fraction-to-decimal-calculator", { n: 1, d: 8 }))).toBe(0.125);
    expect(errs(run(frac, "fraction-to-decimal-calculator", { n: 1, d: 0 }))).toMatch(/denominator/);
  });
  it("decimal to fraction is exact", () => {
    const d = (decimal: string, repeating = "") => primary(run(frac, "decimal-to-fraction-calculator", { decimal, repeating }));
    expect(d("0.75")).toBe("3/4");
    expect(d("0.125")).toBe("1/8");
    expect(d("-1.25")).toBe("-5/4");
    expect(d(".5")).toBe("1/2");
    expect(d("3")).toBe("3");
    expect(d("0.1", "6")).toBe("1/6");
    expect(d("0.", "3")).toBe("1/3");
    expect(d("0.", "142857")).toBe("1/7");
    const rounded = run(frac, "decimal-to-fraction-calculator", { decimal: "0.3333", repeating: "" });
    expect(primary(rounded)).toBe("3333/10000");
    expect(sec(rounded, "Closest simple fraction (denominator ≤ 1,000)")).toBe("1/3");
    expect(errs(run(frac, "decimal-to-fraction-calculator", { decimal: "abc", repeating: "" }))).toMatch(/Enter a decimal/);
    expect(errs(run(frac, "decimal-to-fraction-calculator", { decimal: "5", repeating: "3" }))).toMatch(/decimal point/);
  });
  it("fraction to percentage", () => {
    expect(primary(run(frac, "fraction-to-percentage-calculator", { n: 3, d: 4 }))).toBe(75);
    expect(primary(run(frac, "fraction-to-percentage-calculator", { n: 1, d: 8 }))).toBe(12.5);
    expect(out(run(frac, "fraction-to-percentage-calculator", { n: 5, d: 4 })).notes?.[0]).toMatch(/above 100%/);
    expect(errs(run(frac, "fraction-to-percentage-calculator", { n: 1, d: 0 }))).toMatch(/denominator/);
  });
});

describe("number tools", () => {
  it("ratio", () => {
    expect(primary(run(nums, "ratio-calculator", { mode: "simplify", terms: "12:18:30" }))).toBe("2 : 3 : 5");
    expect(sec(run(nums, "ratio-calculator", { mode: "simplify", terms: "12:18:30" }), "Greatest common factor")).toBe("6");
    expect(primary(run(nums, "ratio-calculator", { mode: "simplify", terms: "1.5 : 2.5" }))).toBe("3 : 5");
    expect(primary(run(nums, "ratio-calculator", { mode: "simplify", terms: "0:5" }))).toBe("0 : 1");
    expect(primary(run(nums, "ratio-calculator", { mode: "split", terms: "2:3", total: 100 }))).toBe("40 : 60");
    expect(errs(run(nums, "ratio-calculator", { mode: "simplify", terms: "5" }))).toMatch(/at least 2/);
    expect(errs(run(nums, "ratio-calculator", { mode: "simplify", terms: "2:-3" }))).toMatch(/negative/);
    expect(errs(run(nums, "ratio-calculator", { mode: "simplify", terms: "0:0" }))).toMatch(/greater than zero/);
  });
  it("proportion", () => {
    expect(primary(run(nums, "proportion-calculator", { kind: "direct", a: 2, b: 3, c: 4 }))).toBe(6);
    expect(primary(run(nums, "proportion-calculator", { kind: "direct", a: undefined, b: 3, c: 4, d: 6 }))).toBe(2);
    expect(primary(run(nums, "proportion-calculator", { kind: "inverse", a: 6, b: 10, c: 12 }))).toBe(5);
    expect(errs(run(nums, "proportion-calculator", { kind: "direct", a: 1, b: 2, c: 3, d: 4 }))).toMatch(/exactly one/);
    expect(errs(run(nums, "proportion-calculator", { kind: "direct", a: 1 }))).toMatch(/three of the four/);
    expect(errs(run(nums, "proportion-calculator", { kind: "direct", a: 0, b: 3, c: 4 }))).toMatch(/can't be zero/);
  });
  it("average", () => {
    expect(primary(run(nums, "average-calculator", { numbers: "10 20 30" }))).toBe(20);
    const r = run(nums, "average-calculator", { numbers: "1,2,2,3,3" });
    expect(primary(r)).toBe(2.2);
    expect(sec(r, "Mode")).toBe("2, 3 (×2)");
    expect(sec(r, "Median")).toBe(2);
    expect(primary(run(nums, "average-calculator", { numbers: "0.1 0.2 0.3" }))).toBe(0.2);
    expect(sec(run(nums, "average-calculator", { numbers: "1 2 3 4" }), "Median")).toBe(2.5);
    expect(sec(run(nums, "average-calculator", { numbers: "5" }), "Range")).toBe(0);
    expect(sec(run(nums, "average-calculator", { numbers: "1 2 3" }), "Mode")).toMatch(/No mode/);
    expect(errs(run(nums, "average-calculator", { numbers: "1 2 x" }))).toMatch(/Couldn't read "x"/);
    expect(errs(run(nums, "average-calculator", { numbers: " " }))).toMatch(/at least 1/);
  });
  it("weighted average", () => {
    expect(primary(run(nums, "weighted-average-calculator", { rows: "80, 50\n90, 50" }))).toBe(85);
    expect(primary(run(nums, "weighted-average-calculator", { rows: "85 30\n90 20\n70 50" }))).toBe(78.5);
    expect(errs(run(nums, "weighted-average-calculator", { rows: "80, 0\n90, 0" }))).toMatch(/add up to zero/);
    expect(errs(run(nums, "weighted-average-calculator", { rows: "80, -5" }))).toMatch(/negative/);
    expect(errs(run(nums, "weighted-average-calculator", { rows: "80, 5, 3" }))).toMatch(/Line 1 needs exactly two/);
  });
  it("HCF and LCM", () => {
    const r = run(nums, "hcf-lcm-calculator", { numbers: "12 18 24" });
    expect(primary(r)).toBe("6");
    expect(sec(r, "LCM")).toBe("72");
    expect(sec(run(nums, "hcf-lcm-calculator", { numbers: "17 19" }), "LCM")).toBe("323");
    expect(out(run(nums, "hcf-lcm-calculator", { numbers: "17 19" })).notes?.[0]).toMatch(/co-prime/);
    expect(primary(run(nums, "hcf-lcm-calculator", { numbers: "48,18" }))).toBe("6");
    expect(out(r).table?.rows[0]).toEqual(["12", "2² × 3"]);
    expect(sec(run(nums, "hcf-lcm-calculator", { numbers: "999999999989 3" }), "LCM")).toBe("2,999,999,999,967");
    expect(errs(run(nums, "hcf-lcm-calculator", { numbers: "4.5 6" }))).toMatch(/whole number/);
    expect(errs(run(nums, "hcf-lcm-calculator", { numbers: "0 6" }))).toMatch(/greater than zero/);
    expect(errs(run(nums, "hcf-lcm-calculator", { numbers: "6" }))).toMatch(/at least 2/);
  });
  it("permutations and combinations", () => {
    const r = run(nums, "permutation-combination-calculator", { n: 5, r: 3 });
    expect(primary(r)).toBe("10");
    expect(sec(r, "Permutations (nPr)")).toBe("60");
    expect(sec(r, "Permutations with repetition (nʳ)")).toBe("125");
    expect(sec(r, "Combinations with repetition")).toBe("35");
    expect(primary(run(nums, "permutation-combination-calculator", { n: 52, r: 5 }))).toBe("2,598,960");
    expect(primary(run(nums, "permutation-combination-calculator", { n: 10, r: 0 }))).toBe("1");
    expect(primary(run(nums, "permutation-combination-calculator", { n: 0, r: 0 }))).toBe("1");
    expect(String(primary(run(nums, "permutation-combination-calculator", { n: 100, r: 50 })))).toContain("100,891,344,545,564,193,334,812,497,256");
    expect(out(run(nums, "permutation-combination-calculator", { n: 1000, r: 500 })).texts?.[0].value.length).toBe(300);
    expect(errs(run(nums, "permutation-combination-calculator", { n: 3, r: 5 }))).toMatch(/can't be larger/);
  });
  it("probability", () => {
    const single = run(nums, "probability-calculator", { mode: "single", favorable: 1, total: 6 });
    expect(primary(single)).toBeCloseTo(0.166667, 5);
    expect(sec(single, "Odds in favour")).toBe("1 : 5");
    expect(errs(run(nums, "probability-calculator", { mode: "single", favorable: 7, total: 6 }))).toMatch(/more than the total/);
    expect(errs(run(nums, "probability-calculator", { mode: "single", favorable: 0, total: 0 }))).toMatch(/at least 1/);
    const ind = run(nums, "probability-calculator", { mode: "two", pa: 50, pb: 50, relation: "independent" });
    expect(primary(ind)).toBe(75);
    expect(sec(ind, "P(A and B)")).toBe(25);
    expect(sec(ind, "P(neither)")).toBe(25);
    expect(sec(ind, "P(exactly one)")).toBe(50);
    expect(primary(run(nums, "probability-calculator", { mode: "two", pa: 30, pb: 20, relation: "exclusive" }))).toBe(50);
    expect(errs(run(nums, "probability-calculator", { mode: "two", pa: 70, pb: 40, relation: "exclusive" }))).toMatch(/more than 100%/);
    const bin = run(nums, "probability-calculator", { mode: "binomial", n: 10, k: 3, p: 50 });
    expect(primary(bin)).toBeCloseTo(0.1171875, 9);
    expect(sec(bin, "P(X ≤ k)")).toBeCloseTo(176 / 1024, 9);
    expect(sec(bin, "P(X ≥ k)")).toBeCloseTo(968 / 1024, 9);
    expect(sec(bin, "Expected successes (n × p)")).toBe(5);
    expect(primary(run(nums, "probability-calculator", { mode: "binomial", n: 5, k: 0, p: 0 }))).toBe(1);
    expect(primary(run(nums, "probability-calculator", { mode: "binomial", n: 5, k: 5, p: 100 }))).toBe(1);
    expect(primary(run(nums, "probability-calculator", { mode: "binomial", n: 1000, k: 500, p: 50 }))).toBeCloseTo(0.02522502, 7);
    expect(errs(run(nums, "probability-calculator", { mode: "binomial", n: 5, k: 6, p: 50 }))).toMatch(/can't be larger/);
  });
});

describe("commerce tools", () => {
  it("profit and loss", () => {
    const profit = run(com, "profit-loss-calculator", { mode: "prices", cp: 100, sp: 120, currency: "" });
    expect(label(profit)).toBe("Profit");
    expect(primary(profit)).toBe(20);
    expect(sec(profit, "Profit % (on cost price)")).toBe(20);
    expect(sec(profit, "Margin (on selling price)")).toBeCloseTo(16.6667, 4);
    const loss = run(com, "profit-loss-calculator", { mode: "prices", cp: 200, sp: 150, currency: "" });
    expect(label(loss)).toBe("Loss");
    expect(sec(loss, "Loss % (on cost price)")).toBe(25);
    expect(label(run(com, "profit-loss-calculator", { mode: "prices", cp: 50, sp: 50, currency: "" }))).toBe("No profit or loss");
    expect(errs(run(com, "profit-loss-calculator", { mode: "prices", cp: 0, sp: 5, currency: "" }))).toMatch(/Cost price/);
    expect(primary(run(com, "profit-loss-calculator", { mode: "sp-from-cp", cp2: 500, kind: "profit", pct: 12, currency: "" }))).toBe(560);
    expect(primary(run(com, "profit-loss-calculator", { mode: "sp-from-cp", cp2: 500, kind: "loss", pct: 10, currency: "" }))).toBe(450);
    expect(primary(run(com, "profit-loss-calculator", { mode: "cp-from-sp", sp2: 560, kind: "profit", pct: 12, currency: "" }))).toBe(500);
    expect(errs(run(com, "profit-loss-calculator", { mode: "cp-from-sp", sp2: 5, kind: "loss", pct: 100, currency: "" }))).toMatch(/100% loss/);
    expect(errs(run(com, "profit-loss-calculator", { mode: "sp-from-cp", cp2: 5, kind: "loss", pct: 120, currency: "" }))).toMatch(/more than 100%/);
  });
  it("discount", () => {
    const d = run(com, "discount-calculator", { mode: "price", price: 1000, d1: 20, currency: "" });
    expect(primary(d)).toBe(800);
    expect(sec(d, "You save")).toBe(200);
    const two = run(com, "discount-calculator", { mode: "price", price: 1000, d1: 20, d2: 10, currency: "" });
    expect(primary(two)).toBe(720);
    expect(sec(two, "Effective discount")).toBe(28);
    const taxed = run(com, "discount-calculator", { mode: "price", price: 1000, d1: 20, tax: 18, currency: "" });
    expect(label(taxed)).toBe("Total to pay");
    expect(primary(taxed)).toBe(944);
    expect(primary(run(com, "discount-calculator", { mode: "percent", original: 1000, sale: 800, currency: "" }))).toBe(20);
    expect(errs(run(com, "discount-calculator", { mode: "price", price: 10, d1: 120, currency: "" }))).toMatch(/more than 100%/);
    expect(primary(run(com, "discount-calculator", { mode: "price", price: 99.99, d1: 100, currency: "" }))).toBe(0);
  });
});

describe("motion tools", () => {
  const base = { distUnit: "km", timeUnit: "h" };
  it("speed, time, distance", () => {
    expect(primary(run(mot, "speed-time-distance-calculator", { ...base, solve: "distance", speed: 60, time: 2.5 }))).toBe(150);
    expect(primary(run(mot, "speed-time-distance-calculator", { ...base, solve: "speed", distance: 150, time: 2 }))).toBe(75);
    expect(primary(run(mot, "speed-time-distance-calculator", { ...base, solve: "time", distance: 150, speed: 60 }))).toBe(2.5);
    const r = run(mot, "speed-time-distance-calculator", { ...base, solve: "speed", distance: 100, time: 1 });
    expect(sec(r, "Speed in mph")).toBeCloseTo(62.1371, 4);
    expect(sec(r, "Speed in m/s")).toBeCloseTo(27.7778, 4);
    expect(sec(run(mot, "speed-time-distance-calculator", { ...base, solve: "time", distance: 150, speed: 60 }), "Time as h:mm:ss")).toBe("2:30:00");
    expect(primary(run(mot, "speed-time-distance-calculator", { distUnit: "m", timeUnit: "s", solve: "speed", distance: 100, time: 10 }))).toBe(10);
    expect(errs(run(mot, "speed-time-distance-calculator", { ...base, solve: "speed", distance: 1, time: 0 }))).toMatch(/Time can't be zero/);
    expect(errs(run(mot, "speed-time-distance-calculator", { ...base, solve: "time", distance: 1, speed: 0 }))).toMatch(/Speed can't be zero/);
  });
  it("time and work", () => {
    expect(primary(run(mot, "time-and-work-calculator", { mode: "together", a: 10, b: 15 }))).toBe(6);
    expect(primary(run(mot, "time-and-work-calculator", { mode: "together", a: 10, b: 15, c: 30 }))).toBe(5);
    expect(errs(run(mot, "time-and-work-calculator", { mode: "together", a: 10 }))).toMatch(/at least two/);
    expect(primary(run(mot, "time-and-work-calculator", { mode: "missing", t: 6, a2: 10 }))).toBe(15);
    expect(errs(run(mot, "time-and-work-calculator", { mode: "missing", t: 6, a2: 5 }))).toMatch(/longer than the whole team/);
    const partial = run(mot, "time-and-work-calculator", { mode: "partial", a3: 10, b3: 15, x: 2 });
    expect(primary(partial)).toBeCloseTo(6.8, 9);
    expect(sec(partial, "Work done by A before B joins")).toBe(20);
    expect(errs(run(mot, "time-and-work-calculator", { mode: "partial", a3: 10, b3: 15, x: 10 }))).toMatch(/already finish/);
  });
});
