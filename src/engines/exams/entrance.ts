import type { EngineMap, FieldError } from "@/tools/types";
import { N, P, T } from "@/lib/format";
import { clean } from "@/lib/numeric";
import { fail, failMany, num, ok, optNum, str } from "../helpers";
import { accuracyPct, f, net, percentileFromRank, r4 } from "./common";

// ---------------------------------------------------------------- JEE Main (Paper 1, B.E./B.Tech.)
export const JEE_MAIN_SUBJECTS = [{ id: "phy", label: "Physics" }, { id: "chem", label: "Chemistry" }, { id: "math", label: "Mathematics" }] as const;
export const JEE_MAIN_MCQ = 20; // Section A questions per subject
export const JEE_MAIN_NUM = 5; // Section B questions per subject

// ---------------------------------------------------------------- NEET UG
export const NEET_SUBJECTS = [{ id: "phy", label: "Physics" }, { id: "chem", label: "Chemistry" }, { id: "bot", label: "Botany" }, { id: "zoo", label: "Zoology" }] as const;
export const NEET_QUESTIONS_PER_SUBJECT = 45;

export const NEET_QUALIFYING: Record<string, { label: string; percentile: number }> = {
  "ur-ews": { label: "General (UR) / EWS", percentile: 50 },
  "ur-ews-pwbd": { label: "General (UR) / EWS — PwBD", percentile: 45 },
  "obc-sc-st": { label: "OBC / SC / ST (including their PwBD categories)", percentile: 40 },
};

export const engines: EngineMap = {
  "jee-main-marks-calculator": (v) => {
    const policy = str(v, "num_penalty"); // "both" | "0" | "1"
    const errors: FieldError[] = [];
    const rows = JEE_MAIN_SUBJECTS.map((s) => {
      const mc = num(v, `${s.id}_mcq_c`), mw = num(v, `${s.id}_mcq_w`), nc = num(v, `${s.id}_num_c`), nw = num(v, `${s.id}_num_w`);
      if (mc + mw > JEE_MAIN_MCQ) errors.push({ field: `${s.id}_mcq_w`, message: `${s.label}: correct plus wrong multiple-choice answers can't exceed ${JEE_MAIN_MCQ} (you entered ${mc + mw}).` });
      if (nc + nw > JEE_MAIN_NUM) errors.push({ field: `${s.id}_num_w`, message: `${s.label}: correct plus wrong numerical answers can't exceed ${JEE_MAIN_NUM} (you entered ${nc + nw}).` });
      return { ...s, mc, mw, nc, nw };
    });
    if (errors.length) return failMany(errors);

    const scenario = (numericalPenalty: number) => rows.map((r) => {
      const mcq = net(r.mc, r.mw, 4, 1);
      const numeric = net(r.nc, r.nw, 4, numericalPenalty);
      return { ...r, mcq, numeric, total: clean(mcq + numeric) };
    });
    const zero = scenario(0), minus = scenario(1);
    const sum = (xs: { total: number }[]) => clean(xs.reduce((a, x) => a + x.total, 0));
    const primaryRows = policy === "1" ? minus : zero;
    const total = sum(primaryRows);
    const correct = rows.reduce((a, r) => a + r.mc + r.nc, 0), wrong = rows.reduce((a, r) => a + r.mw + r.nw, 0);
    const acc = accuracyPct(correct, wrong);
    const primaryLabel = policy === "1" ? "Total marks (−1 per wrong numerical)" : "Total marks (no penalty on numericals)";
    const secondary = [
      ...(policy === "both" ? [{ label: "Total marks (−1 per wrong numerical)", value: N(sum(minus), "/ 300") }] : []),
      { label: "Percentage of 300", value: P(r4((total / 300) * 100), 2) },
      { label: "Questions attempted", value: N(correct + wrong, "of 75") },
      ...(acc === null ? [] : [{ label: "Accuracy", value: P(r4(acc), 1) }]),
    ];
    const steps = rows.map((r) => `${r.label}: ${r.mc} × 4 − ${r.mw} × 1 (multiple-choice) + ${r.nc} × 4${policy === "1" ? ` − ${r.nw} × 1` : ""} (numerical) = ${f(primaryRows.find((x) => x.id === r.id)!.total)}`);
    const notes = [
      "Marks are not a percentile or a rank. The NTA percentile depends on how every other candidate in your session performed — use the JEE Main percentile calculator if you know your rank in the session.",
      ...(policy === "both" ? ["Published summaries disagree about whether a wrong Section B (numerical) answer costs a mark, so both totals are shown. Your question paper's instructions are the authority."] : []),
    ];
    return ok({
      primary: { label: primaryLabel, value: N(total, "/ 300") },
      secondary,
      table: {
        caption: "Marks by subject",
        columns: policy === "both" ? ["Subject", "Section A (MCQ)", "Section B (numerical), no penalty", "Total", "Total with −1 numerical"] : ["Subject", "Section A (MCQ)", "Section B (numerical)", "Total"],
        rows: primaryRows.map((r, i) => policy === "both" ? [r.label, r.mcq, r.numeric, r.total, minus[i].total] : [r.label, r.mcq, r.numeric, r.total]),
      },
      steps,
      notes,
    });
  },

  "jee-advanced-marks-calculator": (v) => {
    const maxMarks = optNum(v, "max_marks"), cutoff = optNum(v, "cutoff");
    const scC = num(v, "sc_c"), scW = num(v, "sc_w"), scM = num(v, "sc_marks"), scN = num(v, "sc_neg");
    const mcFull = num(v, "mc_full"), p3 = num(v, "mc_p3"), p2 = num(v, "mc_p2"), p1 = num(v, "mc_p1"), mcW = num(v, "mc_w"), mcM = num(v, "mc_marks"), mcN = num(v, "mc_neg");
    const natC = num(v, "nat_c"), natW = num(v, "nat_w"), natM = num(v, "nat_marks"), natN = num(v, "nat_neg");
    const positive = clean(scC * scM + mcFull * mcM + p3 * 3 + p2 * 2 + p1 * 1 + natC * natM);
    const negative = clean(scW * scN + mcW * mcN + natW * natN);
    const total = clean(positive - negative);
    if (maxMarks !== undefined && maxMarks <= 0) return fail("Maximum marks must be greater than zero.", "max_marks");
    const attempted = scC + scW + mcFull + p3 + p2 + p1 + mcW + natC + natW;
    const correctish = scC + mcFull + p3 + p2 + p1 + natC;
    const secondary = [
      { label: "Marks gained", value: N(positive) },
      { label: "Marks lost", value: N(negative) },
      { label: "Questions attempted", value: N(attempted) },
      ...(attempted ? [{ label: "Fully or partly correct", value: P(r4((correctish / attempted) * 100), 1) }] : []),
      ...(maxMarks !== undefined ? [{ label: `Percentage of ${f(maxMarks)}`, value: P(r4((total / maxMarks) * 100), 2) }] : []),
      ...(cutoff !== undefined ? [{ label: "Compared with the cut-off you entered", value: T(total >= cutoff ? `${f(clean(total - cutoff))} above` : `${f(clean(cutoff - total))} below`) }] : []),
    ];
    const steps = [
      `Single-correct: ${scC} × ${f(scM)} − ${scW} × ${f(scN)} = ${f(net(scC, scW, scM, scN))}`,
      `Multiple-correct: ${mcFull} × ${f(mcM)} + partial (${p3} × 3 + ${p2} × 2 + ${p1} × 1) − ${mcW} × ${f(mcN)} = ${f(clean(mcFull * mcM + p3 * 3 + p2 * 2 + p1 - mcW * mcN))}`,
      `Numerical: ${natC} × ${f(natM)} − ${natW} × ${f(natN)} = ${f(net(natC, natW, natM, natN))}`,
    ];
    return ok({
      primary: { label: "Total marks", value: N(total) },
      secondary,
      steps,
      notes: [
        "JEE Advanced's pattern and marks are set by the organising IIT each year and printed in the paper's instructions. The marks per question type here are editable for that reason.",
        "A negative total is possible. This tool does not estimate a rank: ranks depend on every candidate's marks and on the year's cut-offs.",
      ],
    });
  },

  "neet-ug-marks-calculator": (v) => {
    const cutoff = optNum(v, "cutoff");
    const errors: FieldError[] = [];
    const rows = NEET_SUBJECTS.map((s) => {
      const c = num(v, `${s.id}_c`), w = num(v, `${s.id}_w`);
      if (c + w > NEET_QUESTIONS_PER_SUBJECT) errors.push({ field: `${s.id}_w`, message: `${s.label}: correct plus wrong answers can't exceed ${NEET_QUESTIONS_PER_SUBJECT} (you entered ${c + w}).` });
      return { ...s, c, w, marks: net(c, w, 4, 1) };
    });
    if (errors.length) return failMany(errors);
    const total = clean(rows.reduce((a, r) => a + r.marks, 0));
    const c = rows.reduce((a, r) => a + r.c, 0), w = rows.reduce((a, r) => a + r.w, 0);
    const acc = accuracyPct(c, w);
    return ok({
      primary: { label: "Total marks", value: N(total, "/ 720") },
      secondary: [
        { label: "Percentage of 720", value: P(r4((total / 720) * 100), 2) },
        { label: "Marks gained", value: N(c * 4) },
        { label: "Marks lost to wrong answers", value: N(w) },
        { label: "Questions attempted", value: N(c + w, "of 180") },
        ...(acc === null ? [] : [{ label: "Accuracy", value: P(r4(acc), 1) }]),
        ...(cutoff !== undefined ? [{ label: "Compared with the cut-off you entered", value: T(total >= cutoff ? `${f(clean(total - cutoff))} above` : `${f(clean(cutoff - total))} below`) }] : []),
      ],
      table: { caption: "Marks by subject", columns: ["Subject", "Correct", "Wrong", "Marks"], rows: rows.map((r) => [r.label, r.c, r.w, r.marks]) },
      steps: [`Total = 4 × ${c} correct − 1 × ${w} wrong = ${f(total)}`, ...rows.map((r) => `${r.label}: 4 × ${r.c} − ${r.w} = ${f(r.marks)}`)],
      notes: ["Marks are not a percentile, rank or qualifying status. Use the NEET qualifying checker to compare against the percentile rule."],
    });
  },

  "neet-qualifying-cutoff-checker": (v) => {
    const cat = NEET_QUALIFYING[str(v, "category")];
    if (!cat) return fail("Choose your category.", "category");
    const marks = optNum(v, "marks"), cutoff = optNum(v, "cutoff_marks"), rank = optNum(v, "rank"), appeared = optNum(v, "appeared");
    if ((rank === undefined) !== (appeared === undefined)) return fail("Enter both your all-India rank and the number of candidates who appeared, or leave both empty.", rank === undefined ? "rank" : "appeared");
    if (rank !== undefined && appeared !== undefined && rank > appeared) return fail("Your rank can't be larger than the number of candidates who appeared.", "rank");
    const marksCheck = marks !== undefined && cutoff !== undefined ? marks >= cutoff : undefined;
    const percentile = rank !== undefined && appeared !== undefined ? percentileFromRank(rank, appeared) : undefined;
    const pctCheck = percentile !== undefined ? percentile >= cat.percentile : undefined;
    if (marksCheck === undefined && pctCheck === undefined) return fail("Enter your marks together with the official qualifying marks for your category, or your rank together with the number of candidates who appeared (or both).", "marks");
    const checks = [marksCheck, pctCheck].filter((x): x is boolean => x !== undefined);
    const verdict = checks.every(Boolean) ? "Meets the qualifying criterion" : checks.some(Boolean) ? "The two checks disagree — see below" : "Below the qualifying criterion";
    return ok({
      primary: { label: "Qualifying status", value: T(verdict) },
      secondary: [
        { label: "Qualifying percentile for your category", value: T(`${cat.percentile}th percentile`) },
        ...(marksCheck !== undefined ? [{ label: "Marks check", value: T(`${f(marks!)} vs cut-off ${f(cutoff!)} → ${marksCheck ? "at or above" : "below"}`) }] : []),
        ...(percentile !== undefined ? [{ label: "Your percentile (from rank)", value: P(Math.round(percentile * 1e7) / 1e7, 7) }] : []),
        ...(pctCheck !== undefined ? [{ label: "Percentile check", value: T(pctCheck ? `at or above the ${cat.percentile}th` : `below the ${cat.percentile}th`) }] : []),
      ],
      steps: [
        `Category: ${cat.label} → qualifying percentile ${cat.percentile}`,
        ...(percentile !== undefined ? [`Percentile = 100 × (${f(appeared!)} − ${f(rank!)} + 1) ÷ ${f(appeared!)} = ${f(percentile)}`] : []),
      ],
      notes: [
        "The qualifying cut-off marks change every year and are published by the NTA with the result. This tool does not know them — enter the figure from your result notice.",
        "Qualifying NEET is not the same as getting a seat: admission depends on counselling rank, seats and state or institute rules.",
      ],
    });
  },
};
