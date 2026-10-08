import { describe, it, expect } from "vitest";
import { engines as ssc, SSC_TIER1_SCHEME } from "@/engines/exams/ssc";
import { errs, out, primary, run, sec } from "./util";

const cgl = (c: [number, number, number, number], w: [number, number, number, number]) =>
  run(ssc, "ssc-cgl-tier-1-score-calculator", { reasoning_c: c[0], reasoning_w: w[0], ga_c: c[1], ga_w: w[1], quant_c: c[2], quant_w: w[2], english_c: c[3], english_w: w[3] });

describe("SSC Tier-I score calculators (2 marks, −0.5, 4 × 25 questions)", () => {
  it("encodes the verified marking scheme", () => {
    expect(SSC_TIER1_SCHEME).toEqual({ questionsPerSection: 25, marksPerCorrect: 2, negativePerWrong: 0.5 });
  });
  it("computes raw scores", () => {
    const r = cgl([20, 15, 18, 22], [3, 5, 4, 2]);
    // correct 75 → 150 marks; wrong 14 → −7
    expect(primary(r)).toBe(143);
    expect(sec(r, "Out of")).toBe(200);
    expect(sec(r, "Marks lost to negative marking")).toBe(7);
    expect(sec(r, "Questions attempted")).toBe(89);
    expect(sec(r, "Accuracy (correct ÷ attempted)")).toBeCloseTo(84.27, 2);
    expect(out(r).table!.rows[0][4]).toMatchObject({ value: 38.5 });
  });
  it("handles boundaries", () => {
    expect(primary(cgl([25, 25, 25, 25], [0, 0, 0, 0]))).toBe(200);
    expect(primary(cgl([0, 0, 0, 0], [0, 0, 0, 0]))).toBe(0);
    expect(primary(cgl([0, 0, 0, 0], [25, 25, 25, 25]))).toBe(-50);
    expect(sec(cgl([0, 0, 0, 0], [0, 0, 0, 0]), "Accuracy (correct ÷ attempted)")).toBe("—");
    expect(primary(cgl([1, 0, 0, 0], [1, 0, 0, 0]))).toBe(1.5);
  });
  it("rejects impossible section totals and fractions", () => {
    expect(errs(cgl([20, 0, 0, 0], [6, 0, 0, 0]))).toMatch(/only 25 questions/);
    expect(errs(cgl([2.5, 0, 0, 0], [0, 0, 0, 0]))).toMatch(/whole number/);
  });
  it("CHSL shares the same Tier-I scheme with its own section names", () => {
    const r = run(ssc, "ssc-chsl-tier-1-score-calculator", { english_c: 20, english_w: 2, reasoning_c: 20, reasoning_w: 2, quant_c: 10, quant_w: 10, ga_c: 15, ga_w: 5 });
    expect(primary(r)).toBe(2 * 65 - 0.5 * 19);
    expect(out(r).table!.rows[0][0]).toBe("English Language");
  });
});
