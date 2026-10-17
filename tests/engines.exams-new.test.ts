import { describe, it, expect } from "vitest";
import { engines as entrance } from "@/engines/exams/entrance";
import { engines as gate } from "@/engines/exams/gate";
import { engines as management } from "@/engines/exams/management";
import { engines as percentile } from "@/engines/exams/percentile";
import { engines as gov } from "@/engines/exams/government";
import { engines as planner } from "@/engines/exams/planner";
import { errs, out, primary, run, sec } from "./util";

const jee = (v: Partial<Record<string, string | number>> = {}) => run(entrance, "jee-main-marks-calculator", { phy_mcq_c: 14, phy_mcq_w: 4, phy_num_c: 3, phy_num_w: 1, chem_mcq_c: 15, chem_mcq_w: 3, chem_num_c: 2, chem_num_w: 2, math_mcq_c: 12, math_mcq_w: 5, math_num_c: 3, math_num_w: 1, num_penalty: "both", ...v });

describe("JEE Main marks (+4 / −1 MCQ; Section B penalty is shown both ways)", () => {
  it("computes both totals by hand", () => {
    // MCQ: 14×4−4=52, 15×4−3=57, 12×4−5=43 → 152. Numerical with no penalty: 12+8+12 = 32 → 184. With −1: 11+6+11 = 28 → 180.
    const r = jee();
    expect(primary(r)).toBe(184);
    expect(sec(r, "Total marks (−1 per wrong numerical)")).toBe(180);
    expect(sec(r, "Percentage of 300")).toBeCloseTo((184 / 300) * 100, 3);
  });
  it("respects a chosen penalty rule", () => {
    expect(primary(jee({ num_penalty: "1" }))).toBe(180);
    expect(primary(jee({ num_penalty: "0" }))).toBe(184);
  });
  it("handles the extremes", () => {
    const perfect = jee({ phy_mcq_c: 20, phy_mcq_w: 0, phy_num_c: 5, phy_num_w: 0, chem_mcq_c: 20, chem_mcq_w: 0, chem_num_c: 5, chem_num_w: 0, math_mcq_c: 20, math_mcq_w: 0, math_num_c: 5, math_num_w: 0 });
    expect(primary(perfect)).toBe(300);
    const worst = jee({ phy_mcq_c: 0, phy_mcq_w: 20, phy_num_c: 0, phy_num_w: 5, chem_mcq_c: 0, chem_mcq_w: 20, chem_num_c: 0, chem_num_w: 5, math_mcq_c: 0, math_mcq_w: 20, math_num_c: 0, math_num_w: 5, num_penalty: "1" });
    expect(primary(worst)).toBe(-75);
  });
  it("rejects more answers than questions", () => {
    expect(errs(jee({ phy_mcq_c: 18, phy_mcq_w: 3 }))).toMatch(/can't exceed 20/);
    expect(errs(jee({ chem_num_c: 4, chem_num_w: 2 }))).toMatch(/can't exceed 5/);
  });
});

describe("JEE Advanced marks (editable scheme with partial marking)", () => {
  const base = { sc_c: 6, sc_w: 2, sc_marks: 3, sc_neg: 1, mc_full: 3, mc_p3: 1, mc_p2: 1, mc_p1: 0, mc_w: 2, mc_marks: 4, mc_neg: 2, nat_c: 4, nat_w: 1, nat_marks: 4, nat_neg: 0 };
  it("adds partial marks as one mark per correct option chosen", () => {
    // single: 6×3−2 = 16; multiple: 3×4 + 3 + 2 − 2×2 = 13; numerical: 4×4 = 16 → 45
    expect(primary(run(entrance, "jee-advanced-marks-calculator", base))).toBe(45);
  });
  it("uses edited marks and shows percentage and cut-off margin", () => {
    const r = run(entrance, "jee-advanced-marks-calculator", { ...base, nat_neg: 1, max_marks: 180, cutoff: 40 });
    expect(primary(r)).toBe(44); // numerical wrong now costs 1
    expect(sec(r, "Percentage of 180")).toBeCloseTo((44 / 180) * 100, 3);
    expect(sec(r, "Compared with the cut-off you entered")).toBe("4 above");
  });
});

describe("NEET UG marks (+4 / −1, 180 questions, 720 marks)", () => {
  const v = { phy_c: 30, phy_w: 10, chem_c: 35, chem_w: 8, bot_c: 38, bot_w: 5, zoo_c: 36, zoo_w: 6 };
  it("totals by hand", () => {
    // 110 + 132 + 147 + 138 = 527
    const r = run(entrance, "neet-ug-marks-calculator", v);
    expect(primary(r)).toBe(527);
    expect(sec(r, "Marks lost to wrong answers")).toBe(29);
    expect(sec(r, "Questions attempted")).toBe(168); // 139 correct + 29 wrong
  });
  it("hits the maximum and minimum", () => {
    expect(primary(run(entrance, "neet-ug-marks-calculator", { phy_c: 45, phy_w: 0, chem_c: 45, chem_w: 0, bot_c: 45, bot_w: 0, zoo_c: 45, zoo_w: 0 }))).toBe(720);
    expect(primary(run(entrance, "neet-ug-marks-calculator", { phy_c: 0, phy_w: 45, chem_c: 0, chem_w: 45, bot_c: 0, bot_w: 45, zoo_c: 0, zoo_w: 45 }))).toBe(-180);
  });
  it("validates per-subject totals", () => {
    expect(errs(run(entrance, "neet-ug-marks-calculator", { ...v, phy_c: 40, phy_w: 6 }))).toMatch(/can't exceed 45/);
  });
});

describe("NEET qualifying checker", () => {
  const check = (v: Record<string, string | number>) => run(entrance, "neet-qualifying-cutoff-checker", v);
  it("compares marks with the official cut-off", () => {
    expect(primary(check({ category: "ur-ews", marks: 412, cutoff_marks: 400 }))).toBe("Meets the qualifying criterion");
    expect(primary(check({ category: "ur-ews", marks: 399, cutoff_marks: 400 }))).toBe("Below the qualifying criterion");
    expect(primary(check({ category: "ur-ews", marks: 400, cutoff_marks: 400 }))).toBe("Meets the qualifying criterion");
  });
  it("computes the percentile from rank with the right threshold per category", () => {
    // 100 × (2,000,000 − 600,000 + 1) ÷ 2,000,000 = 70.00005 → clears the 40th
    expect(primary(check({ category: "obc-sc-st", rank: 600000, appeared: 2000000 }))).toBe("Meets the qualifying criterion");
    // rank 1,200,000 → 40.00005: clears 40 (OBC) but not 50 (general)
    expect(primary(check({ category: "obc-sc-st", rank: 1200000, appeared: 2000000 }))).toBe("Meets the qualifying criterion");
    expect(primary(check({ category: "ur-ews", rank: 1200000, appeared: 2000000 }))).toBe("Below the qualifying criterion");
    expect(primary(check({ category: "ur-ews-pwbd", rank: 1100000, appeared: 2000000 }))).toBe("Meets the qualifying criterion"); // 45.00005
  });
  it("reports when the two checks disagree", () => {
    expect(primary(check({ category: "ur-ews", marks: 450, cutoff_marks: 400, rank: 1200000, appeared: 2000000 }))).toMatch(/disagree/);
  });
  it("needs enough information and sensible values", () => {
    expect(errs(check({ category: "ur-ews", marks: 400 }))).toMatch(/Enter your marks together with/);
    expect(errs(check({ category: "ur-ews", rank: 5 }))).toMatch(/both your all-India rank/);
    expect(errs(check({ category: "ur-ews", rank: 50, appeared: 10 }))).toMatch(/can't be larger/);
  });
});

describe("GATE marks (MCQ ⅓ and ⅔ penalties, none for MSQ/NAT)", () => {
  const marks = (v: Record<string, number>) => run(gate, "gate-marks-calculator", v);
  it("computes by hand", () => {
    // gained 12 + 2×15 + 6 + 2×5 = 58; lost 4/3 + 6×2/3 = 5.3333 → 52.6667
    const r = marks({ mcq1_c: 12, mcq1_w: 4, mcq2_c: 15, mcq2_w: 6, nat1_c: 6, nat2_c: 5 });
    expect(primary(r) as number).toBeCloseTo(52.6667, 3);
    expect(sec(r, "Marks gained")).toBe(58);
    expect(sec(r, "Marks lost to wrong MCQs") as number).toBeCloseTo(5.3333, 3);
  });
  it("gives 100 for a perfect paper and rejects over-counting", () => {
    expect(primary(marks({ mcq1_c: 0, mcq1_w: 0, mcq2_c: 0, mcq2_w: 0, nat1_c: 0, nat2_c: 50 }))).toBe(100);
    expect(errs(marks({ mcq1_c: 0, mcq1_w: 0, mcq2_c: 0, mcq2_w: 0, nat1_c: 101, nat2_c: 0 }))).toMatch(/out of 100/);
  });
  it("a wrong 2-mark MCQ costs two thirds, a wrong 1-mark MCQ one third", () => {
    expect(primary(marks({ mcq1_c: 0, mcq1_w: 3, mcq2_c: 0, mcq2_w: 0, nat1_c: 0, nat2_c: 0 }))).toBe(-1);
    expect(primary(marks({ mcq1_c: 0, mcq1_w: 0, mcq2_c: 0, mcq2_w: 3, nat1_c: 0, nat2_c: 0 }))).toBe(-2);
  });
});

describe("GATE score: S = Sq + (St − Sq)(M − Mq)/(Mt − Mq), Sq = 350, St = 900", () => {
  const score = (marks: number, mq: number, mt: number) => run(gate, "gate-score-calculator", { marks, mq, mt });
  it("maps the anchor points exactly", () => {
    expect(primary(score(25, 25, 82))).toBe(350);
    expect(primary(score(82, 25, 82))).toBe(900);
    expect(primary(score(53.5, 25, 82))).toBe(625); // halfway between Mq and Mt
  });
  it("matches a hand calculation", () => {
    // 350 + 550 × (62.33 − 25) ÷ (82 − 25) = 350 + 550 × 0.654912 = 710.20
    expect(primary(score(62.33, 25, 82)) as number).toBeCloseTo(710.2, 1);
  });
  it("caps at 1000 and shows the uncapped value; flags marks below the qualifying marks", () => {
    const high = score(100, 25, 82);
    expect(primary(high)).toBe(1000);
    expect(sec(high, "Uncapped formula value") as number).toBeCloseTo(1073.68, 1);
    expect(sec(score(20, 25, 82), "Status against the qualifying marks")).toMatch(/Below the qualifying marks/);
  });
  it("refuses a degenerate Mt ≤ Mq", () => {
    expect(errs(score(60, 50, 50))).toMatch(/must be higher than the qualifying marks/);
    expect(errs(score(60, 60, 40))).toMatch(/must be higher/);
  });
});

describe("CAT raw score (+3, −1 MCQ, no TITA penalty, 204 marks)", () => {
  const cat = (v: Record<string, number>) => run(management, "cat-score-calculator", { varc_mcq_c: 0, varc_mcq_w: 0, varc_tita_c: 0, dilr_mcq_c: 0, dilr_mcq_w: 0, dilr_tita_c: 0, qa_mcq_c: 0, qa_mcq_w: 0, qa_tita_c: 0, ...v });
  it("computes by hand", () => {
    // VARC 3×16 − 3 = 45; DILR 3×12 − 2 = 34; QA 3×14 − 3 = 39 → 118
    const r = cat({ varc_mcq_c: 14, varc_mcq_w: 3, varc_tita_c: 2, dilr_mcq_c: 9, dilr_mcq_w: 2, dilr_tita_c: 3, qa_mcq_c: 10, qa_mcq_w: 3, qa_tita_c: 4 });
    expect(primary(r)).toBe(118);
    expect(out(r).table!.rows.map((x) => x[4])).toEqual([45, 34, 39]);
  });
  it("maximum is 204; section limits are enforced", () => {
    expect(primary(cat({ varc_mcq_c: 24, dilr_mcq_c: 22, qa_mcq_c: 22 }))).toBe(204);
    expect(errs(cat({ varc_mcq_c: 20, varc_mcq_w: 3, varc_tita_c: 2 }))).toMatch(/can't exceed 24/);
    expect(errs(cat({ qa_mcq_c: 20, qa_tita_c: 3 }))).toMatch(/can't exceed 22/);
  });
  it("wrong MCQs cost one mark each", () => {
    expect(primary(cat({ qa_mcq_w: 5 }))).toBe(-5);
  });
});

describe("Percentile calculators (NTA / standard definition)", () => {
  const jee = (v: Record<string, string | number>) => run(percentile, "jee-main-percentile-calculator", v);
  it("rank → percentile = 100 × (N − rank + 1) ÷ N", () => {
    // 100 × (100000 − 1000 + 1) ÷ 100000 = 100 × 99001 ÷ 100000 = 99.001
    expect(primary(jee({ mode: "rank", candidates: 100000, rank: 1000 }))).toBe(99.001);
    expect(primary(jee({ mode: "rank", candidates: 1000, rank: 1 }))).toBe(100);
    expect(primary(jee({ mode: "rank", candidates: 1000, rank: 1000 }))).toBe(0.1);
  });
  it("count → percentile = 100 × k ÷ N", () => {
    expect(primary(jee({ mode: "count", candidates: 100000, below: 99000 }))).toBe(99);
    expect(primary(jee({ mode: "count", candidates: 8, below: 6 }))).toBe(75);
  });
  it("percentile → rank inverts the above", () => {
    expect(primary(jee({ mode: "percentile", candidates: 100000, percentile: 99 }))).toBe(1001);
    expect(primary(jee({ mode: "percentile", candidates: 1000, percentile: 100 }))).toBe(1);
  });
  it("reports to seven decimals for JEE Main and two for CAT", () => {
    expect(primary(jee({ mode: "rank", candidates: 123456, rank: 777 }))).toBe(Math.round(((100 * (123456 - 777 + 1)) / 123456) * 1e7) / 1e7);
    expect(primary(run(percentile, "cat-percentile-calculator", { mode: "rank", candidates: 300000, rank: 3000 }))).toBe(99);
    expect(primary(run(percentile, "cat-percentile-calculator", { mode: "rank", candidates: 300000, rank: 7777 }))).toBe(97.41);
  });
  it("validates inputs", () => {
    expect(errs(jee({ mode: "rank", candidates: 100, rank: 101 }))).toMatch(/can't be larger/);
    expect(errs(jee({ mode: "count", candidates: 100, below: 101 }))).toMatch(/can't be larger/);
    expect(errs(jee({ mode: "percentile", candidates: 100, percentile: 101 }))).toMatch(/between 0 and 100/);
    expect(errs(jee({ mode: "rank", candidates: 0.5, rank: 1 }))).toMatch(/whole number/);
  });
});

describe("SSC MTS (Session I: no penalty; Session II: −1; 3 marks each)", () => {
  const mts = (v: Record<string, number>) => run(gov, "ssc-mts-score-calculator", { math_c: 0, reason_c: 0, ga_c: 0, ga_w: 0, eng_c: 0, eng_w: 0, ...v });
  it("computes by hand", () => {
    // Session I: 3 × (15 + 17) = 96. Session II: (54 − 5) + (60 − 3) = 106. Total 202.
    const r = mts({ math_c: 15, reason_c: 17, ga_c: 18, ga_w: 5, eng_c: 20, eng_w: 3 });
    expect(primary(r)).toBe(202);
    expect(sec(r, "Session I (no negative marking)")).toBe(96);
    expect(sec(r, "Session II (−1 per wrong answer)")).toBe(106);
  });
  it("maximum 270; limits per section", () => {
    expect(primary(mts({ math_c: 20, reason_c: 20, ga_c: 25, eng_c: 25 }))).toBe(270);
    expect(errs(mts({ ga_c: 20, ga_w: 6 }))).toMatch(/can't exceed 25/);
    expect(errs(mts({ math_c: 21 }))).toMatch(/can't exceed 20/);
  });
});

describe("Banking prelims (¼ penalty)", () => {
  const bank = (v: Record<string, number>) => run(gov, "banking-prelims-score-calculator", { eng_c: 0, eng_w: 0, quant_c: 0, quant_w: 0, reason_c: 0, reason_w: 0, marks_per_q: 1, penalty: 0.25, ...v });
  it("computes by hand", () => {
    // correct 22+20+24 = 66; wrong 4+6+5 = 15 → 66 − 3.75 = 62.25
    expect(primary(bank({ eng_c: 22, eng_w: 4, quant_c: 20, quant_w: 6, reason_c: 24, reason_w: 5 }))).toBe(62.25);
  });
  it("supports other mark values and penalties and checks bounds", () => {
    expect(primary(bank({ eng_c: 10, marks_per_q: 2, penalty: 0.5, quant_w: 4 }))).toBe(20 - 4);
    expect(errs(bank({ eng_c: 31 }))).toMatch(/can't exceed 30/);
    expect(errs(bank({ penalty: 1.5 }))).toMatch(/between 0 and 1/);
    expect(errs(bank({ marks_per_q: 0 as never }))).toMatch(/greater than zero/);
  });
});

describe("UPSC Prelims (GS 2 marks, CSAT 2.5; ⅓ penalty; CSAT qualifying 33% = 66)", () => {
  const upsc = (v: Record<string, string | number>) => run(gov, "upsc-prelims-score-calculator", { paper: "both", gs_c: 0, gs_w: 0, csat_c: 0, csat_w: 0, ...v });
  it("computes both papers by hand", () => {
    // GS: 62×2 − 20×2/3 = 124 − 13.3333 = 110.6667. CSAT: 50×2.5 − 10×2.5/3 = 125 − 8.3333 = 116.6667
    const r = upsc({ gs_c: 62, gs_w: 20, csat_c: 50, csat_w: 10 });
    expect(primary(r) as number).toBeCloseTo(110.6667, 3);
    expect(sec(r, "CSAT (Paper II) score") as number).toBeCloseTo(116.6667, 3);
    expect(sec(r, "CSAT qualifying (33% = 66 marks)")).toMatch(/Meets 66/);
  });
  it("CSAT threshold is 66", () => {
    expect(sec(upsc({ csat_c: 26 }), "CSAT qualifying (33% = 66 marks)")).toMatch(/Below 66 marks \(short by 1\)/); // 65
    expect(sec(upsc({ csat_c: 27 }), "CSAT qualifying (33% = 66 marks)")).toMatch(/Meets 66/); // 67.5
  });
  it("handles one paper only and limits", () => {
    expect(primary(upsc({ paper: "csat", csat_c: 80 }))).toBe(200);
    expect(primary(upsc({ paper: "gs", gs_c: 100 }))).toBe(200);
    expect(errs(upsc({ gs_c: 90, gs_w: 11 }))).toMatch(/100 questions/);
    expect(errs(upsc({ csat_c: 70, csat_w: 11 }))).toMatch(/80 questions/);
  });
});

describe("RRB NTPC and Group D (1 mark, ⅓ penalty)", () => {
  const rrb = (v: Record<string, string | number>) => run(gov, "rrb-ntpc-group-d-score-calculator", v);
  it("computes by hand", () => {
    expect(primary(rrb({ exam: "ntpc-cbt1", correct: 70, wrong: 18 }))).toBe(64);
    expect(primary(rrb({ exam: "group-d", correct: 0, wrong: 3 }))).toBe(-1);
  });
  it("question counts differ by stage", () => {
    expect(primary(rrb({ exam: "ntpc-cbt2", correct: 120, wrong: 0 }))).toBe(120);
    expect(errs(rrb({ exam: "ntpc-cbt1", correct: 100, wrong: 1 }))).toMatch(/100 questions/);
    expect(errs(rrb({ exam: "bogus", correct: 1, wrong: 0 }))).toMatch(/Choose/);
  });
});

describe("Target score planner (c·m − (a − c)·p ≥ T)", () => {
  const plan = (v: Record<string, number>) => run(planner, "target-score-planner", v);
  it("finds the minimum correct answers", () => {
    // (150 + 100 × 0.5) ÷ 2.5 = 80
    const r = plan({ target: 150, attempts: 100, marks_correct: 2, penalty: 0.5 });
    expect(primary(r)).toBe(80);
    expect(sec(r, "Accuracy needed")).toBe(80);
    expect(sec(r, "Wrong answers you can afford")).toBe(20);
    expect(sec(r, "Guessing breaks even at")).toBe(20);
  });
  it("rounds up and the answer really reaches the target", () => {
    for (const [t, a, m, p] of [[90, 100, 1, 0.25], [66, 80, 2.5, 0.8333], [37, 50, 1, 0], [10, 30, 4, 1]] as const) {
      const c = primary(plan({ target: t, attempts: a, marks_correct: m, penalty: p })) as number;
      expect(c * m - (a - c) * p).toBeGreaterThanOrEqual(t - 1e-9);
      if (c > 0) expect((c - 1) * m - (a - c + 1) * p).toBeLessThan(t); // and one fewer would not
    }
  });
  it("refuses unreachable targets", () => {
    expect(errs(plan({ target: 201, attempts: 100, marks_correct: 2, penalty: 0.5 }))).toMatch(/out of reach/);
  });
});

describe("Mock-test tracker", () => {
  const track = (tests: string) => run(planner, "mock-test-tracker", { tests });
  const four = "Mock 1, 98, 200\nMock 2, 112, 200\nMock 3, 120, 200\nMock 4, 131, 200";
  it("averages percentages and finds the trend", () => {
    // 49, 56, 60, 65.5 → mean 57.625; least-squares slope = 26.75 ÷ 5 = 5.35 points per test
    const r = track(four);
    expect(primary(r)).toBe(57.625);
    expect(sec(r, "Trend across tests")).toBe("+5.35 percentage points per test");
    expect(sec(r, "Best")).toBe("Mock 4 — 65.5%");
    expect(sec(r, "Lowest")).toBe("Mock 1 — 49%");
  });
  it("compares tests with different maximum marks by percentage", () => {
    expect(primary(track("A, 50, 100\nB, 30, 60"))).toBe(50);
  });
  it("accepts a name containing commas and a single test", () => {
    expect(primary(track("Mock, set 1, 60, 100"))).toBe(60);
  });
  it("rejects malformed lines with the line number", () => {
    expect(errs(track("Mock 1, 98"))).toMatch(/Line 1 needs a name/);
    expect(errs(track("Mock 1, 98, 200\nMock 2, 250, 200"))).toMatch(/Line 2: the score \(250\) is higher/);
    expect(errs(track("Mock 1, abc, 200"))).toMatch(/Line 1/);
    expect(errs(track("   "))).toMatch(/at least one mock test/);
  });
});
